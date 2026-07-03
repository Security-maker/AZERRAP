export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
      <p className="font-bold text-cold">{title}</p>
      <p className="mt-2 text-sm text-metal">{message}</p>
    </div>
  );
}
