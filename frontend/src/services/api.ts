import type {
  ApplicationDTO,
  DashboardDTO,
  DocumentDTO,
  FollowUpDTO,
  HourDTO,
  StudentDTO,
  UserDTO,
} from "../../../shared/contracts";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-Requested-With", "InternshipHub");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError("Cannot reach the server. Is the API running?", 0);
  }

  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : typeof payload === "string" && payload
          ? payload
          : "The request could not be completed.";
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

function query(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export type StudentInput = {
  id: string;
  name: string;
  email: string;
  program: string;
  section: string;
  requiredHours: number;
  term: string;
  phone?: string;
  degree?: string;
  yearSection?: string;
  course?: string;
  adviser?: string;
  adviserEmail?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  organizationType?: string;
  department?: string;
  arrangement?: string;
  supervisor?: string;
  supervisorEmail?: string;
  address?: string;
  startDate?: string;
  expectedCompletion?: string;
  password?: string;
};

export type ApplicationInput = {
  studentId: string;
  organization: string;
  position: string;
  appliedOn: string;
  notes?: string;
};

export type HourInput = {
  studentId: string;
  date: string;
  hours: number;
  description: string;
};

export type RegisterInput = {
  id: string;
  name: string;
  email: string;
  program: "BSIT" | "BSBA" | "BSHM";
  section: string;
  phone?: string;
  password: string;
};

export type ContactInput = {
  phone: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
};

export const api = {
  login: (input: { userId: string; password: string; role: "admin" | "student"; keepSignedIn: boolean }) =>
    request<UserDTO>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  register: (input: RegisterInput) =>
    request<UserDTO>("/auth/register", { method: "POST", body: JSON.stringify(input) }),
  me: () => request<UserDTO>("/auth/me"),
  updateMyProfile: (input: ContactInput) =>
    request<StudentDTO>("/me/profile", { method: "PATCH", body: JSON.stringify(input) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  requestPasswordAssistance: (email: string) =>
    request<{ message: string }>("/auth/password-assistance", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  changePassword: (input: { currentPassword: string; password: string }) =>
    request<{ message: string }>("/auth/password", { method: "PATCH", body: JSON.stringify(input) }),

  dashboard: (term?: string) => request<DashboardDTO>(`/dashboard${query({ term })}`),
  terms: () => request<string[]>("/terms"),
  requirements: () => request<readonly string[]>("/requirements"),

  students: (params: { term?: string; search?: string; program?: string; section?: string; status?: string } = {}) =>
    request<StudentDTO[]>(`/students${query(params)}`),
  student: (id: string) => request<StudentDTO>(`/students/${encodeURIComponent(id)}`),
  createStudent: (input: StudentInput) =>
    request<StudentDTO>("/students", { method: "POST", body: JSON.stringify(input) }),
  updateStudent: (id: string, input: StudentInput) =>
    request<StudentDTO>(`/students/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),

  applications: (params: { studentId?: string; term?: string; status?: string } = {}) =>
    request<ApplicationDTO[]>(`/applications${query(params)}`),
  createApplication: (input: ApplicationInput) =>
    request<ApplicationDTO>("/applications", { method: "POST", body: JSON.stringify(input) }),
  updateApplication: (id: number, status: ApplicationDTO["status"]) =>
    request<ApplicationDTO>(`/applications/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  documents: (params: { studentId?: string } = {}) =>
    request<DocumentDTO[]>(`/documents${query(params)}`),
  uploadDocument: (input: { studentId: string; requirement: string; file: File }) => {
    const body = new FormData();
    body.append("studentId", input.studentId);
    body.append("requirement", input.requirement);
    body.append("file", input.file);
    return request<DocumentDTO>("/documents", { method: "POST", body });
  },
  updateDocument: (id: number, input: { status: "Verified" | "Rejected"; reviewNote?: string }) =>
    request<DocumentDTO>(`/documents/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  documentDownloadUrl: (id: number) => `${API_BASE}/documents/${id}/download`,

  hours: (params: { studentId?: string } = {}) => request<HourDTO[]>(`/hours${query(params)}`),
  createHour: (input: HourInput) =>
    request<HourDTO>("/hours", { method: "POST", body: JSON.stringify(input) }),
  updateHour: (id: number, status: HourDTO["status"]) =>
    request<HourDTO>(`/hours/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),

  followUps: () => request<FollowUpDTO[]>("/follow-ups"),
  createFollowUp: (input: { studentId: string; note: string }) =>
    request<FollowUpDTO>("/follow-ups", { method: "POST", body: JSON.stringify(input) }),

  reportExportUrl: (term?: string) => `${API_BASE}/reports/export${query({ term })}`,
};
