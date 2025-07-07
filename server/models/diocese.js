'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class diocese extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      diocese.hasMany(models.almanacRecord, { foreignKey: 'diocese_reg', as: 'almanacRecords' });
    }
  }
  diocese.init({
    diocese: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    }
  }, {
    sequelize,
    modelName: 'diocese',
    indexes: [
      {
        fields: ['diocese'],
        unique: true
      }
    ]
  });
  return diocese;
};