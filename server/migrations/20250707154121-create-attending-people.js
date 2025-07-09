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
        type: Sequelize.STRING,
        allowNull: false
      },
      almanacRecordID: {
        type: Sequelize.STRING,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: true
      },
      suffix: {
        type: Sequelize.STRING,
        allowNull: true
      },
      role: {
        type: Sequelize.STRING,
        allowNull: true
      },
      note: {
        type: Sequelize.STRING,
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