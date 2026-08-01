import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { Op } from 'sequelize';
import {
  Game,
  Player,
  PlayerGame,
  sequelize,
} from '../models/index.js';
import { setFlash, validateMultipartCsrfToken } from './access.controller.js';
import {
  findDefaultAvatar,
} from '../services/default-avatar.service.js';

const AVATAR_DIRECTORY = path.join(process.cwd(), 'public', 'uploads', 'avatars');
const PUBLIC_AVATAR_PREFIX = '/uploads/avatars/';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    callback(allowedTypes.has(file.mimetype) ? null : new Error('INVALID_AVATAR_TYPE'), allowedTypes.has(file.mimetype));
  },
}).single('avatar');

function avatarExtension(buffer) {
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

async function removeLocalAvatar(avatarUrl) {
  if (!avatarUrl?.startsWith(PUBLIC_AVATAR_PREFIX)) return;
  const filename = path.basename(avatarUrl);
  const avatarPath = path.join(AVATAR_DIRECTORY, filename);

  try {
    await fs.unlink(avatarPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function normalizedGameIds(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map(Number).filter(Number.isInteger))];
}

export function parseAvatarUpload(req, res, next) {
  avatarUpload(req, res, (error) => {
    if (!error) return validateMultipartCsrfToken(req, res, next);

    const invalidFile = error instanceof multer.MulterError
      || error.message === 'INVALID_AVATAR_TYPE';
    setFlash(
      req,
      'error',
      invalidFile
        ? 'L’avatar doit être une image JPEG, PNG ou WebP de 2 Mo maximum.'
        : 'Impossible de recevoir cette image.',
    );
    return res.redirect('/account');
  });
}

export async function showPublicProfile(req, res, next) {
  try {
    const player = await Player.findOne({
      where: {
        id: Number(req.params.playerId),
        isActive: true,
      },
      include: [{
        association: 'favoriteGames',
        through: { attributes: ['position'] },
      }],
    });
    if (!player) return res.status(404).send('Profil introuvable.');

    const canViewPrivateProfile = req.currentUser
      && (req.currentUser.id === player.id || req.currentUser.role.name === 'Admin');
    if (!player.isProfilePublic && !canViewPrivateProfile) {
      return res.status(404).send('Profil introuvable.');
    }

    player.favoriteGames.sort((first, second) => first.PlayerGame.position - second.PlayerGame.position);
    return res.render('layouts/public-profile', { player });
  } catch (error) {
    return next(error);
  }
}

export async function updatePublicProfile(req, res, next) {
  const biography = req.body.biography?.trim() || null;
  const gameIds = normalizedGameIds(req.body.gameIds);

  try {
    if (biography && biography.length > 500) {
      setFlash(req, 'error', 'La biographie ne peut pas dépasser 500 caractères.');
      return res.redirect('/account');
    }
    if (gameIds.length > 3) {
      setFlash(req, 'error', 'Vous pouvez sélectionner au maximum trois jeux.');
      return res.redirect('/account');
    }

    const matchingGames = gameIds.length
      ? await Game.count({ where: { id: { [Op.in]: gameIds }, isAvailable: true } })
      : 0;
    if (matchingGames !== gameIds.length) {
      setFlash(req, 'error', 'Un des jeux sélectionnés est invalide ou indisponible.');
      return res.redirect('/account');
    }

    await sequelize.transaction(async (transaction) => {
      await req.currentUser.update({
        biography,
        isProfilePublic: req.body.isProfilePublic === 'on',
      }, { transaction });
      await PlayerGame.destroy({
        where: { playerId: req.currentUser.id },
        transaction,
      });
      if (gameIds.length) {
        await PlayerGame.bulkCreate(
          gameIds.map((gameId, index) => ({
            playerId: req.currentUser.id,
            gameId,
            position: index + 1,
          })),
          { transaction },
        );
      }
    });

    setFlash(req, 'success', 'Votre profil public a été mis à jour.');
    return res.redirect('/account');
  } catch (error) {
    return next(error);
  }
}

export async function updateAvatar(req, res, next) {
  let avatarPath;

  try {
    if (!req.file) {
      setFlash(req, 'error', 'Sélectionnez une image à utiliser comme avatar.');
      return res.redirect('/account');
    }

    const extension = avatarExtension(req.file.buffer);
    if (!extension) {
      setFlash(req, 'error', 'Le contenu du fichier ne correspond pas à une image autorisée.');
      return res.redirect('/account');
    }

    await fs.mkdir(AVATAR_DIRECTORY, { recursive: true });
    const filename = `${crypto.randomUUID()}.${extension}`;
    avatarPath = path.join(AVATAR_DIRECTORY, filename);
    const avatarUrl = `${PUBLIC_AVATAR_PREFIX}${filename}`;
    const previousAvatarUrl = req.currentUser.avatarUrl;

    await fs.writeFile(avatarPath, req.file.buffer, { mode: 0o600 });
    await req.currentUser.update({ avatarUrl });
    await removeLocalAvatar(previousAvatarUrl);

    setFlash(req, 'success', 'Votre avatar a été mis à jour.');
    return res.redirect('/account');
  } catch (error) {
    if (avatarPath) {
      await fs.unlink(avatarPath).catch(() => {});
    }
    return next(error);
  }
}

export async function selectDefaultAvatar(req, res, next) {
  try {
    const avatar = findDefaultAvatar(req.body.avatarId);
    if (!avatar) {
      setFlash(req, 'error', 'Sélectionnez un avatar proposé dans la liste.');
      return res.redirect('/account#public-profile');
    }

    const previousAvatarUrl = req.currentUser.avatarUrl;
    await req.currentUser.update({ avatarUrl: avatar.url });
    await removeLocalAvatar(previousAvatarUrl);
    setFlash(req, 'success', `L’avatar « ${avatar.label} » est maintenant utilisé.`);
    return res.redirect('/account#public-profile');
  } catch (error) {
    return next(error);
  }
}

export async function deleteAvatar(req, res, next) {
  try {
    const previousAvatarUrl = req.currentUser.avatarUrl;
    await req.currentUser.update({ avatarUrl: null });
    await removeLocalAvatar(previousAvatarUrl);
    setFlash(req, 'success', 'Votre avatar a été supprimé.');
    return res.redirect('/account');
  } catch (error) {
    return next(error);
  }
}
