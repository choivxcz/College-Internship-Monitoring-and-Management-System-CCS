import { useEffect, useState } from "react";
import type { UserDTO } from "../../shared/contracts";
import Dashboard from "./pages/dashboard/DashboardPage";
import LoginPage from "./pages/auth/LoginPage";
import StudentPortalPage from "./pages/student/StudentPortalPage";
import { api } from "./services/api";

export default function App() {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((current) => {
        if (active) setUser(current);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await api.logout().catch(() => undefined);
    setUser(null);
  }

  if (checkingSession) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b1f3a",
          color: "#dbe7ff",
          fontFamily: "Inter, Arial, sans-serif",
          letterSpacing: "0.08em",
          fontSize: 12,
        }}
      >
        CHECKING YOUR SESSION…
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  if (user.role === "admin") {
    return <Dashboard user={user} onLogout={handleLogout} />;
  }

  return <StudentPortalPage user={user} onLogout={handleLogout} />;
}
