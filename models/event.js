import { DataTypes } from 'sequelize';

export default function defineEvent(sequelize) {
  return sequelize.define('Event', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    date: { type: DataTypes.DATE, allowNull: false },
    status: {
      type: DataTypes.ENUM('upcoming', 'ongoing', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'upcoming',
    },
    maxTable: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 8,
      field: 'max_table',
      validate: { min: 1, max: 8 },
    },
    registrationDeadline: { type: DataTypes.DATE, allowNull: false, field: 'registration_deadline' },
    isPaid: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_paid' },
    price: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    reservable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: { type: DataTypes.INTEGER, allowNull: false, field: 'created_by' },
    cancellationReason: { type: DataTypes.TEXT, allowNull: true, field: 'cancellation_reason' },
    cancelledAt: { type: DataTypes.DATE, allowNull: true, field: 'cancelled_at' },
    cancelledBy: { type: DataTypes.INTEGER, allowNull: true, field: 'cancelled_by' },
  }, {
    tableName: 'event',
    underscored: true,
    timestamps: true,
    validate: {
      deadlineBeforeEvent() {
        if (this.registrationDeadline > this.date) {
          throw new Error("La date limite d'inscription doit précéder l'événement.");
        }
      },
      cancellationIsComplete() {
        const cancellationData = [this.cancellationReason, this.cancelledAt, this.cancelledBy];
        const hasAllCancellationData = cancellationData.every((value) => value !== null && value !== undefined);
        const hasNoCancellationData = cancellationData.every((value) => value === null || value === undefined);

        if ((this.status === 'cancelled' && !hasAllCancellationData)
          || (this.status !== 'cancelled' && !hasNoCancellationData)) {
          throw new Error("Les informations d'annulation de l'événement sont incohérentes.");
        }
      },
    },
  });
}
