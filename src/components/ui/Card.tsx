import clsx from '../../utils/clsx';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('flat-card rounded-3xl p-5', className)} />;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-electric">Portail opérationnel</p>
        <h1 className="mt-1 text-2xl font-extrabold text-cold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-metal">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
