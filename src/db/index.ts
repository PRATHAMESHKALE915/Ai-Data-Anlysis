import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  var _postgresPool: Pool | undefined;
  var _drizzleDb: any | undefined;
}

export const createPool = () => {
  if (!process.env.SQL_HOST) return null;
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const db: any = new Proxy({}, {
  get(_target, prop) {
    if (!global._drizzleDb) {
      const pool = createPool();
      if (!pool) {
        throw new Error('Cloud SQL host not configured (SQL_HOST missing)');
      }
      global._drizzleDb = drizzle(pool, { schema });
    }
    return (global._drizzleDb as any)[prop];
  }
});
