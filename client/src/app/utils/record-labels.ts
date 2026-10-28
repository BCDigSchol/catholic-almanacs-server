// Readable labels for almanac records. The almanacs often listed an institution
// without a name ("not recorded"); rather than show that verbatim, label it by
// its kind and place, and let the UI style it as a generated label.

const UNNAMED = /^\s*(|not recorded|\(name not recorded\)|[—–-])\s*$/i;

export function isUnnamed(name: string | null | undefined): boolean {
  return UNNAMED.test(name || '');
}

/** "church" from "church, school" — the first listed type. */
export function primaryType(type: string | null | undefined): string {
  return (type || '').split(',')[0].trim();
}

/** "Louisville, KY" from whichever parts are known. */
export function placeLabel(city?: string | null, state?: string | null): string {
  return [city, state].filter(Boolean).join(', ');
}

/** The recorded name, or e.g. "Unnamed church" when the almanac gave none. */
export function institutionLabel(name: string | null | undefined, type?: string | null): string {
  if (!isUnnamed(name)) return (name || '').trim();
  const kind = primaryType(type);
  return kind ? `Unnamed ${kind}` : 'Unnamed institution';
}

export function personLabel(p: { title?: string; name?: string; suffix?: string }): string {
  return [p.title, p.name, p.suffix].filter(Boolean).join(' ').trim() || 'Unnamed person';
}

/** "1833–1870" or "1866" for a sorted list of years. */
export function yearSpan(years: number[]): string {
  if (!years.length) return '';
  const first = years[0], last = years[years.length - 1];
  return first === last ? `${first}` : `${first}–${last}`;
}
