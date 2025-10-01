const { where } = require("sequelize");
const db = require("../models");
const Op = db.Sequelize.Op;
const { Sequelize } = db.sequelize;

const getPagination = require("../utils/get-pagination");
const religiousOrderDict = require('../config/religiousOrderDict.json')

const almanacRecord = db.almanacRecord;
const personInAlmanacRecord = db.personInAlmanacRecord;
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
    console.log(req.query);
    if (!page) {
        page = 0;
    };
    if (!size) {
        size = 3;
    };
    let {limit, offset} = getPagination(page, size);
    let persWhere = {};
    let instWhere = {};
    let { persName, instName, diocese, countyOrig, cityOrig, stateOrig, instStartYear, instEndYear, religiousOrder } = req.query;
    if (persName) {
        persWhere.name = { [Op.like]: `%${persName}%` };
    };
    if (instName) {
        instWhere.instName = { [Op.like]: `%${instName}%` };
    };
    if (countyOrig) {
        instWhere.countyOrig = { [Op.like]: `%${countyOrig}%` };
    };
    if (cityOrig) {
        instWhere.cityOrig = { [Op.like]: `%${cityOrig}%` };
    };
    if (stateOrig) {
        instWhere.stateOrig = { [Op.like]: `%${stateOrig}%` };
    };
    if (instStartYear && instEndYear) {
        instWhere.year = { [Op.between]: [instStartYear, instEndYear] };
    } else if (instStartYear) {
        instWhere.year = { [Op.gte]: instStartYear };
    } else if (instEndYear) {
        instWhere.year = { [Op.lte]: instEndYear };
    };
    if (diocese) {
        instWhere.diocese_reg = { [Op.like]: `%${diocese}%` };
    };
    if (religiousOrder) {
        let equivalents = null;
        for (const group of Object.values(religiousOrderDict)) {
            if (group.includes(religiousOrder)) {
                equivalents = group;
                break;
            }
        }
        if (!equivalents && religiousOrderDict[religiousOrder]) {
            equivalents = religiousOrderDict[religiousOrder];
        }
        if (!equivalents) {
            equivalents = [religiousOrder];
        }
        instWhere.religiousOrder = {
            [Op.or]: equivalents.map(order => ({ [Op.like]: `%${order}%` }))
        };  
    };

    person.findAndCountAll({
        distinct: true,
        attributes: ['ID'],
        include: [
            {
                model: almanacRecord,
                where: instWhere,
                as: 'almanacRecords',
                attributes: ['instID','instName','year','cityReg', 'diocese', 'latitude', 'longitude'],
                through: {
                    model: personInAlmanacRecord,
                    where: persWhere,
                    attributes: ['name', 'lastName', 'title', 'suffix', 'role', 'note']
                }
            }
        ],
        order: [[
            Sequelize.literal(`(
                CASE 
                    WHEN (
                    SELECT pir.\`lastName\`
                    FROM \`personInAlmanacRecords\` pir
                    JOIN \`almanacRecords\` ar ON pir.\`almanacRecordID\` = ar.\`ID\`
                    WHERE pir.\`persID\` = \`person\`.\`ID\`
                    ORDER BY ar.\`year\` DESC
                    LIMIT 1
                    ) REGEXP '^[A-Za-z]' THEN 0
                    ELSE 1
                END
            )`), 'ASC'
        ], [
                Sequelize.literal(`(
                    SELECT pir.\`lastName\`
                    FROM \`personInAlmanacRecords\` pir
                    JOIN \`almanacRecords\` ar ON pir.\`almanacRecordID\` = ar.\`ID\`
                    WHERE pir.\`persID\` = \`person\`.\`ID\`
                    ORDER BY ar.\`year\` DESC
                    LIMIT 1
                    )`), 'ASC'
        ]
    ],
        limit,
        offset
    }).then(
        data => {
        /**data.forEach(person => {
            if (person.almanacRecords && Array.isArray(person.almanacRecords)) {
                person.almanacRecords.sort((a, b) => a.year - b.year);
            }
        });
        data.sort((a, b) => {
            const aName = a.almanacRecords.length > 0 ? a.almanacRecords[a.almanacRecords.length - 1].personInAlmanacRecord.name : '';
            const bName = b.almanacRecords.length > 0 ? b.almanacRecords[b.almanacRecords.length - 1].personInAlmanacRecord.name : '';
            const aAlpha = /^[A-Za-z]/.test(aName);
            const bAlpha = /^[A-Za-z]/.test(bName);
            if (aAlpha && !bAlpha) return -1;
            if (!aAlpha && bAlpha) return 1;
            return aName.localeCompare(bName);
        });
        const start = offset;
        const end = offset + limit;
        const paginatedRows = data.slice(start, end); */
        data.rows.forEach(person => {
            if (person.almanacRecords && Array.isArray(person.almanacRecords)) {
                person.almanacRecords.sort((a, b) => a.year - b.year);
            }
        });
        res.send({
            count: data.count,
            rows: data.rows,
        });
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
                attributes: ['instID','instName','year','cityReg', 'diocese', 'latitude', 'longitude'],
                through: {
                    model: personInAlmanacRecord,
                    attributes: ['name', 'title', 'suffix', 'role', 'note', 'isAttending', 'attendingInstID']
                }
            }]}
    );
    if (data) {
        let processedData = {
            persID: data.dataValues.ID,
            name: [],
            title: data.dataValues.almanacRecords[data.dataValues.almanacRecords.length - 1].personInAlmanacRecord.title,
            suffix: data.dataValues.almanacRecords[data.dataValues.almanacRecords.length - 1].personInAlmanacRecord.suffix,
            note: data.dataValues.almanacRecords[data.dataValues.almanacRecords.length - 1].personInAlmanacRecord.note,
            role: [],
            residingInstitutions: [],
            visitingInstitutions: [],
            year: [],
            dioceses: []
        }
        let existingAlmanacRecords = [];
        let existingYears = [];
        let existingRoles = [];
        let existingDioceses = [];
        let existingNames = [];
        for (let i = data.dataValues.almanacRecords.length - 1; i >= 0; i--) {
            let almanacRecord = data.dataValues.almanacRecords[i];
            if (!existingAlmanacRecords.includes(almanacRecord.instID)) {
                existingAlmanacRecords.push(almanacRecord.instID);
                if (almanacRecord.personInAlmanacRecord.isAttending) {
                    processedData.visitingInstitutions.push({
                        instID: almanacRecord.instID,
                        instName: almanacRecord.instName,
                        year: almanacRecord.year,
                        cityReg: almanacRecord.cityReg,
                        diocese: almanacRecord.diocese,
                        latitude: almanacRecord.latitude,
                        longitude: almanacRecord.longitude,
                        personInAlmanacRecord: almanacRecord.personInAlmanacRecord
                })
                } else {
                    processedData.residingInstitutions.push({
                        instID: almanacRecord.instID,
                        instName: almanacRecord.instName,
                        year: almanacRecord.year,
                        cityReg: almanacRecord.cityReg,
                        diocese: almanacRecord.diocese,
                        latitude: almanacRecord.latitude,
                        longitude: almanacRecord.longitude,
                        personInAlmanacRecord: almanacRecord.personInAlmanacRecord
                    });
                }
            }
            if (!existingRoles.includes(almanacRecord.personInAlmanacRecord.role)) {
                if (almanacRecord.personInAlmanacRecord.role) {
                    existingRoles.push(almanacRecord.personInAlmanacRecord.role);
                    processedData.role.push(almanacRecord.personInAlmanacRecord.role);
                }
            }
        }
        for (let i = 0; i < data.dataValues.almanacRecords.length; i++) {
            let almanacRecord = data.dataValues.almanacRecords[i];
            if (!existingYears.includes(almanacRecord.year)){
                existingYears.push(almanacRecord.year);
                processedData.year.push(almanacRecord.year);
            };
            if (!existingDioceses.includes(almanacRecord.diocese)) {
                existingDioceses.push(almanacRecord.diocese);
                processedData.dioceses.push(almanacRecord.diocese);
            };
            if (!existingNames.includes(almanacRecord.personInAlmanacRecord.name)) {
                existingNames.push(almanacRecord.personInAlmanacRecord.name);
                processedData.name.push(almanacRecord.personInAlmanacRecord.name);
            }
        }
        processedData.year.sort((a, b) => a - b);
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
            attributes: ['instID','instName','year', 'cityReg', 'diocese', 'latitude', 'longitude'],
            through: {
                model: personInAlmanacRecord,
                where: { persID: req.params.id },
                attributes: ['name', 'title', 'suffix', 'role', 'note', 'isAttending', 'attendingInstID']
            }
        }]
    });
    if (data) {
        let processedData = {
            persID: data.dataValues.ID,
            name: [data.dataValues.almanacRecords[0].personInAlmanacRecord.name],
            title: data.dataValues.almanacRecords[0].personInAlmanacRecord.title,
            suffix: data.dataValues.almanacRecords[0].personInAlmanacRecord.suffix,
            note: data.dataValues.almanacRecords[0].personInAlmanacRecord.note,
            residingInstitutions: [],
            visitingInstitutions: [],
            year: data.dataValues.almanacRecords[0].year,
            dioceses: [],
            role: [],
        }
        let existingRoles = [];
        let existingAlmanacRecords = [];
        let existingDioceses = [];
        for (let i = data.dataValues.almanacRecords.length - 1; i >= 0; i--) {
            let almanacRecord = data.dataValues.almanacRecords[i];
            if (!existingRoles.includes(almanacRecord.personInAlmanacRecord.role)) {
                existingRoles.push(almanacRecord.personInAlmanacRecord.role);
                processedData.role.push(almanacRecord.personInAlmanacRecord.role);
            };
            if (!existingAlmanacRecords.includes(almanacRecord.instID)) {
                existingAlmanacRecords.push(almanacRecord.instID);
                if (almanacRecord.personInAlmanacRecord.isAttending) {
                    processedData.visitingInstitutions.push({
                        instID: almanacRecord.instID,
                        instName: almanacRecord.instName,
                        year: almanacRecord.year,
                        cityReg: almanacRecord.cityReg,
                        diocese: almanacRecord.diocese,
                        latitude: almanacRecord.latitude,
                        longitude: almanacRecord.longitude,
                        personInAlmanacRecord: almanacRecord.personInAlmanacRecord
                    });
                } else {
                    processedData.residingInstitutions.push({
                        instID: almanacRecord.instID,
                        instName: almanacRecord.instName,
                        year: almanacRecord.year,
                        cityReg: almanacRecord.cityReg,
                        diocese: almanacRecord.diocese,
                        latitude: almanacRecord.latitude,
                        longitude: almanacRecord.longitude,
                        personInAlmanacRecord: almanacRecord.personInAlmanacRecord
                    });
                }
            };
        };
        for (let i = 0; i < data.dataValues.almanacRecords.length; i++) {
            let almanacRecord = data.dataValues.almanacRecords[i];
            if (!existingDioceses.includes(almanacRecord.diocese)) {
                existingDioceses.push(almanacRecord.diocese);
                processedData.dioceses.push(almanacRecord.diocese);
            }
        }
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