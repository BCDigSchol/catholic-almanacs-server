'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('almanacRecords', {
      ID:{
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      instID: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      instName: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: '(name not recorded)'
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      instType: {
        type: Sequelize.STRING,
        allowNull: true
      },
      language: {
        type: Sequelize.STRING,
        allowNull: true
      },
      instNote: {
        type: Sequelize.STRING(1024),
        allowNull: true
      },
      placeName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      region: {
        type: Sequelize.STRING,
        allowNull: true
      },
      countyOrig: {
        type: Sequelize.STRING,
        allowNull: true
      },
      countyReg: {
        type: Sequelize.STRING,
        allowNull: true
      },
      cityOrig: {
        type: Sequelize.STRING,
        allowNull: true
      },
      cityReg: {
        type: Sequelize.STRING,
        allowNull: true
      },
      stateOrig: {
        type: Sequelize.STRING,
        allowNull: true
      },
      stateReg: {
        type: Sequelize.STRING,
        allowNull: true
      },
      latitude: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      longitude: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      memberType: {
        type: Sequelize.STRING,
        allowNull: true
      },
      member: {
        type: Sequelize.STRING,
        allowNull: true
      },
      affiliated: {
        type: Sequelize.STRING,
        allowNull: true
      },
      diocese: {
        type: Sequelize.STRING,
        allowNull: true
      },
      diocese_reg: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: true,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: true,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('almanacRecords', ['instID'], {
      name: 'almanacRecords_instID_index',
    });
    await queryInterface.addIndex('almanacRecords', ['instName'], {
      name: 'almanacRecords_instName_index',
    });
    await queryInterface.addIndex('almanacRecords', ['year'], {
      name: 'almanacRecords_instYear_index',
    });
    await queryInterface.addIndex('almanacRecords', ['year', 'instID'], {
      name: 'almanacRecords_instYear_instID_index',
    });
    await queryInterface.addIndex('almanacRecords', ['ID'], {
      name: 'almanacRecords_ID_index',
    });
    await queryInterface.addIndex('almanacRecords', ['instType'], {
      name: 'almanacRecords_instType_index',
    });
    await queryInterface.addIndex('almanacRecords', ['year', 'instType'], {
      name: 'almanacRecords_instYear_instType_index',
    });
    await queryInterface.addIndex('almanacRecords', ['year', 'instName'], {
      name: 'almanacRecords_instYear_instName_index',
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('almanacRecords', 'almanacRecords_instID_index');
    await queryInterface.removeIndex('almanacRecords', 'almanacRecords_instName_index');
    await queryInterface.removeIndex('almanacRecords', 'almanacRecords_year_index');
    await queryInterface.removeIndex('almanacRecords', 'almanacRecords_year_instID_index');
    await queryInterface.removeIndex('almanacRecords', 'almanacRecords_ID_index');
    await queryInterface.removeIndex('almanacRecords', 'almanacRecords_instType_index');
    await queryInterface.removeIndex('almanacRecords', 'almanacRecords_year_instType_index');
    await queryInterface.removeIndex('almanacRecords', 'almanacRecords_year_instName_index');
    await queryInterface.dropTable('almanacRecords');
  }
};