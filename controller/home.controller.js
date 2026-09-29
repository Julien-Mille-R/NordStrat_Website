import sanitizeHtml from 'sanitize-html';
import { NewsPost } from '../models/index.js';

export async function showHomePage(req, res, next) {
  try {
    const latestNews = await NewsPost.findAll({
      include: [{ association: 'author' }],
      order: [['publishedAt', 'DESC']],
      limit: 5,
    });

    for (const newsPost of latestNews) {
      const plainContent = sanitizeHtml(newsPost.content, {
        allowedTags: [],
        allowedAttributes: {},
      })
        .replace(/\s+/g, ' ')
        .trim();

      const excerpt = plainContent.length > 260
        ? `${plainContent.slice(0, 257).trimEnd()}...`
        : plainContent;

      newsPost.setDataValue('excerpt', excerpt);
    }

    return res.render('layouts/home', { latestNews });
  } catch (error) {
    return next(error);
  }
}