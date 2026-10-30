import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { db } from '../db.js';
import { migrate } from '../migrations.js';
try {
  if (config.dbDialect === 'mysql') {
    const { default: mysql } = await import('mysql2/promise');
    const connection = await mysql.createConnection({ host: config.dbHost, port: config.dbPort, user: config.dbUser, password: config.dbPassword });
    try { await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); }
    finally { await connection.end(); }
  } else if (config.dbStorage !== ':memory:') {
    await mkdir(path.dirname(config.dbStorage), { recursive: true });
  }
  await migrate();
  console.log(`Database ${config.dbDialect === 'mysql' ? config.database : config.dbStorage} is ready.`);
} catch (error) { console.error('Migration failed. Check the database settings in backend/.env.', error); process.exitCode = 1; }
finally { await db.close(); }
