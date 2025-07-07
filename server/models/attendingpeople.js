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
      attendingPeople.belongsTo(models.almanacRecord, {foreignKey: 'almanacRecordID', as: 'almanacRecord'});
    }
  }
  attendingPeople.init({
    attendingPersID: DataTypes.STRING,
    almanacRecordID: DataTypes.STRING
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