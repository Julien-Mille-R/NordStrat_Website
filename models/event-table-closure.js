import { DataTypes } from 'sequelize';

export default function defineEventTableClosure(sequelize) {
  return sequelize.define('EventTableClosure', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false, field: 'event_id' },
    tableNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'table_number',
      validate: { min: 1, max: 8 },
    },
    closedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'closed_by' },
  }, {
    tableName: 'event_table_closure',
    underscored: true,
    timestamps: true,
    indexes: [{ unique: true, fields: ['event_id', 'table_number'] }],
  });
}
