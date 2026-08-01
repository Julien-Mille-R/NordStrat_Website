import {
  Event,
  EventAttendance,
  EventTableClosure,
  GameTable,
  sequelize,
} from '../models/index.js';
import { setFlash } from './access.controller.js';
import { recordAdminAction } from '../services/audit-log.service.js';

const ALLOWED_EDIT_STATUSES = new Set(['upcoming', 'ongoing', 'completed']);

function nextWeeklyDate(date) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 7);
  return nextDate;
}

function eventLabel(event) {
  return event.title || `Soirée #${event.id}`;
}

export async function showEventList(req, res, next) {
  try {
    const events = await Event.findAll({ order: [['date', 'DESC']] });
    return res.render('layouts/admin/event-list', { events });
  } catch (error) {
    return next(error);
  }
}

export function showCreateEventForm(req, res) {
  return res.render('layouts/admin/event-form', { event: null });
}

export async function createEvent(req, res, next) {
  try {
    await sequelize.transaction(async (transaction) => {
      const event = await Event.create({
        title: req.body.title,
        date: req.body.date,
        registrationDeadline: req.body.registrationDeadline,
        maxTable: Number(req.body.maxTable || 8),
        reservable: req.body.reservable === 'on',
        createdBy: req.currentUser.id,
      }, { transaction });
      await recordAdminAction({
        admin: req.currentUser,
        category: 'game_tables',
        action: 'event_created',
        targetType: 'event',
        targetId: event.id,
        targetLabel: eventLabel(event),
        description: 'Soirée créée.',
        transaction,
      });
    });
    return res.redirect('/admindashboard/events');
  } catch (error) {
    return next(error);
  }
}

export async function showEditEventForm(req, res, next) {
  try {
    const event = await Event.findByPk(Number(req.params.eventId));
    if (!event) return res.status(404).send('Événement introuvable.');
    if (event.status === 'cancelled') return res.status(409).send('Une soirée annulée ne peut plus être modifiée.');
    return res.render('layouts/admin/event-form', { event });
  } catch (error) {
    return next(error);
  }
}

export async function updateEvent(req, res, next) {
  try {
    const event = await Event.findByPk(Number(req.params.eventId));
    if (!event) return res.status(404).send('Événement introuvable.');
    if (event.status === 'cancelled') return res.status(409).send('Une soirée annulée ne peut plus être modifiée.');
    if (!ALLOWED_EDIT_STATUSES.has(req.body.status)) return res.status(400).send('Statut invalide.');
    await sequelize.transaction(async (transaction) => {
      await event.update({
        title: req.body.title,
        date: req.body.date,
        registrationDeadline: req.body.registrationDeadline,
        maxTable: Number(req.body.maxTable || 8),
        reservable: req.body.reservable === 'on',
        status: req.body.status,
      }, { transaction });
      await recordAdminAction({
        admin: req.currentUser,
        category: 'game_tables',
        action: 'event_updated',
        targetType: 'event',
        targetId: event.id,
        targetLabel: eventLabel(event),
        description: `Soirée modifiée : ${event.maxTable} tables disponibles, inscriptions ${event.reservable ? 'ouvertes' : 'fermées'}.`,
        transaction,
      });
    });
    return res.redirect('/admindashboard/events');
  } catch (error) {
    return next(error);
  }
}

