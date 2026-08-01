import { DataTypes } from 'sequelize';

export const AUDIT_CATEGORIES = [
  'game_tables',
  'members',
  'memberships',
  'news',
  'public_events',
];

export default function defineAuditLog(sequelize) {
  return sequelize.define('AuditLog', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    adminId: { type: DataTypes.INTEGER, allowNull: true, field: 'admin_id' },
    adminNickname: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'admin_nickname',
      validate: { len: [1, 100] },
    },
    category: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: { isIn: [AUDIT_CATEGORIES] },
    },
    action: {
      type: DataTypes.STRING(60),
      allowNull: false,
      validate: { len: [1, 60] },
    },
    targetType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'target_type',
      validate: { len: [1, 50] },
    },
    targetId: { type: DataTypes.STRING(100), allowNull: true, field: 'target_id' },
    targetLabel: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'target_label',
      validate: { len: [1, 255] },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [1, 1000] },
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  }, {
    tableName: 'audit_log',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: false,
    indexes: [
      { fields: ['created_at'] },
      { fields: ['category', 'created_at'] },
      { fields: ['admin_id'] },
    ],
  });
}
