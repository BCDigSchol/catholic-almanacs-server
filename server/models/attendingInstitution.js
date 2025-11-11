//attendingInstitution middle table

'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class attendingInstitution extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      attendingInstitution.belongsTo(models.almanacRecord, { foreignKey: 'attendingInstRecordID', as: 'institution'});
      attendingInstitution.belongsTo(models.almanacRecord, { foreignKey: 'attendedInstRecordID', as: 'small_institution' });
    }
  }
  attendingInstitution.init({
    attendedInstRecordID: DataTypes.STRING,
    attendingInstRecordID: DataTypes.STRING,
    attendingInstName: DataTypes.STRING,
    attendingFrequency: DataTypes.STRING,
    note: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'attendingInstitution',
    indexes: [
      {
        unique: true,
        fields: ['attendedInstRecordID', 'attendingInstRecordID'],
      },
      {
        fields: ['attendedInstRecordID'],
        unique: true,
      },
      {
        fields: ['attendingInstRecordID'],
      }
    ]
  });
  return attendingInstitution;
};