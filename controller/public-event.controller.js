import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { Op } from 'sequelize';
import {
  PublicEvent,
  PublicEventApplication,
  sequelize,
} from '../models/index.js';
import { setFlash, validateMultipartCsrfToken } from './access.controller.js';
import { recordAdminAction } from '../services/audit-log.service.js';
import { applySeo } from './seo.controller.js';

const EVENT_SLUG_PREFIX = 'assaut-de-bruay-';
const PUBLIC_EVENT_PATH = '/events/assaut-de-bruay';
const PUBLIC_EVENT_REGISTRATION_PATH = `${PUBLIC_EVENT_PATH}/registration`;
const ADMIN_EVENT_PATH = '/admindashboard/assaut-de-bruay';
const PUBLIC_EVENT_IMAGE_DIRECTORY = path.join(process.cwd(), 'public', 'uploads', 'public-events');
const PUBLIC_EVENT_IMAGE_PREFIX = '/uploads/public-events/';
const MAX_PUBLIC_EVENT_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_APPLICATION_TYPES = new Set(['partner', 'vendor', 'volunteer']);
const ALLOWED_APPLICATION_STATUSES = new Set(['new', 'reviewing', 'accepted', 'waitlisted', 'rejected', 'withdrawn']);
const EDITABLE_VOLUNTEER_STATUSES = new Set(['new', 'reviewing']);
const WITHDRAWABLE_VOLUNTEER_STATUSES = new Set(['new', 'reviewing', 'accepted', 'waitlisted']);
const ALLOWED_VOLUNTEER_TASKS = new Set([
  'setup',
  'welcome',
  'refreshments',
  'logistics',
  'game_hosting',
  'exhibitor_support',
  'communication',
  'cleanup',
  'where_needed',
]);
const APPLICATION_STATUS_LABELS = {
  new: 'nouvelle',
  reviewing: 'en cours',
  accepted: 'acceptée',
  waitlisted: 'sur liste d’attente',
  rejected: 'refusée',
  withdrawn: 'retirée par le demandeur',
};

const publicEventImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PUBLIC_EVENT_IMAGE_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const isAllowed = allowedTypes.has(file.mimetype);
    callback(isAllowed ? null : new Error('INVALID_PUBLIC_EVENT_IMAGE_TYPE'), isAllowed);
  },
}).single('image');

function imageExtension(buffer) {
  const isJpeg = buffer.length >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff;
  const isPng = buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (isJpeg) return 'jpg';
  if (isPng) return 'png';
  if (isWebp) return 'webp';
  return null;
}

function storedPublicEventImagePath(imageUrl) {
  if (!imageUrl?.startsWith(PUBLIC_EVENT_IMAGE_PREFIX)) return null;
  return path.join(PUBLIC_EVENT_IMAGE_DIRECTORY, path.basename(imageUrl));
}

async function deleteStoredPublicEventImage(imageUrl) {
  const imagePath = storedPublicEventImagePath(imageUrl);
  if (imagePath) await fs.unlink(imagePath).catch(() => {});
}

