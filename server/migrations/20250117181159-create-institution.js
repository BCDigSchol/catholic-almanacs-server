'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('institutions', {
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

    await queryInterface.addIndex('institutions', ['ID'], {
      unique: true,
      name: 'institutions_ID_index',
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('institutions', 'institutions_ID_index');
    await queryInterface.dropTable('institutions');
  }
};