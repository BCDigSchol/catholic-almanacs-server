'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class orderInAlmanacRecord extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      orderInAlmanacRecord.belongsTo(models.order, { foreignKey: 'order', as: 'orderInfo' });
      orderInAlmanacRecord.belongsTo(models.almanacRecord, { foreignKey: 'almanacRecordID', as: 'almanacRecordInfo' });
    }
  }
  orderInAlmanacRecord.init({
    order: {
      type: DataTypes.STRING,
      allowNull: false
    },
    almanacRecordID: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'orderInAlmanacRecord',
    indexes: [
      {
        fields: ['order', 'almanacRecordID'],
        unique: true
      }
    ]
  });
  return orderInAlmanacRecord;
};