import { DataTypes } from 'sequelize';

export default function definePublicEvent(sequelize) {
  return sequelize.define('PublicEvent', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(150), allowNull: false },
    slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    eventDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'event_date' },
    eventEndDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'event_end_date' },
    registrationOpenAt: { type: DataTypes.DATEONLY, allowNull: false, field: 'registration_open_at' },
    registrationCloseAt: { type: DataTypes.DATEONLY, allowNull: false, field: 'registration_close_at' },
    description: { type: DataTypes.TEXT, allowNull: false },
    imageUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'image_url' },
    isVisible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_visible' },
    applicationsEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'applications_enabled',
    },
    createdBy: { type: DataTypes.INTEGER, allowNull: false, field: 'created_by' },
  }, {
    tableName: 'public_event',
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['slug'] },
      { fields: ['is_visible', 'event_date'] },
    ],
    validate: {
      datesAreCoherent() {
        if (this.eventDate > this.eventEndDate
          || this.registrationOpenAt > this.registrationCloseAt
          || this.registrationCloseAt >= this.eventDate) {
          throw new Error("La période d'inscription doit précéder l'événement.");
        }
      },
    },
  });
}
