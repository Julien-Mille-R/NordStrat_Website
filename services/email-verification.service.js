import crypto from 'crypto';
import { EmailVerificationToken } from '../models/index.js';

const TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createEmailVerificationToken(playerId, email) {
  const token = crypto.randomBytes(32).toString('hex');

  await EmailVerificationToken.destroy({
    where: { playerId },
  });

  await EmailVerificationToken.create({
    playerId,
    email,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  return token;
}

export async function findValidEmailVerificationToken(token, options = {}) {
  if (!token) return null;

  const tokenHash = hashToken(token);

  const verificationToken = await EmailVerificationToken.findOne({
    where: { tokenHash },
    ...options,
  });

  if (
    !verificationToken
    || verificationToken.usedAt
    || verificationToken.expiresAt <= new Date()
  ) {
    return null;
  }

  return verificationToken;
}

export async function consumeEmailVerificationToken(token, transaction) {
  if (!transaction) {
    throw new Error('Une transaction est requise pour consommer un token de validation d’e-mail.');
  }

  const verificationToken = await findValidEmailVerificationToken(token, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!verificationToken) {
    return null;
  }

  await verificationToken.update({
    usedAt: new Date(),
  }, { transaction });

  return verificationToken;
}