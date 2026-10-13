import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.config';

// Entry point for the TypeORM CLI (npm run migration:run / migration:revert).
export default new DataSource(buildDataSourceOptions());
