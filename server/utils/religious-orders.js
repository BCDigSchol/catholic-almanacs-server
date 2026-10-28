const religiousOrderDict = require('../config/religiousOrderDict.json');

// All the spellings of a religious order (religiousOrderDict groups them under
// a canonical name), so filtering by any one of them matches the others.
function orderEquivalents(religiousOrder) {
    for (const [canonical, group] of Object.entries(religiousOrderDict)) {
        if (canonical === religiousOrder || group.includes(religiousOrder)) {
            return [canonical, ...group];
        }
    }
    return [religiousOrder];
}

// SQL condition matching any spelling of the order on `column`, with its
// replacements, for the raw-SQL list endpoints.
function orderCondition(column, religiousOrder) {
    const equivalents = orderEquivalents(religiousOrder);
    const replacements = {};
    const clauses = equivalents.map((order, i) => {
        replacements[`order${i}`] = `%${order}%`;
        return `${column} LIKE :order${i}`;
    });
    return { sql: `(${clauses.join(' OR ')})`, replacements };
}

module.exports = { orderEquivalents, orderCondition };
