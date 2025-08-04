'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class dioceseInfo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      dioceseInfo.belongsTo(models.diocese, { foreignKey: 'diocese', as: 'dioceseDetails' });
    }
  }
  dioceseInfo.init({
    diocese: DataTypes.STRING,
    year: DataTypes.INTEGER,
    dioceseInfo: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'dioceseInfo',
    indexes: [
      {
        fields: ['diocese', 'year'],
        unique: true
      }
    ]
  });
  return dioceseInfo;
};