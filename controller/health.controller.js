import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { sequelize } from '../models/index.js';
import { ARCHIVE_DIRECTORY } from '../models/booking-archive.js';
import { UPLOAD_ROOT } from '../services/upload-storage.service.js';

async function writableDirectory(directory) {
  await fs.mkdir(directory, { recursive: true });
  await fs.access(directory, fsConstants.R_OK | fsConstants.W_OK);
}

export async function showHealth(req, res) {
  try {
    await Promise.all([
      sequelize.authenticate(),
      writableDirectory(UPLOAD_ROOT),
      writableDirectory(ARCHIVE_DIRECTORY),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ status: 'healthy' });
  } catch (error) {
    console.error('Healthcheck en échec.', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ status: 'unhealthy' });
  }
}
