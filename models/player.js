import { DataTypes } from 'sequelize';

export default function definePlayer(sequelize) {
  return sequelize.define('Player', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    firstname: { type: DataTypes.STRING(100), allowNull: false },
    lastname: { type: DataTypes.STRING(100), allowNull: false },
    nickname: { type: DataTypes.STRING(50), allowNull: true },
    avatarUrl: { type: DataTypes.TEXT, allowNull: true, field: 'avatar_url' },
    biography: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: { len: [0, 500] },
    },
    isProfilePublic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_profile_public',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
      set(value) {
        this.setDataValue('email', value?.trim().toLowerCase());
      },
    },
    password: { type: DataTypes.STRING(255), allowNull: false },
    roleId: { type: DataTypes.INTEGER, allowNull: false, field: 'role_id' },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    moderationStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'active',
      field: 'moderation_status',
      validate: { isIn: [['active', 'temporarily_suspended', 'permanently_suspended', 'deleted']] },
    },
    suspendedUntil: { type: DataTypes.DATE, allowNull: true, field: 'suspended_until' },
    moderationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'moderation_reason',
      validate: { len: [5, 500] },
    },
    moderatedAt: { type: DataTypes.DATE, allowNull: true, field: 'moderated_at' },
    moderatedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'moderated_by' },
    membershipExpiresAt: { type: DataTypes.DATE, allowNull: true, field: 'membership_expires_at' },
    acceptedTermsAt: { type: DataTypes.DATE, allowNull: true, field: 'accepted_terms_at' },
    acceptedTermsVersion: { type: DataTypes.STRING(20), allowNull: true, field: 'accepted_terms_version' },
    anonymizedAt: { type: DataTypes.DATE, allowNull: true, field: 'anonymized_at' },
  }, {
    tableName: 'player',
    underscored: true,
    timestamps: true,
    defaultScope: { attributes: { exclude: ['password'] } },
    scopes: { withPassword: { attributes: { include: ['password'] } } },
    indexes: [{ name: 'unique_player_email_lower', unique: true, fields: [sequelize.fn('LOWER', sequelize.col('email'))] }],
    validate: {
      moderationIsCoherent() {
        if (this.moderationStatus === 'active' && (!this.isActive || this.suspendedUntil)) {
          throw new Error('Un compte actif ne peut pas avoir de suspension en cours.');
        }
        if (this.moderationStatus === 'temporarily_suspended'
          && (this.isActive || !this.suspendedUntil || !this.moderationReason || !this.moderatedBy)) {
          throw new Error('La suspension temporaire est incomplète.');
        }
        if (this.moderationStatus === 'permanently_suspended'
          && (this.isActive || this.suspendedUntil || !this.moderationReason || !this.moderatedBy)) {
          throw new Error('La suspension définitive est incomplète.');
        }
        if (this.moderationStatus === 'deleted' && (this.isActive || !this.anonymizedAt)) {
          throw new Error('Un compte supprimé doit être inactif et anonymisé.');
        }
        if (this.moderationStatus !== 'deleted' && this.anonymizedAt) {
          throw new Error('Un compte actif ou suspendu ne peut pas être anonymisé.');
        }
      },
    },
  });
}
