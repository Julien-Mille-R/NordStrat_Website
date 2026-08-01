import { DataTypes } from 'sequelize';

export default function defineContactMessage(sequelize) {
  return sequelize.define('ContactMessage', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    playerId: { type: DataTypes.INTEGER, allowNull: true, field: 'player_id' },
    authorName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'author_name',
      validate: { len: [2, 100] },
    },
    email: { type: DataTypes.STRING(255), allowNull: false, validate: { isEmail: true } },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
      validate: { len: [6, 30] },
    },
    subject: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: { len: [3, 150] },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [20, 5000] },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'unread',
      validate: { isIn: [['unread', 'read', 'archived']] },
    },
    readAt: { type: DataTypes.DATE, allowNull: true, field: 'read_at' },
    readBy: { type: DataTypes.INTEGER, allowNull: true, field: 'read_by' },
  }, {
    tableName: 'contact_message',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['status', 'created_at'] },
      { fields: ['player_id'] },
      { fields: ['read_by'] },
    ],
    validate: {
      readingStateIsCoherent() {
        const isUnread = this.status === 'unread';
        const hasAnyReadingData = Boolean(this.readAt || this.readBy);
        const hasAllReadingData = Boolean(this.readAt && this.readBy);
        if ((isUnread && hasAnyReadingData) || (!isUnread && !hasAllReadingData)) {
          throw new Error('L’état de lecture du message est incohérent.');
        }
      },
    },
  });
}
