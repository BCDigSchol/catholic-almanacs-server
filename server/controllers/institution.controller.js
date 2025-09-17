const db = require("../models");
const { Sequelize } = db.sequelize;
const getPagination = require("../utils/get-pagination");
const Op = db.Sequelize.Op;
const { where } = require("sequelize");

const almanacRecord = db.almanacRecord;
const person = db.person;
const personInAlmanacRecord = db.personInAlmanacRecord;
const institution = db.institution;
const relatedInstitutions = db.relatedInstitutions;
const order = db.order;
const orderInAlmanacRecord = db.orderInAlmanacRecord;

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
            page = 1;
        };
        if (!size) {
            size = 3;
        };
        let {limit, offset} = getPagination(page, size);
        let where = {};
        let persWhere = {};
        let orderWhere = {};
        let { instName, countyOrig, cityOrig, stateOrig, diocese, instStartYear, instEndYear, language, instType, instFunction, persName, instID, religiousOrder } = req.query;
        if (instName) {
            where.instName = { [Op.like]: `%${instName}%` };
        };
        if (diocese) {
            where.diocese_reg = { [Op.like]: `%${diocese}%` };
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
        if (countyOrig) {
            where.countyOrig = { [Op.like]: `%${countyOrig}%` };
        };
        if (cityOrig) {
            where.cityOrig = { [Op.like]: `%${cityOrig}%` };
        };
        if (stateOrig) {
            where.stateOrig = { [Op.like]: `%${stateOrig}%` };
        };
        if (language) {
            where.language = { [Op.like]: `%${language}%` };
        };
        if (instType) {
            where.instType = { [Op.like]: `%${instType}%` };
        };
        if (instFunction) {
            where.instFunction = { [Op.like]: `%${instFunction}%` };
        };
        if (persName) {
            persWhere.name = { [Op.like]: `%${persName}%` };
        };
        if (instID) {
            where.instID = { [Op.like]: `%${instID}%` };
        };
        if (religiousOrder) {
            orderWhere.order = { [Op.like]: `%${religiousOrder}%` };
        };
        //console.log('-----------where', where);
        const data = await institution.findAndCountAll({
            distinct: true,
            attributes: ['ID'],
            include: [{
                model: almanacRecord,
                as: 'almanacRecord',
                where: where,
                required: Object.keys(persWhere).length > 0 || Object.keys(where).length > 0 || Object.keys(orderWhere).length > 0,
                attributes: ['instName', 'year','instType', 'diocese'],
                include: [{
                    model: person,
                    as: 'personInfo',
                    required: Object.keys(persWhere).length > 0,
                    attributes: ['ID'],
                    through: {
                        model: personInAlmanacRecord,
                        where: persWhere,
                        attributes: ['name','title', 'suffix', 'role', 'note'],
                    }}, {
                    model: order,
                    as: 'orders',
                    required: Object.keys(orderWhere).length > 0,
                    attributes: ['order'],
                    where: orderWhere,
                    through: {
                        model: orderInAlmanacRecord,
                        attributes: ['order', 'almanacRecordID']
                    }}]}],
            order: [[
                Sequelize.literal(`(
                        CASE 
                            WHEN (
                            SELECT \`instName\`
                            FROM \`almanacRecords\` ar
                            WHERE ar.\`instID\` = \`institution\`.\`ID\`
                            ORDER BY ar.\`year\` DESC
                            LIMIT 1
                            ) REGEXP '^[A-Za-z]' THEN 0
                            ELSE 1
                        END
                )`), 'ASC'
            ], [
                Sequelize.literal(`(
                    SELECT \`instName\`
                    FROM \`almanacRecords\` ar
                    WHERE ar.\`instID\` = \`institution\`.\`ID\`
                    ORDER BY ar.\`year\` DESC
                    LIMIT 1
                )`), 'ASC'
            ]],
            limit,
            offset
    });
        /**data.forEach(inst => {
            if (inst.almanacRecord && Array.isArray(inst.almanacRecord)) {
                inst.almanacRecord.sort((a, b) => a.year - b.year)
            }
        });
        data.sort((a, b) => {
            const aName = a.almanacRecord.length > 0 ? a.almanacRecord[a.almanacRecord.length - 1].instName : '';
            const bName = b.almanacRecord.length > 0 ? b.almanacRecord[b.almanacRecord.length - 1].instName : '';
            const aAlpha = /^[A-Za-z]/.test(aName);
            const bAlpha = /^[A-Za-z]/.test(bName);
            if (aAlpha && !bAlpha) return -1;
            if (!aAlpha && bAlpha) return 1;
            return aName.localeCompare(bName);
        });
        const start = offset;
        const end = offset + limit;
        const paginatedRows = data.slice(start, end);
        res.send({
            count: data.length,
            rows: paginatedRows,
        });*/
        data.rows.forEach(inst => {
            if (inst.almanacRecord && Array.isArray(inst.almanacRecord)) {
                inst.almanacRecord.sort((a, b) => a.year - b.year)
            }
        });
        res.send({
            count: data.count,
            rows: data.rows
        })
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

exports.findByID = async (req, res) => {
    const id = req.params.id;
    data = await institution.findOne({
        where: { ID: id },
        attributes: ['ID'],
        include: [{
                model: almanacRecord,
                as: 'almanacRecord',
                attributes: ['instName', 'year', 'language', 'instType', 'instNote', 'diocese', 'placeName', 'region', 'countyOrig', 'countyReg', 'cityOrig', 'cityReg', 'stateOrig', 'stateReg', 'latitude', 'longitude',
                    'member', 'memberType', 'affiliated'
                ],
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
                        attributes: ['name','title', 'suffix', 'role', 'note', 'isAttending', 'attendingInstID'],
                    }},{
                    model: order,
                    as: 'orders',
                    attributes: ['order'],
                    through: {
                        model: orderInAlmanacRecord,
                        attributes: ['order', 'almanacRecordID']
                    }}
                ]
        }, {
            model: relatedInstitutions,
            as: 'relatedFirst',
            attributes: ['firstID', 'secondID', 'isSibling']
        }, {
            model: relatedInstitutions,
            as: 'relatedSecond',
            attributes: ['firstID', 'secondID', 'isSibling'],
        }
    ]
    });
    console.log('data', data);
    if (data) {
        let processedData = {
            instID: data.dataValues.ID,
            year: [],
            instName: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].instName,
            language: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].language,
            diocese: [],
            instType: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].instType,
            instNote: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].instNote,
            placeName: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].placeName,
            region: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].region,
            countyOrig: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].countyOrig,
            countyReg: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].countyReg,
            cityOrig: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].cityOrig,
            cityReg: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].cityReg,
            stateOrig: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].stateOrig,
            stateReg: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].stateReg,
            latitude: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].latitude,
            longitude: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].longitude,
            member: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].member,
            memberType: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].memberType,
            affiliated: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].affiliated,
            order: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].orders.map(order => order.order).join(', '),
            attendedBy: [],
            attendingInstitutions: [],
            relatedInstitutions: [],
            residingPersonInfo: [],
            visitingPersonInfo: [],
            // adding the info of the last record first so that the information of "all years" is the most up-to-date
        };
        
        let existingAttendingInstIDs = [];
        let existingAttendedByInstIDs = [];
        let existingRelatedInstIDs = [];
        let existingResidingPersonIDs = [];
        let existingVisitingPersonIDs = [];

        // all the (unique) dioceses
        for (const record of data.dataValues.almanacRecord) {
            if (!processedData.diocese.includes(record.diocese)) {
                processedData.diocese.push(record.diocese);
            }
        };

        // all the (unique) attending institutions, attended by institutions and persons
        for (let i = data.dataValues.almanacRecord.length - 1; i >= 0; i--) {
            let record = data.dataValues.almanacRecord[i];
            if (!processedData.year.includes(record.year)) {
                processedData.year.push(record.year);
            }
            
            for (const attendingInst of record.attendingInstitutions) {
                if (!existingAttendingInstIDs.includes(attendingInst.instID)) {
                    existingAttendingInstIDs.push(attendingInst.instID);
                    const instDetails = await institution.findAll({
                        where: { ID: attendingInst.instID },
                        attributes: ['ID'],
                        include: [{
                            model: almanacRecord,
                            as: 'almanacRecord',
                            attributes: ['instName', 'year'],
                        }]
                    });
                    let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
                    let latestYear = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].year;
                    //console.log('latestInstName', latestInstName);
                    processedData.attendingInstitutions.push({
                        instID: attendingInst.instID,
                        instName: attendingInst.instName,
                        year: attendingInst.year,
                        attendingFrequency: attendingInst.attendingInstitution.attendingFrequency,
                        note: attendingInst.attendingInstitution.note,
                        latestInstName: latestInstName,
                        latestYear: latestYear
                    });
                    //console.log('processedData.attendingInstitutions', processedData.attendingInstitutions);
                    }};
            
            for (const attendedInst of record.attendedBy) {
                if (!existingAttendedByInstIDs.includes(attendedInst.instID)) {
                    existingAttendedByInstIDs.push(attendedInst.instID);
                    const instDetails = await institution.findAll({
                        where: { ID: attendedInst.instID },
                        attributes: ['ID'],
                        include: [{
                            model: almanacRecord,
                            as: 'almanacRecord',
                            attributes: ['instName', 'year'],
                        }]
                    });
                    let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
                    let latestYear = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].year;
                    processedData.attendedBy.push({
                        instID: attendedInst.instID,
                        instName: attendedInst.instName,
                        year: attendedInst.year,
                        attendingFrequency: attendedInst.attendingInstitution.attendingFrequency,
                        note: attendedInst.attendingInstitution.note,
                        latestInstName: latestInstName,
                        latestYear: latestYear
                    });}};
            
            for (const person of record.personInfo) {
                if (!existingResidingPersonIDs.includes(person.ID) && !person.personInAlmanacRecord.isAttending) {
                    existingResidingPersonIDs.push(person.ID);
                    processedData.residingPersonInfo.push(person);
                } else if (!existingVisitingPersonIDs.includes(person.ID) && person.personInAlmanacRecord.isAttending) {
                    existingVisitingPersonIDs.push(person.ID);
                    if (person.personInAlmanacRecord.attendingInstID) {
                    processedData.attendedBy = processedData.attendedBy.filter(inst => inst.instID !== person.personInAlmanacRecord.attendingInstID);
                    const instDetails = await institution.findAll({
                        where: { ID: person.personInAlmanacRecord.attendingInstID },
                        attributes: ['ID'],
                        include: [{
                            model: almanacRecord,
                            as: 'almanacRecord',
                            attributes: ['instName'],
                        }]
                    });
                    let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
                    processedData.visitingPersonInfo.push({
                        ID: person.ID,
                        personInAlmanacRecord: {
                            ...person.personInAlmanacRecord.dataValues,
                            attendingInstName: latestInstName
                        },
                    });
                } else {
                    processedData.visitingPersonInfo.push(person);
                }
            }}
        };

        // all the related institutions
        const allRelatedInstitutions = [
            ...data.dataValues.relatedFirst,
            ...data.dataValues.relatedSecond
        ];

        const allRelatedInstIDs = new Set();

        allRelatedInstitutions.forEach(relatedInst => {
            allRelatedInstIDs.add(relatedInst.firstID);
            allRelatedInstIDs.add(relatedInst.secondID);
        });

        const uniqueRelatedInstIDs = Array.from(allRelatedInstIDs);
        existingRelatedInstIDs = uniqueRelatedInstIDs.filter(id => id !== data.dataValues.ID);
        for (const relatedInstID of existingRelatedInstIDs) {
            const relatedInstDetails = await institution.findAll({
                where: { ID: relatedInstID },
                attributes: ['ID'],
                include: [{
                    model: almanacRecord,
                    as: 'almanacRecord',
                    attributes: ['instName', 'year', 'instType'],
                }]
            });
            let latestInstName = relatedInstDetails[0].almanacRecord[relatedInstDetails[0].almanacRecord.length - 1].instName;
            let latestYear = relatedInstDetails[0].almanacRecord[relatedInstDetails[0].almanacRecord.length - 1].year;
            processedData.relatedInstitutions.push({
                instID: relatedInstID,
                instName: latestInstName,
                year: latestYear,
                instType: relatedInstDetails[0].almanacRecord[relatedInstDetails[0].almanacRecord.length - 1].instType,
            });
        }
    

        processedData.year.reverse();
        res.send(processedData);
    }
    else {
        res.status(404).send({
            message: `Cannot find almanacRecord with id=${id}.`
        });
    }
};

