import 'dotenv/config';
import { Sequelize } from 'sequelize';
import initModels from './relations.js';
import defineTableGuest from './table-guest.js';

const commonOptions = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  ...(process.env.DB_SCHEMA ? { define: { schema: process.env.DB_SCHEMA } } : {}),
};

const TableGuest = defineTableGuest(sequelize);

export const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, commonOptions)
  : new Sequelize(
    process.env.DB_NAME || 'nordstrat',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || '',
    {
      ...commonOptions,
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
    },
  );

export const models = initModels(sequelize);

export const {
  Role,
  Player,
  PasswordResetToken,
  AuditLog,
  PlayerGame,
  EmailVerificationToken,
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
  TableGuest,
} = models;

export default models;
