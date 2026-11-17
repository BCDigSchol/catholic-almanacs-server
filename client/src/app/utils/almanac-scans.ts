/**
 * Where each year's printed almanac can be read online. The team keeps the
 * list as a spreadsheet; its CSV export is client/public/almanac-scans.csv,
 * read as it comes: a year, the volume's title, then a column per library.
 * A link is filed by the site it points to, not the column it was typed in,
 * and words typed after an address ("begins page 324") become its note, so a
 * fresh export can replace the file without tidying.
 */
export interface ScanLink {
  library: string;
  url: string;
  /** Anything the sheet says about the link, as typed. */
  note: string;
}

export interface ScanVolume {
  year: number;
  title: string;
  links: ScanLink[];
}

export interface AlmanacScans {
  /** Every volume listed, in the sheet's order (a year may have several). */
  volumes: ScanVolume[];
  /** Links for the whole run of almanacs (the row with no year). */
  series: ScanLink[];
}

export const NO_SCANS: AlmanacScans = { volumes: [], series: [] };

const LIBRARIES: [RegExp, string][] = [
  [/villanova\.edu$/, 'Villanova Digital Library'],
  [/hathitrust\.org$/, 'HathiTrust'],
  [/archive\.org$/, 'Internet Archive'],
  [/google\.com$/, 'Google Books'],
];

/** The rows of a CSV file, quoted cells and doubled quotes understood. */
export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** One cell of the sheet as a link, or null where it holds no address. */
function scanLink(cell: string, column: string): ScanLink | null {
  const found = cell.trim().match(/^(https?:\/\/\S+)\s*(.*)$/s);
  if (!found) return null;
  let url: URL;
  try { url = new URL(found[1]); } catch { return null; }
  // Villanova's viewer keeps its zoom and position in the address: keep the page it opens at, drop the rest
  if (url.hash.startsWith('#?')) {
    const page = new URLSearchParams(url.hash.slice(2)).get('cv');
    url.hash = page ? `#?cv=${page}` : '';
  }
  const library = LIBRARIES.find(([host]) => host.test(url.hostname))?.[1]
    ?? (column.replace(/\?/g, '').trim() || url.hostname);
  return { library, url: url.toString(), note: found[2].trim().replace(/^\((.*)\)$/s, '$1') };
}

export function parseScans(text: string): AlmanacScans {
  const [header = [], ...rows] = csvRows(text);
  const out: AlmanacScans = { volumes: [], series: [] };
  for (const row of rows) {
    const links = row.slice(2).map((cell, i) => scanLink(cell, header[i + 2] ?? '')).filter((l): l is ScanLink => !!l);
    const year = Number(row[0]);
    const title = (row[1] ?? '').trim();
    if (!year) out.series.push(...links);
    else if (title || links.length) out.volumes.push({ year, title, links });
  }
  return out;
}

/** The scanned volumes for one almanac year, each title closed with a full stop so text can follow it. */
export function volumesOf(scans: AlmanacScans, year: number | null): ScanVolume[] {
  if (year === null) return [];
  return scans.volumes.filter(v => v.year === year && v.links.length)
    .map(v => ({ ...v, title: (v.title || `The ${year} almanac`).replace(/[.\s]+$/, '') + '.' }));
}
