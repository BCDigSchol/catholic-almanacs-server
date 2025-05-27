const { where } = require("sequelize");
const db = require("../models");
const Op = db.Sequelize.Op;

const getPagination = require("../utils/get-pagination");

const almanacRecord = db.almanacRecord;
const personInAlmanac = db.personInAlmanac;
const person = db.person;

/*exports.create = (req, res) => {
    const persons = req.body;

    const processedPersons = persons.map(person => {
        const uniquePersID = `${person.persYear}-${person.persID}`;
        return {
            ...person,
            uniquePersID: uniquePersID
        };});

    Person.bulkCreate(processedPersons)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the Person."
        });
    });
};*/

exports.findAll = (req, res) => {
    let {page, size} = req.query;
    if (!page) {
        page = 0;
    };
    if (!size) {
        size = 3;
    };
    let {limit, offset} = getPagination(page, size);
    let persWhere = {};
    let instWhere = {};
    let { persName, instName, diocese, cityReg, year } = req.query;
    if (persName) {
        persWhere.name = { [Op.like]: `%${persName}%` };
    };
    if (instName) {
        instWhere.instName = { [Op.like]: `%${instName}%` };
    };
    if (cityReg) {
        instWhere.cityReg = { [Op.like]: `%${cityReg}%` };
    }
    if (diocese) {
        instWhere.diocese = { [Op.like]: `%${diocese}%` };
    };
    if (year) {
        instWhere.year = { [Op.like]: `%${year}%` };
    }
    person.findAndCountAll({
        limit: limit,
        offset: offset,
        distinct: true,
        attributes: ['ID'],
        include: [
            {
                model: almanacRecord,
                where: instWhere,
                as: 'almanacRecords',
                attributes: ['instID','instName','year','cityReg', 'diocese'],
                through: {
                    model: personInAlmanac,
                    where: persWhere,
                    attributes: ['name', 'title', 'suffix', 'role', 'note']
                }
            }
        ]
    }).then(data => {
        res.send(data);
    }).catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while retrieving people."
        });
    });
};

exports.findByID = async (req, res) => {
    const id = req.params.id;
    data = await person.findOne({
        where: { ID: id },
        attributes: ['ID'],
        include: [
            {
                model: almanacRecord,
                as: 'almanacRecords',
                attributes: ['instID','instName','year','cityReg', 'diocese'],
                through: {
                    model: personInAlmanac,
                    attributes: ['name', 'title', 'suffix', 'role', 'note']
                }
            }]}
    );
    if (data) {
        let processedData = {
            persID: data.dataValues.ID,
            name: data.dataValues.almanacRecords[data.dataValues.almanacRecords.length - 1].personInAlmanacRecord.name || '(not recorded)',
            title: data.dataValues.almanacRecords[data.dataValues.almanacRecords.length - 1].personInAlmanacRecord.title,
            suffix: data.dataValues.almanacRecords[data.dataValues.almanacRecords.length - 1].personInAlmanacRecord.suffix,
            note: data.dataValues.almanacRecords[data.dataValues.almanacRecords.length - 1].personInAlmanacRecord.note,
            role: [],
            almanacRecords: [],
            year: [],
        }
        let existingAlmanacRecords = [];
        let existingYears = [];
        let existingRoles = [];
        for (let i = data.dataValues.almanacRecords.length - 1; i >= 0; i--) {
            let almanacRecord = data.dataValues.almanacRecords[i];
            if (!existingAlmanacRecords.includes(almanacRecord.instID)) {
                existingAlmanacRecords.push(almanacRecord.instID);
                processedData.almanacRecords.push({
                    instID: almanacRecord.instID,
                    instName: almanacRecord.instName,
                    year: almanacRecord.year,
                    cityReg: almanacRecord.cityReg,
                    diocese: almanacRecord.diocese,
                    personInAlmanacRecord: almanacRecord.personInAlmanacRecord
                })
            }
            if (!existingRoles.includes(almanacRecord.personInAlmanacRecord.role)) {
                existingRoles.push(almanacRecord.personInAlmanacRecord.role);
                processedData.role.push(almanacRecord.personInAlmanacRecord.role);
            }
        }
        for (let i = 0; i < data.dataValues.almanacRecords.length; i++) {
            let almanacRecord = data.dataValues.almanacRecords[i];
            if (!existingYears.includes(almanacRecord.year)){
                existingYears.push(almanacRecord.year);
                processedData.year.push(almanacRecord.year);
            }
        }
        res.send(processedData);
    } else {
        res.status(404).send({
            message: `Cannot find Person with id=${id}.`
        });
    }
};

exports.findOne = async (req, res) => {
    data = await person.findOne({
        attributes: ['ID'],
        include: [{
            model: almanacRecord,
            as: 'almanacRecords',
            where: { year: req.params.year },
            attributes: ['instID','instName','year', 'cityReg', 'diocese'],
            through: {
                model: personInAlmanac,
                where: { persID: req.params.id },
                attributes: ['name', 'title', 'suffix', 'role', 'note']
            }
        }]
    });
    if (data) {
        let processedData = {
            persID: data.dataValues.ID,
            name: data.dataValues.almanacRecords[0].personInAlmanacRecord.name || '(not recorded)',
            title: data.dataValues.almanacRecords[0].personInAlmanacRecord.title,
            suffix: data.dataValues.almanacRecords[0].personInAlmanacRecord.suffix,
            note: data.dataValues.almanacRecords[0].personInAlmanacRecord.note,
            almanacRecords: data.dataValues.almanacRecords,
            year: data.dataValues.almanacRecords[0].year,
            role: [],
        }
        let existingRoles = [];
        for (let i = data.dataValues.almanacRecords.length - 1; i >= 0; i--) {
            let almanacRecord = data.dataValues.almanacRecords[i];
            if (!existingRoles.includes(almanacRecord.personInAlmanacRecord.role)) {
                existingRoles.push(almanacRecord.personInAlmanacRecord.role);
                processedData.role.push(almanacRecord.personInAlmanacRecord.role);
            }
        };
        res.send(processedData);
    } else {
        res.status(404).send({
            message: `Cannot find Person with id=${req.params.id}.`
        });
    }
};


exports.delete = (req, res) => {
    const id = req.params.persID;
    person.destroy({
        where: { persID: id }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete Person with id=${id}. Maybe Person was not found!`
            });
        } else {
            res.send({
                message: "Person was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete Person with id=" + id
        });
    });
};