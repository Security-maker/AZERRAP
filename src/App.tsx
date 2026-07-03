import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { AppShell } from './components/layout/AppShell';
import LoginPage from './pages/public/LoginPage';
import InstallPage from './pages/public/InstallPage';
import AccessDeniedPage from './pages/public/AccessDeniedPage';
import OfflinePage from './pages/public/OfflinePage';
import AgentHome from './pages/agent/AgentHome';
import ShiftStartPage from './pages/agent/ShiftStartPage';
import ShiftEndPage from './pages/agent/ShiftEndPage';
import AgentMciPage from './pages/agent/AgentMciPage';
import AgentDocsPage from './pages/agent/AgentDocsPage';
import AgentRoundPage from './pages/agent/AgentRoundPage';
import AgentFlashPage from './pages/agent/AgentFlashPage';
import QgDashboard from './pages/qg/QgDashboard';
import QgReportsPage from './pages/qg/QgReportsPage';
import QgAgentsPage from './pages/qg/QgAgentsPage';
import QgSitesPage from './pages/qg/QgSitesPage';
import QgAlertsPage from './pages/qg/QgAlertsPage';
import QgFlashPage from './pages/qg/QgFlashPage';
import QgHistoryPage from './pages/qg/QgHistoryPage';
import QgSettingsPage from './pages/qg/QgSettingsPage';

function Loading() {
  return <div className="grid min-h-screen place-items-center bg-obsidian"><Loader2 className="h-10 w-10 animate-spin text-electric" /></div>;
}

function Protected({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!profile) return <Navigate to="/login" replace />;
  if (!roles.includes(profile.role)) return <Navigate to="/access-denied" replace />;
  return children;
}

function EntryRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={profile.role === 'agent' ? '/agent' : '/qg'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<EntryRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/install" element={<InstallPage />} />
      <Route path="/offline" element={<OfflinePage />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />

      <Route element={<Protected roles={['agent']}><AppShell mode="agent" /></Protected>}>
        <Route path="/agent" element={<AgentHome />} />
        <Route path="/agent/start" element={<ShiftStartPage />} />
        <Route path="/agent/end" element={<ShiftEndPage />} />
        <Route path="/agent/mci" element={<AgentMciPage />} />
        <Route path="/agent/docs" element={<AgentDocsPage />} />
        <Route path="/agent/ronde" element={<AgentRoundPage />} />
        <Route path="/agent/flash" element={<AgentFlashPage />} />
      </Route>

      <Route element={<Protected roles={['superviseur', 'admin']}><AppShell mode="qg" /></Protected>}>
        <Route path="/qg" element={<QgDashboard />} />
        <Route path="/qg/reports" element={<QgReportsPage />} />
        <Route path="/qg/dispositif" element={<QgAgentsPage />} />
        <Route path="/qg/sites" element={<QgSitesPage />} />
        <Route path="/qg/alerts" element={<QgAlertsPage />} />
        <Route path="/qg/flash" element={<QgFlashPage />} />
        <Route path="/qg/history" element={<QgHistoryPage />} />
        <Route path="/qg/settings" element={<QgSettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
