import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react";
import type { ApplicationDTO, DashboardDTO, StudentDTO } from "../../../../shared/contracts";
import { api, ApiError } from "../../services/api";
import "./ApplicationsPage.css";

type TimelineItem = {
  title: string;
  detail: string;
  date: string;
  kind: "success" | "interview" | "submitted" | "closed";
};

type ToastMessage = {
  title: string;
  detail?: string;
  kind?: "success" | "info";
};

type ApplicationForm = {
  studentId: string;
  organization: string;
  position: string;
  appliedOn: string;
  notes: string;
};

const PAGE_SIZE = 6;
const statuses: ApplicationDTO["status"][] = ["Applying", "Accepted", "Interning", "Completed", "Rejected"];

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value || "—"
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function statusTone(status: ApplicationDTO["status"]) {
  if (status === "Rejected") return "withdrawn";
  if (status === "Applying") return "review";
  if (status === "Completed") return "closed";
  return "interview";
}

function decisionTone(status: ApplicationDTO["status"]) {
  if (status === "Rejected") return "rejected";
  if (status === "Applying") return "pending";
  return "accepted";
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationDTO[]>([]);
  const [students, setStudents] = useState<StudentDTO[]>([]);
  const [summary, setSummary] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("All programs");
  const [section, setSection] = useState("All sections");
  const [status, setStatus] = useState("All statuses");
  const [dateFilter, setDateFilter] = useState("Applied: all dates");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [historyAnimating, setHistoryAnimating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ApplicationForm>({ studentId: "", organization: "", position: "", appliedOn: todayIso(), notes: "" });
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const historyTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);

  async function load() {
    setLoading(true);
    try {
      const [applicationRows, studentRows, dashboard] = await Promise.all([
        api.applications(),
        api.students(),
        api.dashboard(),
      ]);
      setApplications(applicationRows);
      setStudents(studentRows);
      setSummary(dashboard);
      setSelectedId((current) => (applicationRows.some((item) => item.id === current) ? current : applicationRows[0]?.id ?? null));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return applications.filter((application) => {
      if (
        normalizedQuery &&
        !`${application.name} ${application.studentId} ${application.organization} ${application.position}`
          .toLowerCase()
          .includes(normalizedQuery)
      ) return false;
      if (program !== "All programs" && !application.program.startsWith(program)) return false;
      if (section !== "All sections" && application.program !== section) return false;
      if (status !== "All statuses" && application.status !== status) return false;
      if (dateFilter !== "Applied: all dates") {
        const applied = new Date(`${application.appliedOn}T00:00:00`).getTime();
        const days = dateFilter === "Applied: last 7 days" ? 7 : dateFilter === "Applied: last 30 days" ? 30 : 120;
        if (Number.isNaN(applied) || applied < Date.now() - days * 86_400_000) return false;
      }
      return true;
    });
  }, [applications, query, program, section, status, dateFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageStart = Math.min(Math.max(1, safePage - 1), Math.max(1, pageCount - 2));
  const pageNumbers = Array.from({ length: Math.min(3, pageCount) }, (_, index) => pageStart + index);
  const selected = applications.find((application) => application.id === selectedId) ?? null;
  const related = selected ? applications.filter((application) => application.studentId === selected.studentId) : [];
  const historyItems = selected ? historyFor(selected, related) : [];
  const pipeline = (label: string) => summary?.pipeline.find((item) => item.label === label)?.count ?? 0;

  function notify(title: string, detail?: string, kind: "success" | "info" = "info") {
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    setToast({ title, detail, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  }

  function selectApplication(application: ApplicationDTO) {
    if (historyTimer.current !== undefined) window.clearTimeout(historyTimer.current);
    setSelectedId(application.id);
    setHistoryAnimating(false);
    historyTimer.current = window.setTimeout(() => {
      setHistoryAnimating(true);
      historyTimer.current = window.setTimeout(() => {
        setHistoryAnimating(false);
        historyTimer.current = undefined;
      }, 850);
    }, 25);
  }

  function openRecordModal() {
    const firstStudent = students.find((student) => student.status === "Not applied") ?? students[0];
    setForm({ studentId: firstStudent?.id ?? "", organization: "", position: "", appliedOn: todayIso(), notes: "" });
    setModalOpen(true);
  }

  function updateForm<K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.studentId || !form.organization.trim() || !form.position.trim()) return;
    setSaving(true);
    try {
      const saved = await api.createApplication({
        studentId: form.studentId,
        organization: form.organization.trim(),
        position: form.position.trim(),
        appliedOn: form.appliedOn,
        notes: form.notes.trim(),
      });
      setModalOpen(false);
      setQuery("");
      setProgram("All programs");
      setSection("All sections");
      setStatus("All statuses");
      setDateFilter("Applied: all dates");
      setPage(1);
      await load();
      setSelectedId(saved.id);
      notify("Application recorded", `${saved.name} · ${saved.organization}`, "success");
    } catch (error) {
      notify("Could not save application", error instanceof ApiError ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(application: ApplicationDTO, next: ApplicationDTO["status"]) {
    if (next === application.status) return;
    setUpdatingId(application.id);
    try {
      await api.updateApplication(application.id, next);
      setApplications((current) => current.map((item) => item.id === application.id ? { ...item, status: next } : item));
      notify("Application updated", `${application.name} is now marked ${next}.`, "success");
      await load();
    } catch (error) {
      notify("Status could not be changed", error instanceof ApiError ? error.message : "Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  function exportCSV() {
    const rows = filtered.map((application) => [
      application.name,
      application.studentId,
      application.program,
      application.organization,
      application.position,
      application.appliedOn,
      application.status,
      application.notes,
    ]);
    const csv = [
      ["Student", "Student ID", "Program", "Organization", "Position", "Applied on", "Status", "Notes"],
      ...rows,
    ]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "internship-application-tracking.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify("Register exported", `${filtered.length} application records included in the CSV.`, "success");
  }

  return (
    <section className="application-page">
      <header className="application-page-heading">
        <div>
          <h1>Internship application tracking</h1>
          <p>Follow every application from first submission to a confirmed placement.</p>
        </div>
        <button className="report-button application-record-button" type="button" onClick={openRecordModal} disabled={!students.length}>
          <Plus size={15} />
          Record application
        </button>
      </header>

      <section className="stat-grid application-stat-grid" aria-label="Application summary">
        <article className="stat-card">
          <div className="stat-card-top"><span>Students applying</span><span className="stat-icon purple"><Send size={14} /></span></div>
          <strong>{pipeline("Applying")}</strong><p>Awaiting interviews or decisions</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-top"><span>Accepted students</span><span className="stat-icon mint"><CheckCircle2 size={14} /></span></div>
          <strong>{pipeline("Accepted")}</strong><p>Preparing to start their internship</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-top"><span>Currently interning</span><span className="stat-icon app-tint-blue"><CalendarDays size={14} /></span></div>
          <strong>{pipeline("Interning")}</strong><p>Active placements this term</p>
        </article>
        <article className="stat-card">
          <div className="stat-card-top"><span>Not yet applied</span><span className="stat-icon amber"><Clock3 size={14} /></span></div>
          <strong>{pipeline("Not applied")}</strong><p>Follow-up needed with advisers</p>
        </article>
      </section>

      {loadError && <div className="application-footnote">{loadError} <button className="text-action" type="button" onClick={() => void load()}>Retry</button></div>}

      <section className="panel application-register-panel">
        <div className="panel-heading application-register-heading">
          <div>
            <h2>Application register</h2>
            <p>{loading ? "Loading…" : `${applications.length} applications recorded · students may have more than one application`}</p>
          </div>
          <button className="text-action application-export" type="button" onClick={exportCSV}>
            Export register <Download size={12} />
          </button>
        </div>

        <div className="application-filters">
          <label className="search-field application-search">
            <Search size={14} />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search student or organization" aria-label="Search student or organization" />
          </label>
          <label className="application-select">
            <select value={program} onChange={(event) => { setProgram(event.target.value); setPage(1); }} aria-label="Filter by program">
              <option>All programs</option><option>BSIT</option><option>BSBA</option><option>BSHM</option>
            </select>
            <ChevronDown size={12} />
          </label>
          <label className="application-select">
            <select value={section} onChange={(event) => { setSection(event.target.value); setPage(1); }} aria-label="Filter by section">
              <option>All sections</option>
              {Array.from(new Set(applications.map((application) => application.program))).map((value) => <option key={value}>{value}</option>)}
            </select>
            <ChevronDown size={12} />
          </label>
          <label className="application-select">
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by application status">
              <option>All statuses</option>
              {statuses.map((value) => <option key={value}>{value}</option>)}
            </select>
            <ChevronDown size={12} />
          </label>
          <label className="application-select">
            <select value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1); }} aria-label="Filter by application date">
              <option>Applied: all dates</option>
              <option>Applied: last 7 days</option>
              <option>Applied: last 30 days</option>
              <option>Applied: this semester</option>
            </select>
            <ChevronDown size={12} />
          </label>
        </div>

        <div className="application-table-wrap">
          <table className="register-table application-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Organization</th>
                <th>Position</th>
                <th>Date applied</th>
                <th>Status</th>
                <th>Decision</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((application) => (
                <tr
                  key={application.id}
                  className={selectedId === application.id ? "is-selected" : ""}
                  tabIndex={0}
                  onClick={() => selectApplication(application)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectApplication(application);
                    }
                  }}
                >
                  <td>
                    <strong>{application.name || "Unknown student"}</strong>
                    <small>{application.studentId} · {application.program}</small>
                  </td>
                  <td>{application.organization}</td>
                  <td>{application.position}</td>
                  <td className="application-date-cell">{formatDate(application.appliedOn)}</td>
                  <td><span className={`application-pill app-status-${statusTone(application.status)}`}>{application.status}</span></td>
                  <td><span className={`application-pill app-decision-${decisionTone(application.status)}`}>{decisionLabel(application.status)}</span></td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <select
                      className="application-status-select"
                      value={application.status}
                      disabled={updatingId === application.id}
                      onChange={(event) => void changeStatus(application, event.target.value as ApplicationDTO["status"])}
                      aria-label={`Update status for ${application.name}`}
                    >
                      {statuses.map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr><td colSpan={7} className="application-empty-state">No applications match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="register-pagination application-pagination">
          <span>Showing {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} applications</span>
          <div>
            <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={13} /> Previous</button>
            {pageNumbers.map((number) => (
              <button key={number} type="button" className={`application-page-number ${number === safePage ? "is-current" : ""}`} onClick={() => setPage(number)}>{number}</button>
            ))}
            <button type="button" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next <ChevronRight size={13} /></button>
          </div>
        </div>
      </section>

      <div className="application-history-wrap">
        <section className={`panel application-history-panel ${historyAnimating ? "is-switching" : ""}`}>
          <div className="application-history-heading">
            <div>
              <h2>Application history</h2>
              <p className="application-history-sub">
                <strong>{selected?.name || "Select an application"}</strong>
                {selected ? ` · ${related.length} application${related.length === 1 ? "" : "s"} on record` : ""}
              </p>
            </div>
            <button className="text-action" type="button" onClick={() => selected && notify("Application details", `${selected.organization} · ${selected.position}`, "info")}>
              Full history <ArrowUpRight size={12} />
            </button>
          </div>
          <ol className="application-timeline">
            {historyItems.map((item) => (
              <li className="application-timeline-item" key={`${item.title}-${item.date}`}>
                <span className={`application-timeline-icon ${item.kind}`}>
                  {item.kind === "success" && <CheckCircle2 size={12} />}
                  {item.kind === "interview" && <Clock3 size={12} />}
                  {item.kind === "submitted" && <Send size={12} />}
                  {item.kind === "closed" && <BriefcaseBusiness size={12} />}
                </span>
                <div className="application-timeline-copy"><strong>{item.title}</strong><p>{item.detail}</p></div>
                <span className="application-timeline-date">{item.date}</span>
              </li>
            ))}
            {!historyItems.length && <li className="application-empty-state">Select an application to view its history.</li>}
          </ol>
        </section>
      </div>

      <p className="application-footnote">
        Application decisions are recorded by college staff. Organization contacts do not need platform accounts.
      </p>

      {modalOpen && (
        <div className="application-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <section className="application-modal" role="dialog" aria-modal="true" aria-labelledby="application-modal-title">
            <div className="application-modal-heading">
              <div>
                <span>PLACEMENT MANAGEMENT</span>
                <h2 id="application-modal-title">Record application</h2>
                <p>Log a new internship application for a student.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close dialog" disabled={saving}><X size={18} /></button>
            </div>
            <form onSubmit={saveApplication}>
              <div className="application-form-grid">
                <label className="application-form-field application-form-wide">
                  <span>Student *</span>
                  <select required value={form.studentId} onChange={(event) => updateForm("studentId", event.target.value)}>
                    <option value="" disabled>Select a student</option>
                    {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.id}</option>)}
                  </select>
                </label>
                <label className="application-form-field application-form-wide">
                  <span>Organization *</span>
                  <input required value={form.organization} onChange={(event) => updateForm("organization", event.target.value)} placeholder="Host organization" />
                </label>
                <label className="application-form-field">
                  <span>Position *</span>
                  <input required value={form.position} onChange={(event) => updateForm("position", event.target.value)} placeholder="e.g. Software Dev. Intern" />
                </label>
                <label className="application-form-field">
                  <span>Date applied *</span>
                  <input required type="date" value={form.appliedOn} onChange={(event) => updateForm("appliedOn", event.target.value)} />
                </label>
                <label className="application-form-field application-form-wide">
                  <span>Notes</span>
                  <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Optional notes for this application" rows={3} />
                </label>
              </div>
              <div className="application-modal-actions">
                <button className="application-cancel-button" type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button className="application-primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save application"}</button>
              </div>
              <p className="application-form-note">New applications start as “Applying”. Use the status selector in the register to move them forward.</p>
            </form>
          </section>
        </div>
      )}

      {toast && (
        <div className={`interaction-toast ${toast.kind === "success" ? "toast-success" : "toast-info"}`} role="status">
          <span className="toast-icon">{toast.kind === "success" ? <CheckCircle2 size={16} /> : <Activity size={16} />}</span>
          <span className="toast-copy"><strong>{toast.title}</strong>{toast.detail && <small>{toast.detail}</small>}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}
    </section>
  );
}

function decisionLabel(status: ApplicationDTO["status"]) {
  if (status === "Rejected") return "Rejected";
  if (status === "Applying") return "Pending";
  return "Accepted";
}

function historyFor(application: ApplicationDTO, related: ApplicationDTO[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  const statusItem: TimelineItem =
    application.status === "Rejected"
      ? { title: `${application.organization} application rejected`, detail: "The college recorded a negative decision for this application.", date: formatDate(application.appliedOn), kind: "closed" }
      : application.status === "Applying"
        ? { title: "Application awaiting review", detail: `${application.organization} · ${application.position}`, date: formatDate(application.appliedOn), kind: "interview" }
        : application.status === "Completed"
          ? { title: "Internship completed", detail: `${application.organization} · all completion requirements verified.`, date: formatDate(application.appliedOn), kind: "success" }
          : { title: `${application.organization} offer accepted`, detail: `${application.name} is recorded as ${application.status.toLowerCase()} with this organization.`, date: formatDate(application.appliedOn), kind: "success" };
  items.push(statusItem);
  items.push({ title: `Application submitted to ${application.organization}`, detail: application.position, date: formatDate(application.appliedOn), kind: "submitted" });
  if (application.notes) items.push({ title: "Application notes", detail: application.notes, date: formatDate(application.appliedOn), kind: "closed" });
  if (related.length > 1) items.push({ title: "Other applications on record", detail: `${related.length - 1} other application${related.length - 1 === 1 ? "" : "s"} for this student.`, date: formatDate(application.appliedOn), kind: "closed" });
  return items;
}
