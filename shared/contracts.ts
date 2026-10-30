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
export interface ApplicationDTO {
  id: number; studentId: string; name: string; program: string; organization: string;
  position: string; status: InternshipStatus | 'Rejected'; notes: string; appliedOn: string;
}
export interface DocumentDTO {
  id: number; studentId: string; name: string; requirement: string; status: 'For review' | 'Verified' | 'Rejected';
  originalName: string; submittedAt: string; reviewNote: string;
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
