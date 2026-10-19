
import multer from 'multer';
import sanitizeHtml from 'sanitize-html';
import { Op } from 'sequelize';
import {
  NewsPost,
  NewsPostImage,
  sequelize,
} from '../models/index.js';
import {
  setFlash,
  validateMultipartCsrfToken,
} from './access.controller.js';
import { recordAdminAction } from '../services/audit-log.service.js';
import { applySeo } from './seo.controller.js';
import {
  deleteUploadedImage,
  saveUploadedImage,
} from '../services/upload-storage.service.js';

const MAX_NEWS_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 10;
const NEWS_CONTENT_MAX_LENGTH = 50000;

const NEWS_CATEGORIES = ['accueil', 'actualites', 'assaut_bruay'];

const NEWS_HTML_SANITIZE_OPTIONS = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u',
    'h2', 'h3', 'ul', 'ol', 'li', 'a',
    'blockquote', 'table', 'thead', 'tbody',
    'tr', 'th', 'td', 'hr', 'img',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
  allowProtocolRelative: false,
  transformTags: {
    div: 'p',
  },
};

function sanitizeNewsContent(content) {
  return sanitizeHtml(content, NEWS_HTML_SANITIZE_OPTIONS).trim();
}

function getCategory(value) {
  return NEWS_CATEGORIES.includes(value) ? value : null;
}

function getVisibility(value) {
  return value === 'on' || value === 'true' || value === true;
}

function getFormPath(postId) {
  return postId
    ? `/admindashboard/news/${postId}/edit`
    : '/admindashboard/news/create';
}

function getUploadedFiles(req, fieldName) {
  return req.files?.[fieldName] || [];
}

const newsImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_NEWS_IMAGE_SIZE,
    files: MAX_GALLERY_IMAGES + 1,
  },
  fileFilter(req, file, callback) {
    const allowedTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);

    const isAllowed = allowedTypes.has(file.mimetype);
    callback(isAllowed ? null : new Error('INVALID_NEWS_IMAGE_TYPE'), isAllowed);
  },
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'galleryImages', maxCount: MAX_GALLERY_IMAGES },
]);

async function saveUploadedNewsImage(file) {
  return saveUploadedImage(file, 'news', 'INVALID_NEWS_IMAGE_CONTENT');
}

async function saveNewsImages(files) {
  const savedImages = [];

  try {
    for (const file of files) {
      const savedImage = await saveUploadedNewsImage(file);
      if (savedImage) savedImages.push(savedImage);
    }

    return savedImages;
  } catch (error) {
    await Promise.all(
      savedImages.map((image) => deleteUploadedImage(image.imageUrl, 'news')),
    );
    throw error;
  }
}

async function cleanUploadedImages(images) {
  await Promise.all(
    images
      .filter(Boolean)
      .map((image) => deleteUploadedImage(image.imageUrl, 'news')),
  );
}

function parseRemovedGalleryIds(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  return [...new Set(
    values
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0),
  )];
}

function getValidationErrorMessage(error) {
  if (error.message === 'INVALID_NEWS_IMAGE_CONTENT') {
    return 'Le contenu d’un fichier ne correspond pas à une image autorisée.';
  }

  if (error.name === 'SequelizeValidationError') {
    return 'Certaines informations sont invalides. Vérifiez le titre, le contenu et la catégorie.';
  }

  return null;
}

export function parseNewsImageUpload(req, res, next) {
  newsImageUpload(req, res, (error) => {
    if (!error) {
      return validateMultipartCsrfToken(req, res, next);
    }

    const formPath = getFormPath(req.params.postId);
    const invalidFile = error instanceof multer.MulterError
      || error.message === 'INVALID_NEWS_IMAGE_TYPE';

    setFlash(
      req,
      'error',
      invalidFile
        ? 'Les images doivent être au format JPEG, PNG ou WebP et ne pas dépasser 5 Mo chacune. Vous pouvez ajouter jusqu’à 10 photos à la galerie.'
        : 'Impossible de recevoir les images.',
    );

    return res.redirect(formPath);
  });
}

export function showCreateNewsForm(req, res) {
  return res.render('layouts/admin/news-form', {
    newsPost: null,
  });
}

