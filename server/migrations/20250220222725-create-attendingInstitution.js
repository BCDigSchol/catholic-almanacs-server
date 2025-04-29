'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('attendingInstitutions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      attendedInstRecordID: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      attendingInstRecordID: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      attendingInstName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      attendingFrequency: {
        type: Sequelize.STRING,
        allowNull: true
      },
      note: {
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

    await queryInterface.addConstraint('attendingInstitutions', {
      fields: ['attendedInstRecordID', 'attendingInstRecordID'],
      type: 'unique',
      name: 'unique_attendingInstitution_constraint'
    });

    await queryInterface.addIndex('attendingInstitutions', ['attendedInstRecordID'], {
      name: 'attendingInstitutions_attendedInstRecordID_index',
    });
    await queryInterface.addIndex('attendingInstitutions', ['attendingInstRecordID'], {
      name: 'attendingInstitutions_attendingInstRecordID_index',
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropIndex('attendingInstitutions', 'attendingInstitutions_attendedInstRecordID_index');
    await queryInterface.dropIndex('attendingInstitutions', 'attendingInstitutions_attendingInstRecordID_index');
    await queryInterface.dropTable('attendingInstitutions');
  }
};