const db = require("../models");
const Op = db.Sequelize.Op;

const almanacRecord = db.almanacRecord;
const person = db.person;
const personInAlmanacRecord = db.personInAlmanacRecord;
const institution = db.institution;

exports.findAllInstitutions = async (req, res) => {
    try {
        where = {};
        let {year, instType, instName, diocese, instFunction} = req.query;
        if (year) {
          where.year = { [Op.eq]: year };
        };
        if (!year) {
          return res.status(400).json({ message: "Year is required" });
        };
        if (instType) {
            where.instType = { [Op.like]: `%${instType}%` };
        };
        if (instFunction) {
            where.instFunction = { [Op.like]: `%${instFunction}%` };
        };
        if (instName) {
            where.instName = { [Op.like]: `%${instName}%` };
        };
        if (diocese) {
            where.diocese_reg = { [Op.like]: `%${diocese}%` };
        };
        const data = await institution.findAndCountAll({
            distinct: true,
            attributes: ['ID'],
            include: [
                {
                    model: almanacRecord,
                    as: 'almanacRecord',
                    required: Object.keys(where).length > 0,
                    attributes: ['instName', 'latitude', 'longitude', 'diocese', 'instType', 'instFunction', 'year'],
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
        instWhere = {};
        persWhere = {};
        let {year, persName, diocese} = req.query;
        if (year) {
          instWhere.year = { [Op.eq]: year };
        };
        if (!year) {
          return res.status(400).json({ message: "Year is required" });
        };
        if (persName) {
            persWhere.name = { [Op.like]: `%${persName}%` };
        };
        if (diocese) {
            instWhere.diocese_reg = { [Op.like]: `%${diocese}%` };
        };
        const data = await person.findAndCountAll({
            distinct: true,
            attributes: ['ID'],
            include: [
                {
                    model: almanacRecord,
                    as: 'almanacRecords',
                    required: Object.keys(instWhere).length > 0,
                    attributes: ['instID', 'instName', 'year', 'diocese', 'latitude', 'longitude'],
                    where: instWhere,
                    through: {
                        model: personInAlmanacRecord,
                        attributes: ['name', 'title', 'suffix', 'role'],
                        where: persWhere
                    }
                }
            ]
        });
            res.send(data);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.findAllDioceses = async (req, res) => {
    try {
        where = {};
        let {year, instName, instType} = req.query;
        if (year) {
          where.year = { [Op.eq]: year };
        };
        if (!year) {
          return res.status(400).json({ message: "Year is required" });
        };
        if (instName) {
            where.instName = { [Op.like]: `%${instName}%` };
        };
        if (instType) {
            where.instType = { [Op.like]: `%${instType}%` };
        };
        const data = await db.diocese.findAndCountAll({
            distinct: true,
            attributes: ['diocese'],
            include: [
                {
                    model: almanacRecord,
                    as: 'almanacRecords',
                    required: Object.keys(where).length > 0,
                    attributes: ['instID', 'instName', 'year', 'instType', 'latitude', 'longitude', 'diocese_reg', 'diocese'],
                    where: where,
                }
            ]
        });
        res.send(data);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}