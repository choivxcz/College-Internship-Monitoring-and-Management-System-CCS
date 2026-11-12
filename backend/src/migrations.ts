import { DataTypes } from 'sequelize';
import { config } from './config.js';
import { db, initialSchema, schema002, schema004, runTransaction, isDateTime, Application, Document } from './db.js';

const tableOptions = config.dbDialect === 'mysql' ? { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' } : {};

async function isApplied(name: string) {
  const [rows] = await db.query('SELECT name FROM schema_migrations WHERE name = ?', { replacements: [name] });
  return rows.length > 0;
}

export async function migrate() {
  const qi = db.getQueryInterface();
  if (!await qi.tableExists('schema_migrations')) {
    await qi.createTable('schema_migrations', { name: { type: DataTypes.STRING(100), primaryKey: true } });
  }
  if (!await isApplied('001_initial')) {
    // MySQL DDL auto-commits, so each table is created only when missing to allow a safe resume.
    for (const [name, attributes] of Object.entries(initialSchema)) {
      if (!await qi.tableExists(name)) await qi.createTable(name, attributes, tableOptions);
    }
    await qi.bulkInsert('schema_migrations', [{ name: '001_initial' }]);
  }
  if (!await isApplied('002_history')) {
    // Each DDL step checks first, so an interrupted run can resume.
    if (!(await qi.describeTable('applications')).interviewDate) {
      await qi.addColumn('applications', 'interviewDate', schema002.applicationColumns.interviewDate);
    }
    for (const [name, attributes] of Object.entries(schema002.tables)) {
      if (!await qi.tableExists(name)) await qi.createTable(name, attributes, tableOptions);
    }
    // Seed history from existing records, then mark the migration done in the same transaction.
    await runTransaction(async transaction => {
      const now = new Date();
      const applicationEvents = (await Application.findAll({ transaction })).flatMap(a => {
        const base = { applicationId: a.get('id'), actorId: null };
        const created = a.get('createdAt') as Date, updated = a.get('updatedAt') as Date;
        const rows = [{ ...base, action: 'Submitted', status: 'Applying', detail: '', createdAt: created, updatedAt: now }];
        if (a.get('status') !== 'Applying') rows.push({ ...base, action: 'Status changed', status: a.get('status') as string, detail: `Applying → ${a.get('status')}`, createdAt: updated, updatedAt: now });
        return rows;
      });
      const documentReviews = (await Document.findAll({ transaction })).flatMap(d => {
        const base = { documentId: d.get('id'), originalName: d.get('originalName') };
        const rows = [{ ...base, action: 'Submitted', note: '', actorId: null as unknown, createdAt: d.get('createdAt') as Date, updatedAt: now }];
        if (d.get('status') !== 'For review') rows.push({ ...base, action: d.get('status') as string, note: d.get('reviewNote') as string, actorId: d.get('reviewerId'), createdAt: d.get('updatedAt') as Date, updatedAt: now });
        return rows;
      });
      if (applicationEvents.length) await qi.bulkInsert('application_events', applicationEvents, { transaction });
      if (documentReviews.length) await qi.bulkInsert('document_reviews', documentReviews, { transaction });
      await qi.bulkInsert('schema_migrations', [{ name: '002_history' }], { transaction });
    });
  }
  if (!await isApplied('003_datetime_precision')) {
    // MySQL DATETIME keeps whole seconds by default; store milliseconds as SQLite does.
    // MODIFY is repeatable, so an interrupted run can resume.
    if (config.dbDialect === 'mysql') {
      for (const [table, attributes] of Object.entries({ ...initialSchema, ...schema002.tables })) {
        for (const [column, options] of Object.entries(attributes)) {
          if (isDateTime(options)) await db.query(`ALTER TABLE \`${table}\` MODIFY \`${column}\` DATETIME(3) NOT NULL`);
        }
      }
    }
    await qi.bulkInsert('schema_migrations', [{ name: '003_datetime_precision' }]);
  }
  if (!await isApplied('004_adviser_remarks')) {
    for (const [name, attributes] of Object.entries(schema004.tables)) {
      // New tables keep millisecond timestamps on MySQL, matching migration 003.
      const columns = Object.fromEntries(Object.entries(attributes).map(([key, options]) =>
        [key, config.dbDialect === 'mysql' && isDateTime(options) ? { ...(options as object), type: DataTypes.DATE(3) } : options]));
      if (!await qi.tableExists(name)) await qi.createTable(name, columns, tableOptions);
    }
    await qi.bulkInsert('schema_migrations', [{ name: '004_adviser_remarks' }]);
  }
}
