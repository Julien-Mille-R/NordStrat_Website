import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import {
  col,
  fn,
  Op,
  where,
} from 'sequelize';
import { Game } from '../models/index.js';
import { setFlash, validateMultipartCsrfToken } from './access.controller.js';
import { attachGameImageUrl } from '../services/game-image.service.js';

const GAME_IMAGE_DIRECTORY = path.join(process.cwd(), 'public', 'uploads', 'games');
const PUBLIC_GAME_IMAGE_PREFIX = '/uploads/games/';
const MAX_GAME_IMAGE_SIZE = 2 * 1024 * 1024;

const gameImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_GAME_IMAGE_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const isAllowed = allowedTypes.has(file.mimetype);
    callback(isAllowed ? null : new Error('INVALID_GAME_IMAGE_TYPE'), isAllowed);
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

function storedGameImagePath(imageUrl) {
  if (!imageUrl?.startsWith(PUBLIC_GAME_IMAGE_PREFIX)) return null;
  return path.join(GAME_IMAGE_DIRECTORY, path.basename(imageUrl));
}

async function deleteStoredGameImage(imageUrl) {
  const imagePath = storedGameImagePath(imageUrl);
  if (imagePath) await fs.unlink(imagePath).catch(() => {});
}

async function saveUploadedGameImage(file) {
  if (!file) return null;
  const extension = imageExtension(file.buffer);
  if (!extension) throw new Error('INVALID_GAME_IMAGE_CONTENT');

  await fs.mkdir(GAME_IMAGE_DIRECTORY, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  const imagePath = path.join(GAME_IMAGE_DIRECTORY, filename);
  await fs.writeFile(imagePath, file.buffer, { mode: 0o600 });
  return { imagePath, imageUrl: `${PUBLIC_GAME_IMAGE_PREFIX}${filename}` };
}

export function parseGameImageUpload(req, res, next) {
  gameImageUpload(req, res, (error) => {
    if (!error) return validateMultipartCsrfToken(req, res, next);

    const formPath = req.params.gameId
      ? `/admindashboard/games/${req.params.gameId}/edit`
      : '/admindashboard/games/create';
    const invalidFile = error instanceof multer.MulterError
      || error.message === 'INVALID_GAME_IMAGE_TYPE';
    setFlash(req, 'error', invalidFile
      ? 'Le logo doit être au format JPEG, PNG ou WebP et ne pas dépasser 2 Mo.'
      : 'Impossible de recevoir ce logo.');
    return res.redirect(formPath);
  });
}

function normalizedText(value) {
  return value?.trim() || null;
}

export function formatGameName(value) {
  return value
    ?.trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const lowercaseWord = word.toLocaleLowerCase('fr-FR');
      return lowercaseWord.charAt(0).toLocaleUpperCase('fr-FR') + lowercaseWord.slice(1);
    })
    .join(' ') || '';
}

function gameRedirect(req) {
  return req.body.redirectTo === '/admindashboard' ? '/admindashboard' : '/admindashboard/games';
}

async function gameNameExists(name, excludedGameId = null) {
  const idCondition = excludedGameId ? { id: { [Op.ne]: excludedGameId } } : {};
  return Game.findOne({
    where: {
      ...idCondition,
      [Op.and]: where(fn('LOWER', col('name')), name.toLocaleLowerCase('fr-FR')),
    },
  });
}

export async function showGameList(req, res, next) {
  try {
    const games = await Game.findAll({ order: [['name', 'ASC']] });
    games.forEach(attachGameImageUrl);
    return res.render('layouts/admin/game-list', { games });
  } catch (error) {
    return next(error);
  }
}

export function showCreateGameForm(req, res) {
  return res.render('layouts/admin/game-form', { game: null });
}

