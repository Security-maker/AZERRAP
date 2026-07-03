import clsx from '../../utils/clsx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';

const variants: Record<Variant, string> = {
  primary: 'bg-azure text-white border-azure hover:bg-electric',
  secondary: 'bg-night text-cold border-white/10 hover:border-electric/60',
  danger: 'bg-alert text-white border-alert hover:brightness-110',
  ghost: 'bg-transparent text-cold border-white/10 hover:bg-white/5',
  success: 'bg-operational text-obsidian border-operational hover:brightness-110',
  warning: 'bg-incident text-obsidian border-incident hover:brightness-110'
};

export function Button({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={clsx(
        'focus-ring min-h-12 rounded-2xl border px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className
      )}
    />
  );
}