export async function showNewsAdminList(req, res, next) {
  try {
    const newsPosts = await NewsPost.findAll({
      include: [
        { association: 'author' },
        { association: 'images' },
      ],
      order: [['publishedAt', 'DESC']],
    });

    return res.render('layouts/admin/news-list', { newsPosts });
  } catch (error) {
    return next(error);
  }
}

export async function showEditNewsForm(req, res, next) {
  try {
    const newsPost = await NewsPost.findByPk(Number(req.params.postId), {
      include: [{ association: 'images' }],
      order: [[{ model: NewsPostImage, as: 'images' }, 'displayOrder', 'ASC']],
    });

    if (!newsPost) {
      return res.status(404).send('Actualité introuvable.');
    }

    return res.render('layouts/admin/news-form', { newsPost });
  } catch (error) {
    return next(error);
  }
}

export async function createNewsPost(req, res, next) {
  const title = req.body.title?.trim() || '';
  const content = sanitizeNewsContent(req.body.content || '');
  const category = getCategory(req.body.category);
  const isVisible = getVisibility(req.body.isVisible);
  const primaryFile = getUploadedFiles(req, 'image')[0];
  const galleryFiles = getUploadedFiles(req, 'galleryImages');

  let uploadedImage = null;
  let uploadedGalleryImages = [];

  try {
    if (
      title.length < 3
      || title.length > 150
      || content.length < 20
      || content.length > NEWS_CONTENT_MAX_LENGTH
      || !category
    ) {
      setFlash(
        req,
        'error',
        'Vérifiez le titre (3 à 150 caractères), le contenu (20 à 50 000 caractères) et la catégorie.',
      );
      return res.redirect(getFormPath());
    }

    uploadedImage = await saveUploadedNewsImage(primaryFile);
    uploadedGalleryImages = await saveNewsImages(galleryFiles);

    const newsPost = await sequelize.transaction(async (transaction) => {
      const createdPost = await NewsPost.create({
        title,
        content,
        category,
        isVisible,
        imageUrl: uploadedImage?.imageUrl || null,
        authorId: req.currentUser.id,
        publishedAt: new Date(),
      }, { transaction });

      if (uploadedGalleryImages.length) {
        await NewsPostImage.bulkCreate(
          uploadedGalleryImages.map((image, index) => ({
            newsPostId: createdPost.id,
            imageUrl: image.imageUrl,
            displayOrder: index,
          })),
          { transaction },
        );
      }

      await recordAdminAction({
        admin: req.currentUser,
        category: 'news',
        action: 'news_created',
        targetType: 'news_post',
        targetId: createdPost.id,
        targetLabel: createdPost.title,
        description: 'Actualité créée.',
        transaction,
      });

      return createdPost;
    });

    setFlash(req, 'success', 'L’actualité a été créée.');
    return res.redirect('/admindashboard/news');
  } catch (error) {
    await cleanUploadedImages([
      uploadedImage,
      ...uploadedGalleryImages,
    ]);

    const message = getValidationErrorMessage(error);
    if (message) {
      setFlash(req, 'error', message);
      return res.redirect(getFormPath());
    }

    return next(error);
  }
}

