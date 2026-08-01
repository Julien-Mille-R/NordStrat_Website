import { DataTypes } from 'sequelize';

export default function defineGame(sequelize) {
  return sequelize.define('Game', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    universe: { type: DataTypes.STRING(100), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    minPlayers: { type: DataTypes.INTEGER, allowNull: true, field: 'min_players', validate: { min: 1 } },
    maxPlayers: { type: DataTypes.INTEGER, allowNull: true, field: 'max_players', validate: { min: 1 } },
    imageUrl: { type: DataTypes.TEXT, allowNull: true, field: 'image_url' },
    isAvailable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_available' },
  }, {
    tableName: 'game',
    underscored: true,
    timestamps: true,
    indexes: [{
      name: 'unique_game_name_lower',
      unique: true,
      fields: [sequelize.fn('LOWER', sequelize.col('name'))],
    }],
    validate: {
      validPlayerRange() {
        const bothEmpty = this.minPlayers == null && this.maxPlayers == null;
        const validRange = this.minPlayers != null
          && this.maxPlayers != null
          && this.maxPlayers >= this.minPlayers;

        if (!bothEmpty && !validRange) {
          throw new Error('Les nombres minimum et maximum de joueurs doivent être cohérents.');
        }
      },
    },
  });
}
