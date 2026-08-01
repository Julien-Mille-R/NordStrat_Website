import { DataTypes } from 'sequelize';

export default function defineGameTable(sequelize) {
  return sequelize.define('GameTable', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false, field: 'event_id' },
    tableNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'table_number',
      validate: { min: 1, max: 8 },
    },
    gameId: { type: DataTypes.INTEGER, allowNull: false, field: 'game_id' },
    maxPlayers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      field: 'max_players',
      validate: { min: 1, max: 10 },
    },
    status: {
      type: DataTypes.ENUM('open', 'closed', 'cancelled'),
      allowNull: false,
      defaultValue: 'open',
    },
    hostPlayerId: { type: DataTypes.INTEGER, allowNull: false, field: 'host_player_id' },
  }, {
    tableName: 'game_table',
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['event_id', 'table_number'] },
      { unique: true, fields: ['id', 'event_id'] },
    ],
  });
}
