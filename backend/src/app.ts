import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { UniqueConstraintError, ForeignKeyConstraintError, ValidationError, ConnectionError } from 'sequelize';
import { MulterError } from 'multer';
import { api } from './routes.js';
import { config } from './config.js';
import { HttpError } from './validation.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.origin, credentials: true, allowedHeaders: ['Content-Type','X-Requested-With'] }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    // A custom header blocks cross-site form submissions; Origin validates browser fetches.
    if (req.get('X-Requested-With') !== 'InternshipHub' || (req.get('Origin') && req.get('Origin') !== config.origin)) {
      res.status(403).json({ message: 'Request origin is not allowed.' }); return;
    }
  }
  next();
}, api);
app.use((_req, res) => { res.status(404).json({ message: 'API route not found.' }); });
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) { res.status(400).json({ message: error.issues.map(i => `${i.path.join('.') || 'Request'}: ${i.message}`).join('; ') }); return; }
  if (error instanceof HttpError) { res.status(error.status).json({ message: error.message }); return; }
  if (error instanceof UniqueConstraintError) { res.status(409).json({ message: 'That student ID or email already exists.' }); return; }
  if (error instanceof ForeignKeyConstraintError) { res.status(400).json({ message: 'A related record does not exist.' }); return; }
  if (error instanceof ValidationError) { res.status(400).json({ message: 'The record contains invalid values.' }); return; }
  if (error instanceof MulterError) { res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Files must be no larger than 10 MB.' : 'Invalid file upload.' }); return; }
  if (error instanceof ConnectionError) { res.status(503).json({ message: 'Database unavailable. Check the connection settings in backend/.env.' }); return; }
  if (error.type === 'entity.parse.failed') { res.status(400).json({ message: 'Invalid JSON.' }); return; }
  if (error.type === 'entity.too.large') { res.status(413).json({ message: 'Request is too large.' }); return; }
  console.error(error);
  res.status(500).json({ message: 'An unexpected server error occurred.' });
};
app.use(errorHandler);
