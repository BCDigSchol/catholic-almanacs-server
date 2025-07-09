const db = require("../models");
const getPagination = require("../utils/get-pagination");
const Op = db.Sequelize.Op;
const religiousOrderDict = require('../config/religiousOrderDict.json');
const { where } = require("sequelize");

const almanacRecord = db.almanacRecord;
const person = db.person;
const personInAlmanacRecord = db.personInAlmanacRecord;
const institution = db.institution;
const relatedInstitutions = db.relatedInstitutions;
const attendingPeople = db.attendingPeople;

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
        let { instName, countyReg, cityReg, stateReg, diocese, instStartYear, instEndYear, language, instType, persName, instID, religiousOrder } = req.query;
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
        if (countyReg) {
            where.countyReg = { [Op.like]: `%${countyReg}%` };
        };
        if (cityReg) {
            where.cityReg = { [Op.like]: `%${cityReg}%` };
        };
        if (stateReg) {
            where.stateReg = { [Op.like]: `%${stateReg}%` };
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
        if (religiousOrder) {
        let equivalents = null;
        for (const [key, group] of Object.entries(religiousOrderDict)) {
            if (group.includes(religiousOrder)) {
                equivalents = [...group, key];
                console.log(group)
                break;
            }
        }
        if (!equivalents && religiousOrderDict[religiousOrder]) {
            equivalents = religiousOrderDict[religiousOrder];
        }
        if (!equivalents) {
            equivalents = [religiousOrder];
        }
        where.religiousOrder = {
            [Op.or]: equivalents.map(order => ({ [Op.like]: `%${order}%` }))
        };  
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
                attributes: ['instName', 'year','instType', 'diocese'],
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
                        attributes: ['name','title', 'suffix', 'role', 'note'],
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

exports.findByID = async (req, res) => {
    const id = req.params.id;
    data = await institution.findOne({
        where: { ID: id },
        attributes: ['ID'],
        include: [{
                model: almanacRecord,
                as: 'almanacRecord',
                attributes: ['instName', 'year', 'language', 'instType', 'instNote', 'diocese', 'placeName', 'region', 'countyOrig', 'countyReg', 'cityOrig', 'cityReg', 'stateOrig', 'stateReg', 'latitude', 'longitude',
                    'member', 'memberType', 'affiliated', 'religiousOrder'
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
                        attributes: ['name','title', 'suffix', 'role', 'note'],
                    }}
                    ,{
                    model: person,
                    as: 'attendingPers',
                    attributes: ['ID'],
                    through: {
                        model: attendingPeople,
                        attributes: ['name', 'title', 'suffix']
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
            religiousOrder: data.dataValues.almanacRecord[data.dataValues.almanacRecord.length - 1].religiousOrder,
            attendingInstitutions: [],
            attendedBy: [],
            relatedInstitutions: [],
            personInfo: [],
            attendingPeople: [],
            // adding the info of the last record first so that the information of "all years" is the most up-to-date
        };
        
        let existingAttendingInstIDs = [];
        let existingAttendedByInstIDs = [];
        let existingPersonIDs = [];
        let existingRelatedInstIDs = [];
        let existingAttendingPeopleIDs = [];

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
            
            record.personInfo.forEach(person => {
                if (!existingPersonIDs.includes(person.ID)) {
                    existingPersonIDs.push(person.ID);
                    processedData.personInfo.push(person);
                }
            });

            record.attendingPers.forEach(attendingPerson => {
                if (!existingAttendingPeopleIDs.includes(attendingPerson.ID)) {
                    existingAttendingPeopleIDs.push(attendingPerson.ID);
                    processedData.attendingPeople.push({
                        ID: attendingPerson.ID,
                        name: attendingPerson.attendingPeople.name,
                        title: attendingPerson.attendingPeople.title,
                        suffix: attendingPerson.attendingPeople.suffix
                    });
                }
            });
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
                    attributes: ['name','title', 'suffix', 'role', 'note'],
                }}
                ,{
                    model: person,
                    as: 'attendingPers',
                    attributes: ['ID'],
                    through: {
                        model: attendingPeople,
                        attributes: ['name', 'title', 'suffix']
                    }
                }
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
            attendingInstitutions: [],
            attendedBy: [],
            parentInstitutions: [],
            childInstitutions: [],
            siblingInstitutions: [],
            personInfo: [],
            attendingPeople: [],
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
            processedData.personInfo.push(person);
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

        if (data.dataValues.almanacRecord[0].attendingPers.length > 0) {
            for (const attendingPerson of data.dataValues.almanacRecord[0].attendingPers) {
                const affiliatedInst = await institution.findAll({
                    attributes: ['ID'],
                    include: [{
                        model: almanacRecord,
                        as: 'almanacRecord',
                        where: { year: req.params.year },
                        attributes: ['instName', 'instID', 'year'],
                        include: [{
                            model: person,
                            as: 'personInfo',
                            where: { ID: attendingPerson.ID },
                            attributes: ['ID'],
                            through: {
                                model: personInAlmanacRecord,
                                attributes: ['name', 'title', 'suffix']
                            }
                        }]
                    }]
                })
                processedData.attendingPeople.push({
                    attendingPerson: attendingPerson,
                    affiliatedInst: affiliatedInst[0].almanacRecord[0]
                })
            }
            }

        res.send(processedData);}
    else {
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