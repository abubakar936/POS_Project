import 'dotenv/config';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppDataSource } from '../database/data-source';
import { Product } from '../products/product.entity';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const IMAGE_TYPES = new Map([
  ['image/jpeg', { extension: 'jpg', signature: (bytes: Buffer) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ['image/png', { extension: 'png', signature: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ['image/gif', { extension: 'gif', signature: (bytes: Buffer) => ['GIF87a', 'GIF89a'].some((signature) => bytes.subarray(0, 6).toString('ascii') === signature) }],
  ['image/webp', { extension: 'webp', signature: (bytes: Buffer) => bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP' }],
]);

interface ResolvedAddress {
  address: string;
  family: number;
}

function ipv4IsPublic(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first = 0, second = 0, third = 0] = parts;
  return !(
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 198 && (second === 18 || second === 19 || second === 51)) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function ipv6IsPublic(address: string): boolean {
  const lower = address.toLowerCase().split('%')[0] ?? '';
  const pieces = lower.split('::');
  if (pieces.length > 2) return false;
  const left = pieces[0] ? pieces[0].split(':') : [];
  const right = pieces.length === 2 && pieces[1] ? pieces[1].split(':') : [];
  const expanded = [...left];
  if (pieces.length === 2) {
    expanded.push(...Array(8 - left.length - right.length).fill('0'));
  }
  expanded.push(...right);
  if (expanded.length !== 8) return false;
  const words = expanded.map((word) => Number.parseInt(word || '0', 16));
  if (words.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffff)) return false;
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    return ipv4IsPublic(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
  }
  const first = words[0] ?? 0;
  const second = words[1] ?? 0;
  return (
    first >= 0x2000 &&
    first <= 0x3fff &&
    !(first === 0x2001 && second === 0x0000) &&
    !(first === 0x2001 && second === 0x0db8) &&
    first !== 0x2002
  );
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4
    ? ipv4IsPublic(address)
    : family === 6 && ipv6IsPublic(address);
}

async function resolvePublicAddress(url: URL): Promise<ResolvedAddress> {
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Only credential-free HTTPS image URLs are allowed for download');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Image host does not resolve exclusively to public IP addresses');
  }
  const address = addresses[0];
  if (!address) throw new Error('Image host has no usable IP address');
  return address;
}

async function fetchImage(
  input: URL,
  redirectsRemaining = MAX_REDIRECTS,
): Promise<{ bytes: Buffer; extension: string }> {
  const address = await resolvePublicAddress(input);
  const response = await new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: Buffer }>((resolveResponse, reject) => {
    const request = httpsRequest(
      {
        protocol: input.protocol,
        hostname: input.hostname.replace(/^\[|\]$/g, ''),
        port: input.port || undefined,
        path: `${input.pathname}${input.search}`,
        method: 'GET',
        headers: { Accept: [...IMAGE_TYPES.keys()].join(', ') },
        servername: input.hostname.replace(/^\[|\]$/g, ''),
        lookup: (_hostname, _options, callback) => {
          callback(null, address.address, address.family);
        },
      },
      (res) => {
        res.on('error', reject);
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolveResponse({ status: res.statusCode, headers: res.headers, body: Buffer.alloc(0) });
          return;
        }
        const declaredLength = Number(res.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
          res.destroy(new Error(`Image exceeds the ${MAX_IMAGE_BYTES}-byte download limit`));
          return;
        }
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_IMAGE_BYTES) {
            res.destroy(new Error(`Image exceeds the ${MAX_IMAGE_BYTES}-byte download limit`));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          resolveResponse({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    request.setTimeout(10_000, () => request.destroy(new Error('Image request timed out')));
    request.on('error', reject);
    request.end();
  });

  if (response.status >= 300 && response.status < 400) {
    if (redirectsRemaining <= 0) throw new Error('Image URL redirected too many times');
    const location = response.headers.location;
    if (!location) throw new Error('Image redirect did not include a destination');
    return fetchImage(new URL(location, input), redirectsRemaining - 1);
  }
  if (response.status !== 200) throw new Error(`Image server returned HTTP ${response.status}`);

  const contentType = response.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
  const imageType = contentType ? IMAGE_TYPES.get(contentType) : undefined;
  if (!imageType || !imageType.signature(response.body)) {
    throw new Error('Response is not a supported JPEG, PNG, GIF, or WebP image');
  }
  return { bytes: response.body, extension: imageType.extension };
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  if (args.some((arg) => !['--apply', '--dry-run'].includes(arg))) {
    throw new Error('Supported options are --dry-run and --apply');
  }
  await AppDataSource.initialize();
  try {
    const repo = AppDataSource.getRepository(Product);
    const products = await repo
      .createQueryBuilder('product')
      .where('product.deletedAt IS NULL')
      .andWhere('product.imageUrl IS NOT NULL')
      .andWhere("product.imageUrl <> ''")
      .orderBy('product.createdAt', 'ASC')
      .getMany();
    const pending = products.filter((product) => !product.imagePath);
    const result = {
      mode: apply ? 'apply' : 'dry-run',
      candidates: pending.length,
      downloaded: 0,
      skipped: products.length - pending.length,
      errors: [] as string[],
      maxImageBytes: MAX_IMAGE_BYTES,
    };
    if (!apply) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const imageDirectory = join(__dirname, '..', '..', 'uploads', 'product-images');
    await mkdir(imageDirectory, { recursive: true });
    for (const product of pending) {
      let absolutePath: string | undefined;
      let fileCreated = false;
      try {
        const downloaded = await fetchImage(new URL(product.imageUrl ?? ''));
        const filename = `${product.id}.${downloaded.extension}`;
        absolutePath = join(imageDirectory, filename);
        const imagePath = `/assets/product-images/${filename}`;
        await writeFile(absolutePath, downloaded.bytes, { flag: 'wx' });
        fileCreated = true;
        await repo.update(product.id, { imagePath });
        result.downloaded += 1;
      } catch (error) {
        let cleanupError = '';
        if (fileCreated && absolutePath) {
          try {
            await unlink(absolutePath);
          } catch (cleanup) {
            cleanupError = `; cleanup failed: ${cleanup instanceof Error ? cleanup.message : 'unknown file error'}`;
          }
        }
        result.errors.push(
          `${product.id}: ${error instanceof Error ? error.message : 'Image download failed'}${cleanupError}`,
        );
      }
    }
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length) process.exitCode = 1;
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Image download failed');
  process.exitCode = 1;
});
