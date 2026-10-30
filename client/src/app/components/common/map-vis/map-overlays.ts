// What a host can draw on map-vis besides its data points.

/** A line between two places, drawn as a gentle arc (e.g. a priest's circuit). */
export interface MapLink {
  from: [number, number];   // [lng, lat]
  to: [number, number];
  color?: string;
  dashed?: boolean;
  width?: number;
  /** Shown on hover. */
  title?: string;
  /** Router link followed on click, with optional query parameters. */
  link?: any[];
  query?: Record<string, any>;
  /** Straight instead of arced (e.g. a path whose legs should read as one line). */
  straight?: boolean;
}

/** A faint point under the data, for context (e.g. neighbouring institutions). */
export interface MapContextPoint {
  lat: number;
  lng: number;
  title?: string;
  link?: any[];
  query?: Record<string, any>;
  color?: string;
  radius?: number;
}

/** A small italic label beside a place (e.g. the years someone served there). */
export interface MapLabel {
  lat: number;
  lng: number;
  text: string;
}
