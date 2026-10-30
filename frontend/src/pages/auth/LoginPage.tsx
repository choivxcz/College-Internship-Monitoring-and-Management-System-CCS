import "./login.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  GraduationCap,
  UserRound,
  LockKeyhole,
  Eye,
  EyeOff,
  ShieldCheck,
  Send,
  Files,
  ArrowRight,
  CircleHelp,
  CheckCircle2,
  X,
  Mail,
  Phone,
  BookOpen,
  UserPlus,
} from "lucide-react";
import type { UserDTO } from "../../../../shared/contracts";
import { api, ApiError, type RegisterInput } from "../../services/api";

type UserRole = "student" | "admin";

type LoginPageProps = { onLogin: (user: UserDTO) => void };

const emptySignUp = { id: "", name: "", email: "", program: "BSIT" as RegisterInput["program"], section: "", phone: "", password: "", confirm: "" };

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [role, setRole] = useState<UserRole>("student");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<
    "success" | "error" | "info"
  >("info");
  const [helpOpen, setHelpOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnteringDashboard, setIsEnteringDashboard] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signUp, setSignUp] = useState(emptySignUp);
  const fluidCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = fluidCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let lastMoveAt = 0;
    let pointerInside = false;
    const points: { x: number; y: number; vx: number; vy: number }[] = [];
    const pointCount = 6;

    const resizeCanvas = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerInside = true;
      lastMoveAt = performance.now();

      if (points.length === 0) {
        for (let i = 0; i < pointCount; i += 1) {
          points.push({ x: event.clientX, y: event.clientY, vx: 0, vy: 0 });
        }
      }

      points[0].x = event.clientX;
      points[0].y = event.clientY;
    };

    const handlePointerLeave = () => {
      pointerInside = false;
      // Fade the remaining ribbon out quickly instead of cutting it off.
      lastMoveAt = performance.now() - 100;
    };

    const drawRibbon = (opacity: number) => {
      if (points.length < 2 || opacity <= 0.008) return;

      const path = () => {
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i += 1) {
          const midpointX = (points[i].x + points[i + 1].x) / 2;
          const midpointY = (points[i].y + points[i + 1].y) / 2;
          context.quadraticCurveTo(points[i].x, points[i].y, midpointX, midpointY);
        }
        const last = points[points.length - 1];
        context.lineTo(last.x, last.y);
      };

      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = opacity;
      context.lineCap = "round";
      context.lineJoin = "round";

      // A soft, short outer bloom.
      context.filter = "blur(10px)";
      path();
      context.strokeStyle = "rgba(76, 145, 255, 0.32)";
      context.lineWidth = 19;
      context.stroke();

      // Teal color adds a liquid, shifting highlight.
      context.filter = "blur(6px)";
      path();
      context.strokeStyle = "rgba(72, 224, 207, 0.38)";
      context.lineWidth = 7;
      context.stroke();

      // Fine luminous core keeps it elegant, not bulky.
      context.filter = "blur(1px)";
      path();
      context.strokeStyle = "rgba(220, 247, 255, 0.55)";
      context.lineWidth = 2;
      context.stroke();
      context.restore();
    };

    const drawFluidTrail = () => {
      context.clearRect(0, 0, width, height);

      if (points.length > 1) {
        for (let i = points.length - 1; i > 0; i -= 1) {
          const point = points[i];
          const target = points[i - 1];
          const follow = 0.27 - (i / pointCount) * 0.10;
          point.vx += (target.x - point.x) * follow;
          point.vy += (target.y - point.y) * follow;
          point.vx *= 0.58;
          point.vy *= 0.58;
          point.x += point.vx;
          point.y += point.vy;
        }

        const idleFor = lastMoveAt ? performance.now() - lastMoveAt : Infinity;
        // A short, elegant trail that fades away in about a second.
        const fade = pointerInside ? Math.exp(-idleFor / 220) : Math.exp(-idleFor / 180);
        drawRibbon(fade);
      }

      animationFrame = window.requestAnimationFrame(drawFluidTrail);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave);
    animationFrame = window.requestAnimationFrame(drawFluidTrail);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  function showMessage(
    message: string,
    type: "success" | "error" | "info" = "info"
  ) {
    setNotice(message);
    setNoticeType(type);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId.trim() || !password) {
      showMessage(
        "Please enter your student ID or college email and password.",
        "error"
      );
      return;
    }

    setIsSubmitting(true);
    setNotice("");
    try {
      const user = await api.login({
        userId: userId.trim(),
        password,
        role,
        keepSignedIn,
      });
      setIsEnteringDashboard(true);

      // Let the ambient transition finish before mounting the workspace.
      window.setTimeout(() => {
        onLogin(user);
      }, 1150);
    } catch (error) {
      showMessage(
        error instanceof ApiError
          ? error.message
          : "Sign in failed. Please try again.",
        "error"
      );
      setIsSubmitting(false);
    }
  }

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setNotice("");
    setShowPassword(false);
    if (next === "signup") setRole("student");
  }

  const updateSignUp = (field: keyof typeof emptySignUp, value: string) =>
    setSignUp((current) => ({ ...current, [field]: value }));

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signUp.password.length < 10) {
      showMessage("Passwords must have at least 10 characters.", "error");
      return;
    }
    if (signUp.password !== signUp.confirm) {
      showMessage("The two passwords do not match.", "error");
      return;
    }

    setIsSubmitting(true);
    setNotice("");
    try {
      const user = await api.register({
        id: signUp.id.trim(),
        name: signUp.name.trim(),
        email: signUp.email.trim(),
        program: signUp.program,
        section: signUp.section.trim().toUpperCase(),
        phone: signUp.phone.trim(),
        password: signUp.password,
      });
      setIsEnteringDashboard(true);
      window.setTimeout(() => onLogin(user), 1150);
    } catch (error) {
      showMessage(
        error instanceof ApiError ? error.message : "Sign up failed. Please try again.",
        "error"
      );
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resetEmail.trim()) {
      showMessage("Please enter your college email.", "error");
      return;
    }

    try {
      const result = await api.requestPasswordAssistance(resetEmail.trim());
      setForgotOpen(false);
      showMessage(result.message, "success");
    } catch (error) {
      showMessage(
        error instanceof ApiError
          ? error.message
          : "The request could not be submitted.",
        "error"
      );
    }
  }

  return (
    <main className="login-shell">
      {isEnteringDashboard && (
        <div className="dashboard-transition" role="status" aria-live="polite">
          <div className="transition-atmosphere" />
          <div className="transition-orbit transition-orbit-one" />
          <div className="transition-orbit transition-orbit-two" />
          <div className="transition-orbit transition-orbit-three" />
          <div className="transition-center">
            <div className="transition-emblem">
              <GraduationCap size={25} strokeWidth={1.6} />
            </div>
            <span className="transition-kicker">LSPU · SCC</span>
            <strong>Preparing your workspace</strong>
            <span className="transition-caption">A better view of every internship milestone.</span>
            <span className="transition-progress"><i /></span>
          </div>
          <span className="transition-corner-label">COLLEGE INTERNSHIP HUB <span> / </span> {role === "admin" ? "ADMIN" : "STUDENT"}</span>
        </div>
      )}
      <canvas ref={fluidCanvasRef} className="fluid-cursor-canvas" aria-hidden="true" />
      {/* LEFT: UNIVERSITY BRANDING */}
      <section
        className="brand-panel"
        aria-label="LSPU campus and portal information"
      >
        <div className="orb orb-one" />
        <div className="orb orb-two" />

        <header className="brand-header">
          <div className="logo-frame">
            <img
              className="school-logo"
              src="/images/lspu-logo.jpg"
              alt="Laguna State Polytechnic University logo"
            />
          </div>

          <div className="brand-identity">
            <h2>LSPU - SCC</h2>
            <p>College Internship Hub</p>
          </div>
        </header>

        <div className="brand-content">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            YOUR INTERNSHIP, CONNECTED
          </div>

          <h1>
            Your next chapter
            <br />
            starts here.
          </h1>

          <p className="brand-description">
            A single place to manage your applications, submit
            requirements, and stay on track from your first step
            to internship completion.
          </p>

          <div className="campus-card">
            <img
              className="campus-image"
              src="/images/lspu-building.jpg"
              alt="Laguna State Polytechnic University campus building"
            />

            <div className="campus-overlay" />

            <div className="campus-caption">
              <strong>From campus to your next chapter.</strong>
              <span>
                One connected space for every internship milestone.
              </span>
            </div>
          </div>

          <div className="benefits">
            <div className="benefit">
              <Send size={17} strokeWidth={1.6} />
              <p>Apply with confidence</p>
            </div>

            <div className="benefit">
              <Files size={17} strokeWidth={1.6} />
              <p>Keep documents ready</p>
            </div>

            <div className="benefit">
              <GraduationCap size={18} strokeWidth={1.6} />
              <p>Complete your journey</p>
            </div>
          </div>
        </div>

        <footer className="brand-footer">
          <ShieldCheck size={14} />
          <span>
            Built for students. Connected with your college.
          </span>
        </footer>
      </section>

      {/* RIGHT: LOGIN FORM */}
      <section className="login-panel">
        <header className="login-topbar">
          <span className="portal-label">
            COLLEGE INTERNSHIP PORTAL
          </span>

          <button
            className="help-button"
            type="button"
            onClick={() => setHelpOpen(true)}
          >
            <CircleHelp size={14} />
            Need help?
          </button>
        </header>

        <div className="login-content">
          <div className="welcome-badge">
            <GraduationCap size={13} />
            Welcome to your college portal
          </div>

          <h1 className="welcome-title">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>

          <p className="welcome-description">
            {mode === "signin"
              ? "Choose your role and sign in to your internship workspace."
              : "Students can register here to track applications, requirements and hours."}
          </p>

          {mode === "signup" ? (
          <form className="login-form signup-form" onSubmit={handleSignUp}>
            <div className="signup-grid">
              <div className="form-field">
                <label htmlFor="su-id">Student ID</label>
                <div className="input-wrap">
                  <UserRound size={16} />
                  <input id="su-id" required maxLength={40} pattern="[A-Za-z0-9\-]+" title="Letters, numbers and dashes only" placeholder="e.g., 2024-00123" value={signUp.id} onChange={(e) => updateSignUp("id", e.target.value)} />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="su-name">Full name</label>
                <div className="input-wrap">
                  <UserRound size={16} />
                  <input id="su-name" required maxLength={150} autoComplete="name" placeholder="Juan Dela Cruz" value={signUp.name} onChange={(e) => updateSignUp("name", e.target.value)} />
                </div>
              </div>
              <div className="form-field signup-wide">
                <label htmlFor="su-email">College email</label>
                <div className="input-wrap">
                  <Mail size={16} />
                  <input id="su-email" type="email" required autoComplete="email" placeholder="you@lspu.edu.ph" value={signUp.email} onChange={(e) => updateSignUp("email", e.target.value)} />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="su-program">Program</label>
                <div className="input-wrap">
                  <BookOpen size={16} />
                  <select id="su-program" value={signUp.program} onChange={(e) => updateSignUp("program", e.target.value)}>
                    <option value="BSIT">BSIT</option>
                    <option value="BSBA">BSBA</option>
                    <option value="BSHM">BSHM</option>
                  </select>
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="su-section">Section</label>
                <div className="input-wrap">
                  <BookOpen size={16} />
                  <input id="su-section" required maxLength={30} placeholder="e.g., 4A" value={signUp.section} onChange={(e) => updateSignUp("section", e.target.value)} />
                </div>
              </div>
              <div className="form-field signup-wide">
                <label htmlFor="su-phone">Mobile number <span className="optional">(optional)</span></label>
                <div className="input-wrap">
                  <Phone size={16} />
                  <input id="su-phone" type="tel" autoComplete="tel" maxLength={40} placeholder="09XX XXX XXXX" value={signUp.phone} onChange={(e) => updateSignUp("phone", e.target.value)} />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="su-password">Password</label>
                <div className="input-wrap">
                  <LockKeyhole size={16} />
                  <input id="su-password" type={showPassword ? "text" : "password"} required minLength={10} autoComplete="new-password" placeholder="At least 10 characters" value={signUp.password} onChange={(e) => updateSignUp("password", e.target.value)} />
                  <button className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="su-confirm">Confirm password</label>
                <div className="input-wrap">
                  <LockKeyhole size={16} />
                  <input id="su-confirm" type={showPassword ? "text" : "password"} required minLength={10} autoComplete="new-password" placeholder="Repeat password" value={signUp.confirm} onChange={(e) => updateSignUp("confirm", e.target.value)} />
                </div>
              </div>
            </div>

            {notice && (
              <div className={`notice notice-${noticeType}`} role="status">
                {noticeType === "success" ? <CheckCircle2 size={16} /> : <CircleHelp size={16} />}
                <span>{notice}</span>
                <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>
                  <X size={14} />
                </button>
              </div>
            )}

            <button className="sign-in-button" type="submit" disabled={isSubmitting || isEnteringDashboard}>
              <span>{isSubmitting || isEnteringDashboard ? "Creating account…" : "Create student account"}</span>
              <UserPlus size={17} />
            </button>
          </form>
          ) : (
          <form className="login-form" onSubmit={handleLogin}>
            <fieldset className="role-fieldset">
              <legend>I am signing in as a</legend>

              <div className="role-options">
                <button
                  className={`role-card ${
                    role === "student" ? "selected" : ""
                  }`}
                  type="button"
                  aria-pressed={role === "student"}
                  onClick={() => {
                    setRole("student");
                    setNotice("");
                  }}
                >
                  <span className="role-icon">
                    <GraduationCap size={16} />
                  </span>

                  <span className="role-radio">
                    {role === "student" && (
                      <span className="role-radio-dot" />
                    )}
                  </span>

                  <strong>Student</strong>
                  <small>Internship students</small>
                </button>

                <button
                  className={`role-card ${
                    role === "admin" ? "selected" : ""
                  }`}
                  type="button"
                  aria-pressed={role === "admin"}
                  onClick={() => {
                    setRole("admin");
                    setNotice("");
                  }}
                >
                  <span className="role-icon">
                    <ShieldCheck size={16} />
                  </span>

                  <span className="role-radio">
                    {role === "admin" && (
                      <span className="role-radio-dot" />
                    )}
                  </span>

                  <strong>Admin</strong>
                  <small>Administrators &amp; coordinators</small>
                </button>
              </div>
            </fieldset>

            <div className="form-field">
              <label htmlFor="userId">
                {role === "student"
                  ? "Student ID or college email"
                  : "Administrator email"}
              </label>

              <div className="input-wrap">
                <UserRound size={16} />

                <input
                  id="userId"
                  name="userId"
                  type="text"
                  autoComplete="username"
                  placeholder={
                    role === "student"
                      ? "e.g., 2024-00123"
                      : "Enter your administrator email"
                  }
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>

              <div className="input-wrap">
                <LockKeyhole size={16} />

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    role === "student"
                      ? "current-password"
                      : "current-password"
                  }
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />

                <button
                  className="password-toggle"
                  type="button"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
            </div>

            {notice && (
              <div
                className={`notice notice-${noticeType}`}
                role="status"
              >
                {noticeType === "success" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <CircleHelp size={16} />
                )}

                <span>{notice}</span>

                <button
                  type="button"
                  aria-label="Dismiss message"
                  onClick={() => setNotice("")}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="form-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(event) =>
                    setKeepSignedIn(event.target.checked)
                  }
                />
                <span>Keep me signed in</span>
              </label>

              <button
                className="forgot-button"
                type="button"
                onClick={() => setForgotOpen(true)}
              >
                Forgot password?
              </button>
            </div>

            <button className="sign-in-button" type="submit" disabled={isSubmitting || isEnteringDashboard}>
              <span>
                {isSubmitting || isEnteringDashboard
                  ? "Signing in…"
                  : `Sign in as ${role === "student" ? "Student" : "Admin"}`}
              </span>
              <ArrowRight size={17} />
            </button>
          </form>
          )}

          <div className="login-divider" />

          <div className="first-time-note">
            {mode === "signin" ? (
              <p>
                New student?{" "}
                <button className="mode-switch" type="button" onClick={() => switchMode("signup")}>
                  Create an account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button className="mode-switch" type="button" onClick={() => switchMode("signin")}>
                  Sign in
                </button>
              </p>
            )}
            <p>
              For access assistance, contact your internship coordinator.
            </p>
          </div>

          <div className="security-note">
            <LockKeyhole size={12} />
            Secure access for your college community
          </div>
        </div>

        <footer className="login-footer">
          <span>© 2026 College Internship System</span>

          <div>
            <button
              type="button"
              onClick={() =>
                showMessage(
                  "Add your institution's privacy policy URL here.",
                  "info"
                )
              }
            >
              Privacy policy
            </button>

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
            >
              Contact support
            </button>
          </div>
        </footer>
      </section>

      {/* HELP DIALOG */}
      {helpOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setHelpOpen(false);
            }
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close help"
              onClick={() => setHelpOpen(false)}
            >
              <X size={18} />
            </button>

            <div className="modal-icon">
              <CircleHelp size={23} />
            </div>

            <h2 id="help-title">Need help signing in?</h2>

            <p>
              Use the account credentials provided by your college.
              If you cannot access your account, contact your internship
              coordinator or system administrator.
            </p>

            <button
              className="modal-primary"
              type="button"
              onClick={() => setHelpOpen(false)}
            >
              Got it
            </button>
          </section>
        </div>
      )}

      {/* PASSWORD RECOVERY DIALOG */}
      {forgotOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setForgotOpen(false);
            }
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close password recovery"
              onClick={() => setForgotOpen(false)}
            >
              <X size={18} />
            </button>

            <div className="modal-icon">
              <LockKeyhole size={22} />
            </div>

            <h2 id="reset-title">Forgot your password?</h2>

            <p>
              Enter your college email address to begin the password
              recovery process.
            </p>

            <form
              className="reset-form"
              onSubmit={handlePasswordReset}
            >
              <label htmlFor="resetEmail">College email</label>

              <input
                id="resetEmail"
                type="email"
                autoComplete="email"
                placeholder="you@college.edu.ph"
                value={resetEmail}
                onChange={(event) =>
                  setResetEmail(event.target.value)
                }
                required
              />

              <button className="modal-primary" type="submit">
                Request password assistance
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
