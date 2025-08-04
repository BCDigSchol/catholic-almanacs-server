'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('dioceseInfos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      diocese: {
        type: Sequelize.STRING,
      },
      year: {
        type: Sequelize.INTEGER
      },
      dioceseInfo: {
        type: Sequelize.TEXT
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
    await queryInterface.addIndex('dioceseInfos', ['diocese', 'year'], {
      unique: true,
      name: 'diocese_year_unique_index'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('dioceseInfos');
    await queryInterface.removeIndex('dioceseInfos', 'diocese_year_unique_index');
  }
};