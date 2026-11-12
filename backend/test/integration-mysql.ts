// Runs the API integration test against a disposable MySQL database (see integration.ts).
process.env.TEST_DB_DIALECT = 'mysql';
await import('./integration.ts');
