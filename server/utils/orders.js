// Religious orders, read from the clergy's name suffixes (S.J., C.SS.R. …):
// the almanacs mark a member's order after the name far more often than they
// tie an order to an institution (orderInAlmanacRecords holds under 300
// links), so an order's footprint here is where its members were listed.
// Titles that are not orders (D.D., V.G., P.P.) are not listed.

const ORDERS = [
    { id: 'sj', name: 'Society of Jesus', common: 'Jesuits', suffixes: ['SJ'] },
    { id: 'cssr', name: 'Congregation of the Most Holy Redeemer', common: 'Redemptorists', suffixes: ['CSSR'] },
    { id: 'cm', name: 'Congregation of the Mission', common: 'Vincentians', suffixes: ['CM'] },
    { id: 'osb', name: 'Order of St. Benedict', common: 'Benedictines', suffixes: ['OSB'] },
    { id: 'osf', name: 'Order of St. Francis', common: 'Franciscans', suffixes: ['OSF'] },
    { id: 'op', name: 'Order of Preachers', common: 'Dominicans', suffixes: ['OP', 'OSD'] },
    { id: 'cpps', name: 'Society of the Precious Blood', common: 'Precious Blood Fathers', suffixes: ['CPPS'] },
    { id: 'omc', name: 'Order of Friars Minor Conventual', common: 'Conventual Franciscans', suffixes: ['OMC'] },
    { id: 'omcap', name: 'Order of Friars Minor Capuchin', common: 'Capuchins', suffixes: ['OMCAP'] },
    { id: 'osa', name: 'Order of St. Augustine', common: 'Augustinians', suffixes: ['OSA'] },
    { id: 'omi', name: 'Oblates of Mary Immaculate', common: 'Oblates', suffixes: ['OMI'] },
    { id: 'sm', name: 'Society of Mary', common: 'Marists', suffixes: ['SM'] },
    { id: 'csc', name: 'Congregation of Holy Cross', common: 'Holy Cross Fathers', suffixes: ['CSC'] },
];

const bySuffix = new Map();
for (const o of ORDERS) for (const s of o.suffixes) bySuffix.set(s, o);

/** The order a name suffix marks ("S. J." → Jesuits), or null. */
function orderOfSuffix(suffix) {
    if (!suffix) return null;
    // a suffix can hold more than one mark ("O.S.B., D.D."): any order among them
    for (const part of String(suffix).split(/[,;]/)) {
        const key = part.toUpperCase().replace(/[^A-Z]/g, '');
        if (bySuffix.has(key)) return bySuffix.get(key);
    }
    return null;
}

module.exports = { ORDERS, orderOfSuffix };
