import { app } from './app.js';
import { db } from './db.js';
import { config } from './config.js';
import { migrate } from './migrations.js';
try {
  await db.authenticate();
  await migrate();
  const server = app.listen(config.port, config.host, () => console.log(`Internship API: http://${config.host}:${config.port}/api`));
  const shutdown = () => { server.close(() => { void db.close().then(() => process.exit(0)); }); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
} catch (error) { console.error('Cannot start API. Check the database settings in backend/.env.', error); await db.close(); process.exitCode = 1; }
