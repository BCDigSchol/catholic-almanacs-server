'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('churches', {
      instID: {
        type: Sequelize.STRING,
        allowNull: false,
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

    await queryInterface.addIndex('churches', ['instID'], {
      name: 'churches_instID_index',
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('churches', 'churches_instID_index');
    await queryInterface.dropTable('churches');
  }
};