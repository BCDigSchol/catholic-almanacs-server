'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      order: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
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
    await queryInterface.addIndex('orders', ['order'], {
      unique: true
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('orders', ['order']);
    await queryInterface.dropTable('orders');
  }
};