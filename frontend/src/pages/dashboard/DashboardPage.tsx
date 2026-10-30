import { useEffect, useMemo, useState } from "react";
import { useAmbientPointer } from "../../hooks/useAmbientPointer";
import AmbientGlow from "../../components/ui/AmbientGlow";
import { Activity, Bell, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Download, FileCheck2, FileText, Flag, GraduationCap, LayoutDashboard, LogOut, Search, ShieldCheck, Users, ChartNoAxesCombined, Clock3, ArrowUpRight, Menu, X } from "lucide-react";
import "./dashboard.css";
import ModulePage from "../../components/layout/ModulePage";
import StudentProfilesPage from "../students/StudentProfilesPage";
import ApplicationsPage from "../applications/ApplicationsPage";
import DocumentsPage from "../documents/DocumentsPage";
import ProgressMonitoringPage from "../progress/ProgressMonitoringPage";
import type { DashboardDTO, IssueDTO, UserDTO } from "../../../../shared/contracts";
import { api, ApiError } from "../../services/api";

type ToastMessage = { title: string; detail?: string; kind?: "success" | "info" };
type DashboardProps = { user: UserDTO; onLogout: () => void | Promise<void> };
const nav=[["Overview",LayoutDashboard],["Student profiles",Users],["Applications",BriefcaseBusiness],["Documents",FileCheck2],["Progress monitoring",ChartNoAxesCombined],["Monitoring & reports",FileText]] as const;
const emptyDashboard: DashboardDTO = {
 students: 0, programs: 0, sections: 0, interning: 0, completed: 0, needsFollowUp: 0,
 requirementExceptions: 0, hoursAtRisk: 0, applications: 0, pipeline: [], issues: [], rows: [],
};
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "IH";
export default function DashboardPage({ user, onLogout }: DashboardProps){
 const [active,setActive]=useState("Overview"),[semester,setSemester]=useState("All terms"),[search,setSearch]=useState(""),[program,setProgram]=useState("All programs"),[status,setStatus]=useState("All statuses"),[page,setPage]=useState(1),[mobile,setMobile]=useState(false),[issue,setIssue]=useState<IssueDTO|null>(null),[reports,setReports]=useState(false);
 const [toast,setToast]=useState<ToastMessage|null>(null);
 const [quickSearchOpen,setQuickSearchOpen]=useState(false);
 const [notificationsOpen,setNotificationsOpen]=useState(false);
 const [profileMenu,setProfileMenu]=useState(false);
 const [summary,setSummary]=useState<DashboardDTO|null>(null);
 const [terms,setTerms]=useState<string[]>([]);
 const [dashboardLoading,setDashboardLoading]=useState(true);
 const [loadError,setLoadError]=useState("");
 const { stageRef, handlePointerMove, handlePointerLeave } = useAmbientPointer<HTMLDivElement>();
 const data = summary ?? emptyDashboard;
 const rows = data.rows;
 const issues = data.issues;
 const userInitials = initialsOf(user.name);
 const todayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" });
 async function loadDashboard(term = semester) {
   setDashboardLoading(true);
   try {
     setSummary(await api.dashboard(term === "All terms" ? undefined : term));
     setLoadError("");
   } catch (error) {
     setLoadError(error instanceof ApiError ? error.message : "Could not load dashboard data.");
     if (error instanceof ApiError && error.status === 401) await onLogout();
   } finally {
     setDashboardLoading(false);
   }
 }
 useEffect(() => { void loadDashboard(semester); }, [semester]);
 useEffect(() => { api.terms().then(setTerms).catch(() => undefined); }, []);
 useEffect(()=>{
   const onKeyDown=(event:KeyboardEvent)=>{
     if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k") { event.preventDefault(); setQuickSearchOpen(true); }
     if(event.key==="Escape") { setQuickSearchOpen(false); setNotificationsOpen(false); setProfileMenu(false); setIssue(null); setReports(false); }
   };
   window.addEventListener("keydown",onKeyDown);
   return ()=>window.removeEventListener("keydown",onKeyDown);
 },[]);
 const filtered=useMemo(()=>rows.filter(r=>(!search||[r.name,String(r.id),r.organization,r.position].some(x=>x.toLowerCase().includes(search.toLowerCase())))&&(program==="All programs"||r.program.startsWith(program))&&(status==="All statuses"||r.status===status)),[rows,search,program,status]);
 const pages=Math.max(1,Math.ceil(filtered.length/6)),shown=filtered.slice((Math.min(page,pages)-1)*6,Math.min(page,pages)*6);
 function exportCSV(){const csv=[["Student","Student ID","Program","Organization","Position","Applied on","Status","Notes"],...filtered.map(r=>[r.name,r.studentId,r.program,r.organization,r.position,r.appliedOn,r.status,r.notes])].map(r=>r.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));const a=document.createElement("a");a.href=url;a.download="internship-application-register.csv";a.click();URL.revokeObjectURL(url);setToast({title:"Register exported",detail:`${filtered.length} application records included in the CSV.`,kind:"success"})}
 async function markFollowUp(item: IssueDTO){try{await api.createFollowUp({studentId:item.id,note:`Follow-up for: ${item.issue}`});setIssue(null);setToast({title:"Follow-up recorded",detail:`${item.name} is now on the coordinator follow-up list.`,kind:"success"});await loadDashboard();}catch(error){setToast({title:"Could not save follow-up",detail:error instanceof ApiError?error.message:"Please try again.",kind:"info"})}}
 return <div ref={stageRef} className="admin-dashboard cinematic-cursor-stage" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
 <AmbientGlow />
 {mobile&&<button className="dashboard-scrim" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
 <aside className={`dashboard-sidebar ${mobile?"is-open":""}`}>
  <div className="sidebar-brand"><div className="sidebar-logo"><GraduationCap size={19}/></div><div><strong>LSPU - SCC</strong><span>COLLEGE INTERNSHIP HUB</span></div><button className="mobile-close" onClick={()=>setMobile(false)} aria-label="Close menu"><X size={17}/></button></div>
  <div className="semester-picker"><label htmlFor="semester">ACADEMIC WORKSPACE</label><div className="semester-select-wrap"><select id="semester" value={semester} onChange={e=>setSemester(e.target.value)}><option>All terms</option>{terms.map(term=><option key={term}>{term}</option>)}</select><ChevronDown size={13}/></div></div>
  <nav className="sidebar-nav"><p className="nav-group-title">MANAGE INTERNSHIPS</p>{nav.map(([label,Icon])=><button key={label} className={`nav-item ${active===label?"active":""}`} onClick={()=>{
    setActive(label);
    setMobile(false);
    setPage(1);
    setSearch("");
    setProgram("All programs");
    setStatus("All statuses");
    setToast(null);
  }}><Icon size={15}/><span>{label}</span>{label==="Applications"&&<span className="nav-count">{data.applications}</span>}</button>)}</nav>
  <div className="sidebar-help"><div className="help-icon"><CircleHelp size={14}/></div><strong>A little guidance?</strong><p>Find policies, templates and coordinator resources.</p><button onClick={()=>setReports(true)}>Open resource center <ArrowUpRight size={12}/></button></div>
  <div className="sidebar-user"><div className="user-avatar">{userInitials}</div><div><strong>{user.name}</strong><span>{user.role === "admin" ? "Internship coordinator" : "Student"}</span></div></div>
 </aside>
 <main className="dashboard-main">
  <header className="dashboard-topbar"><div className="topbar-left"><button className="mobile-menu" aria-label="Open menu" onClick={()=>setMobile(true)}><Menu size={19}/></button><span>Internship hub</span><ChevronRight size={12}/><strong>{active}</strong><button className="quick-search-trigger" onClick={()=>setQuickSearchOpen(true)} aria-label="Open quick search"><Search size={11}/><span>Quick search</span><kbd>Ctrl K</kbd></button></div><div className="topbar-right"><span className="today-label">{todayLabel}</span><div className="topbar-popover-wrap"><button className={`topbar-icon ${notificationsOpen?"is-active":""}`} aria-label="Notifications" onClick={()=>{setNotificationsOpen(v=>!v);setProfileMenu(false)}}><Bell size={15}/><i/></button>{notificationsOpen&&<div className="topbar-popover notification-popover"><div className="popover-heading"><strong>Notifications</strong><span>{data.requirementExceptions + data.hoursAtRisk} updates</span></div><button onClick={()=>{setNotificationsOpen(false);setActive("Progress monitoring");setToast({title:"Adviser review due soon",detail:"Midterm adviser review is due 16 October.",kind:"info"})}}><span className="notification-dot amber-dot"/><span><strong>Midterm adviser review</strong><small>Due 16 October · 22 students nearing completion</small></span></button><button onClick={()=>{setNotificationsOpen(false);setActive("Documents");setToast({title:"Documents need attention",detail:"38 requirement exceptions are currently flagged.",kind:"info"})}}><span className="notification-dot violet-dot"/><span><strong>Pending requirements</strong><small>38 requirement exceptions need review</small></span></button><button className="popover-footer-action" onClick={()=>{setNotificationsOpen(false);setActive("Monitoring & reports")}}>View monitoring summary <ArrowUpRight size={11}/></button></div>}</div><div className="topbar-popover-wrap"><button className="topbar-avatar" aria-label="User profile menu" onClick={()=>{setProfileMenu(v=>!v);setNotificationsOpen(false)}}>{userInitials}</button>{profileMenu&&<div className="topbar-popover profile-popover"><div className="profile-popover-user"><span className="user-avatar">{userInitials}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div><button onClick={()=>{setProfileMenu(false);setToast({title:"Account settings",detail:"Use the password endpoint to change your password when needed.",kind:"info"})}}>Account settings <ArrowUpRight size={11}/></button><button onClick={()=>{setProfileMenu(false);setReports(true)}}>Help & resources <CircleHelp size={12}/></button><button onClick={()=>{setProfileMenu(false);void onLogout();}}>Sign out <LogOut size={12}/></button></div>}</div></div></header>
  <div className="dashboard-content">
   {active === "Overview" ? (
   <>
   <section className="dashboard-heading"><div><p className="mobile-context">ADMIN WORKSPACE / OVERVIEW</p><h1>{active==="Overview"?"Your internship overview":active}</h1><p>A clear view of placements, requirements and student progress across the college.</p></div><button className="report-button" onClick={()=>setReports(true)}><ChartNoAxesCombined size={14}/> View reports</button></section>
   <section className="semester-banner"><div><CalendarDays size={14}/><span>{semester === "All terms" ? "All academic terms" : semester} <b>·</b> {data.students} students across {data.programs} programs</span></div><span className="updated-label">{dashboardLoading ? "Syncing…" : "Live from the internship database"}</span></section>
   {loadError && <section className="semester-banner"><div><CircleHelp size={14}/><span>{loadError}</span></div><button className="text-action" type="button" onClick={()=>void loadDashboard()}>Retry</button></section>}
   <section className="stat-grid">
    {[["Enrolled students",String(data.students),`${data.sections} sections · ${data.programs} programs`,Users,"purple"],["Currently interning",String(data.interning),`${data.students ? (data.interning/data.students*100).toFixed(1) : "0.0"}% of the cohort`,BriefcaseBusiness,"teal"],["Needs follow-up",String(data.needsFollowUp),"Unique students with open exceptions",Clock3,"amber"],["Completed internships",String(data.completed),"All hours and requirements verified",CheckCircle2,"mint"]].map(([title,num,desc,Icon,tint])=><article className="stat-card" key={String(title)}><div className="stat-card-top"><span>{String(title)}</span><span className={`stat-icon ${String(tint)}`}><Icon size={14}/></span></div><strong>{String(num)}</strong><p>{String(desc)}</p></article>)}
   </section>
   <div className="dashboard-columns"><div className="dashboard-left-column">
    <section className="panel pipeline-panel"><div className="panel-heading"><div><h2>Where students are today</h2><p>Placement pipeline · one current status per student</p></div><button className="text-action" onClick={()=>setActive("Applications")}>{data.students} students</button></div>
     <div className="pipeline-bar" aria-label="Placement pipeline by status">{data.pipeline.map(item=><button key={item.label} type="button" title={`${item.label} · ${item.count} students`} aria-label={`Filter ${item.label.toLowerCase()} students`} className={`pipeline-segment ${item.cls}`} style={{width:item.percent}} onClick={()=>{setStatus(item.label);setActive("Applications");setPage(1);setToast({title:item.label,detail:`Application register filtered to ${item.label.toLowerCase()} placements.`,kind:"info"})}}/>)}</div>
     <div className="pipeline-legend">{data.pipeline.map(x=><button className="pipeline-legend-item" key={x.label} onClick={()=>{setStatus(x.label);setActive("Applications");setPage(1)}}><span className={`legend-dot ${x.cls}`}/><span className="legend-label">{x.label}</span><strong>{x.count}</strong><small>{x.percent} of cohort</small></button>)}</div>
     <div className="pipeline-alert"><Flag size={14}/><div><strong>{data.needsFollowUp} students need follow-up</strong><span>{data.requirementExceptions} have unverified requirements and {data.hoursAtRisk} are at risk on hours.</span></div><button onClick={()=>setActive("Progress monitoring")}>Review <ArrowUpRight size={12}/></button></div>
    </section>
<section className="panel attention-panel"><div className="panel-heading"><div><h2>Students needing attention</h2><p>Prioritized exceptions · {data.needsFollowUp} unique students</p></div><button className="text-action" onClick={()=>setActive("Progress monitoring")}>View all <ArrowUpRight size={12}/></button></div>
      <div className="issue-chips"><span className="chip purple-chip">All open · {data.needsFollowUp}</span><span className="chip orange-chip">Requirements · {data.requirementExceptions}</span><span className="chip red-chip">Hours at risk · {data.hoursAtRisk}</span></div>
      <div className="issue-table-wrap"><table className="issue-table"><thead><tr><th>Student</th><th>Issue</th><th>Adviser</th><th>Action</th></tr></thead><tbody>{issues.map(i=><tr key={i.id+i.name}><td><div className="student-cell"><span className="student-avatar">{i.initials}</span><span><strong>{i.name}</strong><small>{i.id} · {i.program}</small></span></div></td><td><span className={`issue-pill ${i.type}`}>{i.issue}</span></td><td>{i.adviser}</td><td><button className="table-action" onClick={()=>setIssue(i)}>{i.followed?"Noted":i.action} {i.followed?<CheckCircle2 size={11}/>:<ArrowUpRight size={11}/>}</button></td></tr>)}{!issues.length&&<tr><td colSpan={4} className="empty-state">No students need attention in this term.</td></tr>}</tbody></table></div><p className="table-footnote">Requirement and hour exceptions may overlap; students are counted once in the follow-up total.</p>
     </section>
   </div>
<section className="panel register-panel"><div className="panel-heading register-heading"><div><h2>Application register</h2><p>{data.applications} applications recorded · students may have more than one application</p></div><button className="text-action export-action" onClick={exportCSV}>Export register <Download size={12}/></button></div>
     <div className="register-filters"><label className="search-field"><Search size={14}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Search student or organization"/></label><select aria-label="Filter by program" value={program} onChange={e=>{setProgram(e.target.value);setPage(1)}}><option>All programs</option><option>BSIT</option><option>BSBA</option><option>BSHM</option></select><select aria-label="Filter by status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1)}}><option>All statuses</option><option>Applying</option><option>Accepted</option><option>Interning</option><option>Completed</option><option>Rejected</option></select></div>
     <div className="register-table-wrap"><table className="register-table"><thead><tr><th>Student</th><th>Organization</th><th>Position</th></tr></thead><tbody>{shown.map(r=><tr key={r.id}><td><strong>{r.name}</strong><small>{r.studentId} · {r.program}</small></td><td>{r.organization}<small>Applied {r.appliedOn}</small></td><td><span className="position-cell">{r.position}</span><span className={`status-mini status-${r.status.toLowerCase().replace(/ /g,"-")}`}>{r.status}</span></td></tr>)}{!shown.length&&<tr><td colSpan={3} className="empty-state">No applications match your filters.</td></tr>}</tbody></table></div>
    <div className="register-pagination"><span>Showing {filtered.length?(Math.min(page,pages)-1)*6+1:0}–{Math.min(Math.min(page,pages)*6,filtered.length)} of {filtered.length} applications</span><div><button disabled={page<=1} onClick={()=>setPage(x=>Math.max(1,x-1))}><ChevronLeft size={13}/> Previous</button><span className="page-number">{Math.min(page,pages)}</span><button disabled={page>=pages} onClick={()=>setPage(x=>Math.min(pages,x+1))}>Next <ChevronRight size={13}/></button></div></div>
   </section></div>
   </>
   ) : active === "Student profiles" ? (
  <StudentProfilesPage />
  ) : active === "Applications" ? (
  <ApplicationsPage />
  ) : active === "Documents" ? (
  <DocumentsPage />
  ) : active === "Progress monitoring" ? (
  <ProgressMonitoringPage />
  ) : (
  <ModulePage active={active} />
  )}
   <footer className="dashboard-footer"><span>© 2026 LSPU-SCC College Internship Hub</span><span><ShieldCheck size={12}/> Internal administrative workspace</span></footer>
  </div>
 </main>
 {(issue||reports)&&<div className="dashboard-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setIssue(null);setReports(false)}}}><section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="dash-modal-title"><button className="dashboard-modal-close" aria-label="Close dialog" onClick={()=>{setIssue(null);setReports(false)}}><X size={17}/></button><div className="dashboard-modal-icon">{issue?<ClipboardList size={22}/>:<Activity size={22}/>}</div><h2 id="dash-modal-title">{issue?"Student follow-up":"Reports & resources"}</h2>{issue?<><p>Review the open item for <strong>{issue.name}</strong> ({issue.id}).</p><div className="modal-detail-row"><span>Issue</span><strong>{issue.issue}</strong></div><div className="modal-detail-row"><span>Adviser</span><strong>{issue.adviser}</strong></div><p className="modal-demo-note">{issue.followed ? "A follow-up note is already recorded for this student." : "Record this follow-up so it appears in the coordinator's notes."}</p><button className="modal-followup-button" disabled={issue.followed} onClick={()=>void markFollowUp(issue)}><CheckCircle2 size={14}/> {issue.followed ? "Follow-up already recorded" : "Mark follow-up noted"}</button></>:<><p>Quick access to internship monitoring summaries and coordinator resources.</p><div className="resource-list"><div><ChartNoAxesCombined size={16}/><span><strong>Semester progress report</strong><small>Placement status, hours and completion</small></span></div><div><FileText size={16}/><span><strong>Requirements summary</strong><small>Pending and verified documents</small></span></div><div><ShieldCheck size={16}/><span><strong>Coordinator resource center</strong><small>Policies, templates and guidance</small></span></div></div></>}<button className="dashboard-modal-primary" onClick={()=>{setIssue(null);setReports(false)}}>Close</button></section></div>}
  {toast&&<div className={`interaction-toast ${toast.kind==="success"?"toast-success":"toast-info"}`} role="status"><span className="toast-icon">{toast.kind==="success"?<CheckCircle2 size={16}/>:<Activity size={16}/>}</span><span className="toast-copy"><strong>{toast.title}</strong>{toast.detail&&<small>{toast.detail}</small>}</span><button aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={14}/></button></div>}
  {quickSearchOpen&&<div className="quick-search-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setQuickSearchOpen(false)}}><section className="quick-search-modal" role="dialog" aria-modal="true" aria-label="Quick search"><div className="quick-search-input"><Search size={17}/><input autoFocus value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Search students, organizations, positions..." onKeyDown={e=>{if(e.key==="Enter"){setActive("Applications");setQuickSearchOpen(false);setToast({title:"Search applied",detail:`Showing matches for “${search}”.`,kind:"info"})}}}/><kbd>ESC</kbd></div><p>QUICK ACTIONS</p><button onClick={()=>{setActive("Applications");setQuickSearchOpen(false);setToast({title:"Application register",detail:"Use the filters to narrow down application records.",kind:"info"})}}><BriefcaseBusiness size={15}/><span><strong>Open application register</strong><small>Search and filter placement applications</small></span><ArrowUpRight size={12}/></button><button onClick={()=>{setActive("Progress monitoring");setQuickSearchOpen(false);setToast({title:"Progress monitoring",detail:"Review students with hours or requirement exceptions.",kind:"info"})}}><ChartNoAxesCombined size={15}/><span><strong>Review student progress</strong><small>Find students who may need follow-up</small></span><ArrowUpRight size={12}/></button><button onClick={()=>{setQuickSearchOpen(false);exportCSV()}}><Download size={15}/><span><strong>Export current register</strong><small>Download the currently filtered rows as CSV</small></span><ArrowUpRight size={12}/></button><div className="quick-search-hint">Tip: press <kbd>Ctrl</kbd> + <kbd>K</kbd> anytime to open quick search.</div></section></div>}
 </div>
}
