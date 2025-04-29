'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ person, personInAlmanacRecord } = require('../models');
const{ loadData } = require('../utils/data-preprocess');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file);
    }},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('personInAlmanacRecords', null, {});
  }
};

async function importData(data) {

  const personInAlmanacRecordKeys = ['uniqueInstID', 'persID', 'persName', 'persTitle', 'persSuffix', 'persNote'];

  const keyMapping = {
    uniqueInstID: 'almanacRecordID',
    persID: 'persID',
    persName: 'name',
    persTitle: 'title',
    persSuffix: 'suffix',
    persNote: 'note'
  };

  const personInAlmanacRecordInfo = data
    .map(row => {
      const filteredRow = {};
      personInAlmanacRecordKeys.forEach(key => {
        if (key in row) {
          filteredRow[keyMapping[key]] = row[key]; 
        }
      });
      return filteredRow;
    });
  

  const uniquePersonInAlmanacRecordInfo = Array.from(new Map(personInAlmanacRecordInfo.map(item => [`${item.almanacRecordID}-${item.persID}`, item])).values());
  
  for (const item of uniquePersonInAlmanacRecordInfo) {
    if (item.persID) {
      try {
        await person.findOrCreate({
          where: { ID: item.persID },
        });
        //console.log(`Created person: ${item.persID}`);
      } catch (error) {
        console.error(`Error creating person: ${JSON.stringify(item)}`, error);
      }
    };
    
    if (item.almanacRecordID && item.persID) {
      //console.log(item);
      try {
        await personInAlmanacRecord.findOrCreate({
          where: { almanacRecordID: item.almanacRecordID, persID: item.persID },
          defaults: item,
        });
      //console.log(`Created personInAlmanacRecord:${item.instID}, ${item.uniquePersID}`);
      } catch (error) {
        console.error(`Error creating personInAlmanacRecord: ${JSON.stringify(item)}`, error);
      }
    }

  };

  console.log(`Finished processing personInAlmanacRecords`);

};
