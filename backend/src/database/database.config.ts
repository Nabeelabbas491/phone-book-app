import { DataSourceOptions } from 'typeorm';
import { Contact } from '../contacts/contact.entity';
import { CreateContacts1760000000000 } from './migrations/1760000000000-CreateContacts';

/**
 * Builds the TypeORM connection options from environment variables.
 * Shared by the Nest application and the TypeORM CLI (see data-source.ts).
 */
export function buildDataSourceOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  const ssl = env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
  const connection = env.DATABASE_URL
    ? { url: env.DATABASE_URL }
    : {
        host: env.DB_HOST ?? 'localhost',
        port: Number(env.DB_PORT ?? 5432),
        username: env.DB_USER ?? 'phonebook',
        password: env.DB_PASSWORD ?? 'phonebook',
        database: env.DB_NAME ?? 'phonebook',
      };

  return {
    type: 'postgres',
    ...connection,
    ssl,
    entities: [Contact],
    migrations: [CreateContacts1760000000000],
    // Schema is managed exclusively through migrations, never auto-synced.
    synchronize: false,
    migrationsRun: true,
  };
}
