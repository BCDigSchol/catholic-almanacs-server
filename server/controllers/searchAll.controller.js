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
                    attributes: ['instName', 'latitude', 'longitude', 'diocese', 'instType', 'year'],
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
                    attributes: ['instID', 'year'],
                    through: {
                        model: personInAlmanacRecord,
                        where: persWhere,
                        attributes: ['persID', 'name', 'title', 'suffix', 'role']
                    }
                }
            ]
        });

        res.json({
            institutions: instData,
            persons: persData
        })
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}