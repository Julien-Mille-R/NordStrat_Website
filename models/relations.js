import defineAuditLog from './audit-log.js';
import defineBookingArchive from './booking-archive.js';
import defineContactMessage from './contact-message.js';
import defineEventAttendance from './event-attendance.js';
import defineEventTableClosure from './event-table-closure.js';
import defineEvent from './event.js';
import defineGameTable from './game-table.js';
import defineGame from './game.js';
import defineMembership from './membership.js';
import defineNewsPost from './news-post.js';
import definePlayer from './player.js';
import definePlayerGame from './player-game.js';
import definePublicEventApplication from './public-event-application.js';
import definePublicEvent from './public-event.js';
import defineReservation from './reservation.js';
import defineRole from './role.js';
import defineTableComment from './table-comment.js';
import defineTableDiscussionRead from './table-discussion-read.js';

const initializedModels = new WeakMap();

export function initModels(sequelize) {
  if (initializedModels.has(sequelize)) {
    return initializedModels.get(sequelize);
  }

  const Role = defineRole(sequelize);
  const Player = definePlayer(sequelize);
  const AuditLog = defineAuditLog(sequelize);
  const PlayerGame = definePlayerGame(sequelize);
  const Event = defineEvent(sequelize);
  const Game = defineGame(sequelize);
  const Membership = defineMembership(sequelize);
  const NewsPost = defineNewsPost(sequelize);
  const PublicEvent = definePublicEvent(sequelize);
  const PublicEventApplication = definePublicEventApplication(sequelize);
  const GameTable = defineGameTable(sequelize);
  const Reservation = defineReservation(sequelize);
  const EventAttendance = defineEventAttendance(sequelize);
  const EventTableClosure = defineEventTableClosure(sequelize);
  const BookingArchive = defineBookingArchive(sequelize);
  const ContactMessage = defineContactMessage(sequelize);
  const TableComment = defineTableComment(sequelize);
  const TableDiscussionRead = defineTableDiscussionRead(sequelize);

  Role.hasMany(Player, {
    as: 'players',
    foreignKey: 'roleId',
    onDelete: 'RESTRICT',
  });
  Player.belongsTo(Role, {
    as: 'role',
    foreignKey: 'roleId',
    onDelete: 'RESTRICT',
  });

  Player.hasMany(AuditLog, {
    as: 'adminAuditLogs',
    foreignKey: 'adminId',
    onDelete: 'SET NULL',
  });
  AuditLog.belongsTo(Player, {
    as: 'admin',
    foreignKey: 'adminId',
    onDelete: 'SET NULL',
  });

  Player.hasMany(NewsPost, {
    as: 'newsPosts',
    foreignKey: 'authorId',
    onDelete: 'RESTRICT',
  });
  NewsPost.belongsTo(Player, {
    as: 'author',
    foreignKey: 'authorId',
    onDelete: 'RESTRICT',
  });

  Player.hasMany(PublicEvent, {
    as: 'createdPublicEvents',
    foreignKey: 'createdBy',
    onDelete: 'RESTRICT',
  });
  PublicEvent.belongsTo(Player, {
    as: 'creator',
    foreignKey: 'createdBy',
    onDelete: 'RESTRICT',
  });
  PublicEvent.hasMany(PublicEventApplication, {
    as: 'applications',
    foreignKey: 'publicEventId',
    onDelete: 'CASCADE',
  });
  PublicEventApplication.belongsTo(PublicEvent, {
    as: 'publicEvent',
    foreignKey: 'publicEventId',
    onDelete: 'CASCADE',
  });
  Player.hasMany(PublicEventApplication, {
    as: 'publicEventApplications',
    foreignKey: 'playerId',
    onDelete: 'SET NULL',
  });
  PublicEventApplication.belongsTo(Player, {
    as: 'applicant',
    foreignKey: 'playerId',
    onDelete: 'SET NULL',
  });
  Player.hasMany(PublicEventApplication, {
    as: 'reviewedPublicEventApplications',
    foreignKey: 'reviewedBy',
    onDelete: 'RESTRICT',
  });
  PublicEventApplication.belongsTo(Player, {
    as: 'reviewer',
    foreignKey: 'reviewedBy',
    onDelete: 'RESTRICT',
  });

  Player.hasMany(Player, {
    as: 'moderatedPlayers',
    foreignKey: 'moderatedBy',
    onDelete: 'SET NULL',
  });
  Player.belongsTo(Player, {
    as: 'moderator',
    foreignKey: 'moderatedBy',
    onDelete: 'SET NULL',
  });

  Player.hasMany(ContactMessage, {
    as: 'contactMessages',
    foreignKey: 'playerId',
    onDelete: 'SET NULL',
  });
  ContactMessage.belongsTo(Player, {
    as: 'player',
    foreignKey: 'playerId',
    onDelete: 'SET NULL',
  });
  Player.hasMany(ContactMessage, {
    as: 'readContactMessages',
    foreignKey: 'readBy',
    onDelete: 'RESTRICT',
  });
  ContactMessage.belongsTo(Player, {
    as: 'reader',
    foreignKey: 'readBy',
    onDelete: 'RESTRICT',
  });

  Player.hasMany(Membership, {
    as: 'memberships',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });
  Membership.belongsTo(Player, {
    as: 'player',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });
  Player.hasMany(Membership, {
    as: 'recordedMemberships',
    foreignKey: 'recordedBy',
    onDelete: 'RESTRICT',
  });
  Membership.belongsTo(Player, {
    as: 'recorder',
    foreignKey: 'recordedBy',
    onDelete: 'RESTRICT',
  });

  Player.belongsToMany(Game, {
    as: 'favoriteGames',
    through: PlayerGame,
    foreignKey: 'playerId',
    otherKey: 'gameId',
    onDelete: 'CASCADE',
  });
  Game.belongsToMany(Player, {
    as: 'favoritedByPlayers',
    through: PlayerGame,
    foreignKey: 'gameId',
    otherKey: 'playerId',
    onDelete: 'CASCADE',
  });
  Player.hasMany(PlayerGame, {
    as: 'favoriteGameLinks',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });
  PlayerGame.belongsTo(Player, {
    as: 'player',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });
  Game.hasMany(PlayerGame, {
    as: 'favoritePlayerLinks',
    foreignKey: 'gameId',
    onDelete: 'CASCADE',
  });
  PlayerGame.belongsTo(Game, {
    as: 'game',
    foreignKey: 'gameId',
    onDelete: 'CASCADE',
  });

  Player.hasMany(Event, {
    as: 'createdEvents',
    foreignKey: 'createdBy',
    onDelete: 'RESTRICT',
  });
  Event.belongsTo(Player, {
    as: 'creator',
    foreignKey: 'createdBy',
    onDelete: 'RESTRICT',
  });

  Event.hasMany(EventTableClosure, {
    as: 'tableClosures',
    foreignKey: 'eventId',
    onDelete: 'CASCADE',
  });
  EventTableClosure.belongsTo(Event, {
    as: 'event',
    foreignKey: 'eventId',
    onDelete: 'CASCADE',
  });
  Player.hasMany(EventTableClosure, {
    as: 'closedEventTables',
    foreignKey: 'closedBy',
    onDelete: 'RESTRICT',
  });
  EventTableClosure.belongsTo(Player, {
    as: 'closedByPlayer',
    foreignKey: 'closedBy',
    onDelete: 'RESTRICT',
  });

  Player.hasMany(Event, {
    as: 'cancelledEvents',
    foreignKey: 'cancelledBy',
    onDelete: 'RESTRICT',
  });
  Event.belongsTo(Player, {
    as: 'cancelledByPlayer',
    foreignKey: 'cancelledBy',
    onDelete: 'RESTRICT',
  });

  Event.hasMany(GameTable, {
    as: 'gameTables',
    foreignKey: 'eventId',
    onDelete: 'CASCADE',
  });
  GameTable.belongsTo(Event, {
    as: 'event',
    foreignKey: 'eventId',
    onDelete: 'CASCADE',
  });

  Game.hasMany(GameTable, {
    as: 'gameTables',
    foreignKey: 'gameId',
    onDelete: 'RESTRICT',
  });
  GameTable.belongsTo(Game, {
    as: 'game',
    foreignKey: 'gameId',
    onDelete: 'RESTRICT',
  });

  Player.hasMany(GameTable, {
    as: 'hostedGameTables',
    foreignKey: 'hostPlayerId',
    onDelete: 'RESTRICT',
  });
  GameTable.belongsTo(Player, {
    as: 'host',
    foreignKey: 'hostPlayerId',
    onDelete: 'RESTRICT',
  });

  Player.hasMany(Reservation, {
    as: 'reservations',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });
  Reservation.belongsTo(Player, {
    as: 'player',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });

  Event.hasMany(Reservation, {
    as: 'reservations',
    foreignKey: 'eventId',
    onDelete: 'CASCADE',
  });
  Reservation.belongsTo(Event, {
    as: 'event',
    foreignKey: 'eventId',
    onDelete: 'CASCADE',
  });

  GameTable.hasMany(Reservation, {
    as: 'reservations',
    foreignKey: 'gameTableId',
    onDelete: 'CASCADE',
  });
  Reservation.belongsTo(GameTable, {
    as: 'gameTable',
    foreignKey: 'gameTableId',
    onDelete: 'CASCADE',
  });

  GameTable.hasMany(TableComment, {
    as: 'comments',
    foreignKey: 'gameTableId',
    onDelete: 'CASCADE',
  });
  TableComment.belongsTo(GameTable, {
    as: 'gameTable',
    foreignKey: 'gameTableId',
    onDelete: 'CASCADE',
  });
  Player.hasMany(TableComment, {
    as: 'tableComments',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });
  TableComment.belongsTo(Player, {
    as: 'author',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });

  GameTable.hasMany(TableDiscussionRead, {
    as: 'discussionReads',
    foreignKey: 'gameTableId',
    onDelete: 'CASCADE',
  });
  TableDiscussionRead.belongsTo(GameTable, {
    as: 'gameTable',
    foreignKey: 'gameTableId',
    onDelete: 'CASCADE',
  });
  Player.hasMany(TableDiscussionRead, {
    as: 'tableDiscussionReads',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });
  TableDiscussionRead.belongsTo(Player, {
    as: 'player',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });

  Event.hasMany(EventAttendance, {
    as: 'attendances',
    foreignKey: 'eventId',
    onDelete: 'CASCADE',
  });
  EventAttendance.belongsTo(Event, {
    as: 'event',
    foreignKey: 'eventId',
    onDelete: 'CASCADE',
  });

  Player.hasMany(EventAttendance, {
    as: 'attendances',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });
  EventAttendance.belongsTo(Player, {
    as: 'player',
    foreignKey: 'playerId',
    onDelete: 'CASCADE',
  });

  GameTable.hasMany(EventAttendance, {
    as: 'attendances',
    foreignKey: 'gameTableId',
    onDelete: 'SET NULL',
  });
  EventAttendance.belongsTo(GameTable, {
    as: 'gameTable',
    foreignKey: 'gameTableId',
    onDelete: 'SET NULL',
  });

  Game.hasMany(EventAttendance, {
    as: 'attendances',
    foreignKey: 'gameId',
    onDelete: 'SET NULL',
  });
  EventAttendance.belongsTo(Game, {
    as: 'game',
    foreignKey: 'gameId',
    onDelete: 'SET NULL',
  });

  Event.hasOne(BookingArchive, {
    as: 'bookingArchive',
    foreignKey: 'eventId',
    onDelete: 'RESTRICT',
  });
  BookingArchive.belongsTo(Event, {
    as: 'event',
    foreignKey: 'eventId',
    onDelete: 'RESTRICT',
  });

  const models = {
    Role,
    Player,
    AuditLog,
    PlayerGame,
    Event,
    Game,
    Membership,
    NewsPost,
    PublicEvent,
    PublicEventApplication,
    GameTable,
    Reservation,
    EventAttendance,
    EventTableClosure,
    BookingArchive,
    ContactMessage,
    TableComment,
    TableDiscussionRead,
  };

  initializedModels.set(sequelize, models);
  return models;
}

export default initModels;
