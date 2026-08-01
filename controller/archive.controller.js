import { BookingArchive } from '../models/index.js';
import { recordAdminAction } from '../services/audit-log.service.js';

export async function archiveEvent(req, res, next) {
  try {
    const { archive } = await BookingArchive.archiveEvent(Number(req.params.eventId));
    await recordAdminAction({
      admin: req.currentUser,
      category: 'game_tables',
      action: 'event_archived_manually',
      targetType: 'event',
      targetId: archive.eventId,
      targetLabel: archive.snapshot.event.title,
      description: 'Soirée clôturée et archivée manuellement.',
    });
    return res.redirect('/admindashboard/archives');
  } catch (error) {
    if (error.message === 'EVENT_NOT_FOUND') return res.status(404).send('Événement introuvable.');
    if (error.message === 'EVENT_NOT_ARCHIVABLE') return res.status(409).send('Cet événement ne peut pas être archivé.');
    return next(error);
  }
}

export async function showArchiveList(req, res, next) {
  try {
    const archives = await BookingArchive.findAll({ order: [['eventDate', 'DESC']] });
    return res.render('layouts/admin/archive-list', { archives });
  } catch (error) {
    return next(error);
  }
}

export async function showArchiveDetails(req, res, next) {
  try {
    const archive = await BookingArchive.findByPk(Number(req.params.archiveId));
    if (!archive) return res.status(404).send('Archive introuvable.');
    return res.render('layouts/admin/archive-details', { archive });
  } catch (error) {
    return next(error);
  }
}

export async function downloadArchive(req, res, next) {
  try {
    const archive = await BookingArchive.findByPk(Number(req.params.archiveId));
    if (!archive) return res.status(404).send('Archive introuvable.');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${archive.getFilename()}"`);
    return res.send(JSON.stringify(archive.snapshot, null, 2));
  } catch (error) {
    return next(error);
  }
}
