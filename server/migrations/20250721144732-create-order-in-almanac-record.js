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
    await queryInterface.addConstraint('orderInAlmanacRecords', {
      fields: ['order', 'almanacRecordID'],
      type: 'unique',
      name: 'unique_order_almanac_record'
    });
    await queryInterface.addIndex('orderInAlmanacRecords', ['order']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('orderInAlmanacRecords', 'unique_order_almanac_record');
    await queryInterface.removeIndex('orderInAlmanacRecords', ['order']);
    await queryInterface.dropTable('orderInAlmanacRecords');
  }
};