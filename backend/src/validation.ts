import { z } from 'zod';
export const text = z.string().trim().max(255);
export const studentId = z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9-]+$/);
export const password = z.string().min(10, 'Passwords must have at least 10 characters.').max(128);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value, 'Enter a valid date.');
export const studentSchema = z.object({
  id: studentId, name: text.min(1).max(150), email: z.string().trim().email().max(255).transform(v => v.toLowerCase()),
  program: z.enum(['BSIT','BSBA','BSHM']), section: text.min(1).max(30),
  requiredHours: z.number().int().min(1).max(2000), term: text.min(1),
  phone: text.default(''), degree: text.default(''), yearSection: text.default(''), course: text.default(''),
  adviser: text.default(''), adviserEmail: z.union([z.string().email(), z.literal('')]).default(''),
  emergencyName: text.default(''), emergencyPhone: text.default(''), organizationType: text.default(''),
  department: text.default(''), arrangement: text.default(''), supervisor: text.default(''),
  supervisorEmail: z.union([z.string().email(), z.literal('')]).default(''), address: text.default(''),
  startDate: z.union([date,z.literal('')]).default(''), expectedCompletion: z.union([date,z.literal('')]).default(''),
  password: password.optional(),
}).refine(v => !v.startDate || !v.expectedCompletion || v.expectedCompletion >= v.startDate, 'Completion date must be on or after the start date.');
// Public self sign-up: only identity and class fields; coordinators fill in the rest later.
export const registerSchema = z.object({
  id: studentId, name: text.min(1).max(150), email: z.string().trim().email().max(255).transform(v => v.toLowerCase()),
  program: z.enum(['BSIT','BSBA','BSHM']), section: text.min(1).max(30), phone: text.default(''), password,
});
// Fields a student may change on their own profile.
export const contactSchema = z.object({ phone: text.default(''), address: text.default(''), emergencyName: text.default(''), emergencyPhone: text.default('') });
export const applicationSchema =z.object({ studentId, organization: text.min(1), position: text.min(1), appliedOn: date, notes: z.string().trim().max(2000).default('') });
const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
export const hourSchema = z.object({ studentId, date: date.refine(v => v <= today(), 'Hours cannot be dated in the future.'), hours: z.number().positive().max(24).multipleOf(0.25), description: z.string().trim().min(1).max(2000) });
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
