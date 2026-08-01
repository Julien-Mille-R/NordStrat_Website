import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { NewsPost, sequelize } from '../models/index.js';
import { setFlash, validateMultipartCsrfToken } from './access.controller.js';
import { recordAdminAction } from '../services/audit-log.service.js';
import { applySeo } from './seo.controller.js';

const NEWS_IMAGE_DIRECTORY = path.join(process.cwd(), 'public', 'uploads', 'news');
const PUBLIC_NEWS_IMAGE_PREFIX = '/uploads/news/';
const MAX_NEWS_IMAGE_SIZE = 5 * 1024 * 1024;

const newsImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_NEWS_IMAGE_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const isAllowed = allowedTypes.has(file.mimetype);
    callback(isAllowed ? null : new Error('INVALID_NEWS_IMAGE_TYPE'), isAllowed);
  },
}).single('image');

function imageExtension(buffer) {
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

function storedNewsImagePath(imageUrl) {
  if (!imageUrl?.startsWith(PUBLIC_NEWS_IMAGE_PREFIX)) return null;
  return path.join(NEWS_IMAGE_DIRECTORY, path.basename(imageUrl));
}

async function deleteStoredNewsImage(imageUrl) {
  const imagePath = storedNewsImagePath(imageUrl);
  if (imagePath) await fs.unlink(imagePath).catch(() => {});
}

async function saveUploadedNewsImage(file) {
  if (!file) return null;
  const extension = imageExtension(file.buffer);
  if (!extension) throw new Error('INVALID_NEWS_IMAGE_CONTENT');

  await fs.mkdir(NEWS_IMAGE_DIRECTORY, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  const imagePath = path.join(NEWS_IMAGE_DIRECTORY, filename);
  await fs.writeFile(imagePath, file.buffer, { mode: 0o600 });
  return {
    imagePath,
    imageUrl: `${PUBLIC_NEWS_IMAGE_PREFIX}${filename}`,
  };
}

export function parseNewsImageUpload(req, res, next) {
  newsImageUpload(req, res, (error) => {
    if (!error) return validateMultipartCsrfToken(req, res, next);

    const formPath = req.params.postId
      ? `/admindashboard/news/${req.params.postId}/edit`
      : '/admindashboard/news/create';
    const invalidFile = error instanceof multer.MulterError
      || error.message === 'INVALID_NEWS_IMAGE_TYPE';
    setFlash(
      req,
      'error',
      invalidFile
        ? 'L’image doit être au format JPEG, PNG ou WebP et ne pas dépasser 5 Mo.'
        : 'Impossible de recevoir cette image.',
    );
    return res.redirect(formPath);
  });
}

export function showCreateNewsForm(req, res) {
  return res.render('layouts/admin/news-form', { newsPost: null });
}

export async function showNewsAdminList(req, res, next) {
  try {
    const newsPosts = await NewsPost.findAll({
      include: [{ association: 'author' }],
      order: [['publishedAt', 'DESC']],
    });
    return res.render('layouts/admin/news-list', { newsPosts });
  } catch (error) {
    return next(error);
  }
}

export async function showEditNewsForm(req, res, next) {
  try {
    const newsPost = await NewsPost.findByPk(Number(req.params.postId));
    if (!newsPost) return res.status(404).send('Actualité introuvable.');
    return res.render('layouts/admin/news-form', { newsPost });
  } catch (error) {
    return next(error);
  }
}

export async function createNewsPost(req, res, next) {
  const title = req.body.title?.trim() || '';
  const content = req.body.content?.trim() || '';
  let imagePath;

  try {
    if (title.length < 3 || title.length > 150 || content.length < 20 || content.length > 10000) {
      setFlash(req, 'error', 'Le titre doit contenir 3 à 150 caractères et le texte 20 à 10 000 caractères.');
      return res.redirect('/admindashboard/news/create');
    }

    const uploadedImage = await saveUploadedNewsImage(req.file);
    imagePath = uploadedImage?.imagePath;

    const newsPost = await sequelize.transaction(async (transaction) => {
      const createdPost = await NewsPost.create({
        title,
        content,
        imageUrl: uploadedImage?.imageUrl || null,
        authorId: req.currentUser.id,
        publishedAt: new Date(),
      }, { transaction });
      await recordAdminAction({
        admin: req.currentUser,
        category: 'news',
        action: 'news_created',
        targetType: 'news_post',
        targetId: createdPost.id,
        targetLabel: createdPost.title,
        description: 'Actualité publiée.',
        transaction,
      });
      return createdPost;
    });

    setFlash(req, 'success', 'L’actualité a été publiée.');
    return res.redirect(`/news/${newsPost.id}`);
  } catch (error) {
    if (imagePath) await fs.unlink(imagePath).catch(() => {});
    if (error.message === 'INVALID_NEWS_IMAGE_CONTENT') {
      setFlash(req, 'error', 'Le contenu du fichier ne correspond pas à une image autorisée.');
      return res.redirect('/admindashboard/news/create');
    }
    if (error.name === 'SequelizeValidationError') {
      setFlash(req, 'error', 'Impossible de publier cette actualité. Vérifiez son contenu.');
      return res.redirect('/admindashboard/news/create');
    }
    return next(error);
  }
}

export async function updateNewsPost(req, res, next) {
  const postId = Number(req.params.postId);
  const title = req.body.title?.trim() || '';
  const content = req.body.content?.trim() || '';
  let uploadedImage;

  try {
    const newsPost = await NewsPost.findByPk(postId);
    if (!newsPost) return res.status(404).send('Actualité introuvable.');
    if (title.length < 3 || title.length > 150 || content.length < 20 || content.length > 10000) {
      setFlash(req, 'error', 'Le titre doit contenir 3 à 150 caractères et le texte 20 à 10 000 caractères.');
      return res.redirect(`/admindashboard/news/${postId}/edit`);
    }

    uploadedImage = await saveUploadedNewsImage(req.file);
    const previousImageUrl = newsPost.imageUrl;
    const removeImage = req.body.removeImage === 'on';
    const imageUrl = uploadedImage?.imageUrl || (removeImage ? null : previousImageUrl);

    await sequelize.transaction(async (transaction) => {
      await newsPost.update({ title, content, imageUrl }, { transaction });
      await recordAdminAction({
        admin: req.currentUser,
        category: 'news',
        action: 'news_updated',
        targetType: 'news_post',
        targetId: newsPost.id,
        targetLabel: newsPost.title,
        description: 'Actualité modifiée.',
        transaction,
      });
    });
    if ((uploadedImage || removeImage) && previousImageUrl) {
      await deleteStoredNewsImage(previousImageUrl);
    }

    setFlash(req, 'success', 'L’actualité a été modifiée.');
    return res.redirect(`/news/${newsPost.id}`);
  } catch (error) {
    if (uploadedImage?.imagePath) await fs.unlink(uploadedImage.imagePath).catch(() => {});
    if (error.message === 'INVALID_NEWS_IMAGE_CONTENT' || error.name === 'SequelizeValidationError') {
      setFlash(req, 'error', 'Impossible de modifier cette actualité. Vérifiez son contenu et son image.');
      return res.redirect(`/admindashboard/news/${postId}/edit`);
    }
    return next(error);
  }
}

export async function deleteNewsPost(req, res, next) {
  try {
    const newsPost = await NewsPost.findByPk(Number(req.params.postId));
    if (!newsPost) return res.status(404).send('Actualité introuvable.');
    const imageUrl = newsPost.imageUrl;
    await sequelize.transaction(async (transaction) => {
      await recordAdminAction({
        admin: req.currentUser,
        category: 'news',
        action: 'news_deleted',
        targetType: 'news_post',
        targetId: newsPost.id,
        targetLabel: newsPost.title,
        description: 'Actualité supprimée.',
        transaction,
      });
      await newsPost.destroy({ transaction });
    });
    await deleteStoredNewsImage(imageUrl);
    setFlash(req, 'success', 'L’actualité a été supprimée.');
    return res.redirect('/admindashboard/news');
  } catch (error) {
    return next(error);
  }
}

export async function showNewsList(req, res, next) {
  try {
    const newsPosts = await NewsPost.findAll({
      include: [{ association: 'author' }],
      order: [['publishedAt', 'DESC']],
    });
    return res.render('layouts/news-list', { newsPosts });
  } catch (error) {
    return next(error);
  }
}

export async function showNewsDetails(req, res, next) {
  try {
    const newsPost = await NewsPost.findByPk(Number(req.params.postId), {
      include: [{ association: 'author' }],
    });
    if (!newsPost) return res.status(404).send('Actualité introuvable.');
    const plainContent = newsPost.content.replace(/\s+/g, ' ').trim();
    const description = plainContent.length > 155
      ? `${plainContent.slice(0, 152).trimEnd()}...`
      : plainContent;
    const canonicalPath = `/news/${newsPost.id}`;
    const canonicalUrl = `${res.locals.seo.baseUrl}${canonicalPath}`;
    const authorName = newsPost.author.nickname
      || `${newsPost.author.firstname} ${newsPost.author.lastname}`;
    applySeo(res, {
      title: `${newsPost.title} | Nord Stratégie`,
      description,
      canonicalPath,
      type: 'article',
      imageUrl: newsPost.imageUrl,
      publishedTime: newsPost.publishedAt.toISOString(),
      modifiedTime: newsPost.updatedAt.toISOString(),
      schemas: [{
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: newsPost.title,
        description,
        datePublished: newsPost.publishedAt.toISOString(),
        dateModified: newsPost.updatedAt.toISOString(),
        mainEntityOfPage: canonicalUrl,
        ...(newsPost.imageUrl ? { image: `${res.locals.seo.baseUrl}${newsPost.imageUrl}` } : {}),
        author: {
          '@type': 'Person',
          name: authorName,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Nord Stratégie',
          url: res.locals.seo.baseUrl,
        },
      }],
    });
    return res.render('layouts/news-details', { newsPost });
  } catch (error) {
    return next(error);
  }
}
