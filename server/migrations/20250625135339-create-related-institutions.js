'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('relatedInstitutions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      almanacRecordID: {
        type: Sequelize.STRING
      },
      firstID: {
        type: Sequelize.STRING
      },
      secondID: {
        type: Sequelize.STRING
      },
      isSibling: {
        type: Sequelize.BOOLEAN
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

    await queryInterface.addIndex('relatedInstitutions', {
      unique: true,
      fields: ['almanacRecordID', 'firstID', 'secondID'],
      name: 'unique_related_institutions_index'
    });
    await queryInterface.addIndex('relatedInstitutions', {
      fields: ['almanacRecordID'],
      name: 'almanac_record_id_index'
    });
    await queryInterface.addIndex('relatedInstitutions', {
      fields: ['firstID'],
      name: 'first_id_index'
    });
    await queryInterface.addIndex('relatedInstitutions', {
      fields: ['secondID'],
      name: 'second_id_index'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('relatedInstitutions');
    await queryInterface.removeIndex('relatedInstitutions', 'unique_related_institutions_index');
    await queryInterface.removeIndex('relatedInstitutions', 'almanac_record_id_index');
    await queryInterface.removeIndex('relatedInstitutions', 'first_id_index');
    await queryInterface.removeIndex('relatedInstitutions', 'second_id_index');
  }
};