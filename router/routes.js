import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  requireAdmin,
  requireGuest,
  requireUser,
} from '../controller/access.controller.js';
import { login, logout } from '../controller/auth.controller.js';
import {
  changeEmail,
  changePassword,
  deleteAccount,
  register,
  showAccount,
  updateProfile,
} from '../controller/account.controller.js';
import {
  showMemberList,
  updateAccountRole,
  updateMemberModeration,
} from '../controller/account-admin.controller.js';
import { showDashboard } from '../controller/admin.controller.js';
import { showAuditLog } from '../controller/audit-log.controller.js';
import { archiveEvent, downloadArchive, showArchiveDetails, showArchiveList } from '../controller/archive.controller.js';
import {
  cancelOwnAttendance,
  confirmOwnAttendance,
  saveAttendance,
  showAttendancePage,
} from '../controller/attendance.controller.js';
import { showBookingPage } from '../controller/booking.controller.js';
import { sendContactMessage, showContactPage } from '../controller/contact.controller.js';
import { showHomePage } from '../controller/home.controller.js';
import {
  cancelEvent,
  createEvent,
  reopenEvent,
  showCreateEventForm,
  showEditEventForm,
  showEventList,
  updateEvent,
} from '../controller/event.controller.js';
import {
  createGame,
  disableGame,
  parseGameImageUpload,
  showCreateGameForm,
  showEditGameForm,
  showGameList,
  updateGame,
} from '../controller/game.controller.js';
import {
  cancelPlayerReservationByAdmin,
  joinTable,
  leaveTable,
} from '../controller/reservation.controller.js';
import { showMembershipList, updateMembership } from '../controller/membership.controller.js';
import { showMessageList, updateMessageStatus } from '../controller/message-admin.controller.js';
import {
  createNewsPost,
  deleteNewsPost,
  parseNewsImageUpload,
  showCreateNewsForm,
  showEditNewsForm,
  showNewsAdminList,
  showNewsDetails,
  showNewsList,
  updateNewsPost,
} from '../controller/news.controller.js';
import {
  deleteAvatar,
  parseAvatarUpload,
  selectDefaultAvatar,
  showPublicProfile,
  updateAvatar,
  updatePublicProfile,
} from '../controller/profile.controller.js';
import {
  savePublicEvent,
  parsePublicEventImageUpload,
  showOwnPublicEventApplications,
  showVolunteerApplicationEdit,
  showPublicEventApplicationDetails,
  showPublicEventApplications,
  showPublicEventAdmin,
  showPublicEventPage,
  showPublicEventRegistrationPage,
  submitPublicEventApplication,
  updateOwnVolunteerApplication,
  updatePublicEventApplication,
  withdrawOwnVolunteerApplication,
} from '../controller/public-event.controller.js';
import {
  cancelTable,
  closeTable,
  closeEventTableSlotByAdmin,
  createTable,
  reopenEventTableSlotByAdmin,
  updateTable,
} from '../controller/table.controller.js';
import {
  createTableComment,
  deleteTableComment,
  openTableDiscussion,
} from '../controller/table-discussion.controller.js';
import { showRobotsTxt, showSitemapXml } from '../controller/seo.controller.js';
import { PostgresRateLimitStore } from '../services/postgres-rate-limit-store.js';

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('authentication'),
  message: 'Trop de tentatives. Réessayez dans quelques minutes.',
});
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('contact'),
  message: 'Trop de messages envoyés. Réessayez plus tard.',
});
const tableDiscussionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('table-discussion'),
  message: 'Trop de messages publiés. Réessayez dans quelques minutes.',
});
const sensitiveAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('sensitive-account'),
  message: 'Trop de tentatives sur le compte. Réessayez dans quelques minutes.',
});
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PostgresRateLimitStore('uploads'),
  message: 'Trop de fichiers envoyés. Réessayez dans quelques minutes.',
});

router.get('/robots.txt', showRobotsTxt);
router.get('/sitemap.xml', showSitemapXml);
router.get('/', showHomePage);
router.get('/news', showNewsList);
router.get('/news/:postId', showNewsDetails);
router.get('/events/assaut-de-bruay', requireUser, showPublicEventPage);
router.get('/events/assaut-de-bruay/registration', requireUser, showPublicEventRegistrationPage);
router.post('/events/assaut-de-bruay/apply', requireUser, contactLimiter, submitPublicEventApplication);
router.get('/about', (req, res) => res.render('layouts/about'));
router.get('/accessibility', (req, res) => res.render('layouts/accessibility'));
router.get('/apropos', (req, res) => res.redirect(301, '/about'));
router.get('/cgu', (req, res) => res.render('layouts/cgu'));
router.get('/mentions-legales', (req, res) => res.render('layouts/legalmentions'));
router.get('/politique-confidentialite', (req, res) => res.render('layouts/privacy-policy'));
router.get('/contact', showContactPage);
router.post('/contact', contactLimiter, sendContactMessage);