async function saveUploadedPublicEventImage(file) {
  if (!file) return null;
  const extension = imageExtension(file.buffer);
  if (!extension) throw new Error('INVALID_PUBLIC_EVENT_IMAGE_CONTENT');

  await fs.mkdir(PUBLIC_EVENT_IMAGE_DIRECTORY, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  const imagePath = path.join(PUBLIC_EVENT_IMAGE_DIRECTORY, filename);
  await fs.writeFile(imagePath, file.buffer, { mode: 0o600 });
  return { imagePath, imageUrl: `${PUBLIC_EVENT_IMAGE_PREFIX}${filename}` };
}

export function parsePublicEventImageUpload(req, res, next) {
  publicEventImageUpload(req, res, (error) => {
    if (!error) return validateMultipartCsrfToken(req, res, next);
    const invalidFile = error instanceof multer.MulterError
      || error.message === 'INVALID_PUBLIC_EVENT_IMAGE_TYPE';
    setFlash(
      req,
      'error',
      invalidFile
        ? 'L’image doit être au format JPEG, PNG ou WebP et ne pas dépasser 5 Mo.'
        : 'Impossible de recevoir cette image.',
    );
    return res.redirect(ADMIN_EVENT_PATH);
  });
}

function parisDate() {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(new Date());
}

function normalizedText(value, maxLength = Number.POSITIVE_INFINITY) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function boundedInteger(value, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function applicationsAreOpen(publicEvent) {
  if (!publicEvent?.isVisible || !publicEvent.applicationsEnabled) return false;
  const today = parisDate();
  return today >= publicEvent.registrationOpenAt && today <= publicEvent.registrationCloseAt;
}

function currentPublicEventQuery() {
  return {
    where: { slug: { [Op.like]: `${EVENT_SLUG_PREFIX}%` } },
    order: [['eventDate', 'DESC']],
  };
}

export async function providePublicEventNavigation(req, res, next) {
  try {
    const publicEvent = await PublicEvent.findOne({
      ...currentPublicEventQuery(),
      attributes: ['id', 'isVisible'],
    });
    res.locals.publicEventNavigationVisible = Boolean(publicEvent?.isVisible);
    return next();
  } catch (error) {
    if (error.original?.code === '42P01' || error.original?.code === '42703') {
      res.locals.publicEventNavigationVisible = false;
      return next();
    }
    return next(error);
  }
}

export async function showPublicEventPage(req, res, next) {
  try {
    const publicEvent = await PublicEvent.findOne(currentPublicEventQuery());
    const ownApplications = publicEvent
      ? await PublicEventApplication.findAll({
        where: { publicEventId: publicEvent.id, playerId: req.currentUser.id },
        order: [['createdAt', 'DESC']],
      })
      : [];
    if (publicEvent?.isVisible) {
      const baseUrl = res.locals.seo.baseUrl;
      const eventUrl = `${baseUrl}${PUBLIC_EVENT_PATH}`;
      applySeo(res, {
        title: `${publicEvent.title} | Nord Stratégie`,
        description: normalizedText(publicEvent.description.replace(/\s+/g, ' '), 160),
        canonicalPath: PUBLIC_EVENT_PATH,
        imageUrl: publicEvent.imageUrl,
        schemas: [{
          '@context': 'https://schema.org',
          '@type': 'Event',
          '@id': `${eventUrl}#event`,
          name: publicEvent.title,
          description: publicEvent.description,
          startDate: publicEvent.eventDate,
          endDate: publicEvent.eventEndDate,
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          url: eventUrl,
          ...(publicEvent.imageUrl ? {
            image: [`${baseUrl}${publicEvent.imageUrl}`],
          } : {}),
          location: {
            '@type': 'Place',
            name: 'Salle polyvalente de Bruay-sur-l’Escaut',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'Bruay-sur-l’Escaut',
              postalCode: '59860',
              addressCountry: 'FR',
            },
          },
          organizer: {
            '@type': 'Organization',
            '@id': `${baseUrl}/#organization`,
            name: 'Nord Stratégie',
            url: baseUrl,
          },
          audience: {
            '@type': 'Audience',
            audienceType: 'Tout public',
          },
        }],
      });
    }
    return res.render('layouts/public-event', {
      publicEvent,
      applicationsOpen: applicationsAreOpen(publicEvent),
      ownApplications,
    });
  } catch (error) {
    return next(error);
  }
}

export async function showPublicEventRegistrationPage(req, res, next) {
  try {
    const publicEvent = await PublicEvent.findOne(currentPublicEventQuery());
    const ownApplications = publicEvent
      ? await PublicEventApplication.findAll({
        where: { publicEventId: publicEvent.id, playerId: req.currentUser.id },
        order: [['createdAt', 'DESC']],
      })
      : [];
    return res.render('layouts/public-event-registration', {
      publicEvent,
      applicationsOpen: applicationsAreOpen(publicEvent),
      ownApplications,
    });
  } catch (error) {
    return next(error);
  }
}

export async function submitPublicEventApplication(req, res, next) {
  const applicationType = req.body.applicationType;
  const contactName = normalizedText(
    req.body.contactName || req.currentUser.nickname || `${req.currentUser.firstname} ${req.currentUser.lastname}`,
    120,
  );
  const organizationName = normalizedText(req.body.organizationName, 150) || null;
  const phone = normalizedText(req.body.phone, 30) || null;
  const description = normalizedText(req.body.description, 5000);
  const availability = normalizedText(req.body.availability, 1000) || null;
  const needs = normalizedText(req.body.needs, 3000) || null;
  const spaceLength = boundedInteger(req.body.spaceLength, 2, 6);
  const websiteUrl = normalizedText(req.body.websiteUrl, 500) || null;
  const socialUrl1 = normalizedText(req.body.socialUrl1, 500) || null;
  const socialUrl2 = normalizedText(req.body.socialUrl2, 500) || null;
  const participantCount = boundedInteger(req.body.participantCount, 1, 100);
  const tableCount = boundedInteger(req.body.tableCount || 0, 0, 6);
  const chairCount = boundedInteger(req.body.chairCount || 0, 0, 500);
  const presentSaturday = req.body.presentSaturday === 'on';
  const presentSunday = req.body.presentSunday === 'on';
  const needsElectricity = req.body.needsElectricity === 'on';
  const powerOutletCount = 0;
  const needsWater = req.body.needsWater === 'on';
  const submittedTasks = Array.isArray(req.body.volunteerTasks)
    ? req.body.volunteerTasks
    : [req.body.volunteerTasks].filter(Boolean);
  const volunteerTasks = submittedTasks.filter((task) => ALLOWED_VOLUNTEER_TASKS.has(task));

  try {
    if (req.body.companyWebsite) {
      setFlash(req, 'success', 'Votre demande a bien été transmise.');
      return res.redirect(PUBLIC_EVENT_REGISTRATION_PATH);
    }

    const publicEvent = await PublicEvent.findOne(currentPublicEventQuery());
    if (!applicationsAreOpen(publicEvent)) {
      setFlash(req, 'error', 'Les inscriptions ne sont pas ouvertes actuellement.');
      return res.redirect(PUBLIC_EVENT_REGISTRATION_PATH);
    }

    const phoneIsValid = !phone || /^[0-9+().\s-]{6,30}$/.test(phone);
    const submittedUrls = [websiteUrl, socialUrl1, socialUrl2].filter(Boolean);
    const urlsAreValid = submittedUrls.every((url) => /^https?:\/\/[^\s]+$/i.test(url));
    const structureRequired = ['partner', 'vendor'].includes(applicationType);
    const invalid = !ALLOWED_APPLICATION_TYPES.has(applicationType)
      || contactName.length < 2
      || !phoneIsValid
      || !urlsAreValid
      || (structureRequired && !organizationName)
      || participantCount === null
      || tableCount === null
      || chairCount === null
      || (structureRequired && spaceLength === null)
      || (!presentSaturday && !presentSunday)
      || description.length < 20
      || (applicationType === 'volunteer' && !volunteerTasks.length);
    if (invalid) {
      setFlash(req, 'error', 'Vérifiez les informations et les champs obligatoires du formulaire.');
      return res.redirect(PUBLIC_EVENT_REGISTRATION_PATH);
    }

    const existingApplication = await PublicEventApplication.findOne({
      where: {
        publicEventId: publicEvent.id,
        playerId: req.currentUser.id,
        applicationType,
      },
    });
    if (existingApplication) {
      setFlash(req, 'error', 'Vous avez déjà envoyé une demande de ce type pour cette édition.');
      return res.redirect(PUBLIC_EVENT_REGISTRATION_PATH);
    }

    await PublicEventApplication.create({
      publicEventId: publicEvent.id,
      playerId: req.currentUser.id,
      applicationType,
      contactName,
      organizationName,
      email: req.currentUser.email,
      phone,
      participantCount,
      presentSaturday,
      presentSunday,
      tableCount: applicationType === 'volunteer' ? 0 : tableCount,
      chairCount: applicationType === 'volunteer' ? 0 : chairCount,
      needsElectricity: applicationType === 'volunteer' ? false : needsElectricity,
      powerOutletCount: applicationType === 'volunteer' ? 0 : powerOutletCount,
      needsWater: applicationType === 'volunteer' ? false : needsWater,
      spaceLength: applicationType === 'volunteer' ? null : spaceLength,
      websiteUrl: applicationType === 'volunteer' ? null : websiteUrl,
      socialUrl1: applicationType === 'volunteer' ? null : socialUrl1,
      socialUrl2: applicationType === 'volunteer' ? null : socialUrl2,
      volunteerTasks: applicationType === 'volunteer' ? volunteerTasks : [],
      description,
      availability,
      needs,
    });
    setFlash(req, 'success', 'Votre demande a bien été transmise à l’équipe organisatrice.');
    return res.redirect('/account/assaut-de-bruay');
  } catch (error) {
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      setFlash(req, 'error', 'Impossible d’enregistrer cette demande. Vérifiez les informations saisies.');
      return res.redirect(PUBLIC_EVENT_REGISTRATION_PATH);
    }
    return next(error);
  }
}

