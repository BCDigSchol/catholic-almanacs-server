'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('personInAlmanacRecords', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      almanacRecordID: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      persID: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: '(name not recorded)'
      },
      title: {
        type: Sequelize.STRING,
        allowNull: true
      },
      suffix: {
        type: Sequelize.STRING,
        allowNull: true
      },
      note: {
        type: Sequelize.STRING(1024),
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addConstraint('personInAlmanacRecords', {
      fields: ['almanacRecordID', 'persID'],
      type: 'unique',
      name: 'unique_personInAlmanacRecord_constraint'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('personInAlmanacRecords');
  }
};