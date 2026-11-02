import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Flag,
  MessageSquarePlus,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import type { DocumentDTO, FollowUpDTO, HourDTO, StudentDTO } from "../../../../shared/contracts";
import { api, ApiError } from "../../services/api";
import "./MonitoringReportsPage.css";

type ToastMessage = { title: string; detail?: string; kind?: "success" | "info" };

type Readiness = "Ready for evaluation" | "Documents pending" | "In progress" | "Behind plan" | "Not started" | "Completed";

const readinessOptions: Readiness[] = ["Ready for evaluation", "Documents pending", "In progress", "Behind plan", "Not started", "Completed"];

const readinessTone: Record<Readiness, string> = {
  "Ready for evaluation": "ready",
  "Documents pending": "docs",
  "In progress": "progress",
  "Behind plan": "behind",
  "Not started": "idle",
  Completed: "done",
};

const PAGE_SIZE = 8;

function readinessOf(student: StudentDTO): Readiness {
  if (student.status === "Completed") return "Completed";
  const hoursComplete = student.requiredHours > 0 && student.hoursDone >= student.requiredHours;
  const documentsComplete = student.verifiedDocuments >= student.totalDocuments;
  if (hoursComplete && documentsComplete) return "Ready for evaluation";
  if (hoursComplete) return "Documents pending";
  if (["Interning", "Accepted"].includes(student.status)) {
    return student.hoursDone < student.requiredHours * 0.5 ? "Behind plan" : "In progress";
  }
  return "Not started";
}

