export const internshipStatuses = ['Not applied', 'Applying', 'Accepted', 'Interning', 'Completed'] as const;
export type InternshipStatus = typeof internshipStatuses[number];
export type Role = 'admin' | 'student';
export interface UserDTO { id: number; email: string; name: string; role: Role; studentId: string | null }
export interface StudentDTO {
  id: string; name: string; program: string; section: string; status: InternshipStatus;
  hoursDone: number; requiredHours: number; email: string; phone: string;
  degree: string; yearSection: string; term: string; course: string;
  adviser: string; adviserEmail: string; emergencyName: string; emergencyPhone: string;
  organization: string; organizationType: string; department: string; position: string;
  arrangement: string; supervisor: string; supervisorEmail: string; address: string;
  startDate: string; expectedCompletion: string; verifiedDocuments: number; totalDocuments: number;
}
export type ApplicationStatus = InternshipStatus | 'Rejected';
/** One dated entry in an application's history; entries are never edited or removed. */
export interface ApplicationEventDTO {
  id: number; action: 'Submitted' | 'Status changed' | 'Interview scheduled' | 'Interview cleared';
  /** Application status after this event. */
  status: ApplicationStatus;
  /** Status change ("Applying → Accepted") or interview date (YYYY-MM-DD). */
  detail: string; actor: string; at: string;
}
export interface ApplicationDTO {
  id: number; studentId: string; name: string; program: string; organization: string;
  position: string; status: ApplicationStatus; notes: string; appliedOn: string;
  interviewDate: string | null; history: ApplicationEventDTO[];
}
/** One dated upload or review decision for a requirement; earlier entries are kept after resubmission. */
export interface DocumentEventDTO {
  id: number; action: 'Submitted' | 'Resubmitted' | 'Verified' | 'Rejected';
  originalName: string; note: string; actor: string; at: string;
}
export interface DocumentDTO {
  id: number; studentId: string; name: string; requirement: string; status: 'For review' | 'Verified' | 'Rejected';
  originalName: string; submittedAt: string; reviewNote: string;
  /** Reviewer and time of the current decision; empty while the file is waiting for review. */
  reviewedBy: string; reviewedAt: string | null; history: DocumentEventDTO[];
}
export interface HourDTO {
  id: number; studentId: string; name: string; date: string; hours: number; description: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}
export interface FollowUpDTO { id: number; studentId: string; note: string; createdAt: string }
export interface IssueDTO {
  id: string; name: string; initials: string; program: string; issue: string;
  type: 'red' | 'orange' | 'blue'; adviser: string; action: string; followed: boolean;
}
export interface DashboardDTO {
  students: number; programs: number; sections: number; interning: number; completed: number;
  needsFollowUp: number; requirementExceptions: number; hoursAtRisk: number; applications: number;
  pipeline: { label: InternshipStatus; count: number; percent: string; cls: string }[];
  issues: IssueDTO[]; rows: ApplicationDTO[];
}
export const requirements = ['Learning agreement', 'Parent consent', 'Medical certificate', 'Endorsement letter', 'Acceptance letter', 'Learning plan', 'Weekly log', 'Final evaluation'] as const;

/** Internship terms run in the 1st or 2nd semester only; stored as "1st semester, AY 2026–2027". */
export const semesters = ['1st semester', '2nd semester'] as const;
export type Semester = typeof semesters[number];
export const termPattern = /^(1st|2nd) semester, AY (\d{4})[–-](\d{4})$/;
export function formatTerm(semester: Semester, startYear: number) { return `${semester}, AY ${startYear}–${startYear + 1}`; }
export function parseTerm(term: string): { semester: Semester; startYear: number } | null {
  const match = termPattern.exec(term.trim());
  if (!match || Number(match[3]) !== Number(match[2]) + 1) return null;
  return { semester: `${match[1]} semester` as Semester, startYear: Number(match[2]) };
}
