import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { RequestHandler } from 'express';
import type { UserDTO } from '../../shared/contracts.js';
import { Session, User } from './db.js';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const key = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return expected.length === key.length && timingSafeEqual(key, expected);
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
declare global { namespace Express { interface Request { user: UserDTO; sessionId: string } } }
export const authenticate: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.session;
  if (typeof token !== 'string') { res.status(401).json({ message: 'Please sign in.' }); return; }
  const session = await Session.findByPk(tokenHash(token));
  if (!session || new Date(session.get('expiresAt') as string).getTime() <= Date.now()) {
    res.status(401).json({ message: 'Your session expired. Please sign in again.' }); return;
  }
  const user = await User.findByPk(session.get('userId') as number, { attributes: ['id','email','name','role','studentId'] });
  if (!user) { res.status(401).json({ message: 'Please sign in.' }); return; }
  req.user = user.toJSON() as UserDTO; req.sessionId = session.get('id') as string;
  next();
};
export const adminOnly: RequestHandler = (req, res, next) => {
  if (req.user.role !== 'admin') { res.status(403).json({ message: 'Administrator access is required.' }); return; }
  next();
};
