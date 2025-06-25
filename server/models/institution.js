// The "ground truth" (immutable property) of a institution: instID

'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class institution extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      institution.hasMany(models.almanacRecord, { foreignKey: 'instID', as: 'almanacRecord' });
      institution.hasMany(models.relatedInstitutions, { foreignKey: 'firstID', as: 'relatedFirst' });
      institution.hasMany(models.relatedInstitutions, { foreignKey: 'secondID', as: 'relatedSecond' });
    }
  }
  institution.init({
    ID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'institution',
    indexes: [
      {
        fields:['ID'],
        unique: true
      }
    ]
  });
  return institution;
};