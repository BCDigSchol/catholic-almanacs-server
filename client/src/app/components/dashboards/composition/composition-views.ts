import { FUNCTION_COLORS, INKS } from '../../../utils/palette';

// The three views of "The Shape of the Church": institutions by function,
// people by the function of the institution they served, and clergy by rank.
// They share one chart; only the data request, labels, colours and wording differ.

export type CompositionViewKey = 'institutions' | 'people' | 'rank';

export interface CompositionRow {
  year: number;
  group: string;
  count: number;
  total: number;
  share: number;
}

export interface CompositionView {
  /** Query params for GET /stats/composition. */
  api: Record<string, string>;
  /** "institution" / "people" etc., singular and plural, for tooltips. */
  noun: [string, string];
  heading: string;
  shareNote: string;
  countNote: string;
  emptyText: string;
  method: string;
  labels: Record<string, string>;
  colors: Record<string, string>;
  /** Headline sentence for the current data, or '' when nothing stands out. */
  takeaway(rows: CompositionRow[], buckets: string[], years: number[], scope: string): string;
}


const pct = (v: number) => `${Math.round(v * 100)}%`;
const shareOf = (rows: CompositionRow[], year: number, bucket: string) =>
  rows.find(r => r.year === year && r.group === bucket)?.share ?? 0;
const countOf = (rows: CompositionRow[], year: number, bucket: string) =>
  rows.find(r => r.year === year && r.group === bucket)?.count ?? 0;

/** The bucket whose share moved most between the first and last year. */
function biggestMove(rows: CompositionRow[], buckets: string[], years: number[], threshold: number) {
  if (years.length < 2) return null;
  const [first, last] = [years[0], years[years.length - 1]];
  const top = buckets.filter(b => b !== 'other')
    .map(b => ({ b, from: shareOf(rows, first, b), to: shareOf(rows, last, b), first, last }))
    .sort((a, z) => Math.abs(z.to - z.from) - Math.abs(a.to - a.from))[0];
  return top && Math.abs(top.to - top.from) >= threshold ? top : null;
}

export const COMPOSITION_VIEWS: Record<CompositionViewKey, CompositionView> = {
  institutions: {
    api: {},
    noun: ['institution', 'institutions'],
    heading: 'Institutions by function',
    shareNote: 'Share of each year’s recorded institutions',
    countNote: 'Institutions recorded each year',
    emptyText: 'No institutions are recorded for this place.',
    method: 'Institutions are grouped by their recorded function; a few institutions with no function recorded are counted as “Other”.',
    labels: {
      'religious institutions': 'Religious (parishes, missions)',
      'educational institutions': 'Educational',
      'consecrated life institutions': 'Consecrated life',
      'charitable institutions': 'Charitable',
      'healthcare institutions': 'Healthcare',
      'other': 'Other / unclassified'
    },
    colors: FUNCTION_COLORS,
    takeaway(rows, buckets, years, scope) {
      const m = biggestMove(rows, buckets, years, 0.01);
      if (!m) return '';
      const name = m.b.charAt(0).toUpperCase() + m.b.slice(1);  // e.g. "Educational institutions"
      return `${name} ${m.to > m.from ? 'grew' : 'fell'} from ${pct(m.from)} of those recorded ${scope} in ${m.first} to ${pct(m.to)} in ${m.last}.`;
    },
  },

  people: {
    api: { entity: 'people' },
    noun: ['person', 'people'],
    heading: 'People by the kind of institution they served',
    shareNote: 'Share of each year’s recorded people',
    countNote: 'People recorded each year',
    emptyText: 'No people are recorded for this place.',
    method: 'People are grouped by the function of the institution they served; anyone whose institution has no function recorded is counted as “Other”.',
    labels: {
      'religious institutions': 'Parishes & missions',
      'educational institutions': 'Educational',
      'consecrated life institutions': 'Consecrated life',
      'charitable institutions': 'Charitable',
      'healthcare institutions': 'Healthcare',
      'other': 'Other / unclassified'
    },
    colors: FUNCTION_COLORS,
    takeaway(rows, buckets, years, scope) {
      const m = biggestMove(rows, buckets, years, 0.03);
      if (!m) return '';
      const kind = m.b === 'religious institutions' ? 'parishes and missions' : m.b;
      return `The share of people recorded ${scope} who served ${kind} ${m.to > m.from ? 'rose' : 'fell'} from ${pct(m.from)} in ${m.first} to ${pct(m.to)} in ${m.last}.`;
    },
  },

  rank: {
    api: { entity: 'people', dimension: 'title' },
    noun: ['person', 'people'],
    heading: 'Clergy by rank',
    shareNote: 'Share of each year’s recorded clergy',
    countNote: 'Clergy recorded each year',
    emptyText: 'No clergy are recorded for this place.',
    method: 'People are grouped by the rank implied by their title: Most Rev. (archbishop), Rt. Rev. (bishop), Very Rev. (vicar or superior), Rev. (priest), Mr. (seminarian or lay). Most clergy are listed simply as “Rev.”, so in Share the priest band dominates and the leadership ranks are thin slivers at the top; Count shows those ranks growing in absolute terms.',
    labels: {
      'archbishop': 'Archbishops (Most Rev.)',
      'bishop': 'Bishops (Rt. Rev.)',
      'vicar or superior': 'Vicars & superiors (Very Rev.)',
      'priest': 'Priests (Rev.)',
      'seminarian or lay': 'Seminarians & lay (Mr.)',
      'other': 'Other / unrecorded'
    },
    colors: {
      'archbishop': INKS[4],
      'bishop': INKS[2],
      'vicar or superior': INKS[0],
      'priest': INKS[3],
      'seminarian or lay': INKS[1],
      'other': INKS[5]
    },
    // How many priests there were for each bishop or archbishop, first year to last.
    takeaway(rows, _buckets, years, scope) {
      const ratio = (year: number) => {
        const bishops = countOf(rows, year, 'archbishop') + countOf(rows, year, 'bishop');
        return bishops ? countOf(rows, year, 'priest') / bishops : 0;
      };
      const ys = years.filter(y => ratio(y) > 0);
      if (ys.length < 2) return '';
      const [first, last] = [ys[0], ys[ys.length - 1]];
      const n = (v: number) => Math.round(v).toLocaleString();
      return `${scope.charAt(0).toUpperCase() + scope.slice(1)}, there were about ${n(ratio(first))} priests for every bishop or archbishop in ${first}, and ${n(ratio(last))} in ${last}.`;
    },
  },
};
