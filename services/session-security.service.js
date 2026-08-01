import { QueryTypes } from 'sequelize';
import { sequelize } from '../models/index.js';

export function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

export function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

export async function invalidatePlayerSessions(playerId, excludedSessionId = null) {
  const replacements = { playerId: String(playerId) };
  const excludedSessionClause = excludedSessionId ? 'AND sid <> :excludedSessionId' : '';
  if (excludedSessionId) replacements.excludedSessionId = excludedSessionId;

  return sequelize.query(
    `DELETE FROM session
     WHERE sess ->> 'userId' = :playerId
     ${excludedSessionClause}`,
    {
      replacements,
      type: QueryTypes.DELETE,
    },
  );
}

export async function renewAuthenticatedSession(req, playerId) {
  await regenerateSession(req);
  req.session.userId = playerId;
  await invalidatePlayerSessions(playerId, req.sessionID);
}
