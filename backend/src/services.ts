import type { Transaction } from 'sequelize';
import { Op } from 'sequelize';
import { Application, Document, FollowUp, HourEntry, Student } from './db.js';
import { requirements, internshipStatuses, type StudentDTO, type ApplicationDTO, type DocumentDTO, type HourDTO, type DashboardDTO, type IssueDTO } from '../../shared/contracts.js';
import { HttpError } from './validation.js';

export async function requireStudent(id: string, transaction?: Transaction) {
  const student = await Student.findByPk(id, { transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!student) throw new HttpError(404, 'Student not found.');
  return student;
}
export function scope(role: string, owner: string | null, requested?: string) {
  if (role === 'student') {
    if (!owner || (requested && requested !== owner)) throw new HttpError(403, 'You can only access your own records.');
    return { studentId: owner };
  }
  return requested ? { studentId: requested } : {};
}
export async function studentProfiles(where: Record<string, unknown> = {}): Promise<StudentDTO[]> {
  const students = await Student.findAll({ where, order: [['name','ASC']] });
  if (!students.length) return [];
  const related = { studentId: { [Op.in]: students.map(s => s.get('id') as string) } };
  const [apps, documents, hours] = await Promise.all([
    Application.findAll({ where: related, order: [['updatedAt','DESC'],['id','DESC']] }),
    Document.findAll({ where: { ...related, status: 'Verified' } }),
    HourEntry.findAll({ where: { ...related, status: 'Approved' } }),
  ]);
  return students.map(s => {
    const student = s.toJSON() as StudentDTO;
    const own = apps.filter(a => a.get('studentId') === student.id);
    const current = own.find(a => ['Interning','Completed','Accepted'].includes(a.get('status') as string)) || own.find(a => a.get('status') === 'Applying');
    return { ...student, status: (current?.get('status') || 'Not applied') as StudentDTO['status'],
      organization: (current?.get('organization') || 'Unassigned') as string, position: (current?.get('position') || '') as string,
      hoursDone: hours.filter(h => h.get('studentId') === student.id).reduce((sum,h) => sum + Number(h.get('hours')), 0),
      verifiedDocuments: new Set(documents.filter(d => d.get('studentId') === student.id).map(d => d.get('requirement'))).size,
      totalDocuments: requirements.length,
    };
  });
}
export async function applicationRows(where: Record<string, unknown> = {}): Promise<ApplicationDTO[]> {
  const records = await Application.findAll({ where, order: [['createdAt','DESC'],['id','DESC']] });
  const students = await Student.findAll({ attributes: ['id','name','program','section'] });
  return records.map(record => {
    const data = record.toJSON() as ApplicationDTO;
    const student = students.find(s => s.get('id') === data.studentId);
    return { ...data, name: String(student?.get('name') || ''), program: `${student?.get('program') || ''} ${student?.get('section') || ''}` };
  });
}
export async function documentRows(where: Record<string, unknown> = {}): Promise<DocumentDTO[]> {
  const [records, students] = await Promise.all([Document.findAll({ where, order: [['createdAt','DESC']] }), Student.findAll({ attributes: ['id','name'] })]);
  return records.map(d => ({ id: d.get('id') as number, studentId: d.get('studentId') as string,
    name: String(students.find(s => s.get('id') === d.get('studentId'))?.get('name') || ''),
    requirement: d.get('requirement') as string, status: d.get('status') as DocumentDTO['status'],
    originalName: d.get('originalName') as string, submittedAt: new Date(d.get('createdAt') as string).toISOString(), reviewNote: d.get('reviewNote') as string,
  }));
}
export async function hourRows(where: Record<string, unknown> = {}): Promise<HourDTO[]> {
  const [records, students] = await Promise.all([HourEntry.findAll({ where, order: [['date','DESC'],['id','DESC']] }), Student.findAll({ attributes: ['id','name'] })]);
  return records.map(h => ({ ...h.toJSON(), hours: Number(h.get('hours')), name: String(students.find(s => s.get('id') === h.get('studentId'))?.get('name') || '') })) as HourDTO[];
}
export async function dashboard(term?: string): Promise<DashboardDTO> {
  const students = await studentProfiles(term ? { term } : {});
  const [allRows, followUps] = await Promise.all([applicationRows(), FollowUp.findAll({ order: [['createdAt','DESC']] })]);
  const rows = allRows.filter(a => students.some(s => s.id === a.studentId));
  const overdue = (s: StudentDTO) => Boolean(s.expectedCompletion && s.expectedCompletion < new Date().toISOString().slice(0,10) && s.hoursDone < s.requiredHours && ['Interning','Accepted'].includes(s.status));
  const issues: IssueDTO[] = students.filter(s => s.verifiedDocuments < s.totalDocuments || overdue(s) || s.status === 'Not applied').map(s => ({
    id: s.id, name: s.name, initials: s.name.split(/\s+/).slice(0,2).map(p => p[0]).join(''), program: `${s.program} ${s.section}`,
    issue: s.status === 'Not applied' ? 'No application yet' : overdue(s) ? 'Completion date passed; hours incomplete' : `${s.totalDocuments - s.verifiedDocuments} requirements unverified`,
    type: s.status === 'Not applied' ? 'blue' : overdue(s) ? 'orange' : 'red', adviser: s.adviser || 'Unassigned', action: 'Follow up',
    followed: followUps.some(f => f.get('studentId') === s.id),
  }));
  return { students: students.length, programs: new Set(students.map(s => s.program)).size,
    sections: new Set(students.map(s => s.program + s.section)).size,
    interning: students.filter(s => s.status === 'Interning').length,
    completed: students.filter(s => s.status === 'Completed').length, needsFollowUp: issues.length,
    requirementExceptions: students.filter(s => s.verifiedDocuments < s.totalDocuments).length,
    hoursAtRisk: students.filter(overdue).length, applications: rows.length,
    pipeline: internshipStatuses.map(label => { const count = students.filter(s => s.status === label).length; return { label, count, percent: `${students.length ? (count / students.length * 100).toFixed(1) : '0.0'}%`, cls: label.toLowerCase().replace(/ /g,'-') }; }), issues, rows,
  };
}
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
}
