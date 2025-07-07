'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('attendingPeople', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      attendingPersID: {
        type: Sequelize.STRING
      },
      almanacRecordID: {
        type: Sequelize.STRING
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

    await queryInterface.addIndex('attendingPeople', {
      unique: true,
      fields: ['attendingPersID', 'almanacRecordID']
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('attendingPeople');
    await queryInterface.removeIndex('attendingPeople', ['attendingPersID', 'almanacRecordID']);
  }
};