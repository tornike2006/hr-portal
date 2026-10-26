import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { configured } from "./lib/supabase";
import { useSession } from "./lib/session";
import { Login, NotLinked, ResetPassword, SetupNeeded } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { People } from "./pages/People";
import { Profile } from "./pages/Profile";
import { OrgChart } from "./pages/OrgChart";
import { TimeOff } from "./pages/TimeOff";
import { Timesheet } from "./pages/Timesheet";
import { Payroll } from "./pages/Payroll";
import { Documents } from "./pages/Documents";
import { Chat } from "./pages/Chat";
import { Announcements } from "./pages/Announcements";
import { Performance } from "./pages/Performance";
import { Recruiting } from "./pages/Recruiting";
import { Onboarding } from "./pages/Onboarding";
import { SettingsPage } from "./pages/Settings";

function HROnly({ children }: { children: ReactNode }) {
  const { isHR } = useSession();
  return isHR ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  const { session, loading, isMember } = useSession();
  if (!configured) return <SetupNeeded />;
  if (window.location.pathname === "/reset-password") return <ResetPassword />;
  if (loading) return <Spinner />;
  if (!session) return <Login />;
  if (!isMember) return <NotLinked />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="people" element={<People />} />
        <Route path="people/:id" element={<Profile />} />
        <Route path="org" element={<OrgChart />} />
        <Route path="time-off" element={<TimeOff />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:channelId" element={<Chat />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="performance" element={<Performance />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="recruiting" element={<Recruiting />} />
        <Route path="timesheet" element={<HROnly><Timesheet /></HROnly>} />
        <Route path="payroll" element={<HROnly><Payroll /></HROnly>} />
        <Route path="documents" element={<HROnly><Documents /></HROnly>} />
        <Route path="settings" element={<HROnly><SettingsPage /></HROnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