export async function updateNewsPost(req, res, next) {
  const postId = Number(req.params.postId);
  const title = req.body.title?.trim() || '';
  const content = sanitizeNewsContent(req.body.content || '');
  const category = getCategory(req.body.category);
  const isVisible = getVisibility(req.body.isVisible);
  const primaryFile = getUploadedFiles(req, 'image')[0];
  const galleryFiles = getUploadedFiles(req, 'galleryImages');
  const removeGalleryIds = parseRemovedGalleryIds(req.body.removeGalleryImageIds);

  let uploadedImage = null;
  let uploadedGalleryImages = [];

  try {
    const newsPost = await NewsPost.findByPk(postId, {
      include: [{ association: 'images' }],
    });

    if (!newsPost) {
      return res.status(404).send('Actualité introuvable.');
    }

    if (
      title.length < 3
      || title.length > 150
      || content.length < 20
      || content.length > NEWS_CONTENT_MAX_LENGTH
      || !category
    ) {
      setFlash(
        req,
        'error',
        'Vérifiez le titre (3 à 150 caractères), le contenu (20 à 50 000 caractères) et la catégorie.',
      );
      return res.redirect(getFormPath(postId));
    }

    uploadedImage = await saveUploadedNewsImage(primaryFile);
    uploadedGalleryImages = await saveNewsImages(galleryFiles);

    const previousImageUrl = newsPost.imageUrl;
    const removeImage = req.body.removeImage === 'on';
    const imageUrl = uploadedImage?.imageUrl
      || (removeImage ? null : previousImageUrl);

    const imagesToRemove = (newsPost.images || []).filter(
      (image) => removeGalleryIds.includes(image.id),
    );

    await sequelize.transaction(async (transaction) => {
      await newsPost.update({
        title,
        content,
        category,
        isVisible,
        imageUrl,
      }, { transaction });

      if (imagesToRemove.length) {
        await NewsPostImage.destroy({
          where: {
            id: { [Op.in]: imagesToRemove.map((image) => image.id) },
            newsPostId: newsPost.id,
          },
          transaction,
        });
      }

      if (uploadedGalleryImages.length) {
        const existingImages = await NewsPostImage.count({
          where: { newsPostId: newsPost.id },
          transaction,
        });

        await NewsPostImage.bulkCreate(
          uploadedGalleryImages.map((image, index) => ({
            newsPostId: newsPost.id,
            imageUrl: image.imageUrl,
            displayOrder: existingImages + index,
          })),
          { transaction },
        );
      }

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
      await deleteUploadedImage(previousImageUrl, 'news');
    }

    await cleanUploadedImages(imagesToRemove);

    setFlash(req, 'success', 'L’actualité a été modifiée.');
    return res.redirect('/admindashboard/news');
  } catch (error) {
    await cleanUploadedImages([
      uploadedImage,
      ...uploadedGalleryImages,
    ]);

    const message = getValidationErrorMessage(error);
    if (message) {
      setFlash(req, 'error', message);
      return res.redirect(getFormPath(postId));
    }

    return next(error);
  }
}

export async function deleteNewsPost(req, res, next) {
  try {
    const newsPost = await NewsPost.findByPk(Number(req.params.postId), {
      include: [{ association: 'images' }],
    });

    if (!newsPost) {
      return res.status(404).send('Actualité introuvable.');
    }

    const imageUrls = [
      newsPost.imageUrl,
      ...(newsPost.images || []).map((image) => image.imageUrl),
    ].filter(Boolean);

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

    await Promise.all(
      imageUrls.map((url) => deleteUploadedImage(url, 'news')),
    );

    setFlash(req, 'success', 'L’actualité a été supprimée.');
    return res.redirect('/admindashboard/news');
  } catch (error) {
    return next(error);
  }
}

export async function showNewsList(req, res, next) {
  try {
    const newsPosts = await NewsPost.findAll({
      where: {
        isVisible: true,
        category: { [Op.in]: ['accueil', 'actualites'] },
      },
      include: [
        { association: 'author' },
        { association: 'images' },
      ],
      order: [['publishedAt', 'DESC']],
    });

    for (const newsPost of newsPosts) {
      const plainContent = sanitizeHtml(newsPost.content, {
        allowedTags: [],
        allowedAttributes: {},
      }).replace(/\s+/g, ' ').trim();

      const excerpt = plainContent.length > 190
        ? `${plainContent.slice(0, 187).trimEnd()}...`
        : plainContent;

      newsPost.setDataValue('excerpt', excerpt);
    }

    return res.render('layouts/news-list', { newsPosts });
  } catch (error) {
    return next(error);
  }
}

export async function showNewsDetails(req, res, next) {
  try {
    const newsPost = await NewsPost.findOne({
      where: {
        id: Number(req.params.postId),
        isVisible: true,
        category: {
          [Op.in]: ['accueil', 'actualites'],
        },
      },
      include: [
        { association: 'author' },
        { association: 'images' },
      ],
      order: [[{ model: NewsPostImage, as: 'images' }, 'displayOrder', 'ASC']],
    });

    if (!newsPost) {
      return res.status(404).send('Actualité introuvable.');
    }

    const plainContent = sanitizeHtml(newsPost.content, {
      allowedTags: [],
      allowedAttributes: {},
    }).replace(/\s+/g, ' ').trim();

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
        ...(newsPost.imageUrl
          ? { image: `${res.locals.seo.baseUrl}${newsPost.imageUrl}` }
          : {}),
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
