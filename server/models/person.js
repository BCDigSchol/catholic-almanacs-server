'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class person extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      person.belongsToMany(models.almanacRecord, { through: models.personInAlmanacRecord, foreignKey: 'persID', as: 'almanacRecords' });
  }
}
  person.init({
    ID: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true
    }
  }, {
    sequelize,
    modelName: 'person',
    indexes: [
      {
        fields: ['ID'],
        unique: true
      }
    ]
  });
  return person;
};