export async function createGame(req, res, next) {
  const name = formatGameName(req.body.name);
  const redirectTo = gameRedirect(req);
  let uploadedImage;

  try {
    if (!name || name.length > 255) {
      setFlash(req, 'error', 'Le nom du jeu doit contenir entre 1 et 255 caractères.');
      return res.redirect(redirectTo);
    }
    if (await gameNameExists(name)) {
      setFlash(req, 'error', 'Ce jeu existe déjà dans le catalogue.');
      return res.redirect(redirectTo);
    }

    uploadedImage = await saveUploadedGameImage(req.file);
    await Game.create({
      name,
      universe: normalizedText(req.body.universe),
      description: normalizedText(req.body.description),
      minPlayers: req.body.minPlayers ? Number(req.body.minPlayers) : null,
      maxPlayers: req.body.maxPlayers ? Number(req.body.maxPlayers) : null,
      imageUrl: uploadedImage?.imageUrl || null,
    });
    setFlash(req, 'success', `Le jeu « ${name} » a été ajouté au catalogue.`);
    return res.redirect(redirectTo);
  } catch (error) {
    if (uploadedImage?.imagePath) await fs.unlink(uploadedImage.imagePath).catch(() => {});
    if (error.message === 'INVALID_GAME_IMAGE_CONTENT') {
      setFlash(req, 'error', 'Le contenu du fichier ne correspond pas à une image autorisée.');
      return res.redirect(redirectTo);
    }
    if (error.name === 'SequelizeUniqueConstraintError' || error.name === 'SequelizeValidationError') {
      setFlash(req, 'error', 'Impossible d’ajouter ce jeu. Vérifiez les informations saisies.');
      return res.redirect(redirectTo);
    }
    return next(error);
  }
}

export async function showEditGameForm(req, res, next) {
  try {
    const game = await Game.findByPk(Number(req.params.gameId));
    if (!game) return res.status(404).send('Jeu introuvable.');
    attachGameImageUrl(game);
    return res.render('layouts/admin/game-form', { game });
  } catch (error) {
    return next(error);
  }
}

export async function updateGame(req, res, next) {
  const name = formatGameName(req.body.name);
  let uploadedImage;

  try {
    const game = await Game.findByPk(Number(req.params.gameId));
    if (!game) return res.status(404).send('Jeu introuvable.');
    if (!name || name.length > 255) {
      setFlash(req, 'error', 'Le nom du jeu doit contenir entre 1 et 255 caractères.');
      return res.redirect(`/admindashboard/games/${game.id}/edit`);
    }
    if (await gameNameExists(name, game.id)) {
      setFlash(req, 'error', 'Un autre jeu porte déjà ce nom.');
      return res.redirect(`/admindashboard/games/${game.id}/edit`);
    }
    uploadedImage = await saveUploadedGameImage(req.file);
    const previousImageUrl = game.imageUrl;
    const removeImage = req.body.removeImage === 'on';
    const imageUrl = uploadedImage?.imageUrl || (removeImage ? null : previousImageUrl);

    await game.update({
      name,
      universe: normalizedText(req.body.universe),
      description: normalizedText(req.body.description),
      minPlayers: req.body.minPlayers ? Number(req.body.minPlayers) : null,
      maxPlayers: req.body.maxPlayers ? Number(req.body.maxPlayers) : null,
      imageUrl,
      isAvailable: req.body.isAvailable === 'on',
    });
    if ((uploadedImage || removeImage) && previousImageUrl) {
      await deleteStoredGameImage(previousImageUrl);
    }
    setFlash(req, 'success', `Le jeu « ${name} » a été mis à jour.`);
    return res.redirect('/admindashboard/games');
  } catch (error) {
    if (uploadedImage?.imagePath) await fs.unlink(uploadedImage.imagePath).catch(() => {});
    if (error.message === 'INVALID_GAME_IMAGE_CONTENT') {
      setFlash(req, 'error', 'Le contenu du fichier ne correspond pas à une image autorisée.');
      return res.redirect(`/admindashboard/games/${req.params.gameId}/edit`);
    }
    if (error.name === 'SequelizeUniqueConstraintError' || error.name === 'SequelizeValidationError') {
      setFlash(req, 'error', 'Impossible de modifier ce jeu. Vérifiez les informations saisies.');
      return res.redirect(`/admindashboard/games/${req.params.gameId}/edit`);
    }
    return next(error);
  }
}

export async function disableGame(req, res, next) {
  try {
    const game = await Game.findByPk(Number(req.params.gameId));
    if (!game) return res.status(404).send('Jeu introuvable.');
    await game.update({ isAvailable: false });
    return res.redirect('/admindashboard/games');
  } catch (error) {
    return next(error);
  }
}
