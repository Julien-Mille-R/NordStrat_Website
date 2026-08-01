import { NewsPost } from '../models/index.js';

export async function showHomePage(req, res, next) {
  try {
    const latestNews = await NewsPost.findAll({
      include: [{ association: 'author' }],
      order: [['publishedAt', 'DESC']],
      limit: 5,
    });
    return res.render('layouts/home', { latestNews });
  } catch (error) {
    return next(error);
  }
}
