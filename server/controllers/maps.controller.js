const db = require("../models");
const Op = db.Sequelize.Op;

const almanacRecord = db.almanacRecord;
const person = db.person;
const personInAlmanacRecord = db.personInAlmanacRecord;
const institution = db.institution;

exports.findAllInstitutions = async (req, res) => {
    try {
        where = {};
        let {year, instType, instName} = req.query;
        if (year) {
          where.year = { [Op.eq]: year };
        };
        if (!year) {
          return res.status(400).json({ message: "Year is required" });
        };
        if (instType) {
            where.instType = { [Op.like]: `%${instType}%` };
        };
        if (instName) {
            where.instName = { [Op.like]: `%${instName}%` };
        };

        const data = await institution.findAndCountAll({
            distinct: true,
            attributes: ['ID'],
            include: [
                {
                    model: almanacRecord,
                    as: 'almanacRecord',
                    required: Object.keys(where).length > 0,
                    attributes: ['instName', 'latitude', 'longitude', 'diocese', 'instType', 'year'],
                    where: where,
                }
            ]
        });
            res.send(data);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.findAllPeople = async (req, res) => {
    try {
        where = {};
        let {year} = req.query;
        if (year) {
          where.year = { [Op.eq]: year };
        };
        if (!year) {
          return res.status(400).json({ message: "Year is required" });
        };

        const data = await person.findAndCountAll({
            distinct: true,
            attributes: ['ID'],
            include: [
                {
                    model: almanacRecord,
                    as: 'almanacRecords',
                    required: Object.keys(where).length > 0,
                    attributes: ['instID', 'instName', 'year', 'latitude', 'longitude'],
                    where: where,
                    through: {
                        model: personInAlmanacRecord,
                        attributes: ['name', 'title', 'suffix', 'role']
                    }
                }
            ]
        });
            res.send(data);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}