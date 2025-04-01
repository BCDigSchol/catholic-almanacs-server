'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('personInYears', {
      persID: {
        type: Sequelize.STRING
      },
      uniquePersID: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      },
      persName: {
        type: Sequelize.STRING
      },
      persNote: {
        type: Sequelize.STRING
      },
      persTitle: {
        type: Sequelize.STRING
      },
      persSuffix: {
        type: Sequelize.STRING
      },
      persYear: {
        type: Sequelize.INTEGER
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

    await queryInterface.addIndex('personInYears', ['persID'], {
      name: 'idx_personInYears_persID'
    });
    await queryInterface.addIndex('personInYears', ['uniquePersID'], {
      name: 'idx_personInYears_uniquePersID'
    });
    await queryInterface.addIndex('personInYears', ['persName'], {
      name: 'idx_personInYears_persName'
    });
    await queryInterface.addIndex('personInYears', ['persYear'], {
      name: 'idx_personInYears_persYear'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('personInYears', 'idx_personInYears_persID');
    await queryInterface.removeIndex('personInYears', 'idx_personInYears_uniquePersID');
    await queryInterface.removeIndex('personInYears', 'idx_personInYears_persName');
    await queryInterface.removeIndex('personInYears', 'idx_personInYears_persYear');
    await queryInterface.dropTable('personInYears');
  }
};