export async function cancelEvent(req, res, next) {
  const eventId = Number(req.params.eventId);
  const cancellationReason = req.body.cancellationReason?.trim();

  try {
    if (!Number.isInteger(eventId)) return res.status(400).send('Identifiant d’événement invalide.');
    if (!cancellationReason || cancellationReason.length < 5 || cancellationReason.length > 500) {
      setFlash(req, 'error', 'Le motif d’annulation doit contenir entre 5 et 500 caractères.');
      return res.redirect('/admindashboard/events');
    }

    let eventFound = false;
    await sequelize.transaction(async (transaction) => {
      const event = await Event.findByPk(eventId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!event) return;
      eventFound = true;

      if (event.status === 'cancelled') throw new Error('EVENT_ALREADY_CANCELLED');
      if (event.status === 'completed') throw new Error('EVENT_ALREADY_COMPLETED');

      await EventAttendance.destroy({ where: { eventId }, transaction });
      await EventTableClosure.destroy({ where: { eventId }, transaction });
      await GameTable.destroy({ where: { eventId }, transaction });
      await event.update({
        status: 'cancelled',
        reservable: false,
        cancellationReason,
        cancelledAt: new Date(),
        cancelledBy: req.currentUser.id,
      }, { transaction });
      await recordAdminAction({
        admin: req.currentUser,
        category: 'game_tables',
        action: 'event_cancelled',
        targetType: 'event',
        targetId: event.id,
        targetLabel: eventLabel(event),
        description: 'Soirée annulée ; ses tables et inscriptions ont été supprimées.',
        transaction,
      });

      const nextDate = nextWeeklyDate(event.date);
      const existingNextEvent = await Event.findOne({ where: { date: nextDate }, transaction });
      if (!existingNextEvent) {
        const deadlineOffset = event.date.getTime() - event.registrationDeadline.getTime();
        const formattedDate = new Intl.DateTimeFormat('fr-FR', {
          dateStyle: 'long',
          timeZone: 'Europe/Paris',
        }).format(nextDate);

        await Event.create({
          title: `Soirée jeux du ${formattedDate}`,
          date: nextDate,
          status: 'upcoming',
          maxTable: event.maxTable,
          registrationDeadline: new Date(nextDate.getTime() - deadlineOffset),
          isPaid: event.isPaid,
          price: event.price,
          reservable: true,
          createdBy: event.createdBy,
        }, { transaction });
      }
    });

    if (!eventFound) return res.status(404).send('Événement introuvable.');
    setFlash(req, 'success', 'La soirée a été annulée. Ses tables et inscriptions ont été supprimées ; elle pourra être relancée avec des tables vierges.');
    return res.redirect('/admindashboard/events');
  } catch (error) {
    if (error.message === 'EVENT_ALREADY_CANCELLED') {
      setFlash(req, 'error', 'Cette soirée est déjà annulée.');
      return res.redirect('/admindashboard/events');
    }
    if (error.message === 'EVENT_ALREADY_COMPLETED') {
      setFlash(req, 'error', 'Une soirée déjà clôturée ne peut pas être annulée.');
      return res.redirect('/admindashboard/events');
    }
    return next(error);
  }
}

export async function reopenEvent(req, res, next) {
  const eventId = Number(req.params.eventId);

  try {
    if (!Number.isInteger(eventId)) return res.status(400).send('Identifiant d’événement invalide.');

    let registrationExtended = false;
    let eventFound = false;
    await sequelize.transaction(async (transaction) => {
      const event = await Event.findByPk(eventId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!event) return;
      eventFound = true;

      if (event.status !== 'cancelled') throw new Error('EVENT_NOT_CANCELLED');
      if (event.date <= new Date()) throw new Error('EVENT_ALREADY_STARTED');

      const registrationDeadline = event.registrationDeadline > new Date()
        ? event.registrationDeadline
        : event.date;
      registrationExtended = registrationDeadline.getTime() !== event.registrationDeadline.getTime();

      await event.update({
        status: 'upcoming',
        reservable: true,
        registrationDeadline,
        cancellationReason: null,
        cancelledAt: null,
        cancelledBy: null,
      }, { transaction });
      await recordAdminAction({
        admin: req.currentUser,
        category: 'game_tables',
        action: 'event_reopened',
        targetType: 'event',
        targetId: event.id,
        targetLabel: eventLabel(event),
        description: 'Soirée rouverte aux réservations avec des tables vierges.',
        transaction,
      });
    });

    if (!eventFound) return res.status(404).send('Événement introuvable.');
    const message = registrationExtended
      ? 'La soirée est de nouveau ouverte avec des tables vierges. La date limite d’inscription a été prolongée jusqu’au début de la soirée.'
      : 'La soirée est de nouveau ouverte aux réservations avec des tables vierges.';
    setFlash(req, 'success', message);
    return res.redirect('/admindashboard/events');
  } catch (error) {
    if (error.message === 'EVENT_NOT_CANCELLED') {
      setFlash(req, 'error', 'Seule une soirée annulée peut être relancée.');
      return res.redirect('/admindashboard/events');
    }
    if (error.message === 'EVENT_ALREADY_STARTED') {
      setFlash(req, 'error', 'Une soirée déjà commencée ou passée ne peut pas être relancée.');
      return res.redirect('/admindashboard/events');
    }
    return next(error);
  }
}
