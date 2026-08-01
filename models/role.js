import { DataTypes } from 'sequelize';

export default function defineRole(sequelize) {
  return sequelize.define('Role', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  }, {
    tableName: 'role',
    underscored: true,
    timestamps: true,
  });
}
