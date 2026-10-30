// Downloads of a network as data, for Gephi, R or Python: node and edge lists
// as CSV, or the whole graph as GEXF 1.3 (Gephi's format). Built in the
// browser from what the page is showing, so a download matches the filters.

export interface ExportGraph {
  /** Nodes: an `id`, a `label`, and any other columns (strings or numbers). */
  nodes: Record<string, any>[];
  /** Edges: `source`, `target`, `weight`, and any other columns. */
  edges: Record<string, any>[];
  directed: boolean;
  /** What the graph is, the filters, and how to cite it: the GEXF description and a CSV comment line. */
  description: string;
}

/** A citation line every download carries. */
export function citation(url = window.location.href): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Catholic Almanacs Database, Boston College. ${url} (downloaded ${today}).`;
}

function save(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, any>[], note: string): string {
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const lines = [cols.map(csvCell).join(','), ...rows.map(r => cols.map(c => csvCell(r[c])).join(','))];
  // a leading comment: R's read.csv(comment.char = "#") and pandas (comment="#") skip it
  return `# ${note.replace(/\n/g, ' ')}\n${lines.join('\n')}\n`;
}

/** Two CSV files, `<base>-nodes.csv` and `<base>-edges.csv`. */
export function downloadCsv(base: string, graph: ExportGraph): void {
  save(`${base}-nodes.csv`, toCsv(graph.nodes, graph.description), 'text/csv;charset=utf-8');
  save(`${base}-edges.csv`, toCsv(graph.edges, graph.description), 'text/csv;charset=utf-8');
}

function xml(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** One GEXF 1.3 file: node and edge attributes typed as numbers or strings. */
export function downloadGexf(base: string, graph: ExportGraph): void {
  const attrs = (rows: Record<string, any>[], skip: string[]) => {
    const cols = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(c => !skip.includes(c));
    return cols.map(c => ({ id: c, type: rows.every(r => r[c] == null || typeof r[c] === 'number') ? 'double' : 'string' }));
  };
  const nodeAttrs = attrs(graph.nodes, ['id', 'label']);
  const edgeAttrs = attrs(graph.edges, ['source', 'target', 'weight']);
  const values = (row: Record<string, any>, cols: { id: string }[]) => cols
    .filter(c => row[c.id] != null && row[c.id] !== '')
    .map(c => `<attvalue for="${xml(c.id)}" value="${xml(Array.isArray(row[c.id]) ? row[c.id].join('; ') : row[c.id])}"/>`).join('');
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gexf xmlns="http://gexf.net/1.3" version="1.3">',
    `<meta lastmodifieddate="${new Date().toISOString().slice(0, 10)}"><creator>Catholic Almanacs Database</creator><description>${xml(graph.description)}</description></meta>`,
    `<graph defaultedgetype="${graph.directed ? 'directed' : 'undirected'}">`,
    `<attributes class="node">${nodeAttrs.map(a => `<attribute id="${xml(a.id)}" title="${xml(a.id)}" type="${a.type}"/>`).join('')}</attributes>`,
    `<attributes class="edge">${edgeAttrs.map(a => `<attribute id="${xml(a.id)}" title="${xml(a.id)}" type="${a.type}"/>`).join('')}</attributes>`,
    '<nodes>',
    ...graph.nodes.map(n => `<node id="${xml(n['id'])}" label="${xml(n['label'])}"><attvalues>${values(n, nodeAttrs)}</attvalues></node>`),
    '</nodes>',
    '<edges>',
    ...graph.edges.map((e, i) => `<edge id="${i}" source="${xml(e['source'])}" target="${xml(e['target'])}" weight="${Number(e['weight']) || 1}"><attvalues>${values(e, edgeAttrs)}</attvalues></edge>`),
    '</edges>',
    '</graph>',
    '</gexf>',
  ];
  save(`${base}.gexf`, out.join('\n'), 'application/xml;charset=utf-8');
}
