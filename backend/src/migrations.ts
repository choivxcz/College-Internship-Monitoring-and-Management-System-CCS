import { DataTypes } from 'sequelize';
import { config } from './config.js';
import { db, initialSchema } from './db.js';

export async function migrate() {
  const qi = db.getQueryInterface();
  if (!await qi.tableExists('schema_migrations')) {
    await qi.createTable('schema_migrations', { name: { type: DataTypes.STRING(100), primaryKey: true } });
  }
  const [applied] = await db.query("SELECT name FROM schema_migrations WHERE name = '001_initial'");
  if (!applied.length) {
    // MySQL DDL auto-commits, so each table is created only when missing to allow a safe resume.
    for (const [name, attributes] of Object.entries(initialSchema)) {
      if (!await qi.tableExists(name)) {
        await qi.createTable(name, attributes, config.dbDialect === 'mysql' ? { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' } : {});
      }
    }
    await qi.bulkInsert('schema_migrations', [{ name: '001_initial' }]);
  }
}
