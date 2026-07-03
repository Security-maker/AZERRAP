import type { FireDate } from '../types';

export function toDate(value: FireDate): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if ('toDate' in value && typeof value.toDate === 'function') return value.toDate();
  return null;
}

export function toReadableDate(value: FireDate) {
  const date = toDate(value);
  return date ? date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

export function durationBetween(start: FireDate, end: FireDate = new Date()) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return '—';
  const minutes = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}`;
}
