import { CustomersModule } from './customers/customers.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { User } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { SubCategoriesModule } from './sub-categories/sub-categories.module';
import { Category } from './categories/category.entity';
import { SubCategory } from './sub-categories/sub-category.entity';
import { Product } from './products/product.entity';
import { ProductsModule } from './products/products.module';
import { Stock } from './stock/stock.entity';
import { StocksModule } from './stock/stocks.module';
import { Vendor } from './vendors/vendor.entity';
import { Company } from './companies/company.entity';
import { VendorsModule } from './vendors/vendors.module';
import { CompaniesModule } from './companies/companies.module';
import { Customer } from './customers/customer.entity';
import { OrdersModule } from './orders/orders.module';
import { Order } from './orders/order.entity';
import { OrderItem } from './orders/order-item.entity';
import { InvoicesModule } from './invoices/invoices.module';
import { Invoice } from './invoices/invoice.entity';
import { InvoicePayment } from './invoices/invoice-payment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: parseInt(configService.getOrThrow<string>('DB_PORT'), 10),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_DATABASE'),
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
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    UsersModule,
    AuthModule,
    CategoriesModule,
    SubCategoriesModule,
    ProductsModule,
    StocksModule,
    VendorsModule,
    CompaniesModule,
    CustomersModule,
    OrdersModule,
    InvoicesModule,
  ],
})
export class AppModule {}
