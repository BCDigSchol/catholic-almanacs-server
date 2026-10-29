// Chart and map colours for "The Directory": mid-toned printing inks rather
// than default bright hues, chosen to read on the white page and the dark theme
// alike, and to differ in lightness as well as hue.

/** The eight inks, in the order to use them for categories. */
export const INKS = [
  '#3f6290', // slate blue
  '#c08a2e', // ochre
  '#8a4f86', // plum
  '#4d8463', // green
  '#b8323b', // rubric
  '#8f897d', // stone grey
  '#8a5a3a', // sepia
  '#4f8796', // teal
];

/** Fixed colours for institution functions, everywhere they appear. */
export const FUNCTION_COLORS: Record<string, string> = {
  'religious institutions': INKS[0],
  'educational institutions': INKS[1],
  'consecrated life institutions': INKS[2],
  'charitable institutions': INKS[3],
  'healthcare institutions': INKS[4],
  'other': INKS[5],
};

/** For anything uncategorised or unknown. */
export const OTHER_INK = INKS[5];

/** The current or highlighted mark (centre of gravity, a selected point). */
export const HIGHLIGHT_INK = '#b8323b';

/**
 * Many-category palette (dioceses): the inks, then darker and lighter
 * printings of each, so neighbouring categories still differ.
 */
export const MANY_INKS = [
  ...INKS,
  '#2a4467', '#8e6215', '#653660', '#335d45', '#86202a', '#665f53', '#5f3b23', '#335f6b',
  '#7d9bc2', '#dcb36a', '#b886b4', '#86b89a', '#d9787f', '#b9b3a7', '#b98c6c', '#86b6c3',
];

/** Light-to-dark ramp for counts (coverage grids, binned maps). */
export const COUNT_RAMP = ['#d5dde8', '#a6b6cc', '#6f88a8', '#3f6290', '#1f3556'];
