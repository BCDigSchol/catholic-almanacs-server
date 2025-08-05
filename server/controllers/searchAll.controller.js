const db = require("../models");
const Op = db.Sequelize.Op;

const almanacRecord = db.almanacRecord;
const person = db.person;
const personInAlmanacRecord = db.personInAlmanacRecord;
const institution = db.institution;

exports.findAllInfo = async (req, res) => {
    try {
        instWhere = {};
        persWhere = {};
        let { name } = req.query;
        if (name) {
            instWhere.instName = { [Op.like]: `%${name}%` };
            persWhere.name = { [Op.like]: `%${name}%` };
        }
        const instData = await institution.findAndCountAll({
            distinct: true,
            attributes: ['ID'],
            include: [
                {
                    model: almanacRecord,
                    as: 'almanacRecord',
                    required: Object.keys(instWhere).length > 0,
                    attributes: ['instID', 'instName', 'diocese', 'year'],
                    where: instWhere,
                }
            ]
        });
        const persData = await person.findAndCountAll({
            distinct: true,
            attributes: ['ID'],
            include: [
                {
                    model: almanacRecord,
                    as: 'almanacRecords',
                    required: Object.keys(persWhere).length > 0,
                    attributes: ['instID', 'year', 'diocese'],
                    through: {
                        model: personInAlmanacRecord,
                        where: persWhere,
                        attributes: ['persID', 'name', 'title', 'suffix']
                    }
                }
            ]
        });

        allData = [];
        instResults = [];
        persResults = [];
        instData.rows.forEach(inst => {
            if (inst.almanacRecord) {
                instResults.push({
                    instID: inst.ID,
                    instName: inst.almanacRecord[inst.almanacRecord.length - 1].instName,
                    diocese: inst.almanacRecord[inst.almanacRecord.length - 1].diocese,
                    type: 'institution'
                });
            }
        });
        persData.rows.forEach(pers => {
            if (pers.almanacRecords) {
                persResults.push({
                    persID: pers.ID,
                    name: pers.almanacRecords[pers.almanacRecords.length - 1].personInAlmanacRecord.name,
                    title: pers.almanacRecords[pers.almanacRecords.length - 1].personInAlmanacRecord.title,
                    suffix: pers.almanacRecords[pers.almanacRecords.length - 1].personInAlmanacRecord.suffix,
                    diocese: pers.almanacRecords[pers.almanacRecords.length - 1].diocese,
                    type: 'person'
                });
            }
        });
        instResults.sort((a, b) => {
            const isAlphabetical = str => /^[a-zA-Z]/.test(str);
            const aAlphabetical = isAlphabetical(a.instName);
            const bAlphabetical = isAlphabetical(b.instName);
            if (aAlphabetical && !bAlphabetical) return -1;
            if (!aAlphabetical && bAlphabetical) return 1;
            return a.instName.localeCompare(b.instName);
        });
        persResults.sort((a, b) => {
            const isAlphabetical = str => /^[a-zA-Z]/.test(str);
            const aAlphabetical = isAlphabetical(a.name);
            const bAlphabetical = isAlphabetical(b.name);
            if (aAlphabetical && !bAlphabetical) return -1;
            if (!aAlphabetical && bAlphabetical) return 1;
            return a.name.localeCompare(b.name);
        })
        allData = instResults.slice(0, 30).concat(persResults.slice(0, 30));
        res.send(allData);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}