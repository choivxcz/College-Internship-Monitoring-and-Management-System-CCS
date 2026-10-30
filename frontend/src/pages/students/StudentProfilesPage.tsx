import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Search, Plus, ChevronRight, ChevronLeft, ChevronDown, Pencil, Building2,
  Mail, Phone, ExternalLink, X, BriefcaseBusiness, FileCheck2, Clock3,
  CheckCircle2, CircleAlert, ArrowUpRight, Download,
} from "lucide-react";
import type { ApplicationDTO, DocumentDTO, HourDTO, StudentDTO } from "../../../../shared/contracts";
import { api, ApiError } from "../../services/api";
import "./StudentProfilesPage.css";

type Student = StudentDTO;
type StudentForm = Student & { password?: string };

const emptyStudent: StudentForm = {
  id:"",name:"",program:"BSIT",section:"4A",status:"Not applied",hoursDone:0,requiredHours:480,
  email:"",phone:"",degree:"",yearSection:"",term:"1st semester, AY 2026–2027",course:"",
  adviser:"",adviserEmail:"",emergencyName:"",emergencyPhone:"",organization:"Unassigned",organizationType:"",
  department:"",position:"",arrangement:"",supervisor:"",supervisorEmail:"",address:"",
  startDate:"",expectedCompletion:"",verifiedDocuments:0,totalDocuments:0,password:"",
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(part => part[0]).join("").toUpperCase() || "ST";
}
function StatusBadge({status}:{status:string}) {
  return <span className={`student-status status-${status.toLowerCase().replace(/\s+/g,"-")}`}>{status}</span>;
}
function InfoField({label,children}:{label:string;children:ReactNode}) {
  return <div className="student-info-field"><span>{label}</span><strong>{children}</strong></div>;
}
function toPayload(form: StudentForm) {
  return {
    id: form.id.trim(), name: form.name.trim(), email: form.email.trim(), program: form.program,
    section: form.section.trim(), requiredHours: form.requiredHours, term: form.term.trim() || "1st semester, AY 2026–2027",
    phone: form.phone, degree: form.degree, yearSection: form.yearSection, course: form.course,
    adviser: form.adviser, adviserEmail: form.adviserEmail, emergencyName: form.emergencyName,
    emergencyPhone: form.emergencyPhone, organizationType: form.organizationType, department: form.department,
    arrangement: form.arrangement, supervisor: form.supervisor, supervisorEmail: form.supervisorEmail,
    address: form.address, startDate: form.startDate, expectedCompletion: form.expectedCompletion,
    ...(form.password ? { password: form.password } : {}),
  };
}

