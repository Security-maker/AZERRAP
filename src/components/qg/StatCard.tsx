import type { LucideIcon } from 'lucide-react';
import clsx from '../../utils/clsx';

const tones = {
  green: 'text-operational border-operational/20 bg-operational/10',
  orange: 'text-incident border-incident/20 bg-incident/10',
  red: 'text-alert border-alert/20 bg-alert/10',
  blue: 'text-electric border-electric/20 bg-electric/10'
};

export function StatCard({ label, value, icon: Icon, tone = 'blue' }: { label: string; value: number | string; icon: LucideIcon; tone?: keyof typeof tones }) {
  return (
    <div className={clsx('rounded-3xl border p-5', tones[tone])}>
      <div className="flex items-center justify-between"><p className="text-xs font-extrabold uppercase tracking-[0.2em] opacity-80">{label}</p><Icon className="h-5 w-5" /></div>
      <p className="mt-4 text-4xl font-extrabold text-cold">{value}</p>
    </div>
  );
}
