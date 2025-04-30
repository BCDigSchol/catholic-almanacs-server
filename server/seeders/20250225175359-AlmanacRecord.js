'use strict';

//const { create } = require("../controllers/institution.controller");
//const importChurch = require('./import/institution.json')

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ almanacRecord, institution } = require('../models');
const{ loadData } = require('../utils/data-preprocess');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const data = await loadData(__dirname);
    for (const file of data) {
      await importData(file);
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('institutions', null, {});
  }
};

async function importData(data) {

  const instKeys = ['uniqueInstID', 'instID', 'instYear', 'church_type', 'instName', 'language', 'instNote', 'state_orig', 'city_reg', 'memberType', 'member', 'affiliated', 'diocese'];

  const keyMapping = {
    uniqueInstID: 'ID',
    instID: 'instID',
    instYear: 'year',
    church_type: 'instType',
    instName: 'instName',
    language: 'language',
    instNote: 'instNote',
    state_orig: 'stateOrig',
    city_reg: 'cityReg',
    memberType: 'memberType',
    member: 'member',
    affiliated: 'affiliated',
    diocese: 'diocese'
  };

  // extract institution information
  const instInfo = data
    .map(row => {
      const filteredRow = {};
      instKeys.forEach(key => {
        if (key in row) {
          filteredRow[keyMapping[key]] = row[key]; 
        }
      });
      return filteredRow;
    });
  
  // remove duplicates
  const uniqueInstInfo = Array.from(new Map(instInfo.map(item => [item.ID, item])).values());
  // mapping the items in instInfo to tuples of [instID, item]
  // creating a new Map object which automatically removes duplicates
  // converting the Map back to an array of values

  // create institution objects
  for (const item of uniqueInstInfo) {
    if (item.ID) {
      try{
        await almanacRecord.findOrCreate({
          where: { ID: item.ID },
          defaults: item
        });
        //console.log(`Created institution: ${item.instID}`);
      } catch (error) {
        console.log(`Error creating institution: ${item.ID}`, error);
      }
    }
    if (item.instID) {
      try{
        await institution.findOrCreate({
          where: { ID: item.instID }
        });
      } catch (error) {
        console.log(`Error creating institution: ${item.instID}`, error);
      }
    }
  };

  console.log(`Finished processing institutions`);

};
