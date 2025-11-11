'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('dioceses', {
      diocese: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING,
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
    await queryInterface.addIndex('dioceses', ['diocese'], {
      unique: true,
      name: 'dioceses_diocese_index'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('dioceses', 'dioceses_diocese_index');
    await queryInterface.dropTable('dioceses');
  }
};