const db = require("../models");
const getPagination = require("../utils/get-pagination");
const Op = db.Sequelize.Op;

const almanacRecord = db.almanacRecord;
const person = db.person;
const personInAlmanacRecord = db.personInAlmanacRecord;
const institution = db.institution;

/*exports.create = (req, res) => {
    const churches = req.body;

    const processedChurches = churches.map(institution => {
        const uniqueInstID = `${institution.year}-${institution.instID}`;
        const uniqueAttendingInstID = institution.uniqueAttendingInstID ? `${institution.year}-${institution.attendingInstID}` : null;
        return {
            ...institution,
            uniqueInstID: uniqueInstID,
            uniqueAttendingInstID: uniqueAttendingInstID
        }});

    almanacRecord.bulkCreate(processedChurches)
    .then(data => {
        res.send(data);
    })
    .catch(err => {
        res.status(500).send({
            message: err.message || "An error occurred while creating the almanacRecord."
        });
    });
};*/

exports.findAll = async (req, res) => {
    try {
        let {page, size} = req.query;
        if (!page) {
            page = 0;
        };
        if (!size) {
            size = 3;
        };
        let {limit, offset} = getPagination(page, size);
        let where = {};
        let persWhere = {};
        let { instName, cityReg, diocese, instStartYear, instEndYear, language, instType, persName, instID } = req.query;
        if (instName) {
            where.instName = { [Op.like]: `%${instName}%` };
        };
        if (diocese) {
            where.diocese = { [Op.like]: `%${diocese}%` };
        };
        if (instStartYear && instEndYear) {
            where.year = {
              [Op.between]: [instStartYear, instEndYear]
            };
          } else if (instStartYear) {
            where.year = {
              [Op.gte]: instStartYear
            };
          } else if (instEndYear) {
            where.year = {
              [Op.lte]: instEndYear
            };
        };
        if (cityReg) {
            where.cityReg = { [Op.like]: `%${cityReg}%` };
        };
        if (language) {
            where.language = { [Op.like]: `%${language}%` };
        };
        if (instType) {
            where.instType = { [Op.like]: `%${instType}%` };
        };
        if (persName) {
            persWhere.name = { [Op.like]: `%${persName}%` };
        };
        if (instID) {
            where.instID = { [Op.like]: `%${instID}%` };
        };
        //console.log('-----------where', where);
        const data = await institution.findAndCountAll({
            limit: limit,
            offset: offset,
            distinct: true,
            attributes: ['ID'],
            include: [{
                model: almanacRecord,
                as: 'almanacRecord',
                where: where,
                required: Object.keys(persWhere).length > 0 || Object.keys(where).length > 0,
                attributes: ['instName', 'year', 'language', 'instType', 'instNote', 'cityReg', 'stateOrig', 'diocese'],
                include: [{
                    model: almanacRecord,
                    as: 'attendingInstitutions',
                    attributes: ['instID', 'instName', 'year'],
                    through: {
                        attributes: ['attendingFrequency', 'note']
                    }}, {
                    model: almanacRecord,
                    as: 'attendedBy',
                    attributes: ['instID', 'instName', 'year'],
                    through: {
                        attributes: ['attendingFrequency', 'note']
                    }}
                    ,{
                    model: person,
                    as: 'personInfo',
                    required: Object.keys(persWhere).length > 0,
                    attributes: ['ID'],
                    through: {
                        model: personInAlmanacRecord,
                        where: persWhere,
                        attributes: ['name','title', 'suffix', 'note'],
                    }
                }
    ]}]});
        /*if (data) {
            const personData = await person.findAll({
                attributes: ['persID'],
                include: [{
                    model: almanacRecord,
                    where: where,
                    as: 'institution',
                    attributes: ['uniqueInstID'], // one more redundant field
                    through:{
                        model: personInAlmanacRecord,
                        where: persWhere,
                        attributes: ['persYear', 'persName', 'persTitle', 'persSuffix', 'persNote']
                    }
                }]
            });
            data.rows.forEach(churchRecord => {
                churchRecord.dataValues.personInfo = personData;
            });*/
            res.send(data);
        //} else {
        //    return res.status(404).json({ message: "No churches found." });
        //};

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.findByID = (req, res) => {
    const id = req.params.id;
    institution.findOne({
        where: { ID: id },
        attributes: ['ID'],
        include: [{
                model: almanacRecord,
                as: 'almanacRecord',
                attributes: ['instName', 'year', 'language', 'instType', 'instNote', 'cityReg', 'stateOrig', 'diocese'],
                include: [{
                    model: almanacRecord,
                    as: 'attendingInstitutions',
                    attributes: ['instID', 'instName', 'year'],
                    through: {
                        attributes: ['attendingFrequency', 'note']
                    }}, {
                    model: almanacRecord,
                    as: 'attendedBy',
                    attributes: ['instID', 'instName', 'year'],
                    through: {
                        attributes: ['attendingFrequency', 'note']
                    }}
                    ,{
                    model: person,
                    as: 'personInfo',
                    attributes: ['ID'],
                    through: {
                        model: personInAlmanacRecord,
                        attributes: ['name','title', 'suffix', 'note'],
                    }}]
        }]
    }).then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot find almanacRecord with id=${id}.`
            });
        } else {
            res.send(data);
        }
    }).catch(err => {
        res.status(500).send({
            message: "Error retrieving almanacRecord with id=" + id
        });
    });
};

exports.findOne = async (req, res) => {
    try {
        const data = await almanacRecord.findOne({
            where: { instID: req.params.id, year: req.params.year },
            attributes: ['instName', 'year', 'language', 'instType', 'instNote', 'cityReg', 'stateOrig', 'diocese'],
                include: [{
                    model: almanacRecord,
                    as: 'attendingInstitutions',
                    attributes: ['instID', 'instName', 'year'],
                    through: {
                        attributes: ['attendingFrequency', 'note']
                    }}, {
                    model: almanacRecord,
                    as: 'attendedBy',
                    attributes: ['instID', 'instName', 'year'],
                    through: {
                        attributes: ['attendingFrequency', 'note']
                    }}
                    ,{
                    model: person,
                    as: 'personInfo',
                    attributes: ['ID'],
                    through: {
                        model: personInAlmanacRecord,
                        attributes: ['name','title', 'suffix', 'note'],
                    }
                }]});
        res.send(data);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.delete = (req, res) => {
    const id = req.params.instID;
    institution.destroy({
        where: { instID: id }
    })
    .then(data => {
        if (!data) {
            res.status(404).send({
                message: `Cannot delete almanacRecord with id=${id}. Maybe almanacRecord was not found!`
            });
        } else {
            res.send({
                message: "almanacRecord was deleted successfully!"
            });
        }
    }).catch(err => {
        res.status(500).send({
            message: "Could not delete almanacRecord with id=" + id
        });
    });
};