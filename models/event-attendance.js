import { DataTypes } from 'sequelize';

export default function defineEventAttendance(sequelize) {
  return sequelize.define('EventAttendance', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false, field: 'event_id' },
    playerId: { type: DataTypes.INTEGER, allowNull: false, field: 'player_id' },
    gameTableId: { type: DataTypes.INTEGER, allowNull: true, field: 'game_table_id' },
    tableNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'table_number',
      validate: { min: 1, max: 8 },
    },
    gameId: { type: DataTypes.INTEGER, allowNull: true, field: 'game_id' },
    gameName: { type: DataTypes.STRING(255), allowNull: false, field: 'game_name' },
    attended: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, {
    tableName: 'event_attendance',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    indexes: [{ unique: true, fields: ['event_id', 'player_id'] }],
  });
}
