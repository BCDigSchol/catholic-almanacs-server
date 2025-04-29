'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('people', {
      ID: {
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

    await queryInterface.addIndex('people', ['ID'], {
      unique: true,
      name: 'idx_people_ID'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('people', 'idx_people_ID');
    await queryInterface.dropTable('people');
  }
};