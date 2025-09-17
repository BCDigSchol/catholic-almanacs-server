const db = require("../models");
const Op = db.Sequelize.Op;
const { Sequelize } = db.sequelize;

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
            ],
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
            ]]
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
            ],
            order: [[
                Sequelize.literal(`(
                    CASE 
                        WHEN (
                        SELECT pir.\`name\`
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
                    SELECT pir.\`name\`
                    FROM \`personInAlmanacRecords\` pir
                    JOIN \`almanacRecords\` ar ON pir.\`almanacRecordID\` = ar.\`ID\`
                    WHERE pir.\`persID\` = \`person\`.\`ID\`
                    ORDER BY ar.\`year\` DESC
                    LIMIT 1
                    )`), 'ASC'
            ]]
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
                })
            }
        });
        persData.rows.forEach(pers => {
            try {
                if (pers.almanacRecords && pers.almanacRecords.length > 0) {
                    const sortedByYearRecords = pers.almanacRecords.sort((a, b) => a.year - b.year);
                    persResults.push({
                        persID: pers.ID,
                        name: sortedByYearRecords[sortedByYearRecords.length - 1].personInAlmanacRecord.name,
                        title: sortedByYearRecords[sortedByYearRecords.length - 1].personInAlmanacRecord.title,
                        suffix: sortedByYearRecords[sortedByYearRecords.length - 1].personInAlmanacRecord.suffix,
                        diocese: sortedByYearRecords[sortedByYearRecords.length - 1].diocese,
                        yearStart: sortedByYearRecords[0].year,
                        yearEnd: sortedByYearRecords[sortedByYearRecords.length - 1].year,
                        type: 'person'
                    });
            }} catch (err) {
                console.error('error processing person:', {
                    persID: pers.ID,
                    almanacRecords: pers.almanacRecords,
                    error: err.message
                })
            }
        });
        /**instResults.sort((a, b) => {
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
        })*/
        allData = instResults.slice(0, 30).concat(persResults.slice(0, 30));
        res.send(allData);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}