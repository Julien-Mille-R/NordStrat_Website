import crypto from 'crypto';
import { PasswordResetToken } from '../models/index.js';

const TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createPasswordResetToken(playerId) {
  const token = crypto.randomBytes(32).toString('hex');

  await PasswordResetToken.destroy({
    where: { playerId },
  });

  await PasswordResetToken.create({
    playerId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  return token;
}

export async function findValidPasswordResetToken(token, options = {}) {
  if (!token) return null;

  const tokenHash = hashToken(token);

  const resetToken = await PasswordResetToken.findOne({
    where: { tokenHash },
    ...options,
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    return null;
  }

  return resetToken;
}

export async function consumePasswordResetToken(token, transaction) {
  if (!transaction) {
    throw new Error('Une transaction est requise pour consommer un token de réinitialisation.');
  }

  const resetToken = await findValidPasswordResetToken(token, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!resetToken) {
    return null;
  }

  await resetToken.update({
    usedAt: new Date(),
  }, { transaction });

  return resetToken;
}