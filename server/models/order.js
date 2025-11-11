'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class order extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      order.belongsToMany(models.almanacRecord, {through: models.orderInAlmanacRecord, foreignKey: 'order', as: 'almanacRecordOrder'});
    }
  }
  order.init({
    order: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'order',
    indexes: [
      {
        fields: ['order'],
        unique: true
      }
    ]
  });
  return order;
};