// Shared by the record pages' maps (institution and person).
import { HIGHLIGHT_INK, INKS } from './palette';

/** A row of the map's key. */
export interface MapKeyItem {
  label: string;
  color: string;
  shape: 'dot' | 'line' | 'dashed';
}

/** Colours of the record maps: the record itself in rubric (the current
 *  thing), circuits out in slate, circuits in in ochre, the see in sepia,
 *  everything else in stone. */
export const RECORD_MAP_INKS = { self: HIGHLIGHT_INK, out: INKS[0], in: INKS[1], see: INKS[6], other: INKS[5] };
