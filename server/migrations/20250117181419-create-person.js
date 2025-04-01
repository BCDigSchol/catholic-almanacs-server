'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('people', {
      persID: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
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

    await queryInterface.addIndex('people', ['persID'], {
      unique: true,
      name: 'idx_people_persID'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('people', 'idx_people_persID');
    await queryInterface.dropTable('people');
  }
};