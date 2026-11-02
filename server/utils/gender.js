// Who ran the Church's works, and whom they served: the schools, academies,
// colleges, asylums, hospitals and religious houses (not parishes), each year,
// as the almanacs describe them.
//
// Who ran it, from the name, type and note: a women's congregation ("under the
// charge of the Sisters of Charity", "Ursuline Convent"), men religious ("the
// Christian Brothers", "Jesuit"), lay teachers, or, where none is said, the
// clergy listed there (men religious by their name suffix, utils/orders.js; else
// diocesan clergy). A school can be both: "boys under the Christian Brothers,
// girls under the Sisters of St. Joseph".
// Whom it served: girls ("Female Orphan Asylum", "for young ladies"), boys
// ("Male Parish School", "for boys"), or both; most say neither.
//
// Read from the whole database when the API starts, so new records are read
// the same way after a reseed (restart the API). Wording the patterns miss
// shows on the Data Issues page (`unreadWording`), to add here.

const db = require('../models');
const { orderOfSuffix } = require('./orders');

/** Women's congregations, the phrases that name them, as the almanacs wrote them. */
const WOMEN = [
    { id: 'charity', label: 'Sisters/Daughters of Charity', re: /\b(sisters?|daughters) of charity\b|\bcharity sisters\b|\bsisters? of charity of nazareth\b/ },
    { id: 'mercy', label: 'Sisters of Mercy', re: /\bsisters? of mercy\b|\bmercy sisters\b|\bconvent of mercy\b/ },
    { id: 'notredame', label: 'Sisters of Notre Dame', re: /\b(school )?sisters of notre dame\b|\bnotre dame (sisters?|nuns)\b|\bsisters? of n\. ?d\./ },
    { id: 'joseph', label: 'Sisters of St. Joseph', re: /\bsisters? of (st\.?|saint) joseph\b/ },
    { id: 'sacredheart', label: 'Society of the Sacred Heart', re: /\b(ladies|religious|madames|mesdames|sisters|society|nuns) of the sacred heart\b|\bconvent of the sacred heart\b/ },
    { id: 'visitation', label: 'Visitation Nuns', re: /\b(sisters?|nuns|ladies|religious) of the visitation\b|\bvisitation (nuns|sisters|convent|academy)\b|\b(academy|convent|monastery) of the visitation\b/ },
    { id: 'ursuline', label: 'Ursulines', re: /\bursuline/ },
    { id: 'goodshepherd', label: 'Good Shepherd Sisters', re: /\b(sisters?|ladies|religious|nuns) of the good shepherd\b|\b(house|convent|asylum|home) of the good shepherd\b|\bgood shepherd (sisters?|nuns|convent|asylum)\b/ },
    { id: 'oblate', label: 'Oblate Sisters of Providence', re: /\boblate sisters\b/ },
    { id: 'providence', label: 'Sisters of Providence', re: /\bsisters? of (divine )?providence\b/ },
    { id: 'holycross', label: 'Sisters of the Holy Cross', re: /\bsisters? of (the )?holy cross\b|\bmarianite/ },
    { id: 'loretto', label: 'Sisters of Loretto', re: /\b(sisters?|ladies|friends of mary) (of|at) (the foot of the cross|loretto)\b|\bloretto (sisters?|nuns|convent|academy)\b/ },
    { id: 'presentation', label: 'Presentation Sisters', re: /\bpresentation (nuns|sisters|convent)\b|\bsisters? of the presentation\b/ },
    { id: 'dominican', label: 'Dominican Sisters', re: /\bdominican (sisters?|nuns)\b|\bsisters? of (st\.? )?dominic\b/ },
    { id: 'benedictine', label: 'Benedictine Sisters', re: /\bbenedictine (sisters?|nuns)\b|\bsisters? of (st\.? )?benedict\b/ },
    { id: 'franciscan', label: 'Franciscan Sisters', re: /\bfranciscan (sisters?|nuns)\b|\bsisters? of (the third order of )?(st\.? )?francis\b|\bpoor clares?\b/ },
    { id: 'carmelite', label: 'Carmelite Nuns', re: /\bcarmelite (nuns|sisters|convent|monastery)\b|\bcarmelites\b/ },
    { id: 'preciousblood', label: 'Sisters of the Precious Blood', re: /\bsisters? of the precious blood\b/ },
    { id: 'holynames', label: 'Sisters of the Holy Names', re: /\bsisters? of the holy names\b/ },
    { id: 'holychild', label: 'Sisters of the Holy Child Jesus', re: /\bholy child jesus\b/ },
    { id: 'littlesisters', label: 'Little Sisters of the Poor', re: /\blittle sisters of the poor\b/ },
    { id: 'immheart', label: 'Sisters of the Immaculate Heart of Mary', re: /\bsisters? of the immaculate heart\b|\bservants of the immaculate heart\b/ },
    { id: 'holyfamily', label: 'Sisters of the Holy Family', re: /\bsisters? of the holy family\b/ },
    { id: 'incarnateword', label: 'Sisters of the Incarnate Word', re: /\bincarnate word\b/ },
    { id: 'christiancharity', label: 'Sisters of Christian Charity', re: /\bsisters? of christian charity\b/ },
    { id: 'greynuns', label: 'Grey Nuns', re: /\bgr[ae]y nuns\b/ },
];
/** Men religious named in notes (orders known only from a name suffix come from utils/orders.js). */
const MEN = [
    { id: 'christianbrothers', label: 'Christian Brothers', re: /\bchristian brothers\b|\bbrothers of the christian schools\b/ },
    { id: 'xaverian', label: 'Xaverian Brothers', re: /\bxaverian/ },
    { id: 'brothersofmary', label: 'Brothers of Mary', re: /\bbrothers of mary\b|\bmarianists?\b/ },
    { id: 'holycrossbrothers', label: 'Brothers/Fathers of Holy Cross', re: /\b(brothers|fathers|priests) of (the )?holy cross\b/ },
    { id: 'franciscanbrothers', label: 'Franciscan Brothers', re: /\bfranciscan (brothers|fathers|friars)\b|\bbrothers of the third order of (st\.? )?francis\b/ },
    { id: 'sj', label: 'Jesuits', re: /\bjesuits?\b|\bsociety of jesus\b/ },
    { id: 'cssr', label: 'Redemptorists', re: /\bredemptorist/ },
    { id: 'osb', label: 'Benedictines', re: /\bbenedictine (fathers|monks)\b|\border of st\.? benedict\b/ },
    { id: 'cm', label: 'Vincentians', re: /\blazarist|\bvincentian|\bcongregation of the mission\b/ },
    { id: 'omcap', label: 'Capuchins', re: /\bcapuchin/ },
    { id: 'passionist', label: 'Passionists', re: /\bpassionist/ },
    { id: 'op', label: 'Dominicans', re: /\bdominican (fathers|friars)\b|\b(convent|priory|house) of (the )?dominicans\b/ },
    { id: 'pss', label: 'Sulpicians', re: /\bsulpician|\bst\.? sulpice\b/ },
    { id: 'trappist', label: 'Trappists', re: /\btrappist/ },
];
const GENERIC_WOMEN = /\b(sisters?|nuns|religious ladies|ladies of the|mother superiou?r|mother house|sisterhood|sisters' house)\b/;
const GENERIC_MEN = /\b(brothers|brother's|monks|friars|fathers of)/;  // lay brothers too: men religious
const LAY = /\blay (teachers?|masters?|mistresses?)\b|\bsecular teachers?\b|\blay (male|female) teachers?\b/;
const GIRLS = /\b(girls?|females?|young ladies|ladies' (school|academy|seminary)|for ladies|maidens)\b/;
const BOYS = /\b(boys?|males?|young (men|gentlemen)|youths?|lads)\b/;
const BOTH = /\bboth sexes\b|\bof both sex/;

/** The kinds of work (not parishes), by the type's most telling word. */
const KINDS = [
    { id: 'hospital', label: 'Hospitals', re: /hospital|infirmary/ },
    { id: 'asylum', label: 'Asylums and homes', re: /asylum|orphan|home\b|refuge|protectory/ },
    { id: 'college', label: 'Colleges and seminaries', re: /college|seminary|university/ },
    { id: 'academy', label: 'Academies', re: /academy/ },
    { id: 'school', label: 'Schools', re: /school|institute/ },
    { id: 'house', label: 'Religious houses', re: /convent|monastery|priory|abbey|novitiate|house|religious institution|consecrated life/ },
];

/** The kind of work a record's type names, or null for a parish (church, chapel, station, mission). */
function kindOf(type) {
    const t = String(type || '').toLowerCase();
    if (!t) return null;
    const k = KINDS.find(k => k.re.test(t));
    return k ? k.id : null;
}

/**
 * Who ran one record and whom it served, from its own words:
 * {women: [congregation id | 'unnamed'], men: [id | 'unnamed'], lay, girls, boys}.
 */
function readWords(name, type, note) {
    let text = [name, type, note].filter(Boolean).join(' . ').toLowerCase();
    const women = [], men = [];
    for (const c of WOMEN) if (c.re.test(text)) { women.push(c.id); text = text.replace(new RegExp(c.re.source, 'g'), ' '); }
    for (const c of MEN) if (c.re.test(text)) { men.push(c.id); text = text.replace(new RegExp(c.re.source, 'g'), ' '); }
    if (!women.length && GENERIC_WOMEN.test(text)) women.push('unnamed');
    if (!men.length && GENERIC_MEN.test(text)) men.push('unnamed');
    // a convent with no men named is a women's house
    if (!women.length && !men.length && /\bconvent\b/.test(String(type || '').toLowerCase())) women.push('unnamed');
    const lay = LAY.test(text);
    const both = BOTH.test(text);
    // text: what is left once the congregations are taken out
    return { women, men, lay, girls: both || GIRLS.test(text), boys: both || BOYS.test(text), text };
}

const RUN = [
    { id: 'women', label: 'Women religious' },
    { id: 'mixed', label: 'Women and men religious' },
    { id: 'men', label: 'Men religious' },
    { id: 'clergy', label: 'Diocesan clergy listed' },
    { id: 'lay', label: 'Lay teachers' },
    { id: 'unstated', label: 'Not stated' },
];
const SERVED = [
    { id: 'girls', label: 'Girls' }, { id: 'boys', label: 'Boys' }, { id: 'both', label: 'Girls and boys' }, { id: 'unstated', label: 'Not stated' },
];

let _gender = null;

/** Every work-record, read: {rec, inst, year, name, type, kind, dio, lat, lng, run, women, men, served}. */
async function loadGender() {
    if (_gender) return _gender;
    const dioceses = require('./dioceses');
    const [records, listings] = await Promise.all([
        db.sequelize.query(
            `SELECT ID, instID, instName, instType, year, instNote, diocese, latitude, longitude
               FROM almanacRecords WHERE year IS NOT NULL`,
            { type: db.Sequelize.QueryTypes.SELECT }),
        db.sequelize.query(
            `SELECT almanacRecordID AS rec, suffix, title, isAttending FROM personInAlmanacRecords`,
            { type: db.Sequelize.QueryTypes.SELECT }),
    ]);
    // the clergy listed at each record, and any order their names mark
    const listed = new Map();
    for (const l of listings) {
        if (l.isAttending) continue;
        let x = listed.get(l.rec);
        if (!x) listed.set(l.rec, x = { n: 0, orders: new Set() });
        x.n++;
        const o = orderOfSuffix(l.suffix);
        if (o) x.orders.add(o.id);
    }
    const works = [];
    for (const r of records) {
        const kind = kindOf(r.instType);
        if (!kind) continue;
        const w = readWords(r.instName, r.instType, r.instNote);
        const people = listed.get(r.ID);
        // nothing said of who ran it: the men listed there, by order if marked
        if (!w.women.length && !w.men.length && people) {
            if (people.orders.size) w.men.push(...people.orders);
        }
        const run = w.women.length && w.men.length ? 'mixed' : w.women.length ? 'women' : w.men.length ? 'men'
            : people ? 'clergy' : w.lay ? 'lay' : 'unstated';
        const served = w.girls && w.boys ? 'both' : w.girls ? 'girls' : w.boys ? 'boys' : 'unstated';
        const lat = Number(r.latitude), lng = Number(r.longitude);
        const placed = r.latitude != null && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0;
        works.push({
            rec: r.ID, inst: r.instID, year: Number(r.year), name: r.instName || '', type: r.instType || '', kind,
            dio: dioceses.dioceseIdAsListed(r.instID, r.diocese) || 'unknown',
            lat: placed ? Math.round(lat * 1e4) / 1e4 : null, lng: placed ? Math.round(lng * 1e4) / 1e4 : null,
            run, women: w.women, men: w.men, served,
        });
    }
    _gender = { works, kinds: KINDS.map(({ id, label }) => ({ id, label })), run: RUN, served: SERVED,
        congregations: [...WOMEN.map(c => ({ id: c.id, label: c.label, sex: 'women' })),
            { id: 'unnamed', label: 'Sisters, not named', sex: 'women' }] };
    return _gender;
}

/**
 * Notes that use the words these patterns look for but that were not read:
 * religious who ran it ("sisters", "brothers", "nuns") with no one found, or
 * pupils ("girls", "boys", "female") with no one served. For the Data Issues
 * page, so new wording can be added above.
 */
function unreadGender(name, type, note) {
    if (!note) return null;
    const w = readWords(name, type, note);
    // the words looked for in the note itself (with its congregations taken
    // out), so the page can show them in place
    const t = readWords('', '', note).text;
    const out = [];
    const ran = /\b(sisters?|nuns?|brothers?|religious|community of|order of|ladies of)\b/.exec(t);
    if (ran && !w.women.length && !w.men.length) out.push({ marker: 'who ran it', word: ran[1] });
    const pupils = /\b(girls?|boys?|females?|males?|young (men|ladies|women))\b/.exec(t);
    if (pupils && !w.girls && !w.boys) out.push({ marker: 'whom it served', word: pupils[0] });
    return out.length ? out : null;
}

module.exports = { loadGender, readWords, kindOf, unreadGender, WOMEN, MEN, KINDS, RUN, SERVED };
