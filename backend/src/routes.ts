import { Router, type Request, type Response } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { Op } from 'sequelize';
import { db, runTransaction, User, Session, Student, Application, Document, HourEntry, FollowUp, RecoveryRequest } from './db.js';
import { authenticate, adminOnly, hashPassword, verifyPassword, tokenHash } from './security.js';
import { config } from './config.js';
import { applicationSchema, hourSchema, studentSchema, registerSchema, contactSchema, password, studentId, HttpError } from './validation.js';
import { applicationRows, documentRows, hourRows, studentProfiles, dashboard, requireStudent, scope, csvCell } from './services.js';
import { requirements, type UserDTO } from '../../shared/contracts.js';

export const api = Router();
const cookieOptions = { httpOnly: true, secure: config.production, sameSite: 'lax' as const, path: '/api' };
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many attempts. Try again in 15 minutes.' } });
api.get('/health', async (_req, res) => { await db.authenticate(); res.json({ status: 'ok', database: 'connected' }); });
const degrees: Record<string, string> = { BSIT: 'BS Information Technology (BSIT)', BSBA: 'BS Business Administration (BSBA)', BSHM: 'BS Hospitality Management (BSHM)' };
const defaultTerm = '1st semester, AY 2026–2027';
const userDTO = (user: InstanceType<typeof User>): UserDTO => { const { id, email, name, role, studentId: owner } = user.toJSON() as UserDTO; return { id, email, name, role, studentId: owner }; };
async function startSession(req: Request, res: Response, userId: number, keepSignedIn: boolean) {
  const token = randomBytes(32).toString('hex');
  const duration = (keepSignedIn ? 30 * 24 : 8) * 60 * 60 * 1000;
  if (typeof req.cookies?.session === 'string') await Session.destroy({ where: { id: tokenHash(req.cookies.session) } });
  await Session.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } });
  await Session.create({ id: tokenHash(token), userId, expiresAt: new Date(Date.now() + duration) });
  res.cookie('session', token, { ...cookieOptions, ...(keepSignedIn ? { maxAge: duration } : {}) });
}
api.post('/auth/login', authLimit, async (req, res) => {
  const data = z.object({ userId: z.string().trim().min(1).max(255), password: z.string().min(1).max(128), role: z.enum(['admin','student']), keepSignedIn: z.boolean().default(false) }).parse(req.body);
  const user = await User.findOne({ where: { role: data.role, [Op.or]: [{ email: data.userId.toLowerCase() }, ...(data.role === 'student' ? [{ studentId: data.userId }] : [])] } });
  // Perform password work for unknown users too.
  const hash = user?.get('passwordHash') as string || '00000000000000000000000000000000:' + '00'.repeat(64);
  if (!await verifyPassword(data.password, hash) || !user) throw new HttpError(401, 'Invalid credentials or selected role.');
  await startSession(req, res, user.get('id') as number, data.keepSignedIn);
  res.json(userDTO(user));
});
api.post('/auth/register', authLimit, async (req, res) => {
  const data = registerSchema.parse(req.body);
  const passwordHash = await hashPassword(data.password);
  const { password: ignored, ...profile } = data;
  // New students join the most recently used term; coordinators can correct it later.
  const latest = await Student.findOne({ attributes: ['term'], order: [['createdAt','DESC']] });
  const user = await runTransaction(async transaction => {
    await Student.create({ ...profile, degree: degrees[profile.program], term: (latest?.get('term') as string) || defaultTerm, requiredHours: 480 }, { transaction });
    return User.create({ email: profile.email, name: profile.name, role: 'student', studentId: profile.id, passwordHash }, { transaction });
  });
  await startSession(req, res, user.get('id') as number, false);
  res.status(201).json(userDTO(user));
});
api.post('/auth/password-assistance', authLimit, async (req, res) => {
  const { email } = z.object({ email: z.string().trim().email().max(255) }).parse(req.body);
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  if (user) await runTransaction(async transaction => {
    await User.findByPk(user.get('id') as number, { transaction, lock: transaction.LOCK.UPDATE });
    if (!await RecoveryRequest.findOne({ where: { userId: user.get('id'), resolved: false }, transaction })) await RecoveryRequest.create({ userId: user.get('id') }, { transaction });
  });
  res.json({ message: 'If this email is registered, your assistance request is available to the coordinator. Contact the college to verify your identity; no email is sent automatically.' });
});
api.use(authenticate);
api.get('/auth/me', (req, res) => { res.json(req.user); });
api.post('/auth/logout', async (req, res) => { await Session.destroy({ where: { id: req.sessionId } }); res.clearCookie('session', cookieOptions).status(204).end(); });
api.patch('/auth/password', async (req, res) => {
  const data = z.object({ currentPassword: z.string().max(128), password }).parse(req.body);
  const user = await User.findByPk(req.user.id);
  if (!user || !await verifyPassword(data.currentPassword, user.get('passwordHash') as string)) throw new HttpError(400, 'Current password is incorrect.');
  const passwordHash = await hashPassword(data.password);
  await runTransaction(async transaction => { await user.update({ passwordHash }, { transaction }); await Session.destroy({ where: { userId: req.user.id }, transaction }); });
  res.clearCookie('session', cookieOptions).json({ message: 'Password changed. Sign in again.' });
});
api.patch('/me/profile', async (req, res) => {
  if (req.user.role !== 'student' || !req.user.studentId) throw new HttpError(403, 'Only student accounts have a profile to update.');
  const data = contactSchema.parse(req.body);
  await runTransaction(async transaction => { await (await requireStudent(req.user.studentId!, transaction)).update(data, { transaction }); });
  res.json((await studentProfiles({ id: req.user.studentId }))[0]);
});
api.get('/terms', async (_req, res) => {
  const records = await Student.findAll({ attributes: ['term'], group: ['term'], order: [['term','DESC']] });
  res.json(records.map(s => s.get('term')));
});
api.get('/requirements', (_req, res) => { res.json(requirements); });
api.get('/students', async (req, res) => {
  const where: Record<string, unknown> = req.user.role === 'student' ? { id: req.user.studentId } : {};
  if (typeof req.query.term === 'string' && req.query.term) where.term = req.query.term;
  let students = await studentProfiles(where);
  const q = String(req.query.search || '').toLowerCase();
  if (q) students = students.filter(s => `${s.name} ${s.id} ${s.organization}`.toLowerCase().includes(q));
  for (const field of ['program','section','status'] as const) if (req.query[field]) students = students.filter(s => s[field] === req.query[field]);
  res.json(students);
});
api.get('/students/:id', async (req, res) => {
  scope(req.user.role, req.user.studentId, String(req.params.id));
  const [student] = await studentProfiles({ id: req.params.id });
  if (!student) throw new HttpError(404, 'Student not found.');
  res.json(student);
});
api.post('/students', adminOnly, async (req, res) => {
  const data = studentSchema.parse(req.body);
  if (!data.password) throw new HttpError(400, 'An initial password is required for the student account.');
  const passwordHash = await hashPassword(data.password);
  const { password: ignored, ...profile } = data;
  await runTransaction(async transaction => {
    await Student.create(profile, { transaction });
    await User.create({ email: profile.email, name: profile.name, role: 'student', studentId: profile.id, passwordHash }, { transaction });
  });
  res.status(201).json((await studentProfiles({ id: data.id }))[0]);
});
api.patch('/students/:id', adminOnly, async (req, res) => {
  const data = studentSchema.parse(req.body);
  if (data.id !== req.params.id) throw new HttpError(400, 'Student IDs cannot be changed.');
  const { password: ignored, ...profile } = data;
  await runTransaction(async transaction => {
    const student = await requireStudent(data.id, transaction);
    if (await Application.count({ where: { studentId: data.id, status: 'Completed' }, transaction })) {
      const approved = Number(await HourEntry.sum('hours', { where: { studentId: data.id, status: 'Approved' }, transaction }) || 0);
      if (data.requiredHours > approved) throw new HttpError(409, 'Reopen the completed placement before increasing its required hours beyond the approved total.');
    }
    await student.update(profile, { transaction });
    await User.update({ name: data.name, email: data.email }, { where: { studentId: data.id }, transaction });
  });
  res.json((await studentProfiles({ id: data.id }))[0]);
});
const queryOwner = (value: unknown) => typeof value === 'string' ? value : undefined;
api.get('/applications', async (req, res) => {
  let rows = await applicationRows(scope(req.user.role, req.user.studentId, queryOwner(req.query.studentId)));
  if (req.query.term) { const profiles = await studentProfiles({ term: String(req.query.term) }); rows = rows.filter(r => profiles.some(s => s.id === r.studentId)); }
  if (req.query.status) rows = rows.filter(r => r.status === req.query.status);
  res.json(rows);
});
api.post('/applications', async (req, res) => {
  const data = applicationSchema.parse(req.body); scope(req.user.role, req.user.studentId, data.studentId);
  await requireStudent(data.studentId);
  const record = await Application.create({ ...data, status: 'Applying' });
  res.status(201).json((await applicationRows({ id: record.get('id') }))[0]);
});
api.patch('/applications/:id', adminOnly, async (req, res) => {
  const data = z.object({ status: z.enum(['Applying','Accepted','Interning','Completed','Rejected']) }).parse(req.body);
  await runTransaction(async transaction => {
    const record = await Application.findByPk(String(req.params.id), { transaction });
    if (!record) throw new HttpError(404, 'Application not found.');
    const owner = record.get('studentId') as string;
    const student = await requireStudent(owner, transaction);
    if (['Accepted','Interning','Completed'].includes(data.status)) {
      const other = await Application.findOne({ where: { studentId: owner, id: { [Op.ne]: record.get('id') }, status: { [Op.in]: ['Accepted','Interning','Completed'] } }, transaction });
      if (other) throw new HttpError(409, 'This student already has a current placement. Change that application first.');
    }
    if (data.status === 'Completed') {
      const hours = Number(await HourEntry.sum('hours', { where: { studentId: owner, status: 'Approved' }, transaction }) || 0);
      const verified = await Document.count({ where: { studentId: owner, status: 'Verified' }, distinct: true, col: 'requirement', transaction });
      if (hours < Number(student.get('requiredHours')) || verified < requirements.length) throw new HttpError(409, 'Completion requires all required hours approved and all documents verified.');
    }
    await record.update(data, { transaction });
  });
  res.json((await applicationRows({ id: req.params.id }))[0]);
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 3 } });
api.get('/documents', async (req, res) => { res.json(await documentRows(scope(req.user.role, req.user.studentId, queryOwner(req.query.studentId)))); });
api.post('/documents', upload.single('file'), async (req, res) => {
  const data = z.object({ studentId, requirement: z.enum(requirements) }).parse(req.body);
  scope(req.user.role, req.user.studentId, data.studentId);
  const file = req.file;
  if (!file) throw new HttpError(400, 'Select a PDF, PNG or JPEG file (up to 10 MB).');
  const b = file.buffer;
  const kind = b.subarray(0,5).toString() === '%PDF-' ? ['.pdf','application/pdf'] : b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? ['.png','image/png'] : b[0] === 255 && b[1] === 216 && b[2] === 255 ? ['.jpg','image/jpeg'] : null;
  if (!kind) throw new HttpError(400, 'Only PDF, PNG and JPEG files are supported.');
  const storageName = randomUUID() + kind[0];
  let oldFile = ''; let id: unknown;
  await mkdir(config.uploadDir, { recursive: true });
  await writeFile(path.join(config.uploadDir, storageName), b, { flag: 'wx' });
  try {
    await runTransaction(async transaction => {
      await requireStudent(data.studentId, transaction);
      const existing = await Document.findOne({ where: data, transaction });
      if (existing?.get('status') === 'Verified') throw new HttpError(409, 'A verified document cannot be replaced. Ask the coordinator to reject it first.');
      const values = { ...data, storageName, mimeType: kind[1], originalName: path.basename(file.originalname).slice(0,255), status: 'For review', reviewNote: '', reviewerId: null, createdAt: new Date() };
      if (existing) { oldFile = existing.get('storageName') as string; await existing.update(values, { transaction }); id = existing.get('id'); }
      else id = (await Document.create(values, { transaction })).get('id');
    });
  } catch (error) { await unlink(path.join(config.uploadDir, storageName)).catch(() => {}); throw error; }
  if (oldFile) await unlink(path.join(config.uploadDir, oldFile)).catch(() => {});
  res.status(201).json((await documentRows({ id }))[0]);
});
api.get('/documents/:id/download', async (req, res, next) => {
  const doc = await Document.findByPk(String(req.params.id));
  if (!doc) throw new HttpError(404, 'Document not found.');
  scope(req.user.role, req.user.studentId, doc.get('studentId') as string);
  res.download(path.join(config.uploadDir, doc.get('storageName') as string), doc.get('originalName') as string, error => { if (error && !res.headersSent) next(new HttpError(404, 'Document file is unavailable.')); });
});
api.patch('/documents/:id', adminOnly, async (req, res) => {
  const data = z.object({ status: z.enum(['Verified','Rejected']), reviewNote: z.string().trim().max(2000).default('') }).parse(req.body);
  await runTransaction(async transaction => {
    const doc = await Document.findByPk(String(req.params.id), { transaction });
    if (!doc) throw new HttpError(404, 'Document not found.');
    await requireStudent(doc.get('studentId') as string, transaction);
    if (data.status === 'Rejected' && await Application.count({ where: { studentId: doc.get('studentId'), status: 'Completed' }, transaction })) throw new HttpError(409, 'Reopen the completed placement before rejecting a requirement.');
    await doc.update({ ...data, reviewerId: req.user.id }, { transaction });
  });
  res.json((await documentRows({ id: req.params.id }))[0]);
});
api.get('/hours', async (req, res) => { res.json(await hourRows(scope(req.user.role, req.user.studentId, queryOwner(req.query.studentId)))); });
api.post('/hours', async (req, res) => {
  const data = hourSchema.parse(req.body); scope(req.user.role, req.user.studentId, data.studentId);
  const entry = await runTransaction(async transaction => {
    await requireStudent(data.studentId, transaction);
    if (!await Application.count({ where: { studentId: data.studentId, status: 'Interning' }, transaction })) throw new HttpError(409, 'An interning placement is required before logging hours.');
    const total = Number(await HourEntry.sum('hours', { where: { studentId: data.studentId, date: data.date, status: { [Op.ne]: 'Rejected' } }, transaction }) || 0);
    if (total + data.hours > 24) throw new HttpError(409, 'Daily hours cannot exceed 24, including pending entries.');
    return HourEntry.create({ ...data, status: 'Pending' }, { transaction });
  });
  res.status(201).json((await hourRows({ id: entry.get('id') }))[0]);
});
api.patch('/hours/:id', adminOnly, async (req, res) => {
  const data = z.object({ status: z.enum(['Approved','Rejected']) }).parse(req.body);
  await runTransaction(async transaction => {
    const entry = await HourEntry.findByPk(String(req.params.id), { transaction });
    if (!entry) throw new HttpError(404, 'Hour entry not found.');
    await requireStudent(entry.get('studentId') as string, transaction);
    if (data.status === 'Rejected' && await Application.count({ where: { studentId: entry.get('studentId'), status: 'Completed' }, transaction })) throw new HttpError(409, 'Reopen the completed placement before rejecting hours.');
    if (data.status === 'Approved') {
      const total = Number(await HourEntry.sum('hours', { where: { studentId: entry.get('studentId'), date: entry.get('date'), id: { [Op.ne]: entry.get('id') }, status: { [Op.ne]: 'Rejected' } }, transaction }) || 0);
      if (total + Number(entry.get('hours')) > 24) throw new HttpError(409, 'Daily hours cannot exceed 24.');
    }
    await entry.update({ ...data, reviewerId: req.user.id }, { transaction });
  });
  res.json((await hourRows({ id: req.params.id }))[0]);
});
api.get('/follow-ups', adminOnly, async (_req, res) => { res.json(await FollowUp.findAll({ order: [['createdAt','DESC']] })); });
api.post('/follow-ups', adminOnly, async (req, res) => {
  const data = z.object({ studentId, note: z.string().trim().min(1).max(2000) }).parse(req.body);
  await requireStudent(data.studentId);
  res.status(201).json(await FollowUp.create({ ...data, authorId: req.user.id }));
});
api.get('/dashboard', adminOnly, async (req, res) => { res.json(await dashboard(queryOwner(req.query.term))); });
api.get('/reports/export', adminOnly, async (req, res) => {
  const data = await studentProfiles(req.query.term ? { term: String(req.query.term) } : {});
  const csv = [['Student ID','Name','Program','Status','Organization','Approved hours','Required hours','Verified documents','Required documents'], ...data.map(s => [s.id,s.name,s.program,s.status,s.organization,s.hoursDone,s.requiredHours,s.verifiedDocuments,s.totalDocuments])].map(row => row.map(csvCell).join(',')).join('\r\n');
  res.type('text/csv').attachment('internship-progress.csv').send('\uFEFF' + csv);
});
api.get('/admin/recovery-requests', adminOnly, async (_req, res) => {
  const records = await RecoveryRequest.findAll({ where: { resolved: false }, order: [['createdAt','ASC']] });
  const users = await User.findAll({ attributes: ['id','name','email','studentId'] });
  res.json(records.map(r => ({ ...r.toJSON(), user: users.find(u => u.get('id') === r.get('userId'))?.toJSON() })));
});
api.patch('/admin/users/:id/password', adminOnly, async (req, res) => {
  const data = z.object({ password }).parse(req.body);
  const user = await User.findByPk(String(req.params.id));
  if (!user) throw new HttpError(404, 'Account not found.');
  const passwordHash = await hashPassword(data.password);
  await runTransaction(async transaction => {
    await user.update({ passwordHash }, { transaction });
    await Session.destroy({ where: { userId: user.get('id') }, transaction });
    await RecoveryRequest.update({ resolved: true }, { where: { userId: user.get('id') }, transaction });
  });
  res.json({ message: 'Password updated and all previous sessions revoked.' });
});
