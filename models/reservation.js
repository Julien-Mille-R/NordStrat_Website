import { DataTypes } from 'sequelize';

export default function defineReservation(sequelize) {
  return sequelize.define('Reservation', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    playerId: { type: DataTypes.INTEGER, allowNull: false, field: 'player_id' },
    gameTableId: { type: DataTypes.INTEGER, allowNull: false, field: 'game_table_id' },
    eventId: { type: DataTypes.INTEGER, allowNull: false, field: 'event_id' },
    status: {
      type: DataTypes.ENUM('confirmed', 'cancelled'),
      allowNull: false,
      defaultValue: 'confirmed',
    },
    cancelledAt: { type: DataTypes.DATE, allowNull: true, field: 'cancelled_at' },
  }, {
    tableName: 'reservation',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        name: 'unique_active_player_per_event',
        unique: true,
        fields: ['player_id', 'event_id'],
        where: { status: 'confirmed' },
      },
      {
        name: 'idx_active_reservation_game_table',
        fields: ['game_table_id'],
        where: { status: 'confirmed' },
      },
    ],
    validate: {
      cancelledDateMatchesStatus() {
        const valid = this.status === 'cancelled'
          ? this.cancelledAt != null
          : this.cancelledAt == null;

        if (!valid) {
          throw new Error("La date d'annulation doit correspondre au statut de la réservation.");
        }
      },
    },
  });
}
