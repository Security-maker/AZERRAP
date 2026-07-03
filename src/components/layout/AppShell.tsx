import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, BookOpen, ClipboardList, Gauge, LogOut, MapPinned, MessageSquareWarning, QrCode, Shield, Users, Building2, History, Settings, Home } from 'lucide-react';
import logo from '../../assets/logo.png';
import { useAuth } from '../../hooks/useAuth';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { SosButton } from './SosButton';
import clsx from '../../utils/clsx';

const agentNav = [
  { to: '/agent', label: 'Accueil', icon: Home },
  { to: '/agent/mci', label: 'MCI', icon: ClipboardList },
  { to: '/agent/ronde', label: 'Ronde', icon: QrCode },
  { to: '/agent/docs', label: 'Docs', icon: BookOpen },
  { to: '/agent/flash', label: 'Flash', icon: Bell }
];

const qgNav = [
  { to: '/qg', label: 'Dashboard', icon: Gauge },
  { to: '/qg/reports', label: 'MCI', icon: ClipboardList },
  { to: '/qg/dispositif', label: 'Agents', icon: Users },
  { to: '/qg/sites', label: 'Sites', icon: Building2 },
  { to: '/qg/alerts', label: 'SOS', icon: MessageSquareWarning },
  { to: '/qg/flash', label: 'Flash', icon: Bell },
  { to: '/qg/history', label: 'Exports', icon: History },
  { to: '/qg/settings', label: 'Réglages', icon: Settings }
];

export function AppShell({ mode }: { mode: 'agent' | 'qg' }) {
  const nav = mode === 'agent' ? agentNav : qgNav;
  const { profile, logout } = useAuth();
  const online = useOnlineStatus();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-obsidian text-cold">
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-72 border-r border-white/10 bg-obsidian/95 p-5 md:block">
        <Link to={mode === 'agent' ? '/agent' : '/qg'} className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="h-11 w-11 rounded-2xl bg-night object-contain" />
          <div>
            <p className="text-lg font-extrabold">Sentinelle Pro</p>
            <p className="text-xs font-semibold text-metal">Portail sécurisé</p>
          </div>
        </Link>
        <div className="mt-6 rounded-3xl border border-white/10 bg-night p-4">
          <p className="text-xs text-metal">Utilisateur</p>
          <p className="mt-1 font-bold">{profile?.prenom} {profile?.nom}</p>
          <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-metal">
            <span className={clsx('status-dot', online ? 'bg-operational' : 'bg-alert')} /> {online ? 'En ligne' : 'Hors ligne'}
          </p>
          {mode === 'agent' && <p className="mt-2 text-xs text-electric">GPS actif pendant le service</p>}
        </div>
        <nav className="mt-6 space-y-2">
          {nav.map((item) => (
            <NavLink key={item.to} end={item.to === '/agent' || item.to === '/qg'} to={item.to} className={({ isActive }) => clsx('flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-bold transition', isActive ? 'bg-azure text-white' : 'text-metal hover:bg-white/5 hover:text-cold')}>
              <item.icon className="h-5 w-5" /> {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={async () => { await logout(); navigate('/login'); }} className="absolute bottom-5 left-5 right-5 flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 px-4 text-sm font-bold text-metal hover:bg-white/5">
          <LogOut className="h-5 w-5" /> Déconnexion
        </button>
      </aside>

      <main className="px-4 pb-28 pt-5 md:ml-72 md:px-8 md:pb-10">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="h-10 w-10 rounded-2xl bg-night object-contain" />
            <span className="font-extrabold">Sentinelle</span>
          </div>
          <span className={clsx('rounded-full px-3 py-1 text-xs font-bold', online ? 'bg-operational/15 text-operational' : 'bg-alert/15 text-alert')}>{online ? 'En ligne' : 'Hors ligne'}</span>
        </div>
        <Outlet />
      </main>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-obsidian/95 px-2 pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {nav.slice(0, 5).map((item) => (
            <NavLink key={item.to} end={item.to === '/agent' || item.to === '/qg'} to={item.to} className={({ isActive }) => clsx('flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold', isActive ? 'bg-azure text-white' : 'text-metal')}>
              <item.icon className="h-5 w-5" /> {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <SosButton />
    </div>
  );
}
