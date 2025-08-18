'use strict';

//const { create } = require("../controllers/institution.controller");
//const importChurch = require('./import/institution.json')

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ almanacRecord, institution } = require('../models');
const{ loadData } = require('../utils/data-preprocess');
const diocese = require('../models/diocese');

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
    await queryInterface.bulkDelete('almanacRecords', null, {});
  }
};

async function importData(data) {

  const instKeys = ['uniqueInstID', 'instID', 'instYear', 'church_type', 'instName', 'language', 'instNote', 'placeName', 'region', 'county_orig', 'county_reg', 'city_orig', 'city_reg', 'state_orig', 'state_reg', 'latitude', 'longitude', 'memberType', 'member', 'affiliated', 'diocese', 'diocese_reg'];

  const keyMapping = {
    uniqueInstID: 'ID',
    instID: 'instID',
    instYear: 'year',
    church_type: 'instType',
    instName: 'instName',
    language: 'language',
    instNote: 'instNote',
    placeName: 'placeName',
    region: 'region',
    county_orig: 'countyOrig',
    county_reg: 'countyReg',
    city_orig: 'cityOrig',
    city_reg: 'cityReg',
    state_orig: 'stateOrig',
    state_reg: 'stateReg',
    latitude: 'latitude',
    longitude: 'longitude',
    memberType: 'memberType',
    member: 'member',
    affiliated: 'affiliated',
    diocese: 'diocese',
    diocese_reg: 'diocese_reg'
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
  
  const instInfoMap = new Map();

  instInfo.forEach(item => {
    if (!item.ID) return;
    if (!instInfoMap.has(item.ID)) {
      instInfoMap.set(item.ID, { ...item });
    } else {
      const existing = instInfoMap.get(item.ID);

      // Aggregate memberType
      if (item.memberType) {
        const types = new Set(
          (existing.memberType ? existing.memberType.split(',') : [])
          .concat(item.memberType.split(','))
          .map(s => s.trim())
          .filter(Boolean)
        );
        existing.memberType = Array.from(types).join(', ');
      }

      // Aggregate member
      if (item.member) {
        const members = new Set(
          (existing.member ? existing.member.split(',') : [])
          .concat(item.member.split(','))
          .map(s => s.trim())
          .filter(Boolean)
        );
        existing.member = Array.from(members).join(', ');
      }
    }
  });

  const uniqueInstInfo = Array.from(instInfoMap.values());

  // remove duplicates
  // const uniqueInstInfo = Array.from(new Map(instInfo.map(item => [item.ID, item])).values());
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
      try {
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
