import { COUNT_RAMP } from './palette';

/** One step of a shaded map's key. */
export interface ShadeStep { from: number; to: number | null; color: string; label: string; }

export interface Shading {
  /** area id -> colour, for map-vis [dioceseShades] / [countyShades] */
  colors: Record<string, string>;
  steps: ShadeStep[];
}

/**
 * Colours areas by a value on a sequential ramp, in equal steps up to `max`
 * (the largest value unless given), with the value formatted for the key.
 * Areas with no value are left out, so the map leaves them unshaded.
 */
export function shadeByValue(values: Record<string, number | null | undefined>, options: {
  max?: number; ramp?: string[]; format?: (v: number) => string;
} = {}): Shading {
  const ramp = options.ramp ?? COUNT_RAMP;
  const nums = Object.values(values).filter((v): v is number => v != null && Number.isFinite(v));
  const max = options.max ?? ((nums.length ? Math.max(...nums) : 1) || 1);
  const fmt = options.format ?? (v => String(Math.round(v)));
  const step = max / ramp.length;
  const colors: Record<string, string> = {};
  for (const [id, v] of Object.entries(values)) {
    if (v == null || !Number.isFinite(v)) continue;
    colors[id] = ramp[Math.min(ramp.length - 1, Math.floor(v / step))];
  }
  const steps = ramp.map((color, i) => {
    const from = i * step, to = i === ramp.length - 1 ? null : (i + 1) * step;
    return { from, to, color, label: to == null ? `${fmt(from)} and over` : `${fmt(from)}–${fmt(to)}` };
  });
  return { colors, steps };
}

/** Shares as percentages, steps of a fifth. */
export const percentFormat = (v: number): string => `${Math.round(v * 100)}%`;
