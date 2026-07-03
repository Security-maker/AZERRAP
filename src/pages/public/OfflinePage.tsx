export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-obsidian p-5">
      <section className="max-w-lg rounded-[2rem] border border-white/10 bg-night p-7">
        <h1 className="text-3xl font-extrabold">Mode hors ligne</h1>
        <p className="mt-3 text-metal">Les données critiques nécessitent une connexion. Une alerte SOS n’est considérée envoyée qu’après confirmation serveur.</p>
      </section>
    </main>
  );
}
