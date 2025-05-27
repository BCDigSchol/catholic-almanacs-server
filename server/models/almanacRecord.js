// church in a year

'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class almanacRecord extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      almanacRecord.belongsToMany(models.person, { through: models.personInAlmanacRecord, foreignKey: 'almanacRecordID', as: 'personInfo' });
      almanacRecord.belongsToMany(models.almanacRecord, { through: models.attendingInstitution, foreignKey: 'attendedInstRecordID', as: 'attendedBy'});
      almanacRecord.belongsToMany(models.almanacRecord, { through: models.attendingInstitution, foreignKey: 'attendingInstRecordID', as: 'attendingInstitutions'});
      almanacRecord.belongsTo(models.institution, { foreignKey: 'instID', as: 'institution' });
    }
  }
  almanacRecord.init({
    ID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    },
    instID: DataTypes.STRING,
    instName: DataTypes.STRING,
    instType: DataTypes.STRING,
    language: DataTypes.STRING,
    instNote: {
      type: DataTypes.STRING(1024),
    },
    year: DataTypes.INTEGER,
    placeName: DataTypes.STRING,
    region: DataTypes.STRING,
    countyOrig: DataTypes.STRING,
    countyReg: DataTypes.STRING,
    cityOrig: DataTypes.STRING,
    cityReg: DataTypes.STRING,
    stateOrig: DataTypes.STRING,
    stateReg: DataTypes.STRING,
    latitude: DataTypes.DOUBLE,
    longitude: DataTypes.DOUBLE,
    memberType: DataTypes.STRING,
    member: DataTypes.STRING,
    affiliated: DataTypes.STRING,
    diocese: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'almanacRecord',
    indexes:[
      {
        fields: ['ID'],
      },
      {
        fields: ['instID'],
      },
      {
        fields: ['instName'],
      },
      {
        fields: ['instYear'],
      },
      {
        fields: ['instYear', 'instID'],
      }
    ]
  });
  return almanacRecord;
};