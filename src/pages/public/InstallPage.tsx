import { Smartphone, MonitorDown } from 'lucide-react';
import logo from '../../assets/logo.png';

export default function InstallPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-obsidian p-5">
      <section className="max-w-2xl rounded-[2rem] border border-electric/20 bg-night p-7">
        <img src={logo} className="h-16 w-16 rounded-2xl bg-obsidian object-contain" alt="Logo" />
        <h1 className="mt-5 text-3xl font-extrabold">Installer la PWA</h1>
        <p className="mt-3 text-metal">L’application s’installe sans App Store ni Google Play depuis le navigateur.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-obsidian p-5"><Smartphone className="text-electric" /><h2 className="mt-3 font-bold">iPhone / iPad</h2><p className="mt-2 text-sm text-metal">Safari → Partager → Sur l’écran d’accueil.</p></div>
          <div className="rounded-3xl border border-white/10 bg-obsidian p-5"><MonitorDown className="text-electric" /><h2 className="mt-3 font-bold">Android / Desktop</h2><p className="mt-2 text-sm text-metal">Chrome / Edge → Installer l’application.</p></div>
        </div>
      </section>
    </main>
  );
}
