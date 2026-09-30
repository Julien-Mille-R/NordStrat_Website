import { DataTypes } from 'sequelize';

export default function defineTableGuest(sequelize) {
  return sequelize.define('TableGuest', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    gameTableId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'game_table_id',
    },

    nickname: {
      type: DataTypes.STRING(80),
      allowNull: false,
      validate: {
        len: [1, 80],

        notBlank(value) {
          if (!String(value).trim()) {
            throw new Error('Le nom de l’invité est obligatoire.');
          }
        },
      },
    },
  }, {
    tableName: 'table_guest',
    underscored: true,
    timestamps: true,

    indexes: [
      {
        fields: ['game_table_id'],
      },
      {
        unique: true,
        fields: ['game_table_id', 'nickname'],
      },
    ],
  });
}