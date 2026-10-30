import dotenv from 'dotenv';
import path from 'node:path';
// Resolve from the backend working directory, consistently for tsx and compiled runs.
export const backendDir = path.basename(process.cwd()) === 'backend' ? process.cwd() : path.resolve(process.cwd(), 'backend');
dotenv.config({ path: path.join(backendDir, '.env') });
const dbDialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase();
if (dbDialect !== 'sqlite' && dbDialect !== 'mysql') throw new Error('DB_DIALECT must be either "sqlite" or "mysql".');
export const config = {
  production: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 3001), host: process.env.HOST || '127.0.0.1',
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  dbDialect: dbDialect as 'sqlite' | 'mysql',
  database: process.env.DB_NAME || 'internship_hub',
  dbStorage: path.resolve(backendDir, process.env.DB_STORAGE || path.join('data', 'internship_hub.sqlite')),
  dbHost: process.env.DB_HOST || '127.0.0.1', dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: process.env.DB_USER || 'root', dbPassword: process.env.DB_PASSWORD || '',
  uploadDir: path.join(backendDir, 'uploads'),
};
if (!/^[a-zA-Z0-9_]+$/.test(config.database)) throw new Error('DB_NAME must contain only letters, digits and underscores.');
new URL(config.origin);
