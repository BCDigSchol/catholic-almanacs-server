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
    await queryInterface.addConstraint('dioceseInfos', {
      fields: ['diocese', 'year'],
      type: 'unique',
      name: 'diocese_year_unique_index'
    });
    await queryInterface.addIndex('dioceseInfos', ['diocese'], {
      name: 'diocese_index'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('dioceseInfos', 'diocese_year_unique_index');
    await queryInterface.removeIndex('dioceseInfos', 'diocese_index');
    await queryInterface.dropTable('dioceseInfos');
  }
};