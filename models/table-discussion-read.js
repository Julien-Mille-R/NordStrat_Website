import { DataTypes } from 'sequelize';

export default function defineTableDiscussionRead(sequelize) {
  return sequelize.define('TableDiscussionRead', {
    gameTableId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      field: 'game_table_id',
    },
    playerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      field: 'player_id',
    },
    lastReadAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_read_at',
    },
  }, {
    tableName: 'table_discussion_read',
    underscored: true,
    timestamps: false,
    indexes: [{ fields: ['player_id'] }],
  });
}
