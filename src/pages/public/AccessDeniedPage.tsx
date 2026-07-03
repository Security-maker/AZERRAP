import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-obsidian p-5 text-center">
      <section className="max-w-md rounded-[2rem] border border-alert/30 bg-alert/10 p-7">
        <h1 className="text-3xl font-extrabold text-alert">Accès refusé</h1>
        <p className="mt-3 text-metal">Ton rôle ne permet pas d’accéder à cette zone.</p>
        <Link to="/"><Button className="mt-6">Retour portail</Button></Link>
      </section>
    </main>
  );
}
