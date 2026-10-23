import 'dotenv/config';
import { DataSource } from 'typeorm';
import { createDatabaseOptions } from './database-options';

export const AppDataSource = new DataSource(
  createDatabaseOptions(process.env, false),
);
