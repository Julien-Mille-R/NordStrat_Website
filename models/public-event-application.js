import { DataTypes } from 'sequelize';

export default function definePublicEventApplication(sequelize) {
  return sequelize.define('PublicEventApplication', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    publicEventId: { type: DataTypes.INTEGER, allowNull: false, field: 'public_event_id' },
    playerId: { type: DataTypes.INTEGER, allowNull: true, field: 'player_id' },
    applicationType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'application_type',
      validate: { isIn: [['partner', 'vendor', 'volunteer']] },
    },
    contactName: { type: DataTypes.STRING(120), allowNull: false, field: 'contact_name' },
    organizationName: { type: DataTypes.STRING(150), allowNull: true, field: 'organization_name' },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { isEmail: true },
      set(value) {
        this.setDataValue('email', value?.trim().toLowerCase());
      },
    },
    phone: { type: DataTypes.STRING(30), allowNull: true },
    participantCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'participant_count',
      validate: { min: 1, max: 100 },
    },
    presentSaturday: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'present_saturday',
    },
    presentSunday: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'present_sunday',
    },
    tableCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'table_count',
      validate: { min: 0, max: 6 },
    },
    chairCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'chair_count',
      validate: { min: 0, max: 500 },
    },
    needsElectricity: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'needs_electricity',
    },
    powerOutletCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'power_outlet_count',
      validate: { min: 0, max: 50 },
    },
    needsWater: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'needs_water',
    },
    spaceLength: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'space_length',
      validate: { min: 2, max: 6 },
    },
    // Conservé temporairement pour pouvoir consulter les anciennes inscriptions.
    spaceDetails: { type: DataTypes.TEXT, allowNull: true, field: 'space_details' },
    websiteUrl: { type: DataTypes.TEXT, allowNull: true, field: 'website_url' },
    socialUrl1: { type: DataTypes.TEXT, allowNull: true, field: 'social_url_1' },
    socialUrl2: { type: DataTypes.TEXT, allowNull: true, field: 'social_url_2' },
    volunteerTasks: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'volunteer_tasks',
    },
    description: { type: DataTypes.TEXT, allowNull: false },
    availability: { type: DataTypes.TEXT, allowNull: true },
    needs: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'new',
      validate: { isIn: [['new', 'reviewing', 'accepted', 'waitlisted', 'rejected', 'withdrawn']] },
    },
    reviewedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'reviewed_by' },
    reviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
    adminNotes: { type: DataTypes.TEXT, allowNull: true, field: 'admin_notes' },
    withdrawalReason: { type: DataTypes.TEXT, allowNull: true, field: 'withdrawal_reason' },
    withdrawnAt: { type: DataTypes.DATE, allowNull: true, field: 'withdrawn_at' },
  }, {
    tableName: 'public_event_application',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['public_event_id', 'application_type', 'status'] },
      { fields: ['player_id'] },
      { fields: ['email'] },
    ],
    validate: {
      applicationDetailsMatchType() {
        if (['partner', 'vendor'].includes(this.applicationType) && !this.organizationName) {
          throw new Error('Une demande partenaire ou vendeur doit indiquer une structure.');
        }
        if (['partner', 'vendor'].includes(this.applicationType) && !this.spaceLength) {
          throw new Error('Une demande partenaire ou vendeur doit indiquer une longueur d’emplacement.');
        }
        if (!this.presentSaturday && !this.presentSunday) {
          throw new Error('Au moins un jour de présence doit être sélectionné.');
        }
        if (!Array.isArray(this.volunteerTasks)) {
          throw new Error('La liste des missions bénévoles est invalide.');
        }
      },
      reviewIsCoherent() {
        const isNew = this.status === 'new';
        const isWithdrawn = this.status === 'withdrawn';
        if (isNew && (this.reviewedBy || this.reviewedAt)) {
          throw new Error('Une nouvelle demande ne peut pas être marquée comme traitée.');
        }
        if (!isNew && !isWithdrawn && (!this.reviewedBy || !this.reviewedAt)) {
          throw new Error('Le suivi administratif est incomplet.');
        }
        if (isWithdrawn !== Boolean(this.withdrawnAt)) {
          throw new Error('Les informations de désistement sont incohérentes.');
        }
      },
    },
  });
}
