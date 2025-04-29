'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ attendingInstitution } = require('../models');
const{ loadData } = require('../utils/data-preprocess');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file);
    }},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('attendingInstitutiones', null, {});
  }
};

async function importData(data) {

  const attendingInstitutionKeys = ['uniqueInstID', 'uniqueAttendingInstID', 'attendingChurch', 'attendingChurchFrequency', 'attendingChurchNote'];

  const keyMapping = {
    attendedInstRecordID: 'uniqueInstID',
    attendingInstRecordID: 'uniqueAttendingInstID',
    attendingInstName: 'attendingChurch',
    attendingFrequency: 'attendingChurchFrequency',
    note: 'attendingChurchNote'
  };

  const attendingInstitutionInfo = data
    .map(row => {
      const filteredRow = {};
      attendingInstitutionKeys.forEach(key => {
        if (key in row) {
          filteredRow[keyMapping[key]] = row[key]; 
        }
      });
      return filteredRow;
    });

  const uniqueAttendingInstitutionInfo = Array.from(new Map(attendingInstitutionInfo.map(item => [`${item.attendedInstRecordID}-${item.attendingInstRecordID}`, item])).values());

  //console.log(uniqueattendingInstitutionInfo[0]);
  
  for (const item of uniqueAttendingInstitutionInfo) {
    if (item.attendedInstRecordID && item.attendingInstRecordID) {
      try {
        await attendingInstitution.findOrCreate({
          where: { attendedInstRecordID: item.attendedInstRecordID, attendingInstRecordID: item.attendingInstRecordID },
          defaults: item
        });
      //console.log(`Created attendingInstitution:${item.instID}, ${item.attendingInstID}`);
      } catch (error) {
        console.error(`Error creating attendingInstitution: ${JSON.stringify(item)}`, error);
      }
    }
  };

  console.log(`Finished processing attendingInstitutiones`);

};
