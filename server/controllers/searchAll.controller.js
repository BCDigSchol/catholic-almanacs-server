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
        instData.rows.forEach(inst => {
            if (inst.almanacRecord) {
                allData.push({
                    instID: inst.ID,
                    instName: inst.almanacRecord[inst.almanacRecord.length - 1].instName,
                    diocese: inst.almanacRecord[inst.almanacRecord.length - 1].diocese,
                    type: 'institution'
                });
            }
        });
        persData.rows.forEach(pers => {
            if (pers.almanacRecords) {
                allData.push({
                    persID: pers.ID,
                    name: pers.almanacRecords[pers.almanacRecords.length - 1].personInAlmanacRecord.name,
                    title: pers.almanacRecords[pers.almanacRecords.length - 1].personInAlmanacRecord.title,
                    suffix: pers.almanacRecords[pers.almanacRecords.length - 1].personInAlmanacRecord.suffix,
                    diocese: pers.almanacRecords[pers.almanacRecords.length - 1].diocese,
                    type: 'person'
                });
            }
        });
        allData.sort((a, b) => {
            const getKey = x => x.type === 'institution' ? x.instName : x.name;
            const isAlpha = str => /^[A-Za-z]/.test(str);

            const aKey = getKey(a);
            const bKey = getKey(b);

            const aAlpha = isAlpha(aKey);
            const bAlpha = isAlpha(bKey);

            if (aAlpha && !bAlpha) return -1;
            if (!aAlpha && bAlpha) return 1;
            return aKey.localeCompare(bKey);
        });
        res.send(allData);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}