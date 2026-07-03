import clsx from '../../utils/clsx';

const color = {
  normal: 'border-operational/40 text-operational bg-operational/10',
  surveillance: 'border-incident/40 text-incident bg-incident/10',
  important: 'border-incident/70 text-incident bg-incident/20',
  critique: 'border-alert/60 text-alert bg-alert/15',
  info: 'border-electric/40 text-electric bg-electric/10'
};

export function Badge({ children, tone = 'info' }: { children: React.ReactNode; tone?: keyof typeof color }) {
  return <span className={clsx('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide', color[tone])}>{children}</span>;
}