router.post('/auth/login', requireGuest, authLimiter, login);
router.post('/auth/logout', requireUser, logout);
router.post('/account/register', requireGuest, authLimiter, register);
router.get('/account', requireUser, showAccount);
router.get('/account/assaut-de-bruay', requireUser, showOwnPublicEventApplications);
router.get('/account/assaut-de-bruay/applications/:applicationId/edit', requireUser, showVolunteerApplicationEdit);
router.post('/account/assaut-de-bruay/applications/:applicationId/edit', requireUser, contactLimiter, updateOwnVolunteerApplication);
router.post('/account/assaut-de-bruay/applications/:applicationId/withdraw', requireUser, contactLimiter, withdrawOwnVolunteerApplication);
router.post('/account/profile', requireUser, updateProfile);
router.post('/account/password', requireUser, sensitiveAccountLimiter, changePassword);
router.post('/account/email', requireUser, sensitiveAccountLimiter, changeEmail);
router.post('/account/delete', requireUser, sensitiveAccountLimiter, deleteAccount);
router.post('/account/public-profile', requireUser, updatePublicProfile);
router.post('/account/avatar', requireUser, uploadLimiter, parseAvatarUpload, updateAvatar);
router.post('/account/avatar/default', requireUser, selectDefaultAvatar);
router.post('/account/avatar/delete', requireUser, deleteAvatar);

router.get('/members/:playerId', showPublicProfile);

router.get('/booking', showBookingPage);
router.post('/events/:eventId/attendance/cancel', requireUser, cancelOwnAttendance);
router.post('/events/:eventId/attendance/confirm', requireUser, confirmOwnAttendance);

router.post('/tables/create', requireUser, createTable);
router.post('/tables/:tableId/join', requireUser, joinTable);
router.post('/tables/:tableId/leave', requireUser, leaveTable);
router.post('/tables/:tableId/update', requireUser, updateTable);
router.post('/tables/:tableId/close', requireUser, closeTable);
router.post('/tables/:tableId/cancel', requireUser, cancelTable);
router.post('/events/:eventId/tables/:tableNumber/close', requireAdmin, closeEventTableSlotByAdmin);
router.post('/events/:eventId/tables/:tableNumber/reopen', requireAdmin, reopenEventTableSlotByAdmin);
router.post('/tables/:tableId/discussion/open', requireUser, openTableDiscussion);
router.post('/tables/:tableId/comments', requireUser, tableDiscussionLimiter, createTableComment);
router.post('/tables/:tableId/comments/:commentId/delete', requireAdmin, deleteTableComment);

router.get('/admin', (req, res) => res.status(404).send('Page introuvable.'));

router.use('/admindashboard', requireAdmin);

router.get('/admindashboard', showDashboard);
router.get('/admindashboard/audit-log', showAuditLog);
router.get('/admindashboard/public-events', (req, res) => res.redirect(301, '/admindashboard/assaut-de-bruay'));
router.get('/admindashboard/assaut-de-bruay', showPublicEventAdmin);
router.post(
  '/admindashboard/assaut-de-bruay/save',
  uploadLimiter,
  parsePublicEventImageUpload,
  savePublicEvent,
);
router.get('/admindashboard/assaut-de-bruay/applications', showPublicEventApplications);
router.get('/admindashboard/assaut-de-bruay/applications/:applicationId', showPublicEventApplicationDetails);
router.post('/admindashboard/assaut-de-bruay/applications/:applicationId/status', updatePublicEventApplication);

router.get('/admindashboard/news', showNewsAdminList);
router.get('/admindashboard/news/create', showCreateNewsForm);
router.post(
  '/admindashboard/news/create',
  uploadLimiter,
  parseNewsImageUpload,
  createNewsPost,
);
router.get('/admindashboard/news/:postId/edit', showEditNewsForm);
router.post(
  '/admindashboard/news/:postId/update',
  uploadLimiter,
  parseNewsImageUpload,
  updateNewsPost,
);
router.post('/admindashboard/news/:postId/delete', deleteNewsPost);

router.get('/admindashboard/inbox', showMessageList);
router.post('/admindashboard/inbox/:messageId/status', updateMessageStatus);

router.get('/admindashboard/members', showMemberList);
router.post('/admindashboard/members/:playerId/role', updateAccountRole);
router.post('/admindashboard/members/:playerId/moderation', updateMemberModeration);

router.get('/admindashboard/memberships', showMembershipList);
router.post('/admindashboard/members/:playerId/memberships', updateMembership);

router.get('/admindashboard/events', showEventList);
router.get('/admindashboard/events/create', showCreateEventForm);
router.post('/admindashboard/events/create', createEvent);
router.get('/admindashboard/events/:eventId/edit', showEditEventForm);
router.post('/admindashboard/events/:eventId/update', updateEvent);
router.post('/admindashboard/events/:eventId/cancel', cancelEvent);
router.post('/admindashboard/events/:eventId/reopen', reopenEvent);
router.get('/admindashboard/events/:eventId/attendance', showAttendancePage);
router.post('/admindashboard/events/:eventId/attendance', saveAttendance);
router.post(
  '/admindashboard/events/:eventId/reservations/:playerId/cancel',
  cancelPlayerReservationByAdmin,
);
router.post('/admindashboard/events/:eventId/archive', archiveEvent);

router.get('/admindashboard/games', showGameList);
router.get('/admindashboard/games/create', showCreateGameForm);
router.post('/admindashboard/games/create', parseGameImageUpload, createGame);
router.get('/admindashboard/games/:gameId/edit', showEditGameForm);
router.post('/admindashboard/games/:gameId/update', parseGameImageUpload, updateGame);
router.post('/admindashboard/games/:gameId/disable', disableGame);

router.get('/admindashboard/archives', showArchiveList);
router.get('/admindashboard/archives/:archiveId', showArchiveDetails);
router.get('/admindashboard/archives/:archiveId/download', downloadArchive);

export default router;
