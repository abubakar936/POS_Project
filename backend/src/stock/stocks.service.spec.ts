import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { CreateStockDto } from './dto/create-stock.dto';
import { Stock } from './stock.entity';
import { StocksService } from './stocks.service';

describe('StocksService.create', () => {
  const product = {
    id: '00000000-0000-4000-8000-000000000001',
    measuringUnit: 'kg',
    deletedAt: null,
  } as Product;
  let rows: Array<Partial<Stock>>;
  let service: StocksService;

  beforeEach(() => {
    rows = [];
    const stockRepo = {
      manager: { getRepository: jest.fn() },
      create: (value: Partial<Stock>) => value,
      save: async (value: Partial<Stock>) => {
        const saved = { ...value, id: `stock-${rows.length + 1}` };
        rows.push(saved);
        return saved;
      },
    };
    const productRepo = { findOne: jest.fn().mockResolvedValue(product) };
    service = new StocksService(
      stockRepo as unknown as Repository<Stock>,
      productRepo as unknown as Repository<Product>,
    );
  });

  it('accepts a required-field-only receipt and stores whole quantity for any unit', async () => {
    const dto: CreateStockDto = {
      productId: product.id,
      quantity: '5',
      purchasePrice: '10.50',
      salePrice: '15.75',
    };

    const created = await service.create(dto);

    expect(created).toMatchObject({
      quantity: '5',
      remainingQuantity: '5',
      purchasePrice: '10.50',
      salePrice: '15.75',
      locationType: 'Unspecified',
      vendorId: null,
      companyId: null,
    });
  });

  describe('StocksService.update', () => {
    it('allows editing receipt details when no vendor or company is assigned', async () => {
      const existingStock = {
        id: '00000000-0000-4000-8000-000000000002',
        productId: '00000000-0000-4000-8000-000000000001',
        vendorId: null,
        companyId: null,
        locationType: 'Front',
      } as Stock;
      const stockRepo = {
        findOne: jest.fn().mockResolvedValue(existingStock),
        save: jest.fn((stock: Stock) => stock),
      };
      const productRepo = {
        findOne: jest.fn().mockResolvedValue({ ...product, id: existingStock.productId }),
      };
      const service = new StocksService(
        stockRepo as unknown as Repository<Stock>,
        productRepo as unknown as Repository<Product>,
      );

      const updated = await service.update(existingStock.id, {
        locationType: 'Back room',
        minimumQuantity: '5',
      });

      expect(updated.locationType).toBe('Back room');
      expect(updated.minimumQuantity).toBe('5');
      expect(stockRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  it('rejects fractional received quantities', async () => {
    await expect(
      service.create({
        productId: product.id,
        quantity: '1.5',
        purchasePrice: '10.50',
        salePrice: '15.75',
      }),
    ).rejects.toThrow(new BadRequestException('Quantity must be a positive whole number'));
    expect(rows).toHaveLength(0);
  });

  it('creates separate stock rows when received prices differ', async () => {
    const first = await service.create({
      productId: product.id,
      quantity: '2',
      purchasePrice: '10',
      salePrice: '15',
      printedPrice: '18',
    });
    const second = await service.create({
      productId: product.id,
      quantity: '3',
      purchasePrice: '12',
      salePrice: '17',
      printedPrice: '20',
    });

    expect(first.id).not.toBe(second.id);
    expect(rows).toHaveLength(2);
  });
});
