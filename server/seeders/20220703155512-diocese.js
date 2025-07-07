'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const{ diocese } = require('../models');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const dioceses = [];
    const filePath = path.join(__dirname, 'import', 'others', 'diocese.csv');
    await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            dioceses.push(row);
        })
        .on('end', () => {
        resolve();
        })
        .on('error', (error) => {
        reject(error);
        });
    });

    if (dioceses.length > 0) {
      for (const row of dioceses) {
        const value = row[Object.keys(row)[0]];
        //console.log(`Processing diocese: ${value}`);
        await diocese.findOrCreate({
          where: { diocese: value },
      })
    }
  }
    console.log(`Inserted ${dioceses.length} dioceses into the database.`);
},

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('dioceses', null, {});
  }
};
