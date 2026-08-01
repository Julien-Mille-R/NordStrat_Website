import { applySeo } from './seo.controller.js';

export function showNotFound(req, res) {
  applySeo(res, {
    title: 'Page introuvable | Nord Stratégie',
    description: 'La page demandée est introuvable sur le site de Nord Stratégie.',
    robots: 'noindex, follow',
    schemas: [],
  });
  res.setHeader('X-Robots-Tag', 'noindex');
  return res.status(404).render('layouts/404');
}
