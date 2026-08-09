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
import { deleteUploadedImage, saveUploadedImage } from '../services/upload-storage.service.js';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    callback(allowedTypes.has(file.mimetype) ? null : new Error('INVALID_AVATAR_TYPE'), allowedTypes.has(file.mimetype));
  },
}).single('avatar');

async function removeLocalAvatar(avatarUrl) {
  return deleteUploadedImage(avatarUrl, 'avatars');
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
  let uploadedAvatar;

  try {
    if (!req.file) {
      setFlash(req, 'error', 'Sélectionnez une image à utiliser comme avatar.');
      return res.redirect('/account');
    }

    uploadedAvatar = await saveUploadedImage(req.file, 'avatars', 'INVALID_AVATAR_CONTENT');
    const previousAvatarUrl = req.currentUser.avatarUrl;

    await req.currentUser.update({ avatarUrl: uploadedAvatar.imageUrl });
    await removeLocalAvatar(previousAvatarUrl);

    setFlash(req, 'success', 'Votre avatar a été mis à jour.');
    return res.redirect('/account');
  } catch (error) {
    if (uploadedAvatar) await deleteUploadedImage(uploadedAvatar.imageUrl, 'avatars');
    if (error.message === 'INVALID_AVATAR_CONTENT') {
      setFlash(req, 'error', 'Le contenu du fichier ne correspond pas à une image autorisée.');
      return res.redirect('/account');
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