exports.findOne = async (req, res) => {
    data = await institution.findOne({
        where: { ID: req.params.id },
        attributes: ['ID'],
        include: [{
            model: almanacRecord,
            as: 'almanacRecord',
            where: { year: req.params.year },
            attributes: ['instName', 'year', 'language', 'instType', 'instNote', 'diocese', 'placeName', 'region', 'countyOrig', 'countyReg', 'cityOrig', 'cityReg', 'stateOrig', 'stateReg', 'latitude', 'longitude',
                'member', 'memberType', 'affiliated'
            ],
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
                    attributes: ['name','title', 'suffix', 'role', 'note', 'isAttending', 'attendingInstID'],
                }}, {
                model: order,
                as: 'orders',
                attributes: ['order'],
                through: {
                    model: orderInAlmanacRecord,
                    attributes: ['order', 'almanacRecordID']
                }}
            ]
        }, {
            model: relatedInstitutions,
            as: 'relatedFirst',
            attributes: ['firstID', 'secondID', 'isSibling']
        }, {
            model: relatedInstitutions,
            as: 'relatedSecond',
            attributes: ['firstID', 'secondID', 'isSibling']
        }], 
});
    if (data) {
        let processedData = {
            instID: data.dataValues.ID,
            instName: data.dataValues.almanacRecord[0].instName,
            language: data.dataValues.almanacRecord[0].language,
            diocese: [data.dataValues.almanacRecord[0].diocese],
            instType: data.dataValues.almanacRecord[0].instType,
            instNote: data.dataValues.almanacRecord[0].instNote,
            placeName: data.dataValues.almanacRecord[0].placeName,
            region: data.dataValues.almanacRecord[0].region,
            countyOrig: data.dataValues.almanacRecord[0].countyOrig,
            countyReg: data.dataValues.almanacRecord[0].countyReg,
            cityOrig: data.dataValues.almanacRecord[0].cityOrig,
            cityReg: data.dataValues.almanacRecord[0].cityReg,
            stateOrig: data.dataValues.almanacRecord[0].stateOrig,
            stateReg: data.dataValues.almanacRecord[0].stateReg,
            latitude: data.dataValues.almanacRecord[0].latitude,
            longitude: data.dataValues.almanacRecord[0].longitude,
            member: data.dataValues.almanacRecord[0].member,
            memberType: data.dataValues.almanacRecord[0].memberType,
            affiliated: data.dataValues.almanacRecord[0].affiliated,
            year: data.dataValues.almanacRecord[0].year,
            order: data.dataValues.almanacRecord[0].orders.map(order => order.order).join(', '),
            attendingInstitutions: [],
            attendedBy: [],
            parentInstitutions: [],
            childInstitutions: [],
            siblingInstitutions: [],
            residingPersonInfo: [],
            visitingPersonInfo: [],
        };

        // attending institutions, attended by institutions and persons
        for (const attendingInst of data.dataValues.almanacRecord[0].attendingInstitutions) {
            const instDetails = await institution.findAll({
                where: { ID: attendingInst.instID },
                attributes: ['ID'],
                include: [{
                    model: almanacRecord,
                    as: 'almanacRecord',
                    attributes: ['instName', 'year'],
                }]
            });
            let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
            let latestYear = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].year;
            processedData.attendingInstitutions.push({
                instID: attendingInst.instID,
                instName: attendingInst.instName,
                year: attendingInst.year,
                attendingFrequency: attendingInst.attendingInstitution.attendingFrequency,
                note: attendingInst.attendingInstitution.note,
                latestInstName: latestInstName,
                latestYear: latestYear
            });
        }

        for (const attendedInst of data.dataValues.almanacRecord[0].attendedBy) {
            const instDetails = await institution.findAll({
                where: { ID: attendedInst.instID },
                attributes: ['ID'],
                include: [{
                    model: almanacRecord,
                    as: 'almanacRecord',
                    attributes: ['instName', 'year'],
                }]
            });
            let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
            let latestYear = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].year;
            processedData.attendedBy.push({
                instID: attendedInst.instID,
                instName: attendedInst.instName,
                year: attendedInst.year,
                attendingFrequency: attendedInst.attendingInstitution.attendingFrequency,
                note: attendedInst.attendingInstitution.note,
                latestInstName: latestInstName,
                latestYear: latestYear
            });}

        for (const person of data.dataValues.almanacRecord[0].personInfo) {
            if (!person.personInAlmanacRecord.isAttending) {
                processedData.residingPersonInfo.push(person);
            } else {
                if (person.personInAlmanacRecord.attendingInstID) {
                    processedData.attendedBy = processedData.attendedBy.filter(inst => inst.instID !== person.personInAlmanacRecord.attendingInstID);
                    const instDetails = await institution.findAll({
                        where: { ID: person.personInAlmanacRecord.attendingInstID },
                        attributes: ['ID'],
                        include: [{
                            model: almanacRecord,
                            as: 'almanacRecord',
                            attributes: ['instName'],
                        }]
                    });
                    let latestInstName = instDetails[0].almanacRecord[instDetails[0].almanacRecord.length - 1].instName;
                    processedData.visitingPersonInfo.push({
                        ID: person.ID,
                        personInAlmanacRecord: {
                            ...person.personInAlmanacRecord.dataValues,
                            attendingInstName: latestInstName
                        },
                    });
                } else {
                    processedData.visitingPersonInfo.push(person);
                }
            }
        };

        const parentInstitutions = [
            ...data.dataValues.relatedSecond.filter(rel => rel.isSibling === false)
        ]

        const childInstitutions = [
            ...data.dataValues.relatedFirst.filter(rel => rel.isSibling === false)
        ]

        const siblingInstitutions = [
            ...data.dataValues.relatedFirst.filter(rel => rel.isSibling === true),
            ...data.dataValues.relatedSecond.filter(rel => rel.isSibling === true)
        ]

        const allParentInstIDs = new Set(parentInstitutions.map(rel => rel.firstID));
        const allChildInstIDs = new Set(childInstitutions.map(rel => rel.secondID));
        const allSiblingInstIDs = new Set();

        siblingInstitutions.forEach(rel => {
            allSiblingInstIDs.add(rel.firstID);
            allSiblingInstIDs.add(rel.secondID);
        });

        const uniqueParentInstIDs = Array.from(allParentInstIDs).filter(id => id !== data.dataValues.ID);
        const uniqueChildInstIDs = Array.from(allChildInstIDs).filter(id => id !== data.dataValues.ID);
        const uniqueSiblingInstIDs = Array.from(allSiblingInstIDs).filter(id => id !== data.dataValues.ID);

        for (const parentInstID of uniqueParentInstIDs) {
            const parentInstDetails = await institution.findAll({
                where: { ID: parentInstID },
                attributes: ['ID'],
                include: [{
                    model: almanacRecord,
                    as: 'almanacRecord',
                    where: {year: req.params.year},
                    attributes: ['instName', 'year', 'instType'],
                }]
            });
            if (parentInstDetails.length !== 0) {
                processedData.parentInstitutions.push({
                    instID: parentInstID,
                    instName: parentInstDetails[0].almanacRecord[0].instName,
                    year: parentInstDetails[0].almanacRecord[0].year,
                    instType: parentInstDetails[0].almanacRecord[0].instType
                });
        }
        }

        for (const childInstID of uniqueChildInstIDs) {
            const childInstDetails = await institution.findAll({
                where: { ID: childInstID },
                attributes: ['ID'],
                include: [{
                    model: almanacRecord,
                    as: 'almanacRecord',
                    where: {year: req.params.year},
                    attributes: ['instName', 'year', 'instType'],
                }]
            });
            if (childInstDetails.length !== 0) {
                processedData.childInstitutions.push({
                    instID: childInstID,
                    instName: childInstDetails[0].almanacRecord[0].instName,
                    year: childInstDetails[0].almanacRecord[0].year,
                    instType: childInstDetails[0].almanacRecord[0].instType
                });
        }
        };

        for (const siblingInstID of uniqueSiblingInstIDs) {
            const siblingInstDetails = await institution.findAll({
                where: { ID: siblingInstID },
                attributes: ['ID'],
                include: [{
                    model: almanacRecord,
                    as: 'almanacRecord',
                    where: {year: req.params.year},
                    attributes: ['instName', 'year', 'instType'],
                }]
            });
            if (siblingInstDetails.length !== 0) {
                processedData.siblingInstitutions.push({
                    instID: siblingInstID,
                    instName: siblingInstDetails[0].almanacRecord[0].instName,
                    year: siblingInstDetails[0].almanacRecord[0].year,
                    instType: siblingInstDetails[0].almanacRecord[0].instType
                });
        }
        };

        res.send(processedData);
    } else {
        res.status(404).send({
            message: `Cannot find almanacRecord with id=${req.params.id}.`
        });
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