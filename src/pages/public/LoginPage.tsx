import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import logo from '../../assets/logo.png';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';

export default function LoginPage() {
  const { login, profile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (profile) return <Navigate to={profile.role === 'agent' ? '/agent' : '/qg'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Accès refusé. Vérifie l’email et le mot de passe.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-obsidian p-5">
      <section className="w-full max-w-md rounded-[2rem] border border-electric/20 bg-night p-6 shadow-premium">
        <div className="text-center">
          <img src={logo} alt="Logo agence" className="mx-auto h-20 w-20 rounded-3xl bg-obsidian object-contain" />
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-electric/25 bg-electric/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-electric"><ShieldCheck className="h-4 w-4" /> Portail sécurisé</p>
          <h1 className="mt-4 text-3xl font-extrabold text-cold">Connexion opérationnelle</h1>
          <p className="mt-2 text-sm text-metal">Accès réservé aux agents et superviseurs habilités.</p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <Input type="email" autoComplete="email" placeholder="Email professionnel" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" autoComplete="current-password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="rounded-2xl border border-alert/30 bg-alert/10 p-3 text-sm font-semibold text-alert">{error}</p>}
          <Button disabled={loading} className="w-full">
            <LockKeyhole className="mr-2 inline h-4 w-4" /> {loading ? 'Vérification...' : 'Entrer dans le portail'}
          </Button>
        </form>
        <p className="mt-5 text-center text-xs text-metal">Portail opérationnel sécurisé · PWA installable</p>
      </section>
    </main>
  );
}
