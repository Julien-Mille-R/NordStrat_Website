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

export function showServerError(error, req, res, next) {
  console.error(error);
  if (res.headersSent) return next(error);
  applySeo(res, {
    title: 'Erreur interne | Nord Stratégie',
    description: 'Une erreur empêche temporairement l’affichage de cette page.',
    robots: 'noindex, nofollow',
    schemas: [],
  });
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.status(500).render('layouts/500');
}
