'use strict';

// Add almanacRecords.attendingFrequency to hold an "orphan" attendance frequency:
// the almanac records that a church is attended at some cadence (source column R,
// attendingChurchFrequency) WITHOUT naming the attending church (columns P/Q,
// attendingInstID/attendingChurch). ~1,200 rows (1834–1870) are like this. The
// attendingInstitution join needs both record ids, so those frequencies had
// nowhere to live and were dropped at seed time; this column keeps them on the
// attended church's own record.

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('almanacRecords', 'attendingFrequency', {
      type: Sequelize.STRING,   // inherits the table's utf8mb4 charset
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('almanacRecords', 'attendingFrequency');
  }
};
