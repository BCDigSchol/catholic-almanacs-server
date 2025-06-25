'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class relatedInstitutions extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      relatedInstitutions.belongsTo(models.institution, {foreignKey: 'firstID', as: 'firstInstitution'});
      relatedInstitutions.belongsTo(models.institution, {foreignKey: 'secondID', as: 'secondInstitution'});
      relatedInstitutions.belongsTo(models.almanacRecord, {foreignKey: 'almanacRecordID', as: 'almanacRecord'});
    }
  }
  relatedInstitutions.init({
    almanacRecordID: DataTypes.STRING,
    firstID: DataTypes.STRING,
    secondID: DataTypes.STRING,
    isSibling: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'relatedInstitutions',
    indexes: [
      {
        unique: true,
        fields: ['almanacRecordID', 'firstID', 'secondID']
      },
      {
        fields: ['almanacRecordID']
      },
      {
        fields: ['firstID']
      },
      {
        fields: ['secondID']
      }
    ]
  });
  return relatedInstitutions;
};