const percent = (part: number, whole: number) => (whole ? Math.min(100, Math.round((part / whole) * 1000) / 10) : 0);
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const formatDate = (value: string) => {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MonitoringReportsPage() {
  const [students, setStudents] = useState<StudentDTO[]>([]);
  const [hours, setHours] = useState<HourDTO[]>([]);
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("All programs");
  const [readiness, setReadiness] = useState<"All readiness" | Readiness>("All readiness");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [detailsSwitching, setDetailsSwitching] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const switchTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);

  async function load() {
    setLoading(true);
    try {
      const [studentRows, hourRows, documentRows, followUpRows] = await Promise.all([
        api.students(),
        api.hours(),
        api.documents(),
        api.followUps(),
      ]);
      setStudents(studentRows);
      setHours(hourRows);
      setDocuments(documentRows);
      setFollowUps(followUpRows);
      setSelectedId((current) => (studentRows.some((student) => student.id === current) ? current : studentRows[0]?.id ?? ""));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Could not load monitoring records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => {
      window.clearTimeout(switchTimer.current);
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  function notify(title: string, detail?: string, kind: "success" | "info" = "info") {
    window.clearTimeout(toastTimer.current);
    setToast({ title, detail, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }

  const programs = useMemo(() => [...new Set(students.map((student) => student.program).filter(Boolean))].sort(), [students]);

  const rows = useMemo(() => students.map((student) => ({ student, readiness: readinessOf(student) })), [students]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter(({ student, readiness: state }) =>
      (!normalized || `${student.name} ${student.id} ${student.organization}`.toLowerCase().includes(normalized))
      && (program === "All programs" || student.program === program)
      && (readiness === "All readiness" || state === readiness));
  }, [rows, query, program, readiness]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = useMemo(() => {
    const result = Object.fromEntries(readinessOptions.map((option) => [option, 0])) as Record<Readiness, number>;
    for (const row of rows) result[row.readiness] += 1;
    return result;
  }, [rows]);

  const followUpStudents = new Set(followUps.map((item) => item.studentId)).size;
  const totalRequired = students.reduce((sum, student) => sum + student.requiredHours, 0);
  const totalApproved = students.reduce((sum, student) => sum + Math.min(student.hoursDone, student.requiredHours), 0);
  const totalDocs = students.reduce((sum, student) => sum + student.totalDocuments, 0);
  const verifiedDocs = students.reduce((sum, student) => sum + student.verifiedDocuments, 0);

  const stats = [
    { label: "Ready for evaluation", value: counts["Ready for evaluation"], detail: "Hours and documents complete", icon: ClipboardCheck, tone: "purple" },
    { label: "Completed internships", value: counts.Completed, detail: `${percent(counts.Completed, students.length)}% of the cohort`, icon: CheckCircle2, tone: "mint" },
    { label: "Behind plan", value: counts["Behind plan"], detail: "Below half of required hours", icon: Clock3, tone: "amber" },
    { label: "Open follow-ups", value: followUps.length, detail: `${followUpStudents} student${followUpStudents === 1 ? "" : "s"} with coordinator notes`, icon: Flag, tone: "teal" },
  ];

  const programSummary = useMemo(() => programs.map((name) => {
    const group = students.filter((student) => student.program === name);
    const required = group.reduce((sum, student) => sum + student.requiredHours, 0);
    const approved = group.reduce((sum, student) => sum + Math.min(student.hoursDone, student.requiredHours), 0);
    const docs = group.reduce((sum, student) => sum + student.totalDocuments, 0);
    const verified = group.reduce((sum, student) => sum + student.verifiedDocuments, 0);
    return {
      name,
      students: group.length,
      interning: group.filter((student) => student.status === "Interning").length,
      completed: group.filter((student) => student.status === "Completed").length,
      ready: group.filter((student) => readinessOf(student) === "Ready for evaluation").length,
      hoursPercent: percent(approved, required),
      docsPercent: percent(verified, docs),
    };
  }), [programs, students]);

  const selected = students.find((student) => student.id === selectedId) ?? students[0];
  const selectedReadiness = selected ? readinessOf(selected) : undefined;
  const selectedFollowUps = useMemo(
    () => followUps.filter((item) => item.studentId === selected?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [followUps, selected?.id]
  );
  const selectedChecklist = useMemo(() => {
    if (!selected) return [];
    const ownDocs = documents.filter((item) => item.studentId === selected.id);
    const pendingHours = hours.filter((item) => item.studentId === selected.id && item.status === "Pending");
    const forReview = new Set(ownDocs.filter((item) => item.status === "For review").map((item) => item.requirement)).size;
    const submitted = new Set(ownDocs.map((item) => item.requirement)).size;
    const missing = Math.max(0, selected.totalDocuments - submitted);
    const remaining = Math.max(0, selected.requiredHours - selected.hoursDone);
    return [
      { label: "Required hours", done: remaining === 0, detail: remaining ? `${remaining} h still needed` : "All required hours approved" },
      { label: "Hour entries reviewed", done: pendingHours.length === 0, detail: pendingHours.length ? `${pendingHours.length} entr${pendingHours.length === 1 ? "y" : "ies"} awaiting approval` : "No pending hour entries" },
      { label: "Documents verified", done: selected.verifiedDocuments >= selected.totalDocuments, detail: `${selected.verifiedDocuments} of ${selected.totalDocuments} verified${forReview ? ` · ${forReview} for review` : ""}${missing ? ` · ${missing} missing` : ""}` },
      { label: "Placement recorded", done: selected.organization !== "Unassigned", detail: selected.organization !== "Unassigned" ? selected.organization : "No accepted placement yet" },
    ];
  }, [selected, documents, hours]);

  function selectStudent(studentId: string) {
    if (studentId === selected?.id) return;
    window.clearTimeout(switchTimer.current);
    setDetailsSwitching(false);
    setSelectedId(studentId);
    setNote("");
    switchTimer.current = window.setTimeout(() => setDetailsSwitching(true), 25);
  }

  function resetFilters() {
    setQuery("");
    setProgram("All programs");
    setReadiness("All readiness");
    setPage(1);
  }

  function focusReadiness(value: Readiness) {
    setReadiness(value);
    setPage(1);
    const target = rows.find((row) => row.readiness === value);
    if (target) selectStudent(target.student.id);
    notify(value, `${counts[value]} student${counts[value] === 1 ? "" : "s"} in the completion register.`);
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !note.trim()) return;
    setSavingNote(true);
    try {
      await api.createFollowUp({ studentId: selected.id, note: note.trim() });
      setFollowUps(await api.followUps());
      setNote("");
      notify("Follow-up recorded", `${selected.name} now has a new coordinator note.`, "success");
    } catch (error) {
      notify("Could not save follow-up", error instanceof ApiError ? error.message : "Please try again.");
    } finally {
      setSavingNote(false);
    }
  }

  async function exportProgressReport() {
    setExporting(true);
    try {
      const response = await fetch(api.reportExportUrl(), { credentials: "include" });
      if (!response.ok) throw new Error("export failed");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "internship-progress.csv";
      link.click();
      URL.revokeObjectURL(url);
      notify("Progress report exported", `${students.length} student records included in the CSV.`, "success");
    } catch {
      notify("Report could not be exported", "Check that the API is running and try again.");
    } finally {
      setExporting(false);
    }
  }

  function exportRegister() {
    downloadCsv("completion-register.csv", [
      ["Student ID", "Name", "Program", "Section", "Status", "Organization", "Approved hours", "Required hours", "Verified documents", "Required documents", "Readiness"],
      ...filtered.map(({ student, readiness: state }) => [student.id, student.name, student.program, student.section, student.status, student.organization, student.hoursDone, student.requiredHours, student.verifiedDocuments, student.totalDocuments, state]),
    ]);
    notify("Completion register exported", `${filtered.length} filtered records included in the CSV.`, "success");
  }

  function exportFollowUps() {
    const names = new Map(students.map((student) => [student.id, student.name]));
    downloadCsv("follow-up-log.csv", [
      ["Student ID", "Name", "Note", "Recorded on"],
      ...followUps.map((item) => [item.studentId, names.get(item.studentId) ?? "", item.note, formatDate(item.createdAt)]),
    ]);
    notify("Follow-up log exported", `${followUps.length} coordinator notes included in the CSV.`, "success");
  }

  function exportProgramSummary() {
    downloadCsv("program-summary.csv", [
      ["Program", "Students", "Interning", "Completed", "Ready for evaluation", "Hours completion %", "Documents verified %"],
      ...programSummary.map((item) => [item.name, item.students, item.interning, item.completed, item.ready, item.hoursPercent, item.docsPercent]),
    ]);
    notify("Program summary exported", `${programSummary.length} programs included in the CSV.`, "success");
  }

  const reports = [
    { title: "Internship progress report", detail: "Status, approved hours and verified documents per student", icon: FileSpreadsheet, action: () => void exportProgressReport(), busy: exporting },
    { title: "Completion register", detail: `Current filtered view · ${filtered.length} students with readiness`, icon: ClipboardCheck, action: exportRegister, busy: false },
    { title: "Program summary", detail: "Hours and document completion by program", icon: Activity, action: exportProgramSummary, busy: false },
    { title: "Follow-up log", detail: `${followUps.length} coordinator notes across the cohort`, icon: FileText, action: exportFollowUps, busy: false },
  ];

  return (
    <section className="reports-page">
      <header className="reports-page-heading">
        <div>
          <h1>Monitoring &amp; reports</h1>
          <p>See who is ready for evaluation, follow up on students who need help and export summaries for the college.</p>
        </div>
        <button className="reports-primary-button" type="button" onClick={() => void exportProgressReport()} disabled={exporting || !students.length}>
          <Download size={14} />
          {exporting ? "Exporting…" : "Export progress report"}
        </button>
      </header>

      <section className="stat-grid reports-stat-grid" aria-label="Monitoring summary">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="stat-card" key={stat.label}>
              <div className="stat-card-top"><span>{stat.label}</span><span className={`stat-icon ${stat.tone}`}><Icon size={15} /></span></div>
              <strong>{loading && !students.length ? "—" : stat.value}</strong>
              <p>{stat.detail}</p>
            </article>
          );
        })}
      </section>

      {loadError && (
        <div className="reports-alert">
          <TriangleAlert size={15} />
          <span>{loadError}</span>
          <button className="reports-card-link" type="button" onClick={() => void load()}>Retry</button>
        </div>
      )}

      <div className="reports-filter-bar">
        <label className="reports-search-box">
          <Search size={14} />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search student or organization" aria-label="Search student or organization" />
          {query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setPage(1); }}><X size={13} /></button>}
        </label>
        <label className="reports-select-wrap">
          <select value={program} onChange={(event) => { setProgram(event.target.value); setPage(1); }} aria-label="Filter by program">
            <option>All programs</option>
            {programs.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <ChevronDown size={12} />
        </label>
        <label className="reports-select-wrap reports-readiness-select">
          <select value={readiness} onChange={(event) => { setReadiness(event.target.value as typeof readiness); setPage(1); }} aria-label="Filter by readiness">
            <option>All readiness</option>
            {readinessOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <ChevronDown size={12} />
        </label>
        <button className="reports-ready-link" type="button" onClick={() => focusReadiness("Ready for evaluation")}>
          {counts["Ready for evaluation"]} ready for evaluation <ArrowUpRight size={11} />
        </button>
      </div>

      <div className="reports-overview">
        <section className="panel reports-register-card">
          <div className="reports-card-heading">
            <div><h2>Completion register</h2><p>Approved hours, verified documents and evaluation readiness per student</p></div>
            <button className="reports-card-link" type="button" onClick={exportRegister} disabled={!filtered.length}>Export view <Download size={11} /></button>
          </div>
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead><tr><th>Student</th><th>Approved hours</th><th>Documents</th><th>Readiness</th><th>Action</th></tr></thead>
              <tbody>
                {shown.map(({ student, readiness: state }) => {
                  const hoursPercent = percent(student.hoursDone, student.requiredHours);
                  return (
                    <tr key={student.id} className={student.id === selected?.id ? "is-selected" : ""} onClick={() => selectStudent(student.id)}>
                      <td>
                        <div className="reports-student-cell">
                          <span className="reports-avatar-sm">{initialsOf(student.name)}</span>
                          <span><strong>{student.name}</strong><small>{student.id} · {student.program} {student.section}</small></span>
                        </div>
                      </td>
                      <td>
                        <div className="reports-mini-progress">
                          <span className="reports-mini-bar"><span style={{ width: `${hoursPercent}%` }} /></span>
                          <small>{student.hoursDone} / {student.requiredHours} h</small>
                        </div>
                      </td>
                      <td><span className="reports-doc-count">{student.verifiedDocuments}/{student.totalDocuments}</span></td>
                      <td><span className={`reports-pill readiness-${readinessTone[state]}`}>{state}</span></td>
                      <td>
                        <button className="reports-table-action" type="button" onClick={(event) => { event.stopPropagation(); selectStudent(student.id); }}>
                          {student.id === selected?.id ? "Viewing" : "View report"} <ArrowUpRight size={10} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!shown.length && (
                  <tr>
                    <td colSpan={5} className="reports-empty-cell">
                      {loading ? "Loading students…" : students.length ? <>No students match these filters. <button className="reports-card-link" type="button" onClick={resetFilters}>Clear filters</button></> : "No student profiles yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="reports-pagination">
            <span>Showing {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} students</span>
            <div>
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={12} /> Previous</button>
              <span className="reports-page-number">{currentPage}</span>
              <button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next <ChevronRight size={12} /></button>
            </div>
          </div>
        </section>

        <section className="panel reports-snapshot-card">
          <div className="reports-card-heading">
            <div><h2>Cohort snapshot</h2><p>{students.length} students across {programs.length} program{programs.length === 1 ? "" : "s"}</p></div>
            <button className="reports-card-link" type="button" onClick={() => void load()} disabled={loading}>{loading ? "Syncing…" : "Refresh"} <ArrowUpRight size={11} /></button>
          </div>

          <div className="reports-meter-block">
            <div className="reports-meter-label"><span>Required hours approved</span><strong>{percent(totalApproved, totalRequired)}%</strong></div>
            <div className="reports-meter"><span style={{ width: `${percent(totalApproved, totalRequired)}%` }} /></div>
            <small>{totalApproved.toLocaleString()} of {totalRequired.toLocaleString()} hours</small>
          </div>
          <div className="reports-meter-block">
            <div className="reports-meter-label"><span>Requirements verified</span><strong>{percent(verifiedDocs, totalDocs)}%</strong></div>
            <div className="reports-meter reports-meter-teal"><span style={{ width: `${percent(verifiedDocs, totalDocs)}%` }} /></div>
            <small>{verifiedDocs} of {totalDocs} documents</small>
          </div>

          <div className="reports-readiness-bar" aria-label="Readiness breakdown">
            {readinessOptions.map((option) => counts[option] > 0 && (
              <button
                key={option}
                type="button"
                className={`readiness-segment readiness-${readinessTone[option]}`}
                style={{ flexGrow: counts[option] }}
                title={`${option} · ${counts[option]}`}
                aria-label={`Filter ${option.toLowerCase()} students`}
                onClick={() => focusReadiness(option)}
              />
            ))}
          </div>
          <div className="reports-readiness-legend">
            {readinessOptions.map((option) => (
              <button key={option} type="button" className={readiness === option ? "is-active" : ""} onClick={() => focusReadiness(option)}>
                <span className={`reports-legend-dot readiness-${readinessTone[option]}`} />
                <span>{option}</span>
                <strong>{counts[option]}</strong>
              </button>
            ))}
          </div>
        </section>
      </div>

      {selected && selectedReadiness ? (
        <div key={selected.id} className={`reports-details ${detailsSwitching ? "is-switching" : ""}`}>
          <section className="panel reports-student-card">
            <div className="reports-student-top">
              <span className="reports-avatar">{initialsOf(selected.name)}</span>
              <div className="reports-student-copy">
                <div className="reports-name-line">
                  <h2>{selected.name}</h2>
                  <span className={`reports-pill readiness-${readinessTone[selectedReadiness]}`}>{selectedReadiness}</span>
                </div>
                <p>{selected.program} {selected.section} · {selected.position || "No position"} · {selected.organization}</p>
              </div>
            </div>

            <div className="reports-student-stats">
              <div><span>Approved hours</span><strong>{selected.hoursDone}</strong><small>of {selected.requiredHours} required</small></div>
              <div><span>Documents verified</span><strong>{selected.verifiedDocuments}</strong><small>of {selected.totalDocuments} requirements</small></div>
              <div><span>Coordinator notes</span><strong>{selectedFollowUps.length}</strong><small>follow-ups on record</small></div>
            </div>

            <div className="reports-meter-block">
              <div className="reports-meter-label"><span>Hours completion</span><strong>{percent(selected.hoursDone, selected.requiredHours)}%</strong></div>
              <div className="reports-meter"><span style={{ width: `${percent(selected.hoursDone, selected.requiredHours)}%` }} /></div>
            </div>

            <div className="reports-checklist">
              {selectedChecklist.map((item) => (
                <div key={item.label} className={`reports-check ${item.done ? "is-done" : ""}`}>
                  {item.done ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                  <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                </div>
              ))}
            </div>

            <div className="reports-student-meta">
              <span>Adviser <strong>{selected.adviser || "Not assigned"}</strong></span>
              <span>Supervisor <strong>{selected.supervisor || "Not recorded"}</strong></span>
              <span>Expected completion <strong>{selected.expectedCompletion ? formatDate(selected.expectedCompletion) : "—"}</strong></span>
            </div>
          </section>

          <section className="panel reports-notes-card">
            <div className="reports-card-heading">
              <div><h2>Follow-up notes</h2><p>Coordinator notes for {selected.name.split(/\s+/)[0]}</p></div>
            </div>
            <div className="reports-note-list">
              {selectedFollowUps.map((item) => (
                <article className="reports-note" key={item.id}>
                  <Flag size={13} />
                  <div><p>{item.note}</p><small>{formatDate(item.createdAt)}</small></div>
                </article>
              ))}
              {!selectedFollowUps.length && <div className="reports-empty-state">No follow-up notes recorded for this student.</div>}
            </div>
            <form className="reports-note-form" onSubmit={saveNote}>
              <label>
                <span>Add a follow-up note</span>
                <textarea rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Reminded student to submit the final evaluation form." />
              </label>
              <button className="reports-primary-button" type="submit" disabled={savingNote || !note.trim()}>
                <MessageSquarePlus size={13} />
                {savingNote ? "Saving…" : "Save note"}
              </button>
            </form>
          </section>
        </div>
      ) : (
        !loading && <div className="reports-empty-state">No students found. Add a student profile to begin monitoring.</div>
      )}

      <div className="reports-bottom-grid">
        <section className="panel reports-program-card">
          <div className="reports-card-heading">
            <div><h2>Program summary</h2><p>Hours and document completion by program</p></div>
            <button className="reports-card-link" type="button" onClick={exportProgramSummary} disabled={!programSummary.length}>Export <Download size={11} /></button>
          </div>
          <div className="reports-table-wrap">
            <table className="reports-table reports-program-table">
              <thead><tr><th>Program</th><th>Students</th><th>Interning</th><th>Completed</th><th>Hours</th><th>Documents</th></tr></thead>
              <tbody>
                {programSummary.map((item) => (
                  <tr key={item.name} onClick={() => { setProgram(item.name); setPage(1); }}>
                    <td><strong className="reports-program-name">{item.name}</strong></td>
                    <td>{item.students}</td>
                    <td>{item.interning}</td>
                    <td>{item.completed}</td>
                    <td><div className="reports-mini-progress"><span className="reports-mini-bar"><span style={{ width: `${item.hoursPercent}%` }} /></span><small>{item.hoursPercent}%</small></div></td>
                    <td><div className="reports-mini-progress"><span className="reports-mini-bar reports-mini-teal"><span style={{ width: `${item.docsPercent}%` }} /></span><small>{item.docsPercent}%</small></div></td>
                  </tr>
                ))}
                {!programSummary.length && <tr><td colSpan={6} className="reports-empty-cell">{loading ? "Loading programs…" : "No programs to summarize yet."}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel reports-downloads-card">
          <div className="reports-card-heading">
            <div><h2>Downloadable reports</h2><p>CSV files open in Excel or Google Sheets</p></div>
          </div>
          <div className="reports-download-list">
            {reports.map((report) => {
              const Icon = report.icon;
              return (
                <button key={report.title} type="button" className="reports-download" onClick={report.action} disabled={report.busy || !students.length}>
                  <span className="reports-download-icon"><Icon size={15} /></span>
                  <span className="reports-download-copy"><strong>{report.title}</strong><small>{report.busy ? "Preparing file…" : report.detail}</small></span>
                  <Download size={13} />
                </button>
              );
            })}
          </div>
        </section>
      </div>

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
