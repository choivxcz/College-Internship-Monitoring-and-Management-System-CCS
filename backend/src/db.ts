import { Sequelize, DataTypes, Model, Transaction, type ModelAttributes, type DataType } from 'sequelize';
import { config } from './config.js';

const isMySql = config.dbDialect === 'mysql';
export const db = isMySql
  ? new Sequelize(config.database, config.dbUser, config.dbPassword, {
      dialect: 'mysql', host: config.dbHost, port: config.dbPort, logging: false,
      timezone: '+00:00', define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
      // Student row locks serialize placement/hour decisions; fresh reads must see the preceding commit.
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
      pool: { max: 10, min: 0, idle: 10000 },
    })
  : new Sequelize({
      dialect: 'sqlite', storage: config.dbStorage, logging: false,
      // SQLite has no row locks; a single connection serializes ordinary writes.
      pool: { max: 1, min: 0, idle: 10000 },
      // Transaction connections bypass the pool, so wait out brief write locks.
      retry: { max: 20, match: [/SQLITE_BUSY/, /SQLITE_LOCKED/] },
    });
let writeQueue: Promise<unknown> = Promise.resolve();
/** SQLite allows one writer; serializing transactions mirrors the MySQL row-lock guarantees. */
export function runTransaction<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T> {
  if (isMySql) return db.transaction(callback);
  const run = writeQueue.then(() => db.transaction(callback));
  writeQueue = run.catch(() => undefined);
  return run;
}
const text = (length = 255) => ({ type: DataTypes.STRING(length), allowNull: false, defaultValue: '' });
const pk = () => ({ type: isMySql ? DataTypes.INTEGER.UNSIGNED : DataTypes.INTEGER, autoIncrement: true, primaryKey: true });
const ref = (table: string, type: DataType = isMySql ? DataTypes.INTEGER.UNSIGNED : DataTypes.INTEGER) => ({ type, allowNull: false, references: { model: table, key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' });
const studentRef = () => ref('students', DataTypes.STRING(40));
const timestamps = () => ({ createdAt: { type: DataTypes.DATE, allowNull: false }, updatedAt: { type: DataTypes.DATE, allowNull: false } });

// The initial migration uses this frozen schema; future changes belong in a new migration.
export const initialSchema: Record<string, ModelAttributes> = {
  students: {
    id: { type: DataTypes.STRING(40), primaryKey: true }, name: text(150), email: { ...text(), unique: true },
    program: text(30), section: text(30), requiredHours: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 480 },
    ...Object.fromEntries(['phone','degree','yearSection','term','course','adviser','adviserEmail','emergencyName','emergencyPhone','organizationType','department','arrangement','supervisor','supervisorEmail','address','startDate','expectedCompletion'].map(key => [key, text()])),
    ...timestamps(),
  },
  users: {
    id: pk(), email: { ...text(), unique: true }, name: text(150), passwordHash: text(),
    role: { type: DataTypes.ENUM('admin','student'), allowNull: false },
    studentId: { ...studentRef(), allowNull: true, unique: true }, ...timestamps(),
  },
  sessions: {
    id: { type: DataTypes.STRING(64), primaryKey: true }, userId: ref('users'),
    expiresAt: { type: DataTypes.DATE, allowNull: false }, ...timestamps(),
  },
  applications: {
    id: pk(), studentId: studentRef(), organization: text(), position: text(), notes: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('Applying','Accepted','Interning','Completed','Rejected'), allowNull: false, defaultValue: 'Applying' },
    appliedOn: { type: DataTypes.DATEONLY, allowNull: false }, ...timestamps(),
  },
  documents: {
    id: pk(), studentId: studentRef(), requirement: text(80),
    status: { type: DataTypes.ENUM('For review','Verified','Rejected'), allowNull: false, defaultValue: 'For review' },
    originalName: text(), storageName: text(), mimeType: text(80),
    reviewNote: { type: DataTypes.TEXT, allowNull: false }, reviewerId: { ...ref('users'), allowNull: true, onDelete: 'SET NULL' },
    ...timestamps(),
  },
  hour_entries: {
    id: pk(), studentId: studentRef(), date: { type: DataTypes.DATEONLY, allowNull: false },
    hours: { type: DataTypes.DECIMAL(5,2), allowNull: false }, description: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('Pending','Approved','Rejected'), allowNull: false, defaultValue: 'Pending' },
    reviewerId: { ...ref('users'), allowNull: true, onDelete: 'SET NULL' }, ...timestamps(),
  },
  follow_ups: { id: pk(), studentId: studentRef(), authorId: ref('users'), note: { type: DataTypes.TEXT, allowNull: false }, ...timestamps() },
  recovery_requests: { id: pk(), userId: ref('users'), resolved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, ...timestamps() },
};
function model(table: string) {
  return db.define<Model>(table, initialSchema[table], { tableName: table });
}
export const Student = model('students');
export const User = model('users');
export const Session = model('sessions');
export const Application = model('applications');
export const Document = model('documents');
export const HourEntry = model('hour_entries');
export const FollowUp = model('follow_ups');
export const RecoveryRequest = model('recovery_requests');