export default function StudentProfilesPage() {
  const [students,setStudents] = useState<Student[]>([]);
  const [loading,setLoading] = useState(true);
  const [loadError,setLoadError] = useState("");
  const [selectedId,setSelectedId] = useState("");
  const [profileAnimating,setProfileAnimating] = useState(false);
  const animationTimer = useRef<number | undefined>(undefined);
  const [studentApplications,setStudentApplications] = useState<ApplicationDTO[]>([]);
  const [studentDocuments,setStudentDocuments] = useState<DocumentDTO[]>([]);
  const [studentHours,setStudentHours] = useState<HourDTO[]>([]);
  const [query,setQuery] = useState("");
  const [program,setProgram] = useState("All programs");
  const [section,setSection] = useState("All sections");
  const [status,setStatus] = useState("All internship statuses");
  const [page,setPage] = useState(1);
  const [tab,setTab] = useState("Profile overview");
  const [modal,setModal] = useState<"add"|"edit"|null>(null);
  const [form,setForm] = useState<StudentForm>(emptyStudent);
  const [saving,setSaving] = useState(false);
  const [notice,setNotice] = useState("");

  async function loadStudents(preferredId?: string) {
    setLoading(true);
    try {
      const list = await api.students();
      setStudents(list);
      setSelectedId(current => preferredId || (list.some(student => student.id === current) ? current : list[0]?.id ?? ""));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : "Could not load student profiles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadStudents(); }, []);

  useEffect(() => {
    if (!selectedId) {
      setStudentApplications([]); setStudentDocuments([]); setStudentHours([]);
      return;
    }
    let active = true;
    Promise.all([
      api.applications({ studentId: selectedId }),
      api.documents({ studentId: selectedId }),
      api.hours({ studentId: selectedId }),
    ]).then(([applications, documents, hours]) => {
      if (!active) return;
      setStudentApplications(applications);
      setStudentDocuments(documents);
      setStudentHours(hours);
    }).catch(() => {
      if (!active) return;
      setStudentApplications([]); setStudentDocuments([]); setStudentHours([]);
    });
    return () => { active = false; };
  }, [selectedId]);

  function selectStudent(studentId: string) {
    if (animationTimer.current !== undefined) window.clearTimeout(animationTimer.current);
    setProfileAnimating(false);
    setSelectedId(studentId);
    setTab("Profile overview");
    animationTimer.current = window.setTimeout(() => {
      setProfileAnimating(true);
      animationTimer.current = window.setTimeout(() => {
        setProfileAnimating(false);
        animationTimer.current = undefined;
      }, 850);
    }, 25);
  }

  const filtered = useMemo(() => students.filter(student => {
    const q = query.trim().toLowerCase();
    return (!q || `${student.name} ${student.id} ${student.organization}`.toLowerCase().includes(q))
      && (program === "All programs" || student.program === program)
      && (section === "All sections" || `${student.program} ${student.section}` === section)
      && (status === "All internship statuses" || student.status === status);
  }),[students,query,program,section,status]);

  const pageSize = 7;
  const pageCount = Math.max(1,Math.ceil(filtered.length/pageSize));
  const safePage = Math.min(page,pageCount);
  const visible = filtered.slice((safePage-1)*pageSize,safePage*pageSize);
  const selected = students.find(student => student.id === selectedId) ?? filtered[0] ?? students[0] ?? emptyStudent;
  const approvedHours = studentHours.filter(entry => entry.status === "Approved").reduce((sum,entry) => sum + entry.hours,0);
  const progress = Math.min(100,Math.round((selected.hoursDone/Math.max(1,selected.requiredHours))*100));

  function notify(message:string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""),3200);
  }
  function openAdd() {
    setForm({...emptyStudent,id:`2026-${String(1000+students.length).slice(-4)}`,term:students[0]?.term || emptyStudent.term});
    setModal("add");
  }
  function openEdit() {
    setForm({...selected,password:""});
    setModal("edit");
  }
  function update<K extends keyof StudentForm>(key:K,value:StudentForm[K]) {
    setForm(current => ({...current,[key]:value}));
  }
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim() || !form.id.trim()) return;
    const isAdd = modal === "add";
    setSaving(true);
    try {
      const saved = isAdd ? await api.createStudent(toPayload(form)) : await api.updateStudent(selectedId,toPayload(form));
      setModal(null);
      setQuery(""); setProgram("All programs"); setSection("All sections"); setStatus("All internship statuses"); setPage(1);
      await loadStudents(saved.id);
      notify(isAdd ? "Student and login account created." : "Student profile updated.");
    } catch (error) {
      notify(error instanceof ApiError ? error.message : "The profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  function filterChange(setter:(value:string)=>void,value:string) {
    setter(value); setPage(1);
  }

  return (
    <section className="student-profile-page">
      <div className="student-page-heading">
        <div><h1>Student internship profiles</h1><p>Keep student details, adviser assignments and placement information connected.</p></div>
        <button className="student-primary-button" type="button" onClick={openAdd}><Plus size={15}/> Add student</button>
      </div>

      {loadError && <div className="student-empty-state">{loadError} <button type="button" onClick={()=>void loadStudents()}>Retry</button></div>}

      <div className="student-filter-bar">
        <label className="student-search-box"><Search size={15}/><input value={query} onChange={e=>filterChange(setQuery,e.target.value)} placeholder="Search name or student ID" aria-label="Search name or student ID"/>{query && <button type="button" aria-label="Clear search" onClick={()=>setQuery("")}><X size={14}/></button>}</label>
        <label className="student-select-wrap"><select value={program} onChange={e=>filterChange(setProgram,e.target.value)} aria-label="Filter by program"><option>All programs</option><option>BSIT</option><option>BSBA</option><option>BSHM</option></select><ChevronDown size={13}/></label>
        <label className="student-select-wrap"><select value={section} onChange={e=>filterChange(setSection,e.target.value)} aria-label="Filter by section"><option>All sections</option>{["BSIT 4A","BSIT 4B","BSBA 4A","BSBA 4B","BSHM 4B"].map(item=><option key={item}>{item}</option>)}</select><ChevronDown size={13}/></label>
        <label className="student-select-wrap student-status-filter"><select value={status} onChange={e=>filterChange(setStatus,e.target.value)} aria-label="Filter by internship status"><option>All internship statuses</option>{["Not applied","Applying","Accepted","Interning","Completed"].map(item=><option key={item}>{item}</option>)}</select><ChevronDown size={13}/></label>
        <span className="student-record-count">{loading ? "Loading…" : `${filtered.length} records`}</span>
      </div>

      <div className="student-workspace">
        <aside className="student-directory-panel">
          <div className="student-directory-heading"><strong>Students</strong><span>Recently updated</span></div>
          <div className="student-directory-list">
            {visible.map(student=>{
              const isSelected=student.id===selected.id;
              return <button key={student.id} type="button" className={`student-directory-item ${isSelected?"is-selected":""}`} onClick={()=>selectStudent(student.id)}>
                <span className="student-avatar">{initials(student.name)}</span>
                <span className="student-directory-main"><strong>{student.name}</strong><small>{student.id} · {student.program} {student.section}</small></span>
                <ChevronRight className="student-directory-chevron" size={14}/>
                <span className="student-directory-meta"><StatusBadge status={student.status}/><small>{student.hoursDone} / {student.requiredHours} h</small></span>
              </button>;
            })}
            {!loading && visible.length===0 && <div className="student-empty-state">No students match your search. Try changing the filters.</div>}
          </div>
          <div className="student-pagination"><span>Showing {visible.length?(safePage-1)*pageSize+1:0}–{Math.min(safePage*pageSize,filtered.length)} of {filtered.length}</span><div><button type="button" disabled={safePage<=1} onClick={()=>setPage(v=>Math.max(1,v-1))} aria-label="Previous page"><ChevronLeft size={14}/></button><span>{safePage}/{pageCount}</span><button type="button" disabled={safePage>=pageCount} onClick={()=>setPage(v=>Math.min(pageCount,v+1))} aria-label="Next page"><ChevronRight size={14}/></button></div></div>
        </aside>

        <div key={selected.id} className={`student-profile-details ${profileAnimating ? "is-switching" : ""}`}>
          <section className="student-detail-card student-identity-card">
            <div className="student-identity-top"><span className="student-avatar student-avatar-large">{initials(selected.name)}</span><div className="student-identity-copy"><div className="student-name-line"><h2>{selected.name||"Select a student"}</h2><StatusBadge status={selected.status}/></div><p>{selected.id} · {selected.degree || selected.program} · Section {selected.section}</p><div className="student-contact-line"><span><Mail size={12}/>{selected.email||"No email recorded"}</span><span><Phone size={12}/>{selected.phone||"No phone recorded"}</span></div></div><button className="student-outline-button" type="button" onClick={openEdit} disabled={!students.length}><Pencil size={13}/> Edit profile</button></div>
            <div className="student-tabs" role="tablist" aria-label="Student profile sections">{["Profile overview",`Applications · ${studentApplications.length}`,`Documents · ${studentDocuments.length}`,"Progress & hours"].map(item=>{const value=item.split(" ·")[0];return <button key={item} type="button" role="tab" aria-selected={tab===value} className={tab===value?"active":""} onClick={()=>setTab(value)}>{item}</button>;})}</div>
            {tab==="Profile overview" && <div className="student-identity-summary"><InfoField label="Faculty adviser">{selected.adviser||"Not assigned"}</InfoField><InfoField label="Required hours">{selected.requiredHours} hours</InfoField><InfoField label="Current placement">{selected.organization}</InfoField></div>}
            {tab==="Applications" && <div className="student-tab-list">{studentApplications.map(application=><div className="student-tab-row" key={application.id}><span><strong>{application.organization}</strong><small>{application.position} · Applied {application.appliedOn}</small></span><StatusBadge status={application.status}/></div>)}{!studentApplications.length&&<div className="student-tab-placeholder"><BriefcaseBusiness size={18}/><div><strong>No applications yet</strong><p>Applications recorded for this student will appear here.</p></div></div>}</div>}
            {tab==="Documents" && <div className="student-tab-list">{studentDocuments.map(document=><div className="student-tab-row" key={document.id}><span><strong>{document.requirement}</strong><small>{document.originalName || "No file uploaded"}{document.reviewNote ? ` · ${document.reviewNote}` : ""}</small></span><span className="student-tab-actions"><StatusBadge status={document.status}/><a href={api.documentDownloadUrl(document.id)} aria-label={`Download ${document.requirement}`}><Download size={13}/></a></span></div>)}{!studentDocuments.length&&<div className="student-tab-placeholder"><FileCheck2 size={18}/><div><strong>No documents yet</strong><p>{selected.verifiedDocuments} of {selected.totalDocuments} requirements are verified.</p></div></div>}</div>}
            {tab==="Progress & hours" && <div className="student-tab-list"><div className="student-tab-placeholder"><Clock3 size={18}/><div><strong>{selected.hoursDone} of {selected.requiredHours} hours approved</strong><p>{Math.max(0,selected.requiredHours-selected.hoursDone)} hours remaining. {approvedHours} approved hours across {studentHours.length} logged entries.</p></div><span>{progress}%</span></div>{studentHours.slice(0,5).map(entry=><div className="student-tab-row" key={entry.id}><span><strong>{entry.date}</strong><small>{entry.description}</small></span><span className="student-tab-actions"><small>{entry.hours} h</small><StatusBadge status={entry.status}/></span></div>)}</div>}
          </section>

          <section className="student-detail-card"><div className="student-card-heading"><h3>Student information</h3><button type="button" onClick={()=>notify("Academic records are managed by the registrar.")}>View academic record <ExternalLink size={12}/></button></div><div className="student-info-grid">
            <InfoField label="Degree program">{selected.degree || selected.program}</InfoField><InfoField label="Year level and section">{selected.yearSection || `${selected.program} ${selected.section}`}</InfoField><InfoField label="Academic term">{selected.term || "—"}</InfoField><InfoField label="Practicum course">{selected.course || "—"}</InfoField><InfoField label="Assigned faculty adviser">{selected.adviser || "Not assigned"}{selected.adviserEmail ? ` · ${selected.adviserEmail}` : ""}</InfoField><InfoField label="Emergency contact">{selected.emergencyName || "—"}{selected.emergencyPhone ? ` · ${selected.emergencyPhone}` : ""}</InfoField>
          </div></section>

          <section className="student-detail-card"><div className="student-card-heading"><h3>Internship organization</h3><button type="button" onClick={openEdit} disabled={!students.length}>Edit organization</button></div><div className="student-organization-heading"><span className="student-organization-icon"><Building2 size={17}/></span><div><strong>{selected.organization}</strong><small>{selected.department || "Department not recorded"}</small></div><span className="student-organization-type">{selected.organizationType || "Not yet placed"}</span></div><div className="student-info-grid">
            <InfoField label="Position / department">{selected.position || "—"}</InfoField><InfoField label="Work arrangement">{selected.arrangement || "—"}</InfoField><InfoField label="Host supervisor">{selected.supervisor || "—"}</InfoField><InfoField label="Contact information">{selected.supervisorEmail || "—"}</InfoField><InfoField label="Office address">{selected.address || "—"}</InfoField>
          </div><p className="student-card-footnote">Placement details come from the student's current application and profile.</p></section>

          <section className="student-detail-card student-progress-card"><div className="student-card-heading"><h3>Placement readiness & progress</h3><button type="button" onClick={()=>setTab("Progress & hours")}>Open monitoring <ArrowUpRight size={12}/></button></div><div className="student-info-grid student-progress-metrics"><InfoField label="Start date">{selected.startDate || "—"}</InfoField><InfoField label="Expected completion">{selected.expectedCompletion || "—"}</InfoField><InfoField label="Verified hours">{selected.hoursDone} h · {Math.max(0,selected.requiredHours-selected.hoursDone)} remaining</InfoField></div><div className="student-progress-track" aria-label={`${progress}% internship hours completed`}><span style={{width:`${progress}%`}}/></div><div className="student-progress-footer"><span className={`student-docs-pill ${selected.verifiedDocuments===selected.totalDocuments?"all-verified":""}`}>{selected.verifiedDocuments===selected.totalDocuments?<CheckCircle2 size={12}/>:<CircleAlert size={12}/>} {selected.verifiedDocuments} of {selected.totalDocuments} documents verified</span><span>{progress}% of required hours</span></div></section>
        </div>
      </div>

      {modal && <div className="student-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setModal(null);}}><section className="student-modal" role="dialog" aria-modal="true" aria-labelledby="student-modal-title"><div className="student-modal-heading"><div><span>STUDENT MANAGEMENT</span><h2 id="student-modal-title">{modal==="add"?"Add student":"Edit student profile"}</h2><p>{modal==="add"?"Create a student profile and its login account.":"Update this student's profile details."}</p></div><button type="button" onClick={()=>setModal(null)} aria-label="Close dialog" disabled={saving}><X size={18}/></button></div><form onSubmit={save}><div className="student-form-grid">
        <label className="student-form-field student-form-wide"><span>Full name *</span><input required value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Enter student's full name"/></label>
        <label className="student-form-field"><span>Student ID *</span><input required value={form.id} onChange={e=>update("id",e.target.value)} placeholder="e.g. 2026-0101" disabled={modal==="edit"}/></label>
        <label className="student-form-field"><span>Email address *</span><input type="email" required value={form.email} onChange={e=>update("email",e.target.value)}/></label>
        <label className="student-form-field"><span>Program</span><select value={form.program} onChange={e=>update("program",e.target.value)}><option>BSIT</option><option>BSBA</option><option>BSHM</option></select></label>
        <label className="student-form-field"><span>Section</span><input required value={form.section} onChange={e=>update("section",e.target.value)}/></label>
        <label className="student-form-field student-form-wide"><span>Academic term</span><input required value={form.term} onChange={e=>update("term",e.target.value)}/></label>
        <label className="student-form-field"><span>Required hours</span><input type="number" min="1" max="2000" required value={form.requiredHours} onChange={e=>update("requiredHours",Number(e.target.value))}/></label>
        <label className="student-form-field"><span>Faculty adviser</span><input value={form.adviser} onChange={e=>update("adviser",e.target.value)}/></label>
        <label className="student-form-field"><span>Adviser email</span><input type="email" value={form.adviserEmail} onChange={e=>update("adviserEmail",e.target.value)}/></label>
        <label className="student-form-field"><span>Contact number</span><input value={form.phone} onChange={e=>update("phone",e.target.value)}/></label>
        {modal==="add" && <label className="student-form-field student-form-wide"><span>Initial password * (at least 10 characters)</span><input type="password" required minLength={10} value={form.password||""} onChange={e=>update("password",e.target.value)} autoComplete="new-password"/></label>}
      </div><div className="student-modal-actions"><button className="student-cancel-button" type="button" onClick={()=>setModal(null)} disabled={saving}>Cancel</button><button className="student-primary-button" type="submit" disabled={saving}>{saving?"Saving…":modal==="add"?"Add student":"Save changes"}</button></div><p className="student-form-note">Saved to the internship database. Student IDs cannot be changed after creation.</p></form></section></div>}
      {notice && <div className="student-toast"><CheckCircle2 size={15}/>{notice}</div>}
    </section>
  );
}