export async function showOwnPublicEventApplications(req, res, next) {
  try {
    const applications = await PublicEventApplication.findAll({
      where: { playerId: req.currentUser.id },
      include: [{ association: 'publicEvent' }],
      order: [['createdAt', 'DESC']],
    });
    return res.render('layouts/account-public-event-applications', { applications });
  } catch (error) {
    return next(error);
  }
}

export async function showVolunteerApplicationEdit(req, res, next) {
  try {
    const applicationId = Number(req.params.applicationId);
    if (!Number.isInteger(applicationId)) return res.status(400).send('Candidature invalide.');
    const application = await PublicEventApplication.findOne({
      where: {
        id: applicationId,
        playerId: req.currentUser.id,
        applicationType: 'volunteer',
      },
      include: [{ association: 'publicEvent' }],
    });
    if (!application) return res.status(404).send('Candidature bénévole introuvable.');
    if (!EDITABLE_VOLUNTEER_STATUSES.has(application.status)) {
      setFlash(req, 'error', 'Cette candidature ne peut plus être modifiée. Vous pouvez toutefois vous désister.');
      return res.redirect('/account/assaut-de-bruay');
    }
    return res.render('layouts/public-event-volunteer-edit', { application });
  } catch (error) {
    return next(error);
  }
}

export async function updateOwnVolunteerApplication(req, res, next) {
  const applicationId = Number(req.params.applicationId);
  const contactName = normalizedText(req.body.contactName, 120);
  const phone = normalizedText(req.body.phone, 30) || null;
  const availability = normalizedText(req.body.availability, 1000) || null;
  const description = normalizedText(req.body.description, 5000);
  const needs = normalizedText(req.body.needs, 3000) || null;
  const participantCount = boundedInteger(req.body.participantCount, 1, 100);
  const presentSaturday = req.body.presentSaturday === 'on';
  const presentSunday = req.body.presentSunday === 'on';
  const submittedTasks = Array.isArray(req.body.volunteerTasks)
    ? req.body.volunteerTasks
    : [req.body.volunteerTasks].filter(Boolean);
  const volunteerTasks = submittedTasks.filter((task) => ALLOWED_VOLUNTEER_TASKS.has(task));

  try {
    const phoneIsValid = !phone || /^[0-9+().\s-]{6,30}$/.test(phone);
    const invalid = !Number.isInteger(applicationId)
      || contactName.length < 2
      || !phoneIsValid
      || participantCount === null
      || (!presentSaturday && !presentSunday)
      || !volunteerTasks.length
      || description.length < 20;
    if (invalid) {
      setFlash(req, 'error', 'Vérifiez les informations et les champs obligatoires du formulaire.');
      return res.redirect(`/account/assaut-de-bruay/applications/${applicationId}/edit`);
    }

    await sequelize.transaction(async (transaction) => {
      const application = await PublicEventApplication.findOne({
        where: {
          id: applicationId,
          playerId: req.currentUser.id,
          applicationType: 'volunteer',
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!application) {
        const error = new Error('VOLUNTEER_APPLICATION_NOT_FOUND');
        throw error;
      }
      if (!EDITABLE_VOLUNTEER_STATUSES.has(application.status)) {
        const error = new Error('VOLUNTEER_APPLICATION_NOT_EDITABLE');
        throw error;
      }
      await application.update({
        contactName,
        email: req.currentUser.email,
        phone,
        participantCount,
        presentSaturday,
        presentSunday,
        volunteerTasks,
        description,
        availability,
        needs,
        status: 'new',
        reviewedBy: null,
        reviewedAt: null,
      }, { transaction });
    });
    setFlash(req, 'success', 'Votre candidature bénévole a été modifiée et transmise pour un nouvel examen.');
    return res.redirect('/account/assaut-de-bruay');
  } catch (error) {
    if (error.message === 'VOLUNTEER_APPLICATION_NOT_FOUND') {
      return res.status(404).send('Candidature bénévole introuvable.');
    }
    if (error.message === 'VOLUNTEER_APPLICATION_NOT_EDITABLE') {
      setFlash(req, 'error', 'Cette candidature ne peut plus être modifiée. Vous pouvez toutefois vous désister.');
      return res.redirect('/account/assaut-de-bruay');
    }
    return next(error);
  }
}

export async function withdrawOwnVolunteerApplication(req, res, next) {
  const applicationId = Number(req.params.applicationId);
  const withdrawalReason = normalizedText(req.body.withdrawalReason, 1000) || null;

  try {
    if (!Number.isInteger(applicationId)) return res.status(400).send('Candidature invalide.');
    await sequelize.transaction(async (transaction) => {
      const application = await PublicEventApplication.findOne({
        where: {
          id: applicationId,
          playerId: req.currentUser.id,
          applicationType: 'volunteer',
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!application) {
        const error = new Error('VOLUNTEER_APPLICATION_NOT_FOUND');
        throw error;
      }
      if (!WITHDRAWABLE_VOLUNTEER_STATUSES.has(application.status)) {
        const error = new Error('VOLUNTEER_APPLICATION_NOT_WITHDRAWABLE');
        throw error;
      }
      await application.update({
        status: 'withdrawn',
        withdrawalReason,
        withdrawnAt: new Date(),
      }, { transaction });
    });
    setFlash(req, 'success', 'Votre désistement a été enregistré. L’équipe organisatrice peut désormais en tenir compte.');
    return res.redirect('/account/assaut-de-bruay');
  } catch (error) {
    if (error.message === 'VOLUNTEER_APPLICATION_NOT_FOUND') {
      return res.status(404).send('Candidature bénévole introuvable.');
    }
    if (error.message === 'VOLUNTEER_APPLICATION_NOT_WITHDRAWABLE') {
      setFlash(req, 'error', 'Cette candidature est déjà retirée ou ne peut plus être annulée.');
      return res.redirect('/account/assaut-de-bruay');
    }
    return next(error);
  }
}

export async function showPublicEventAdmin(req, res, next) {
  try {
    const publicEvent = await PublicEvent.findOne(currentPublicEventQuery());
    const applications = publicEvent
      ? await PublicEventApplication.findAll({
        where: { publicEventId: publicEvent.id },
        attributes: ['status', 'applicationType'],
      })
      : [];
    const summary = {
      total: applications.length,
      new: applications.filter((item) => item.status === 'new').length,
      partner: applications.filter((item) => item.applicationType === 'partner').length,
      vendor: applications.filter((item) => item.applicationType === 'vendor').length,
      volunteer: applications.filter((item) => item.applicationType === 'volunteer').length,
    };
    return res.render('layouts/admin/public-event', { publicEvent, summary });
  } catch (error) {
    return next(error);
  }
}

export async function showPublicEventApplications(req, res, next) {
  try {
    const publicEvent = await PublicEvent.findOne(currentPublicEventQuery());
    if (!publicEvent) {
      return res.render('layouts/admin/public-event-applications', {
        publicEvent: null,
        applications: [],
        filters: { type: '', status: '', day: '', search: '' },
      });
    }

    const type = ALLOWED_APPLICATION_TYPES.has(req.query.type) ? req.query.type : '';
    const status = ALLOWED_APPLICATION_STATUSES.has(req.query.status) ? req.query.status : '';
    const day = ['saturday', 'sunday'].includes(req.query.day) ? req.query.day : '';
    const search = normalizedText(req.query.search, 150);
    const where = { publicEventId: publicEvent.id };
    if (type) where.applicationType = type;
    if (status) where.status = status;
    if (day === 'saturday') where.presentSaturday = true;
    if (day === 'sunday') where.presentSunday = true;
    if (search) {
      where[Op.or] = [
        { contactName: { [Op.iLike]: `%${search}%` } },
        { organizationName: { [Op.iLike]: `%${search}%` } },
        { '$applicant.nickname$': { [Op.iLike]: `%${search}%` } },
      ];
    }

    const applications = await PublicEventApplication.findAll({
      where,
      include: [{ association: 'applicant', required: false }],
      order: [['createdAt', 'DESC']],
    });
    return res.render('layouts/admin/public-event-applications', {
      publicEvent,
      applications,
      filters: {
        type,
        status,
        day,
        search,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function showPublicEventApplicationDetails(req, res, next) {
  try {
    const application = await PublicEventApplication.findByPk(Number(req.params.applicationId), {
      include: [
        { association: 'publicEvent' },
        { association: 'applicant', required: false },
        { association: 'reviewer', required: false },
      ],
    });
    if (!application) return res.status(404).send('Demande introuvable.');
    return res.render('layouts/admin/public-event-application-details', { application });
  } catch (error) {
    return next(error);
  }
}

export async function savePublicEvent(req, res, next) {
  const eventDate = req.body.eventDate;
  const eventEndDate = req.body.eventEndDate;
  const registrationOpenAt = req.body.registrationOpenAt;
  const registrationCloseAt = req.body.registrationCloseAt;
  const title = normalizedText(req.body.title, 150);
  const description = normalizedText(req.body.description, 5000);
  let uploadedImage;
  let previousImageUrl;

  try {
    if (!title || description.length < 20 || !eventDate || !eventEndDate || !registrationOpenAt || !registrationCloseAt) {
      setFlash(req, 'error', 'Complétez les informations et les dates de l’événement.');
      return res.redirect(ADMIN_EVENT_PATH);
    }

    uploadedImage = await saveUploadedPublicEventImage(req.file);
    const baseValues = {
      title,
      slug: `${EVENT_SLUG_PREFIX}${eventDate.slice(0, 4)}`,
      eventDate,
      eventEndDate,
      registrationOpenAt,
      registrationCloseAt,
      description,
      isVisible: req.body.isVisible === 'on',
      applicationsEnabled: req.body.applicationsEnabled === 'on',
    };
    await sequelize.transaction(async (transaction) => {
      const publicEvent = await PublicEvent.findOne({
        where: { slug: baseValues.slug },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      previousImageUrl = publicEvent?.imageUrl || null;
      const values = {
        ...baseValues,
        imageUrl: uploadedImage?.imageUrl
          || (req.body.removeImage === 'on' ? null : previousImageUrl),
      };
      const savedEvent = publicEvent
        ? await publicEvent.update(values, { transaction })
        : await PublicEvent.create({ ...values, createdBy: req.currentUser.id }, { transaction });
      await recordAdminAction({
        admin: req.currentUser,
        category: 'public_events',
        action: publicEvent ? 'public_event_updated' : 'public_event_created',
        targetType: 'public_event',
        targetId: savedEvent.id,
        targetLabel: savedEvent.title,
        description: publicEvent
          ? `Assaut de Bruay modifié ; page ${savedEvent.isVisible ? 'visible' : 'masquée'}, candidatures ${savedEvent.applicationsEnabled ? 'autorisées' : 'fermées'}.`
          : 'Édition de l’Assaut de Bruay créée.',
        transaction,
      });
    });

    if ((uploadedImage || req.body.removeImage === 'on') && previousImageUrl) {
      await deleteStoredPublicEventImage(previousImageUrl);
    }
    setFlash(req, 'success', 'La page de l’Assaut de Bruay a été mise à jour.');
    return res.redirect(ADMIN_EVENT_PATH);
  } catch (error) {
    if (uploadedImage?.imagePath) await fs.unlink(uploadedImage.imagePath).catch(() => {});
    if (error.message === 'INVALID_PUBLIC_EVENT_IMAGE_CONTENT') {
      setFlash(req, 'error', 'Le contenu du fichier ne correspond pas à une image JPEG, PNG ou WebP valide.');
      return res.redirect(ADMIN_EVENT_PATH);
    }
    if (error.name === 'SequelizeValidationError') {
      setFlash(req, 'error', 'Vérifiez la période d’inscription et les dates de l’événement.');
      return res.redirect(ADMIN_EVENT_PATH);
    }
    return next(error);
  }
}

export async function updatePublicEventApplication(req, res, next) {
  const applicationId = Number(req.params.applicationId);
  const status = req.body.status;
  const adminNotes = normalizedText(req.body.adminNotes, 3000) || null;

  try {
    if (!Number.isInteger(applicationId) || !ALLOWED_APPLICATION_STATUSES.has(status) || status === 'withdrawn') {
      return res.status(400).send('Demande ou statut invalide.');
    }
    const application = await PublicEventApplication.findByPk(applicationId);
    if (!application) return res.status(404).send('Demande introuvable.');
    if (application.status === 'withdrawn') {
      setFlash(req, 'error', 'Une candidature retirée par son auteur ne peut pas être réactivée depuis ce suivi.');
      return res.redirect(`${ADMIN_EVENT_PATH}/applications/${application.id}`);
    }

    const previousStatus = application.status;
    await sequelize.transaction(async (transaction) => {
      await application.update({
        status,
        adminNotes,
        reviewedBy: status === 'new' ? null : req.currentUser.id,
        reviewedAt: status === 'new' ? null : new Date(),
      }, { transaction });
      const applicationType = {
        partner: 'partenaire',
        vendor: 'vendeur',
        volunteer: 'bénévole',
      }[application.applicationType];
      await recordAdminAction({
        admin: req.currentUser,
        category: 'public_events',
        action: 'public_event_application_updated',
        targetType: 'public_event_application',
        targetId: application.id,
        targetLabel: `Demande ${applicationType} #${application.id}`,
        description: `Statut de la demande passé de « ${APPLICATION_STATUS_LABELS[previousStatus]} » à « ${APPLICATION_STATUS_LABELS[status]} ».`,
        transaction,
      });
    });
    setFlash(req, 'success', 'Le suivi de la demande a été mis à jour.');
    return res.redirect(`${ADMIN_EVENT_PATH}/applications/${application.id}`);
  } catch (error) {
    return next(error);
  }
}
