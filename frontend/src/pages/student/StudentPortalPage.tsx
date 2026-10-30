import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  TriangleAlert,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import type { ApplicationDTO, DocumentDTO, HourDTO, StudentDTO, UserDTO } from "../../../../shared/contracts";
import { api, ApiError } from "../../services/api";
import "./student-portal.css";

type StudentPortalProps = { user: UserDTO; onLogout: () => void | Promise<void> };
type Tab = "overview" | "applications" | "documents" | "hours" | "profile";
type Flash = { type: "success" | "error"; text: string } | null;

const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "applications", label: "Applications", icon: BriefcaseBusiness },
  { id: "documents", label: "Documents", icon: FileCheck2 },
  { id: "hours", label: "Hour log", icon: Clock3 },
  { id: "profile", label: "Profile", icon: UserRound },
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const statusClass = (value: string) => `sp-status sp-status-${value.toLowerCase().replace(/\s+/g, "-")}`;
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const dateLabel = (value: string) => {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const errorText = (caught: unknown, fallback: string) => (caught instanceof ApiError ? caught.message : fallback);

export default function StudentPortalPage({ user, onLogout }: StudentPortalProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<StudentDTO | null>(null);
  const [applications, setApplications] = useState<ApplicationDTO[]>([]);
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [hours, setHours] = useState<HourDTO[]>([]);
  const [requirements, setRequirements] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<Flash>(null);

  const studentId = user.studentId;

  async function load() {
    if (!studentId) {
      setLoading(false);
      setError("This account is not linked to a student profile yet.");
      return;
    }
    setLoading(true);
    try {
      const [student, apps, docs, entries, reqs] = await Promise.all([
        api.student(studentId),
        api.applications({ studentId }),
        api.documents({ studentId }),
        api.hours({ studentId }),
        api.requirements(),
      ]);
      setProfile(student);
      setApplications(apps);
      setDocuments(docs);
      setHours(entries);
      setRequirements(reqs);
      setError("");
    } catch (caught) {
      setError(errorText(caught, "Could not load your internship records."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [studentId]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const notify = (type: "success" | "error", text: string) => setFlash({ type, text });

  const approvedHours = hours.filter((entry) => entry.status === "Approved").reduce((sum, entry) => sum + entry.hours, 0);
  const pendingHours = hours.filter((entry) => entry.status === "Pending").reduce((sum, entry) => sum + entry.hours, 0);
  const verifiedDocuments = new Set(documents.filter((doc) => doc.status === "Verified").map((doc) => doc.requirement)).size;
  const requiredHours = profile?.requiredHours ?? 0;
  const progress = requiredHours ? Math.min(100, Math.round((approvedHours / requiredHours) * 100)) : 0;
  const currentApplication =
    applications.find((app) => ["Interning", "Accepted", "Completed"].includes(app.status)) ??
    applications.find((app) => app.status === "Applying");
  const isInterning = applications.some((app) => app.status === "Interning");
  const totalRequirements = requirements.length || profile?.totalDocuments || 0;
  const docsNeedingAction = totalRequirements - documents.filter((doc) => doc.status !== "Rejected").length;
  const rejectedDocs = documents.filter((doc) => doc.status === "Rejected").length;
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  const nextSteps = [
    { done: applications.length > 0, label: "Submit an internship application", tab: "applications" as Tab },
    { done: Boolean(currentApplication && currentApplication.status !== "Applying"), label: "Get accepted by a host organization", tab: "applications" as Tab },
    { done: totalRequirements > 0 && verifiedDocuments === totalRequirements, label: `Upload and verify all ${totalRequirements} requirements`, tab: "documents" as Tab },
    { done: requiredHours > 0 && approvedHours >= requiredHours, label: `Log and get ${requiredHours} hours approved`, tab: "hours" as Tab },
  ];

  return (
    <div className="student-portal">
      <header className="sp-topbar">
        <div className="sp-brand">
          <span className="sp-brand-icon"><GraduationCap size={20} /></span>
          <span><strong>LSPU - SCC</strong><small>College Internship Hub</small></span>
        </div>
        <div className="sp-user">
          <span className="sp-avatar">{initials}</span>
          <span><strong>{user.name}</strong><small>{user.email}</small></span>
          <button type="button" onClick={() => void onLogout()}><LogOut size={14} /> Sign out</button>
        </div>
      </header>

      <nav className="sp-tabs" aria-label="Student workspace sections">
        <div className="sp-tabs-inner">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
              <Icon size={15} /> {label}
              {id === "documents" && rejectedDocs > 0 && <span className="sp-tab-badge">{rejectedDocs}</span>}
            </button>
          ))}
        </div>
      </nav>

      <main className="sp-main">
        <section className="sp-heading">
          <div>
            <p>STUDENT WORKSPACE</p>
            <h1>
              {loading && !profile
                ? "Loading your internship…"
                : tab === "overview"
                  ? `Welcome back, ${(profile?.name ?? user.name).split(/\s+/)[0]}`
                  : tabs.find((t) => t.id === tab)?.label}
            </h1>
            <span>
              {tab === "overview" && "Your placement, requirements and approved hours in one place."}
              {tab === "applications" && "Record the organizations you apply to. Your coordinator updates the status."}
              {tab === "documents" && "Upload each requirement as a PDF, PNG or JPEG (10 MB max)."}
              {tab === "hours" && "Log your daily internship hours. Approved hours count toward completion."}
              {tab === "profile" && "Your academic details and contact information."}
            </span>
          </div>
          <button className="sp-refresh" type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} /> {loading ? "Refreshing…" : "Refresh"}
          </button>
        </section>

        {flash && (
          <section className={`sp-flash sp-flash-${flash.type}`} role="status">
            {flash.type === "success" ? <CheckCircle2 size={16} /> : <TriangleAlert size={16} />}
            <span>{flash.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setFlash(null)}><X size={14} /></button>
          </section>
        )}

        {error && (
          <section className="sp-error">
            <TriangleAlert size={16} />
            <span>{error}</span>
            <button type="button" onClick={() => void load()}>Try again</button>
          </section>
        )}

        {profile && studentId && (
          <>
            {tab === "overview" && (
              <>
                <section className="sp-card sp-placement">
                  <div className="sp-placement-lead">
                    <span className="sp-placement-icon"><BriefcaseBusiness size={19} /></span>
                    <div>
                      <p>Current placement</p>
                      <h2>{currentApplication?.organization || "Not placed yet"}</h2>
                      <span>{currentApplication?.position || "No active internship application"}</span>
                    </div>
                  </div>
                  <div className="sp-placement-meta">
                    <span>Student ID <strong>{profile.id}</strong></span>
                    <span>Program <strong>{profile.program} {profile.section}</strong></span>
                    <span>Adviser <strong>{profile.adviser || "Not assigned"}</strong></span>
                    <span>Term <strong>{profile.term || "—"}</strong></span>
                  </div>
                  {currentApplication && <span className={statusClass(currentApplication.status)}>{currentApplication.status}</span>}
                </section>

                <section className="sp-metrics">
                  <article className="sp-card sp-metric">
                    <span className="sp-metric-icon teal"><Clock3 size={15} /></span>
                    <p>Approved hours</p>
                    <strong>{approvedHours} <small>/ {requiredHours} h</small></strong>
                    <div className="sp-progress"><span style={{ width: `${progress}%` }} /></div>
                    <span>{progress}% complete{pendingHours ? ` · ${pendingHours} h awaiting approval` : ""}</span>
                  </article>
                  <article className="sp-card sp-metric">
                    <span className="sp-metric-icon purple"><FileCheck2 size={15} /></span>
                    <p>Verified requirements</p>
                    <strong>{verifiedDocuments} <small>/ {totalRequirements} docs</small></strong>
                    <span>
                      {rejectedDocs
                        ? `${rejectedDocs} rejected — please re-upload`
                        : docsNeedingAction > 0
                          ? `${docsNeedingAction} not uploaded yet`
                          : verifiedDocuments === totalRequirements
                            ? "All requirements verified"
                            : "Waiting for coordinator review"}
                    </span>
                  </article>
                  <article className="sp-card sp-metric">
                    <span className="sp-metric-icon amber"><CalendarDays size={15} /></span>
                    <p>Expected completion</p>
                    <strong>{dateLabel(profile.expectedCompletion)}</strong>
                    <span>Started {dateLabel(profile.startDate)}</span>
                  </article>
                </section>

                <section className="sp-card sp-steps">
                  <div className="sp-card-heading"><div><h2>Your next steps</h2><p>Complete these to finish your internship.</p></div><span>{nextSteps.filter((s) => s.done).length}/{nextSteps.length}</span></div>
                  <ol>
                    {nextSteps.map((step) => (
                      <li key={step.label} className={step.done ? "done" : ""}>
                        {step.done ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                        <span>{step.label}</span>
                        {!step.done && <button type="button" onClick={() => setTab(step.tab)}>Go</button>}
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )}

            {tab === "applications" && (
              <ApplicationsTab studentId={studentId} applications={applications} onSaved={(text) => { notify("success", text); void load(); }} onError={(text) => notify("error", text)} />
            )}

            {tab === "documents" && (
              <DocumentsTab studentId={studentId} requirements={requirements} documents={documents} onSaved={(text) => { notify("success", text); void load(); }} onError={(text) => notify("error", text)} />
            )}

            {tab === "hours" && (
              <HoursTab studentId={studentId} hours={hours} isInterning={isInterning} approvedHours={approvedHours} requiredHours={requiredHours} onSaved={(text) => { notify("success", text); void load(); }} onError={(text) => notify("error", text)} />
            )}

            {tab === "profile" && (
              <ProfileTab profile={profile} onSaved={(updated, text) => { setProfile(updated); notify("success", text); }} onError={(text) => notify("error", text)} onPasswordChanged={onLogout} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

type TabCallbacks = { onSaved: (message: string) => void; onError: (message: string) => void };

function ApplicationsTab({ studentId, applications, onSaved, onError }: TabCallbacks & { studentId: string; applications: ApplicationDTO[] }) {
  const empty = { organization: "", position: "", appliedOn: todayIso(), notes: "" };
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(applications.length === 0);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createApplication({ studentId, ...form, organization: form.organization.trim(), position: form.position.trim(), notes: form.notes.trim() });
      setForm({ ...empty, appliedOn: todayIso() });
      setOpen(false);
      onSaved("Application submitted. Your coordinator will update its status.");
    } catch (caught) {
      onError(errorText(caught, "Could not submit the application."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="sp-card sp-form-card">
        <div className="sp-card-heading">
          <div><h2>New application</h2><p>Add each company or office you have applied to.</p></div>
          {!open && <button type="button" className="sp-button" onClick={() => setOpen(true)}><Plus size={14} /> Add application</button>}
        </div>
        {open && (
          <form className="sp-form" onSubmit={submit}>
            <label><span>Organization</span><input required maxLength={255} value={form.organization} placeholder="e.g., Acme Software Inc." onChange={(e) => setForm({ ...form, organization: e.target.value })} /></label>
            <label><span>Position</span><input required maxLength={255} value={form.position} placeholder="e.g., IT Support Intern" onChange={(e) => setForm({ ...form, position: e.target.value })} /></label>
            <label><span>Date applied</span><input type="date" required max={todayIso()} value={form.appliedOn} onChange={(e) => setForm({ ...form, appliedOn: e.target.value })} /></label>
            <label className="sp-form-wide"><span>Notes <em>(optional)</em></span><textarea maxLength={2000} rows={3} value={form.notes} placeholder="Contact person, interview schedule, etc." onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="sp-form-actions">
              {applications.length > 0 && <button type="button" className="sp-button ghost" onClick={() => setOpen(false)}>Cancel</button>}
              <button type="submit" className="sp-button" disabled={saving}><Send size={14} /> {saving ? "Submitting…" : "Submit application"}</button>
            </div>
          </form>
        )}
      </section>

      <section className="sp-card sp-table-card">
        <div className="sp-card-heading"><div><h2>Your applications</h2><p>Every internship application on record.</p></div><span>{applications.length}</span></div>
        <div className="sp-table-wrap">
          <table>
            <thead><tr><th>Organization</th><th>Position</th><th>Applied</th><th>Status</th></tr></thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td><strong>{application.organization}</strong><small>{application.notes || "No notes"}</small></td>
                  <td>{application.position}</td>
                  <td>{dateLabel(application.appliedOn)}</td>
                  <td><span className={statusClass(application.status)}>{application.status}</span></td>
                </tr>
              ))}
              {!applications.length && <tr><td colSpan={4} className="sp-empty">No applications recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DocumentsTab({ studentId, requirements, documents, onSaved, onError }: TabCallbacks & { studentId: string; requirements: readonly string[]; documents: DocumentDTO[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  function choose(requirement: string) {
    setTarget(requirement);
    inputRef.current?.click();
  }

  async function upload(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file || !target) return;
    if (file.size > MAX_FILE_BYTES) {
      onError("Files must be no larger than 10 MB.");
      return;
    }
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) {
      onError("Only PDF, PNG and JPEG files are supported.");
      return;
    }
    setUploading(target);
    try {
      await api.uploadDocument({ studentId, requirement: target, file });
      onSaved(`${target} uploaded. It is now waiting for review.`);
    } catch (caught) {
      onError(errorText(caught, "The upload failed."));
    } finally {
      setUploading(null);
      setTarget(null);
    }
  }

  const verified = documents.filter((doc) => doc.status === "Verified").length;

  return (
    <section className="sp-card sp-table-card">
      <input ref={inputRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e) => void upload(e.target.files?.[0])} />
      <div className="sp-card-heading"><div><h2>Internship requirements</h2><p>Verified documents cannot be replaced unless your coordinator rejects them.</p></div><span>{verified}/{requirements.length} verified</span></div>
      <ul className="sp-requirements">
        {requirements.map((requirement, index) => {
          const doc = documents.find((d) => d.requirement === requirement);
          const busy = uploading === requirement;
          return (
            <li key={requirement} className={doc ? `is-${doc.status.toLowerCase().replace(/\s+/g, "-")}` : "is-missing"}>
              <span className="sp-req-index">{index + 1}</span>
              <div className="sp-req-body">
                <strong>{requirement}</strong>
                {doc ? (
                  <small>
                    {doc.originalName} · submitted {dateLabel(doc.submittedAt)}
                    {doc.reviewNote && <em className="sp-review-note">Coordinator note: {doc.reviewNote}</em>}
                  </small>
                ) : (
                  <small>Not uploaded yet</small>
                )}
              </div>
              <span className={statusClass(doc?.status ?? "Missing")}>{doc?.status ?? "Missing"}</span>
              <div className="sp-req-actions">
                {doc && <a className="sp-download" href={api.documentDownloadUrl(doc.id)}><ArrowDownToLine size={13} /> Open</a>}
                {doc?.status !== "Verified" && (
                  <button type="button" className="sp-button small" disabled={uploading !== null} onClick={() => choose(requirement)}>
                    <Upload size={13} /> {busy ? "Uploading…" : doc ? "Replace" : "Upload"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!requirements.length && <li className="sp-empty">Requirements list is unavailable.</li>}
      </ul>
    </section>
  );
}

function HoursTab({ studentId, hours, isInterning, approvedHours, requiredHours, onSaved, onError }: TabCallbacks & { studentId: string; hours: HourDTO[]; isInterning: boolean; approvedHours: number; requiredHours: number }) {
  const [form, setForm] = useState({ date: todayIso(), hours: "8", description: "" });
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createHour({ studentId, date: form.date, hours: Number(form.hours), description: form.description.trim() });
      setForm({ ...form, description: "" });
      onSaved("Hours logged. They will count once approved.");
    } catch (caught) {
      onError(errorText(caught, "Could not log the hours."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="sp-card sp-form-card">
        <div className="sp-card-heading">
          <div><h2>Log hours</h2><p>{approvedHours} of {requiredHours} required hours approved.</p></div>
        </div>
        {isInterning ? (
          <form className="sp-form" onSubmit={submit}>
            <label><span>Date</span><input type="date" required max={todayIso()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label><span>Hours</span><input type="number" required min={0.25} max={24} step={0.25} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></label>
            <label className="sp-form-wide"><span>Work summary</span><textarea required maxLength={2000} rows={3} value={form.description} placeholder="What did you work on today?" onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="sp-form-actions">
              <button type="submit" className="sp-button" disabled={saving}><Plus size={14} /> {saving ? "Saving…" : "Log hours"}</button>
            </div>
          </form>
        ) : (
          <p className="sp-hint"><TriangleAlert size={15} /> You can log hours once your coordinator marks one of your applications as <strong>Interning</strong>.</p>
        )}
      </section>

      <section className="sp-card sp-table-card">
        <div className="sp-card-heading"><div><h2>Hour history</h2><p>Only approved entries count toward your requirement.</p></div><span>{hours.length} entries</span></div>
        <div className="sp-table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Hours</th><th>Work summary</th><th>Status</th></tr></thead>
            <tbody>
              {hours.map((entry) => (
                <tr key={entry.id}>
                  <td>{dateLabel(entry.date)}</td>
                  <td><strong>{entry.hours} h</strong></td>
                  <td>{entry.description}</td>
                  <td><span className={statusClass(entry.status)}>{entry.status === "Approved" ? <CheckCircle2 size={12} /> : null}{entry.status}</span></td>
                </tr>
              ))}
              {!hours.length && <tr><td colSpan={4} className="sp-empty">No hours logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ProfileTab({ profile, onSaved, onError, onPasswordChanged }: { profile: StudentDTO; onSaved: (profile: StudentDTO, message: string) => void; onError: (message: string) => void; onPasswordChanged: () => void | Promise<void> }) {
  const [contact, setContact] = useState({ phone: profile.phone, address: profile.address, emergencyName: profile.emergencyName, emergencyPhone: profile.emergencyPhone });
  const [savingContact, setSavingContact] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: "", password: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingContact(true);
    try {
      const updated = await api.updateMyProfile({
        phone: contact.phone.trim(),
        address: contact.address.trim(),
        emergencyName: contact.emergencyName.trim(),
        emergencyPhone: contact.emergencyPhone.trim(),
      });
      onSaved(updated, "Contact information saved.");
    } catch (caught) {
      onError(errorText(caught, "Could not save your contact information."));
    } finally {
      setSavingContact(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwords.password !== passwords.confirm) {
      onError("The new passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await api.changePassword({ currentPassword: passwords.currentPassword, password: passwords.password });
      window.alert("Password changed. Please sign in again with your new password.");
      await onPasswordChanged();
    } catch (caught) {
      onError(errorText(caught, "Could not change your password."));
      setSavingPassword(false);
    }
  }

  const info: [string, string][] = [
    ["Student ID", profile.id],
    ["Full name", profile.name],
    ["College email", profile.email],
    ["Program & section", `${profile.program} ${profile.section}`],
    ["Degree", profile.degree || "—"],
    ["Academic term", profile.term || "—"],
    ["Practicum course", profile.course || "—"],
    ["Faculty adviser", profile.adviser ? `${profile.adviser}${profile.adviserEmail ? ` · ${profile.adviserEmail}` : ""}` : "Not assigned"],
    ["Host organization", profile.organization || "Unassigned"],
    ["Supervisor", profile.supervisor ? `${profile.supervisor}${profile.supervisorEmail ? ` · ${profile.supervisorEmail}` : ""}` : "—"],
    ["Required hours", `${profile.requiredHours} h`],
  ];

  return (
    <>
      <section className="sp-card sp-form-card">
        <div className="sp-card-heading"><div><h2>Academic & placement details</h2><p>Managed by your coordinator. Contact them to correct anything here.</p></div></div>
        <dl className="sp-info-grid">
          {info.map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      </section>

      <div className="sp-columns">
        <section className="sp-card sp-form-card">
          <div className="sp-card-heading"><div><h2>Contact information</h2><p>Keep this up to date so the college can reach you.</p></div></div>
          <form className="sp-form single" onSubmit={saveContact}>
            <label><span>Mobile number</span><input type="tel" maxLength={255} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></label>
            <label><span>Home address</span><input maxLength={255} value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} /></label>
            <label><span>Emergency contact name</span><input maxLength={255} value={contact.emergencyName} onChange={(e) => setContact({ ...contact, emergencyName: e.target.value })} /></label>
            <label><span>Emergency contact number</span><input type="tel" maxLength={255} value={contact.emergencyPhone} onChange={(e) => setContact({ ...contact, emergencyPhone: e.target.value })} /></label>
            <div className="sp-form-actions"><button type="submit" className="sp-button" disabled={savingContact}>{savingContact ? "Saving…" : "Save contact info"}</button></div>
          </form>
        </section>

        <section className="sp-card sp-form-card">
          <div className="sp-card-heading"><div><h2>Change password</h2><p>You will be signed out on every device afterwards.</p></div></div>
          <form className="sp-form single" onSubmit={savePassword}>
            <label><span>Current password</span><input type="password" required autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} /></label>
            <label><span>New password</span><input type="password" required minLength={10} maxLength={128} autoComplete="new-password" placeholder="At least 10 characters" value={passwords.password} onChange={(e) => setPasswords({ ...passwords, password: e.target.value })} /></label>
            <label><span>Confirm new password</span><input type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} /></label>
            <div className="sp-form-actions"><button type="submit" className="sp-button" disabled={savingPassword}>{savingPassword ? "Updating…" : "Change password"}</button></div>
          </form>
        </section>
      </div>
    </>
  );
}
