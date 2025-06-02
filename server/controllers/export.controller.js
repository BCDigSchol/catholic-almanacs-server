const db = require('../models');
const archiver = require('archiver');
const { Readable } = require('stream');

const institution = db.institution;
const person = db.person;
const almanacRecord = db.almanacRecord;
const personInAlmanacRecord = db.personInAlmanacRecord;
const attendingInstitution = db.attendingInstitution;

exports.exportAll = async (req, res) => {
    let { format } = req.query || 'json';
    if (format !== 'json' && format !== 'csv') {
        return res.status(400).send({
            message: "Invalid format specified. Only 'json' and 'csv' are supported."
        });
    }
    try {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=export.zip');
        const archive= archiver('zip', {
            zlib: { level: 9 }
        });
        archive.pipe(res);
        
        if (format === 'json') {
            const addModelToArchive = async (model, fileName) => {
            const data = await model.findAll();
            const jsonString = JSON.stringify(data);
            const jsonStream = new Readable();
            jsonStream.push(jsonString);
            jsonStream.push(null);
            archive.append(jsonStream, { name: fileName });
        };

            await addModelToArchive(institution, 'institutions.json');
            await addModelToArchive(person, 'persons.json');
            await addModelToArchive(almanacRecord, 'almanacRecords.json');
            await addModelToArchive(personInAlmanacRecord, 'personsInAlmanacRecords.json');
            await addModelToArchive(attendingInstitution, 'attendingInstitutions.json');
            await archive.finalize();
        }
        
        if (format === 'csv') {
            const addModelToArchiveCSV = async (model, fileName) => {
                const data = await model.findAll();
                if (data.length === 0) {
                    archive.append('', { name: fileName });
                    return;
                };
                const csvData = [];
                const headers = Object.keys(data[0].dataValues);
                csvData.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
                data.forEach(record => {
                    const values = Object.values(record.dataValues).map(value => {
                    // Convert value to string, escape quotes, wrap in quotes
                    const str = value === null || value === undefined ? '' : String(value);
                    return `"${str.replace(/"/g, '""')}"`;
                });
                csvData.push(values.join(','));
            });
                const csvString = csvData.join('\n');
                const csvStream = new Readable();
                csvStream.push(csvString);
                csvStream.push(null);
                archive.append(csvStream, { name: fileName });
            };

            await addModelToArchiveCSV(institution, 'institutions.csv');
            await addModelToArchiveCSV(person, 'persons.csv');
            await addModelToArchiveCSV(almanacRecord, 'almanacRecords.csv');
            await addModelToArchiveCSV(personInAlmanacRecord, 'personsInAlmanacRecords.csv');
            await addModelToArchiveCSV(attendingInstitution, 'attendingInstitutions.csv');
            await archive.finalize();
        }

    } catch (error) {
        res.status(500).send({
            message: error.message || "Some error occurred while exporting data."
        });
        console.error("Export error:", error);
    }
};