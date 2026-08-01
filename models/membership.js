import { DataTypes } from 'sequelize';

export default function defineMembership(sequelize) {
  return sequelize.define('Membership', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    playerId: { type: DataTypes.INTEGER, allowNull: false, field: 'player_id' },
    seasonStart: { type: DataTypes.DATEONLY, allowNull: false, field: 'season_start' },
    seasonEnd: { type: DataTypes.DATEONLY, allowNull: false, field: 'season_end' },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'unpaid',
      validate: { isIn: [['unpaid', 'paid', 'exempted', 'cancelled']] },
    },
    paidAt: { type: DataTypes.DATE, allowNull: true, field: 'paid_at' },
    amountCents: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'amount_cents',
      validate: { min: 0 },
    },
    paymentMethod: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: 'payment_method',
      validate: { isIn: [['cash', 'check', 'bank_transfer', 'card', 'other']] },
    },
    source: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'manual',
      validate: { isIn: [['manual', 'bank_transfer']] },
    },
    externalReference: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      field: 'external_reference',
    },
    recordedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'recorded_by' },
  }, {
    tableName: 'membership',
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['player_id', 'season_start'] },
      { fields: ['season_start', 'status'] },
      { fields: ['recorded_by'] },
    ],
    validate: {
      paymentDetailsMatchStatus() {
        const hasPaymentDetails = Boolean(this.paidAt && this.paymentMethod);
        const hasNoPaymentDetails = !this.paidAt && !this.paymentMethod;
        if ((this.status === 'paid' && !hasPaymentDetails)
          || (this.status !== 'paid' && !hasNoPaymentDetails)) {
          throw new Error('La date et le mode de paiement doivent correspondre au statut payé.');
        }
      },
    },
  });
}
