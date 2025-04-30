'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class personInAlmanacRecord extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      personInAlmanacRecord.belongsTo(models.almanacRecord, { foreignKey: 'almanacRecordID', as: 'institution'});
      personInAlmanacRecord.belongsTo(models.person, { foreignKey: 'persID', as: 'person'});
    }
  }
  personInAlmanacRecord.init({
    almanacRecordID: DataTypes.STRING,
    persID: DataTypes.STRING,
    name: DataTypes.STRING,
    title: DataTypes.STRING,
    suffix: DataTypes.STRING,
    note: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'personInAlmanacRecord',
    indexes: [
      {
        unique: true,
        fields: ['almanacRecordID', 'persID'],
      },
      {
        fields: ['name'],
      },
      {
        fields: ['persID'],
      }
    ]
    }
  );
  return personInAlmanacRecord;
};