import { DataSourceOptions } from 'typeorm';
import { Category } from '../categories/category.entity';
import { Company } from '../companies/company.entity';
import { Customer } from '../customers/customer.entity';
import { InvoicePayment } from '../invoices/invoice-payment.entity';
import { Invoice } from '../invoices/invoice.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Order } from '../orders/order.entity';
import { Product } from '../products/product.entity';
import { Stock } from '../stock/stock.entity';
import { SubCategory } from '../sub-categories/sub-category.entity';
import { User } from '../users/entities/user.entity';
import { Vendor } from '../vendors/vendor.entity';

export type DatabaseEnvironment = Record<string, string | undefined>;

export function createDatabaseOptions(
  environment: DatabaseEnvironment,
  synchronize = false,
): DataSourceOptions {
  const required = (key: string) => {
    const value = environment[key];
    if (!value) throw new Error(`Missing required database setting: ${key}`);
    return value;
  };
  const port = Number(required('DB_PORT'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be a valid TCP port number');
  }

  return {
    type: 'postgres',
    host: required('DB_HOST'),
    port,
    username: required('DB_USERNAME'),
    password: required('DB_PASSWORD'),
    database: required('DB_DATABASE'),
    entities: [
      User,
      Category,
      SubCategory,
      Product,
      Stock,
      Vendor,
      Company,
      Customer,
      Order,
      OrderItem,
      Invoice,
      InvoicePayment,
    ],
    migrations: [`${__dirname}/migrations/*{.ts,.js}`],
    migrationsTableName: 'typeorm_migrations',
    synchronize,
  };
}
