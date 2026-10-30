import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { HourDTO, StudentDTO } from "../../../../shared/contracts";
import { api, ApiError } from "../../services/api";
import "./ProgressMonitoringPage.css";

type ToastMessage = { title: string; detail?: string; kind?: "success" | "info" };

type EntryForm = { studentId: string; date: string; hours: string; description: string };

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const todayIso = () => isoDate(new Date());
const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const statusTone = (status: string) => status.toLowerCase().replace(/\s+/g, "-");
const weekKey = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return isoDate(date);
};

export default function ProgressMonitoringPage() {
  const [students, setStudents] = useState<StudentDTO[]>([]);
  const [hours, setHours] = useState<HourDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("All programs");
  const [detailsSwitching, setDetailsSwitching] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>({ studentId: "", date: todayIso(), hours: "8", description: "" });
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const switchTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);

  async function load(preferredId?: string) {
    setLoading(true);
    try {
      const [studentRows, hourRows] = await Promise.all([api.students(), api.hours()]);
      setStudents(studentRows);
      setHours(hourRows);
      setSelectedStudentId((current) => preferredId || (studentRows.some((student) => student.id === current) ? current : studentRows[0]?.id ?? ""));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Could not load progress records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? students[0];
  const studentHours = useMemo(
    () => hours.filter((entry) => entry.studentId === selectedStudent?.id),
    [hours, selectedStudent?.id]
  );
  const approvedHours = studentHours.filter((entry) => entry.status === "Approved").reduce((sum, entry) => sum + entry.hours, 0);
  const pendingHours = studentHours.filter((entry) => entry.status === "Pending");
  const rejectedHours = studentHours.filter((entry) => entry.status === "Rejected");
  const requiredHours = selectedStudent?.requiredHours ?? 0;
  const remainingHours = Math.max(0, requiredHours - approvedHours);
  const progress = requiredHours ? Math.round((approvedHours / requiredHours) * 1000) / 10 : 0;
  const flag = progress >= 100 ? "Completed" : progress < 40 && ["Interning", "Accepted"].includes(selectedStudent?.status ?? "") ? "Behind plan" : "On task";
  const weeklyTarget = 40;
  const weeksRemaining = Math.ceil(remainingHours / weeklyTarget);

  const programs = useMemo(() => [...new Set(students.map((student) => student.program).filter(Boolean))].sort(), [students]);
  const studentOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return students.filter((student) => (!normalized || `${student.name} ${student.id}`.toLowerCase().includes(normalized))
      && (program === "All programs" || student.program === program));
  }, [students, query, program]);

  const weeklyTotals = useMemo(() => {
    const groups = new Map<string, HourDTO[]>();
    for (const entry of studentHours) {
      const key = weekKey(entry.date);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([week, entries]) => ({
        week,
        entries: entries.length,
        approved: entries.filter((entry) => entry.status === "Approved").reduce((sum, entry) => sum + entry.hours, 0),
        pending: entries.filter((entry) => entry.status === "Pending").length,
      }));
  }, [studentHours]);

  const behindPlan = students.filter((student) => ["Interning", "Accepted"].includes(student.status) && student.hoursDone < student.requiredHours * 0.5).length;

  function notify(title: string, detail?: string, kind: "success" | "info" = "info") {
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    setToast({ title, detail, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }

  function selectStudent(studentId: string) {
    if (switchTimer.current !== undefined) window.clearTimeout(switchTimer.current);
    setDetailsSwitching(false);
    setSelectedStudentId(studentId);
    switchTimer.current = window.setTimeout(() => { setDetailsSwitching(true); switchTimer.current = undefined; }, 25);
  }

  function changeProgram(value: string) {
    setProgram(value);
    const first = students.find((student) => value === "All programs" || student.program === value);
    if (first && !students.some((student) => student.id === selectedStudentId && (value === "All programs" || student.program === value))) selectStudent(first.id);
  }

  function focusBehindPlan() {
    const target = students.find((student) => ["Interning", "Accepted"].includes(student.status) && student.hoursDone < student.requiredHours * 0.5);
    if (target) {
      selectStudent(target.id);
      notify("Student behind plan", `${target.name} has ${target.hoursDone} of ${target.requiredHours} approved hours.`, "info");
    } else notify("No students behind plan", "Every active intern is on track.", "success");
  }

  function openEntryModal() {
    setEntryForm({ studentId: selectedStudent?.id ?? students[0]?.id ?? "", date: todayIso(), hours: "8", description: "" });
    setEntryOpen(true);
  }

  function updateEntry<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    setEntryForm((current) => ({ ...current, [key]: value }));
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entryForm.studentId) return;
    setSaving(true);
    try {
      await api.createHour({
        studentId: entryForm.studentId,
        date: entryForm.date,
        hours: Number(entryForm.hours),
        description: entryForm.description.trim(),
      });
      setEntryOpen(false);
      await load(entryForm.studentId);
      notify("Hour entry recorded", "The entry is now pending coordinator approval.", "success");
    } catch (error) {
      notify("Hour entry could not be saved", error instanceof ApiError ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewHour(entry: HourDTO, status: "Approved" | "Rejected") {
    setUpdatingId(entry.id);
    try {
      await api.updateHour(entry.id, status);
      await load(entry.studentId);
      notify(status === "Approved" ? "Hours approved" : "Hours rejected", `${entry.name} · ${entry.hours} h on ${formatDate(entry.date)}.`, "success");
    } catch (error) {
      notify("The entry could not be updated", error instanceof ApiError ? error.message : "Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  function exportLog() {
    if (!selectedStudent) return;
    const csv = [["Student", "Date", "Hours", "Description", "Status"], ...studentHours.map((entry) => [selectedStudent.name, entry.date, entry.hours, entry.description, entry.status])]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `hour-log-${selectedStudent.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Hour log exported", `${studentHours.length} entries included in the CSV.`, "success");
  }

  return (
    <section className="progress-page">
      <header className="progress-page-heading">
        <div>
          <h1>Internship progress monitoring</h1>
          <p>Track approved hours, review submissions and keep every placement on schedule.</p>
        </div>
        <button className="progress-primary-button" type="button" onClick={openEntryModal} disabled={!students.length}>
          <Plus size={14} />
          Add hour entry
        </button>
      </header>

      <div className="progress-filter-bar">
        <label className="progress-search-box">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student" aria-label="Search student" />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={13} /></button>}
        </label>
        <label className="progress-select-wrap">
          <select value={program} onChange={(event) => changeProgram(event.target.value)} aria-label="Filter by program">
            <option>All programs</option>
            {programs.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <ChevronDown size={12} />
        </label>
        <label className="progress-select-wrap progress-student-select">
          <select value={selectedStudent?.id ?? ""} onChange={(event) => selectStudent(event.target.value)} aria-label="Select a student">
            {studentOptions.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.id}</option>)}
            {!studentOptions.length && <option value="">No matching students</option>}
          </select>
          <ChevronDown size={12} />
        </label>
        <button className="progress-behind-link" type="button" onClick={focusBehindPlan}>
          {behindPlan} students behind plan <ArrowUpRight size={11} />
        </button>
      </div>

      {loadError && <div className="progress-empty-state">{loadError} <button className="progress-text-action" type="button" onClick={() => void load()}>Retry</button></div>}

      {selectedStudent ? (
        <div key={selectedStudent.id} className={`progress-details ${detailsSwitching ? "is-switching" : ""}`}>
          <section className="panel progress-summary-card">
            <div className="progress-summary-top">
              <span className="progress-avatar">{selectedStudent.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
              <div className="progress-summary-copy">
                <div className="progress-name-line">
                  <h2>{selectedStudent.name}</h2>
                  <span className={`progress-status status-${statusTone(selectedStudent.status)}`}>{selectedStudent.status}</span>
                  <span className={`progress-flag ${flag === "Behind plan" ? "behind" : flag === "Completed" ? "ahead" : "on-task"}`}>{flag}</span>
                </div>
                <p>{selectedStudent.program} {selectedStudent.section} · {selectedStudent.position || "No placement"} · {selectedStudent.organization}</p>
              </div>
            </div>

            <div className="progress-summary-stats">
              <div className="progress-metric-stat"><span>Required hours</span><strong>{requiredHours}</strong></div>
              <div className="progress-metric-stat"><span>Approved hours</span><strong>{approvedHours}</strong></div>
              <div className="progress-metric-stat"><span>Remaining hours</span><strong>{remainingHours}</strong></div>
              <div className="progress-metric-meta"><span>Internship start date</span><strong>{selectedStudent.startDate ? formatDate(selectedStudent.startDate) : "—"}</strong></div>
              <div className="progress-metric-meta"><span>Expected completion</span><strong>{selectedStudent.expectedCompletion ? formatDate(selectedStudent.expectedCompletion) : "—"}</strong></div>
              <div className="progress-metric-meta"><span>Weekly target</span><strong>{weeklyTarget} hours · 8 hours / day</strong></div>
              <div className="progress-metric-meta"><span>Assigned faculty adviser</span><strong>{selectedStudent.adviser || "Not assigned"}</strong></div>
            </div>

            <div className="progress-meter-wrap">
              <div className="progress-meter" aria-label={`${progress}% of required internship hours completed`}><span style={{ width: `${Math.min(100, progress)}%` }} /></div>
              <div className="progress-meter-footer"><span>{progress}% complete</span><span>Approved hours only · {weeksRemaining} week{weeksRemaining === 1 ? "" : "s"} remaining</span></div>
            </div>
          </section>

          <section className="panel progress-remarks-card">
            <div className="progress-card-heading">
              <div><h2>Hour review</h2><p>{pendingHours.length} pending · {rejectedHours.length} rejected</p></div>
            </div>
            <div className="progress-pending-list">
              {pendingHours.slice(0, 4).map((entry) => (
                <div className="progress-follow-up" key={entry.id}>
                  <Clock3 size={14} />
                  <div>
                    <strong>{entry.hours} h · {formatDate(entry.date)}</strong>
                    <span>{entry.description}</span>
                    <div className="progress-review-actions">
                      <button type="button" disabled={updatingId === entry.id} onClick={() => void reviewHour(entry, "Approved")}>Approve</button>
                      <button type="button" disabled={updatingId === entry.id} onClick={() => void reviewHour(entry, "Rejected")}>Reject</button>
                    </div>
                  </div>
                </div>
              ))}
              {!pendingHours.length && <div className="progress-empty-state">No hour entries are waiting for review.</div>}
            </div>
            <button className="progress-text-action" type="button" onClick={openEntryModal}>Log another hour entry <Plus size={11} /></button>
          </section>

          <div className="progress-week-grid">
            <section className="panel progress-attendance-card">
              <div className="progress-card-heading">
                <div><h2>Hour entries</h2><p>Every logged day for {selectedStudent.name.split(/\s+/)[0]}</p></div>
                <button className="progress-card-link" type="button" onClick={exportLog}>Export log <ArrowUpRight size={11} /></button>
              </div>
              <div className="progress-attendance-table-wrap">
                <table className="progress-attendance-table">
                  <thead><tr><th>Date</th><th>Work summary</th><th>Hours</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {studentHours.map((entry) => (
                      <tr key={entry.id}>
                        <td className="progress-date-cell">{formatDate(entry.date)}</td>
                        <td>{entry.description}</td>
                        <td>{entry.hours} h</td>
                        <td><span className={`progress-review-pill review-${entry.status.toLowerCase()}`}>{entry.status}</span></td>
                        <td>
                          {entry.status === "Pending" ? (
                            <span className="progress-review-actions">
                              <button type="button" disabled={updatingId === entry.id} onClick={() => void reviewHour(entry, "Approved")}>Approve</button>
                              <button type="button" disabled={updatingId === entry.id} onClick={() => void reviewHour(entry, "Rejected")}>Reject</button>
                            </span>
                          ) : <span className="progress-date-cell">Recorded</span>}
                        </td>
                      </tr>
                    ))}
                    {!studentHours.length && <tr><td colSpan={5} className="progress-empty-state">No hours logged for this student yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="progress-attendance-footer"><span>Only approved hours count toward completion · daily limit 24 h</span><strong>{studentHours.length} entries</strong></div>
            </section>

            <section className="panel progress-accomplishments-card">
              <div className="progress-card-heading">
                <div><h2>Weekly totals</h2><p>Approved and pending hours by week</p></div>
                <button className="progress-card-link" type="button" onClick={() => void load()} disabled={loading}>Refresh <ArrowUpRight size={11} /></button>
              </div>
              <div className="progress-accomplishment-list">
                {weeklyTotals.map((week) => (
                  <article className="progress-accomplishment" key={week.week}>
                    <div className="progress-accomplishment-heading">
                      <strong>Week of {formatDate(week.week)}</strong>
                      <span className="progress-approved-pill">{week.approved} h approved</span>
                    </div>
                    <p>{week.entries} entr{week.entries === 1 ? "y" : "ies"} logged{week.pending ? ` · ${week.pending} awaiting review` : ""}.</p>
                  </article>
                ))}
                {!weeklyTotals.length && <div className="progress-empty-state">No weekly totals are available yet.</div>}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="progress-empty-state">{loading ? "Loading students…" : "No students found. Add a student profile to begin monitoring progress."}</div>
      )}

      {entryOpen && (
        <div className="progress-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEntryOpen(false); }}>
          <section className="progress-modal" role="dialog" aria-modal="true" aria-labelledby="progress-entry-title">
            <div className="progress-modal-heading">
              <div><span>PROGRESS MONITORING</span><h2 id="progress-entry-title">Add hour entry</h2><p>Record hours and a work summary for a student.</p></div>
              <button type="button" onClick={() => setEntryOpen(false)} aria-label="Close dialog" disabled={saving}><X size={17} /></button>
            </div>
            <form onSubmit={saveEntry}>
              <div className="progress-form-grid">
                <label className="progress-form-field progress-form-wide">
                  <span>Student</span>
                  <select value={entryForm.studentId} onChange={(event) => updateEntry("studentId", event.target.value)}>
                    {students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.program} {student.section}</option>)}
                  </select>
                </label>
                <label className="progress-form-field"><span>Entry date *</span><input required type="date" max={todayIso()} value={entryForm.date} onChange={(event) => updateEntry("date", event.target.value)} /></label>
                <label className="progress-form-field"><span>Hours *</span><input required min="0.25" max="24" step="0.25" type="number" value={entryForm.hours} onChange={(event) => updateEntry("hours", event.target.value)} /></label>
                <label className="progress-form-field progress-form-wide">
                  <span>Work summary *</span>
                  <textarea required rows={4} value={entryForm.description} onChange={(event) => updateEntry("description", event.target.value)} placeholder="Describe the tasks completed and the outcome demonstrated." />
                </label>
              </div>
              <div className="progress-modal-actions">
                <button className="progress-cancel-button" type="button" onClick={() => setEntryOpen(false)} disabled={saving}>Cancel</button>
                <button className="progress-primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save hour entry"}</button>
              </div>
              <p className="progress-form-note">The student needs an active interning placement. New entries start as pending.</p>
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
