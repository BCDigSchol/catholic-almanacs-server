// Languages and congregations: which institutions the almanacs marked as
// serving a language other than English, or a particular people.
//
// The `language` column is filled for every record, "English" by default, so
// English is the baseline, not a finding. Other values are the almanac's own
// words ("German", "Sermon in French and occasionally English", "French and
// Menomony", "African"), split here into each language they name. Some
// congregations are marked only in the name or note ("German Church", "a
// large German congregation", "Indian Mission", "for colored children"); those
// are read with narrow patterns and flagged as found in a note.

/** The categories, in the order they are shown. `kind`: a language, or a people the almanac named. */
const CATEGORIES = [
    { id: 'german', label: 'German', kind: 'language' },
    { id: 'french', label: 'French', kind: 'language' },
    { id: 'polish', label: 'Polish', kind: 'language' },
    { id: 'bohemian', label: 'Bohemian (Czech)', kind: 'language' },
    { id: 'dutch', label: 'Dutch', kind: 'language' },
    { id: 'italian', label: 'Italian', kind: 'language' },
    { id: 'spanish', label: 'Spanish', kind: 'language' },
    { id: 'irish', label: 'Irish', kind: 'language' },
    { id: 'native', label: 'Native American', kind: 'people' },
    { id: 'black', label: 'Black congregations', kind: 'people' },
];

// words in the language column -> category
const LISTED = [
    [/\bgerman\b/i, 'german'],
    [/\bfrench\b/i, 'french'],
    [/\bpolish\b/i, 'polish'],
    [/\bbohemian\b/i, 'bohemian'],
    [/\bdutch\b/i, 'dutch'],
    [/\bitalian\b/i, 'italian'],
    [/\bspanish\b/i, 'spanish'],
    [/\birish\b/i, 'irish'],
    [/\bindian\b|\bmenomon|\bwinebago\b|\bvinebago\b/i, 'native'],
    [/\bafrican\b/i, 'black'],
];

// names and notes: only phrases that mark the congregation itself. "Indian" as
// a whole word (never "Indiana"); nations by name, but not ones that are also
// common place names (Ottawa, Sioux, Osage)
const NOTED = [
    [/^\(?german\)?\.?$|\bgerman (church|ch\.|congregation|catholics?|children|orphans?|parish|settlement|people|population|parochial)/i, 'german'],
    [/^\(?french\)?\.?$|\bfrench (church|ch\.|congregation|catholics?|canadians?|parish|settlement|people|population)/i, 'french'],
    [/\bpolish (church|congregation|catholics?|parish|settlement|people)/i, 'polish'],
    [/\bbohemian (church|congregation|catholics?|parish|settlement|people)/i, 'bohemian'],
    [/\bindians?\b|\bhalf-breeds?\b|\bchippew|\bojibw|\bpotawatom|\bpottawatom|\bmenomon|\bwinneba|\bpenobscot|\bpassamaquoddy|\bpapagos?\b|\bnavajo|\bnevajo/i, 'native'],
    [/\bcolou?red (people|children|girls|boys|orphans?|congregation|catholics?|persons|population)|\(colou?red\)|^colou?red$/i, 'black'],
];

/** {cats: [category id], source: 'listed' | 'note'} for one record, or null if English / not marked. */
function classify(language, name, note) {
    const cats = new Set();
    const lang = String(language || '');
    for (const [re, id] of LISTED) if (re.test(lang)) cats.add(id);
    if (cats.size) return { cats: [...cats], source: 'listed' };
    for (const text of [name, note]) {
        if (!text) continue;
        for (const [re, id] of NOTED) if (re.test(String(text))) cats.add(id);
    }
    return cats.size ? { cats: [...cats], source: 'note' } : null;
}

module.exports = { CATEGORIES, classify };
