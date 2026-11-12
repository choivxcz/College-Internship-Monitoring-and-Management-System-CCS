// Copies every record from the old SQLite database into the (empty, migrated) MySQL database.
// Usage: set DB_DIALECT=mysql in backend/.env, run `npm run db:migrate`, then `npm run db:copy-from-sqlite`.
// Optional: SQLITE_SOURCE=path/to/file.sqlite (defaults to DB_STORAGE or data/internship_hub.sqlite).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Sequelize, type ModelAttributes, type ModelAttributeColumnOptions } from 'sequelize';
import { backendDir, config } from '../config.js';
import { db, initialSchema, schema002, schema004, runTransaction } from '../db.js';

// Parents before children, so foreign keys are satisfied during the insert.
const tables = ['students', 'users', 'sessions', 'applications', 'documents', 'hour_entries', 'follow_ups', 'recovery_requests', 'application_events', 'document_reviews', 'adviser_remarks'];
const attributesFor = (table: string): ModelAttributes => table === 'applications'
  ? { ...initialSchema.applications, ...schema002.applicationColumns }
  : initialSchema[table] ?? schema002.tables[table] ?? schema004.tables[table];

const sourceFile = path.resolve(backendDir, process.env.SQLITE_SOURCE || process.env.DB_STORAGE || path.join('data', 'internship_hub.sqlite'));
const source = new Sequelize({ dialect: 'sqlite', storage: sourceFile, logging: false });
try {
  if (config.dbDialect !== 'mysql') throw new Error('Set DB_DIALECT=mysql in backend/.env before copying.');
  if (!existsSync(sourceFile)) throw new Error(`SQLite file not found: ${sourceFile}`);
  const qi = db.getQueryInterface();
  for (const table of tables) {
    if (!await qi.tableExists(table)) throw new Error(`MySQL table "${table}" is missing. Run "npm run db:migrate" first.`);
    const [[{ count }]] = await db.query(`SELECT COUNT(*) AS count FROM \`${table}\``) as [{ count: number }[], unknown];
    if (Number(count) > 0) throw new Error(`MySQL table "${table}" already has data. The copy only runs into an empty database (do not run db:seed first).`);
  }
  // Read through models so SQLite values (dates, booleans, decimals) arrive as proper JavaScript values.
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const table of tables) {
    // Foreign keys are irrelevant for reading and would make SQLite resolve other tables.
    const attributes = Object.fromEntries(Object.entries(attributesFor(table)).map(([key, value]) => {
      const { references, ...rest } = value as ModelAttributeColumnOptions;
      return [key, rest];
    })) as ModelAttributes;
    const model = source.define(table, attributes, { tableName: table });
    data[table] = (await model.findAll({ order: [[Object.keys(attributes).includes('id') ? 'id' : 'createdAt', 'ASC']] })).map(r => r.get({ plain: true }));
  }
  // MySQL compares IDs and emails without regard to letter case, unlike SQLite.
  for (const [table, column] of [['students', 'id'], ['students', 'email'], ['users', 'email']] as const) {
    const seen = new Map<string, unknown>();
    for (const row of data[table]) {
      const key = String(row[column]).toLowerCase();
      if (seen.has(key)) throw new Error(`${table}.${column} values "${seen.get(key)}" and "${row[column]}" differ only by letter case; MySQL treats them as duplicates. Rename one first.`);
      seen.set(key, row[column]);
    }
  }
  await runTransaction(async transaction => {
    // Passing the MySQL model attributes keeps the milliseconds of every timestamp.
    for (const table of tables) if (data[table].length) await qi.bulkInsert(table, data[table], { transaction }, db.models[table].getAttributes());
  });
  for (const table of tables) console.log(`${table.padEnd(20)} ${data[table].length} rows copied`);
  console.log(`Copied ${sourceFile} into MySQL database "${config.database}". Uploaded files in backend/uploads are unchanged and still used.`);
} catch (error) {
  console.error('Copy failed; nothing was written to MySQL.', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await source.close();
  await db.close();
}
