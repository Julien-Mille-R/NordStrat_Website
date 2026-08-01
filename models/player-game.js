import { DataTypes } from 'sequelize';

export default function definePlayerGame(sequelize) {
  return sequelize.define('PlayerGame', {
    playerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      field: 'player_id',
    },
    gameId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      field: 'game_id',
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 3 },
    },
  }, {
    tableName: 'player_game',
    underscored: true,
    timestamps: true,
    indexes: [{ unique: true, fields: ['player_id', 'position'] }],
  });
}
