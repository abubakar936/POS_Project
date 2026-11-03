import { EntityManager } from 'typeorm';

type BusinessNumberSequence = 'sale_number_seq' | 'invoice_number_seq';

export async function nextBusinessNumber(
  manager: EntityManager,
  sequence: BusinessNumberSequence,
  prefix: 'SALE' | 'INV',
): Promise<string> {
  const [result] = await manager.query(`SELECT nextval('${sequence}') AS value`);
  return `${prefix}-${String(result.value).padStart(6, '0')}`;
}