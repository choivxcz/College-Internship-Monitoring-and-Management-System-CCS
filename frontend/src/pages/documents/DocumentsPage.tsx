import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CircleX,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FileUp,
  FileWarning,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import type { DocumentDTO, StudentDTO } from "../../../../shared/contracts";
import { requirements as requiredDocuments } from "../../../../shared/contracts";
import { api, ApiError } from "../../services/api";
import "./DocumentsPage.css";

type DocumentStatus = "Verified" | "Rejected" | "Missing" | "Pending review";
type HistoryTone = "success" | "danger" | "neutral";

type Requirement = {
  id: string;
  name: string;
  status: DocumentStatus;
  document?: DocumentDTO;
};

type StudentDocuments = {
  id: string;
  name: string;
  program: string;
  section: string;
  requirements: Requirement[];
};

type ToastMessage = { title: string; detail?: string; kind?: "success" | "info" };

const statusLabels: Record<DocumentStatus, string> = {
  Verified: "Verified",
  Rejected: "Rejected",
  Missing: "Missing",
  "Pending review": "Pending review",
};

const statusTones: Record<DocumentStatus, string> = {
  Verified: "doc-status-verified",
  Rejected: "doc-status-rejected",
  Missing: "doc-status-missing",
  "Pending review": "doc-status-pending",
};

const documentStatus = (document: DocumentDTO): DocumentStatus =>
  document.status === "For review" ? "Pending review" : document.status;

function attentionPhrase(status: DocumentStatus) {
  if (status === "Rejected") return "rejected";
  if (status === "Missing") return "missing";
  if (status === "Pending review") return "awaiting review";
  return "verified";
}

function defaultDocumentId(student: StudentDocuments) {
  return (
    student.requirements.find((item) => item.status === "Rejected")?.id ??
    student.requirements.find((item) => item.status === "Missing")?.id ??
    student.requirements.find((item) => item.status === "Pending review")?.id ??
    student.requirements[0]?.id ??
    ""
  );
}

function reviewMatches(student: StudentDocuments, filter: string) {
  if (filter === "Awaiting verification") return student.requirements.some((item) => item.status === "Pending review");
  if (filter === "Rejected submissions") return student.requirements.some((item) => item.status === "Rejected");
  if (filter === "Incomplete requirements") return student.requirements.some((item) => item.status === "Missing");
  if (filter === "Needs review") return student.requirements.some((item) => item.status !== "Verified");
  return true;
}

