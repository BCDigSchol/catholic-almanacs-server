'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orderInAlmanacRecords', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      order: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      almanacRecordID: {
        type: Sequelize.STRING,
        allowNull: false
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
    await queryInterface.addIndex('orderInAlmanacRecords', ['order', 'almanacRecordID'], {
      unique: true,
      name: 'unique_order_almanac_record'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('orderInAlmanacRecords');
    await queryInterface.removeIndex('orderInAlmanacRecords', 'unique_order_almanac_record');
  }
};