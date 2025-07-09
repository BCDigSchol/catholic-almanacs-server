'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class attendingPeople extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      attendingPeople.belongsTo(models.person, {foreignKey: 'attendingPersID', as: 'attendingPerson'});
      attendingPeople.belongsTo(models.almanacRecord, {foreignKey: 'almanacRecordID', as: 'attendingAlmanacRecord'});
    }
  }
  attendingPeople.init({
    attendingPersID: {
      type: DataTypes.STRING,
      allowNull: false
    },
    almanacRecordID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    name: DataTypes.STRING,
    title: DataTypes.STRING,
    suffix: DataTypes.STRING,
    role: DataTypes.STRING,
    note: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'attendingPeople',
    indexes: [
      {
        unique: true,
        fields: ['attendingPersID', 'almanacRecordID']
      }
    ]
  });
  return attendingPeople;
};