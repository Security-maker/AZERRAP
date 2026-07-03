export function sanitizeText(value: string, maxLength = 5000) {
  return value
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, maxLength);
}

export function canUseNFC() {
  return 'NDEFReader' in window;
}

export function canVibrate() {
  return 'vibrate' in navigator;
}