export default function DocumentsPage() {
  const [students, setStudents] = useState<StudentDTO[]>([]);
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [switching, setSwitching] = useState(false);
  const [documentSwitching, setDocumentSwitching] = useState(false);
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("All programs");
  const [section, setSection] = useState("All sections");
  const [reviewFilter, setReviewFilter] = useState("Needs review");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const switchTimer = useRef<number | undefined>(undefined);
  const documentSwitchTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const [studentRows, documentRows] = await Promise.all([api.students(), api.documents()]);
      setStudents(studentRows);
      setDocuments(documentRows);
      setSelectedStudentId((current) => (studentRows.some((student) => student.id === current) ? current : studentRows[0]?.id ?? ""));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Could not load document records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const studentRecords = useMemo<StudentDocuments[]>(() => students.map((student) => ({
    id: student.id,
    name: student.name,
    program: student.program,
    section: student.section,
    requirements: requiredDocuments.map((requirement) => {
      const document = documents.find((item) => item.studentId === student.id && item.requirement === requirement);
      return { id: requirement, name: requirement, document, status: document ? documentStatus(document) : "Missing" };
    }),
  })), [students, documents]);

  const selectedStudent = studentRecords.find((student) => student.id === selectedStudentId) ?? studentRecords[0];
  const selectedDocument = selectedStudent?.requirements.find((item) => item.id === selectedDocumentId) ?? selectedStudent?.requirements[0];
  const verified = selectedStudent?.requirements.filter((item) => item.status === "Verified").length ?? 0;
  const total = selectedStudent?.requirements.length ?? requiredDocuments.length;
  const attentionDocuments = selectedStudent?.requirements.filter((item) => item.status !== "Verified") ?? [];
  const nextDocument = selectedStudent?.requirements.find((item) => item.status === "Pending review");

  useEffect(() => {
    setRemarks(selectedDocument?.document?.reviewNote || "");
  }, [selectedDocument?.document?.id]);

  const stats = useMemo(() => {
    const all = studentRecords.flatMap((student) => student.requirements);
    const counts = {
      verified: all.filter((item) => item.status === "Verified").length,
      pending: all.filter((item) => item.status === "Pending review").length,
      rejected: all.filter((item) => item.status === "Rejected").length,
      missing: all.filter((item) => item.status === "Missing").length,
    };
    return [
      { label: "Verified submissions", value: String(counts.verified), detail: "Complete requirements on record", icon: FileCheck2, tone: "doc-mint" },
      { label: "Awaiting verification", value: String(counts.pending), detail: "Submitted copies need a decision", icon: Clock3, tone: "doc-blue" },
      { label: "Rejected submissions", value: String(counts.rejected), detail: "Corrected copies are required", icon: CircleX, tone: "doc-rose" },
      { label: "Missing requirements", value: String(counts.missing), detail: "No submission on record yet", icon: FileWarning, tone: "doc-sun" },
    ];
  }, [studentRecords]);

  const studentOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return studentRecords.filter((student) => {
      const searchable = `${student.name} ${student.id} ${student.program} ${student.section} ${student.requirements.map((item) => `${item.name} ${item.document?.originalName ?? ""}`).join(" ")}`.toLowerCase();
      return (!normalized || searchable.includes(normalized))
        && (program === "All programs" || student.program === program)
        && (section === "All sections" || `${student.program} ${student.section}` === section)
        && reviewMatches(student, reviewFilter);
    });
  }, [studentRecords, query, program, section, reviewFilter]);

  function notify(title: string, detail?: string, kind: "success" | "info" = "info") {
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    setToast({ title, detail, kind });
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }

  function selectStudent(studentId: string) {
    if (switchTimer.current !== undefined) window.clearTimeout(switchTimer.current);
    const student = studentRecords.find((item) => item.id === studentId);
    setSwitching(false);
    setSelectedStudentId(studentId);
    setSelectedDocumentId(student ? defaultDocumentId(student) : "");
    switchTimer.current = window.setTimeout(() => { setSwitching(true); switchTimer.current = undefined; }, 25);
  }

  function selectDocument(documentId: string) {
    if (documentSwitchTimer.current !== undefined) window.clearTimeout(documentSwitchTimer.current);
    setDocumentSwitching(false);
    setSelectedDocumentId(documentId);
    documentSwitchTimer.current = window.setTimeout(() => { setDocumentSwitching(true); documentSwitchTimer.current = undefined; }, 25);
  }

  async function reviewDocument(item: Requirement | undefined, status: "Verified" | "Rejected") {
    if (!item?.document) return;
    setSaving(true);
    try {
      await api.updateDocument(item.document.id, {
        status,
        reviewNote: item.id === selectedDocument?.id ? remarks.trim() : item.document.reviewNote,
      });
      await load();
      notify(status === "Verified" ? "Document verified" : "Document returned", `${item.name} was updated.`, "success");
    } catch (error) {
      notify("The document could not be updated", error instanceof ApiError ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function requestUpload() {
    if (!selectedDocument) return;
    if (selectedDocument.status === "Verified") {
      notify("Verified documents are locked", "Reject the verified document before replacing its file.");
      return;
    }
    uploadInputRef.current?.click();
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedStudent || !selectedDocument) return;
    setSaving(true);
    try {
      await api.uploadDocument({ studentId: selectedStudent.id, requirement: selectedDocument.name, file });
      await load();
      setSelectedDocumentId(selectedDocument.name);
      notify("Document uploaded", `${selectedDocument.name} is now awaiting review.`, "success");
    } catch (error) {
      notify("Upload failed", error instanceof ApiError ? error.message : "Choose a PDF, PNG or JPEG file up to 10 MB.");
    } finally {
      setSaving(false);
    }
  }

  function download(item: Requirement | undefined) {
    if (!item?.document) {
      notify("No file available", "This requirement has not been uploaded yet.");
      return;
    }
    window.location.href = api.documentDownloadUrl(item.document.id);
  }

  const history = selectedStudent
    ? [...(selectedStudent.requirements.filter((item) => item.document) as (Requirement & { document: DocumentDTO })[])]
      .sort((a, b) => b.document.submittedAt.localeCompare(a.document.submittedAt))
      .slice(0, 5)
      .map((item) => ({
        title: `${item.name} ${statusLabels[item.status].toLowerCase()}`,
        detail: `${item.document.originalName} · ${new Date(item.document.submittedAt).toLocaleDateString("en-GB")}`,
        tone: (item.status === "Verified" ? "success" : item.status === "Rejected" ? "danger" : "neutral") as HistoryTone,
      }))
    : [];

  const primaryLabel = !selectedDocument ? "Select a document"
    : selectedDocument.status === "Missing" ? "Upload document"
    : selectedDocument.status === "Rejected" ? "Request new copy"
    : selectedDocument.status === "Pending review" ? "Verify document"
    : "Download copy";
  const secondaryLabel = selectedDocument?.status === "Pending review" ? "Request changes" : "Download file";
  const bannerClass = !selectedDocument ? "doc-banner-missing"
    : selectedDocument.status === "Rejected" ? "doc-banner-rejected"
    : selectedDocument.status === "Missing" ? "doc-banner-missing"
    : selectedDocument.status === "Pending review" ? "doc-banner-pending"
    : "doc-banner-verified";
  const bannerCopy = !selectedDocument ? "No requirement selected"
    : selectedDocument.status === "Rejected" ? "Rejected: requirement not met"
    : selectedDocument.status === "Missing" ? "Missing: no submission on record"
    : selectedDocument.status === "Pending review" ? "Pending review: waiting for coordinator action"
    : "Verified: requirement complete";
  const shownRemarks = selectedDocument?.document?.reviewNote || (selectedDocument?.status === "Verified"
    ? "All details match the college requirement and this submission is complete."
    : "Check the submitted copy against the requirement before recording a decision.");

  function handlePrimaryAction() {
    if (!selectedDocument) return;
    if (selectedDocument.status === "Verified") download(selectedDocument);
    else if (selectedDocument.status === "Pending review") void reviewDocument(selectedDocument, "Verified");
    else requestUpload();
  }

  function handleSecondaryAction() {
    if (!selectedDocument) return;
    if (selectedDocument.status === "Pending review") void reviewDocument(selectedDocument, "Rejected");
    else if (selectedDocument.document) download(selectedDocument);
    else notify("No file available", "This requirement has not been uploaded yet.");
  }

  return (
    <section className="documents-page">
      <header className="documents-page-heading">
        <div>
          <h1>Internship document management</h1>
          <p>Review submissions, resolve missing requirements and keep a clear verification trail.</p>
        </div>
        <button className="documents-upload-button" type="button" onClick={requestUpload} disabled={!selectedDocument || selectedDocument.status === "Verified" || saving}>
          <Upload size={14} />
          Upload document
        </button>
      </header>

      <section className="stat-grid documents-stat-grid" aria-label="Document summary">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="stat-card" key={stat.label}>
              <div className="stat-card-top"><span>{stat.label}</span><span className={`stat-icon ${stat.tone}`}><Icon size={15} /></span></div>
              <strong>{stat.value}</strong>
              <p>{stat.detail}</p>
            </article>
          );
        })}
      </section>

      {loadError && <div className="checklist-alert"><TriangleAlert size={15}/><div><strong>{loadError}</strong><button className="text-action" type="button" onClick={() => void load()}>Retry</button></div></div>}

      <div className="documents-filter-bar">
        <label className="documents-search-box">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or document" aria-label="Search student or document" />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={13} /></button>}
        </label>
        <label className="documents-select-wrap">
          <select value={program} onChange={(event) => setProgram(event.target.value)} aria-label="Filter by program">
            <option>All programs</option><option>BSIT</option><option>BSBA</option><option>BSHM</option>
          </select>
          <ChevronDown size={12} />
        </label>
        <label className="documents-select-wrap">
          <select value={section} onChange={(event) => setSection(event.target.value)} aria-label="Filter by section">
            <option>All sections</option>
            {Array.from(new Set(studentRecords.map((student) => `${student.program} ${student.section}`))).map((item) => <option key={item}>{item}</option>)}
          </select>
          <ChevronDown size={12} />
        </label>
        <label className="documents-select-wrap">
          <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)} aria-label="Filter by review state">
            <option>Needs review</option><option>All review states</option><option>Awaiting verification</option><option>Rejected submissions</option><option>Incomplete requirements</option>
          </select>
          <ChevronDown size={12} />
        </label>
        <label className="documents-select-wrap documents-student-select">
          <select value={selectedStudent?.id ?? ""} onChange={(event) => selectStudent(event.target.value)} aria-label="Select a student">
            {studentOptions.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.program} {student.section}</option>)}
            {!studentOptions.length && <option value="">No matching students</option>}
          </select>
          <ChevronDown size={12} />
        </label>
      </div>

      {selectedStudent ? (
        <div key={selectedStudent.id} className={`documents-workspace ${switching ? "is-switching" : ""}`}>
          <section className="document-panel document-checklist-panel">
            <div className="checklist-heading">
              <div>
                <h2>Required document checklist</h2>
                <p>{selectedStudent.name} · {selectedStudent.id} · {selectedStudent.program} {selectedStudent.section}</p>
              </div>
              <div className="checklist-progress"><strong>{verified} of {total} verified</strong><span className="checklist-progress-track"><i style={{ width: `${Math.round((verified / Math.max(1, total)) * 100)}%` }} /></span></div>
            </div>

            {attentionDocuments.length > 0 ? (
              <div className="checklist-alert">
                <TriangleAlert size={15} />
                <div>
                  <strong>{attentionDocuments.length} requirement{attentionDocuments.length === 1 ? "" : "s"} need attention</strong>
                  <span>{attentionDocuments.slice(0, 3).map((item) => `${item.name} ${attentionPhrase(item.status)}`).join("; ")}.</span>
                </div>
              </div>
            ) : (
              <div className="checklist-clear"><CheckCircle2 size={15}/><div><strong>All requirements are verified</strong><span>No outstanding actions for this student.</span></div></div>
            )}

            <div className="checklist-table-wrap">
              <table className="checklist-table">
                <thead><tr><th>Required document</th><th>Submitted</th><th>Verification</th><th>Action</th></tr></thead>
                <tbody>
                  {selectedStudent.requirements.map((item) => (
                    <tr key={item.id} className={selectedDocument?.id === item.id ? "is-selected" : ""} onClick={() => selectDocument(item.id)}>
                      <td>
                        <div className="checklist-document-cell">
                          <span className="checklist-file-icon"><FileText size={13} /></span>
                          <span><strong>{item.name}</strong><small>{item.document ? item.document.originalName : "Not yet submitted"}</small></span>
                        </div>
                      </td>
                      <td className="checklist-date-cell">{item.document ? new Date(item.document.submittedAt).toLocaleDateString("en-GB") : "—"}</td>
                      <td><span className={`doc-status ${statusTones[item.status]}`}>{statusLabels[item.status]}</span></td>
                      <td>
                        <button className="checklist-action" type="button" onClick={(event) => { event.stopPropagation(); selectDocument(item.id); if (item.status === "Missing" || item.status === "Rejected") requestUpload(); }}>
                          {item.status === "Verified" ? <><Eye size={11}/> View</> : item.status === "Missing" ? <><Upload size={11}/> Upload</> : <><Eye size={11}/> Review</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="checklist-upload-strip">
              <div><span className="checklist-upload-icon"><FileUp size={15}/></span><span><strong>Add or replace a student submission</strong><small>PDF, JPG or PNG · up to 10 MB per file</small></span></div>
              <button type="button" onClick={requestUpload} disabled={!selectedDocument || selectedDocument.status === "Verified"}>Choose file</button>
            </div>
            <p className="checklist-footnote">Required checklist · {selectedStudent.program} internship · maintained by the college.</p>
          </section>

          <aside className={`documents-side-column ${documentSwitching ? "is-switching" : ""}`}>
            <section className="document-panel document-preview-card">
              <div className="document-card-heading">
                <div><h2>{selectedDocument?.name ?? "No document selected"}</h2><p>Selected document · {selectedStudent.name}</p></div>
                <button type="button" className="document-open-link" onClick={() => download(selectedDocument)}>Open file <ArrowUpRight size={11}/></button>
              </div>

              <div className={`document-banner ${bannerClass}`}>
                {selectedDocument?.status === "Verified" ? <CheckCircle2 size={13}/> : selectedDocument?.status === "Pending review" ? <Clock3 size={13}/> : <TriangleAlert size={13}/>}
                {bannerCopy}
              </div>

              {selectedDocument?.document ? (
                <div className="document-file-row">
                  <span className={`document-file-badge ${statusTones[selectedDocument.status]}`}><FileText size={15}/></span>
                  <div><strong>{selectedDocument.document.originalName}</strong><small>Uploaded {new Date(selectedDocument.document.submittedAt).toLocaleDateString("en-GB")}</small></div>
                  <button type="button" aria-label="Download file" onClick={() => download(selectedDocument)}><Download size={12}/></button>
                </div>
              ) : (
                <div className="document-file-empty">
                  <span className="document-file-badge doc-status-missing"><FileText size={15}/></span>
                  <div><strong>No file uploaded</strong><small>Awaiting a student submission</small></div>
                  <button type="button" onClick={requestUpload}>Add file</button>
                </div>
              )}

              <div className="document-meta-block">
                <span>Submitted by</span>
                <strong>{selectedDocument?.document ? selectedStudent.name : "Awaiting submission"}</strong>
                <small>{selectedDocument?.document ? "Student" : "No submission on record"}</small>
              </div>
              <div className="document-meta-block">
                <span>Reviewed by</span>
                <strong>{selectedDocument?.status === "Verified" || selectedDocument?.status === "Rejected" ? "Internship coordinator" : "Not yet reviewed"}</strong>
                <small>{selectedDocument?.status === "Verified" || selectedDocument?.status === "Rejected" ? "Decision recorded" : "Reviewer will be assigned automatically"}</small>
              </div>

              <div className="document-remarks">
                <span>Coordinator remarks</span>
                <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Add a note for the student and adviser" rows={3} disabled={!selectedDocument?.document || saving} />
                <small>Visible to the student and assigned faculty adviser. {shownRemarks}</small>
              </div>

              <div className="document-card-actions">
                <button className="document-primary-button" type="button" disabled={saving || !selectedDocument} onClick={handlePrimaryAction}>
                  {selectedDocument?.status === "Rejected" ? <><RotateCcw size={12}/> {primaryLabel}</>
                    : selectedDocument?.status === "Pending review" ? <><FileCheck2 size={12}/> {primaryLabel}</>
                    : selectedDocument?.status === "Missing" ? <><Upload size={12}/> {primaryLabel}</>
                    : <><Download size={12}/> {primaryLabel}</>}
                </button>
                <button className="document-secondary-button" type="button" disabled={saving || !selectedDocument} onClick={handleSecondaryAction}>{secondaryLabel}</button>
              </div>
            </section>

            <section className="document-panel document-next-card">
              <div className="document-simple-heading">
                <h2>Next for verification</h2>
                <p>{nextDocument ? `${nextDocument.name} · submitted ${nextDocument.document ? new Date(nextDocument.document.submittedAt).toLocaleDateString("en-GB") : "—"}` : "No submissions are waiting for review"}</p>
              </div>
              {nextDocument ? (
                <>
                  <div className="document-next-file">
                    <span className="document-file-badge doc-status-pending"><FileText size={15}/></span>
                    <span><strong>{nextDocument.document?.originalName ?? nextDocument.name}</strong><small>{nextDocument.name}</small></span>
                    <span className="doc-status doc-status-pending">Pending</span>
                  </div>
                  <p className="document-next-copy">Check the submitted copy against the requirement before verifying or returning it.</p>
                  <div className="document-card-actions">
                    <button className="document-primary-button" type="button" disabled={saving} onClick={() => void reviewDocument(nextDocument, "Verified")}>Verify document</button>
                    <button className="document-secondary-button" type="button" disabled={saving} onClick={() => void reviewDocument(nextDocument, "Rejected")}>Return</button>
                  </div>
                </>
              ) : (
                <div className="document-next-empty"><ShieldCheck size={18}/><span><strong>Review queue is clear</strong><small>Every submitted document for this student has a recorded decision.</small></span></div>
              )}
            </section>

            <section className="document-panel document-history-card">
              <div className="document-simple-heading"><h2>Verification history</h2><p>Latest events for {selectedStudent.name.split(/\s+/)[0]}'s requirements</p></div>
              <ol className="document-history-list">
                {history.map((event) => (
                  <li className="document-history-item" key={`${event.title}-${event.detail}`}>
                    <span className={`document-history-icon ${event.tone}`}>{event.tone === "success" ? <CheckCircle2 size={11}/> : event.tone === "danger" ? <CircleX size={11}/> : <Clock3 size={11}/>}</span>
                    <span><strong>{event.title}</strong><small>{event.detail}</small></span>
                  </li>
                ))}
                {!history.length && <li className="document-history-item"><span className="document-history-icon neutral"><Clock3 size={11}/></span><span><strong>No document activity yet</strong><small>Uploads and reviews will appear here.</small></span></li>}
              </ol>
            </section>
          </aside>
        </div>
      ) : (
        <section className="document-panel document-checklist-panel">
          <div className="document-next-empty"><ShieldAlert size={18}/><span><strong>{loading ? "Loading documents…" : "No students found"}</strong><small>{loading ? "Fetching records from the internship database." : "Add a student profile to begin tracking requirements."}</small></span></div>
        </section>
      )}

      <input ref={uploadInputRef} className="documents-hidden-input" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelected} />

      {toast && (
        <div className={`interaction-toast ${toast.kind === "success" ? "toast-success" : "toast-info"}`} role="status">
          <span className="toast-icon">{toast.kind === "success" ? <CheckCircle2 size={16}/> : <Activity size={16}/>}</span>
          <span className="toast-copy"><strong>{toast.title}</strong>{toast.detail && <small>{toast.detail}</small>}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={14}/></button>
        </div>
      )}
    </section>
  );
}
