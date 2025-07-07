'use strict';


const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ attendingPeople } = require('../models');
const{ loadData } = require('../utils/data-preprocess');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file);
    }},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('attendingPeople', null, {});
  }
};

async function importData(data) {
  //console.log('Data input:', data[0]);

  const attendingPeopleKeys = ['uniqueInstID', 'attendingPersID'];

  const keyMapping = {
    uniqueInstID: 'almanacRecordID',
    attendingPersID: 'attendingPersID'
  };

  const attendingPeopleInfo = data
    .map(row => {
      const filteredRow = {};
      attendingPeopleKeys.forEach(key => {
        if (key in row) {
          filteredRow[keyMapping[key]] = row[key]; 
        }
      });
      return filteredRow;
    });
  
  //console.log(attendingInstitutionInfo[0]);

  const uniqueAttendingPeopleInfo = Array.from(new Map(attendingPeopleInfo.map(item => [`${item.almanacRecordID}-${item.attendingPersID}`, item])).values());
  
  for (const item of uniqueAttendingPeopleInfo) {
    if (item.almanacRecordID && item.attendingPersID) {
      try {
        await attendingPeople.findOrCreate({
          where: { almanacRecordID: item.almanacRecordID, attendingPersID: item.attendingPersID },
          defaults: item
        });
      //console.log(`Created attendingInstitution:${item.instID}, ${item.attendingInstID}`);
      } catch (error) {
        console.error(`Error creating attendingPeople: ${JSON.stringify(item)}`, error);
      }
    }
  };

  console.log(`Finished processing attendingPeople`);

};