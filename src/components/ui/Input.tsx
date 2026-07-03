import clsx from '../../utils/clsx';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('focus-ring min-h-12 w-full rounded-2xl border border-white/10 bg-obsidian px-4 py-3 text-cold placeholder:text-metal', props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx('focus-ring min-h-36 w-full rounded-2xl border border-white/10 bg-obsidian px-4 py-3 text-cold placeholder:text-metal', props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx('focus-ring min-h-12 w-full rounded-2xl border border-white/10 bg-obsidian px-4 py-3 text-cold', props.className)} />;
}
