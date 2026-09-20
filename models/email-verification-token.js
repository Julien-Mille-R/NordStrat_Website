import { DataTypes } from 'sequelize';

export default function defineEmailVerificationToken(sequelize) {
  return sequelize.define('EmailVerificationToken', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    playerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'player_id',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    tokenHash: {
      type: DataTypes.CHAR(64),
      allowNull: false,
      unique: true,
      field: 'token_hash',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'used_at',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'email_verification_token',
    underscored: true,
    timestamps: false,
    indexes: [
      { fields: ['player_id'] },
      { fields: ['expires_at'] },
    ],
  });
}