import { DataTypes } from 'sequelize';

export default function defineTableComment(sequelize) {
  return sequelize.define('TableComment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    gameTableId: { type: DataTypes.INTEGER, allowNull: false, field: 'game_table_id' },
    playerId: { type: DataTypes.INTEGER, allowNull: false, field: 'player_id' },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [1, 500] },
    },
  }, {
    tableName: 'table_comment',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['game_table_id', 'created_at'] },
      { fields: ['player_id'] },
    ],
  });
}
