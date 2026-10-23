import { CustomersModule } from './customers/customers.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { SubCategoriesModule } from './sub-categories/sub-categories.module';
import { ProductsModule } from './products/products.module';
import { StocksModule } from './stock/stocks.module';
import { VendorsModule } from './vendors/vendors.module';
import { CompaniesModule } from './companies/companies.module';
import { OrdersModule } from './orders/orders.module';
import { InvoicesModule } from './invoices/invoices.module';
import { createDatabaseOptions } from './database/database-options';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createDatabaseOptions({
          DB_HOST: configService.getOrThrow<string>('DB_HOST'),
          DB_PORT: configService.getOrThrow<string>('DB_PORT'),
          DB_USERNAME: configService.getOrThrow<string>('DB_USERNAME'),
          DB_PASSWORD: configService.getOrThrow<string>('DB_PASSWORD'),
          DB_DATABASE: configService.getOrThrow<string>('DB_DATABASE'),
          NODE_ENV: configService.get<string>('NODE_ENV'),
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
