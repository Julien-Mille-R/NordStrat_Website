import { NewsPost } from '../models/index.js';

const SITE_NAME = 'Nord Stratégie';
const DEFAULT_DESCRIPTION = 'Nord Stratégie rassemble les passionnés de jeux de figurines à Bruay-sur-l’Escaut : soirées jeux, découvertes, événements et vie associative.';
const PRIVATE_PATH_PREFIXES = [
  '/account',
  '/admindashboard',
  '/admin',
  '/booking',
  '/members/',
  '/events/assaut-de-bruay',
];
const STATIC_PAGE_SEO = {
  '/': {
    title: 'Nord Stratégie | Jeux de figurines à Bruay-sur-l’Escaut',
    description: DEFAULT_DESCRIPTION,
    schema: 'organization',
  },
  '/news': {
    title: 'Actualités | Nord Stratégie',
    description: 'Suivez les actualités, projets, tournois et rendez-vous de l’association Nord Stratégie.',
  },
  '/about': {
    title: 'À propos de Nord Stratégie | Association de jeux de figurines',
    description: 'Découvrez Nord Stratégie, association créée en 2007 pour faire découvrir et partager les jeux de figurines à Bruay-sur-l’Escaut.',
  },
  '/contact': {
    title: 'Contacter Nord Stratégie | Bruay-sur-l’Escaut',
    description: 'Contactez l’association Nord Stratégie pour découvrir les soirées jeux, poser une question ou préparer votre première visite.',
  },
  '/accessibility': {
    title: 'Accessibilité | Nord Stratégie',
    description: 'Consultez la démarche d’accessibilité du site Nord Stratégie et signalez une difficulté d’utilisation.',
  },
  '/cgu': {
    title: 'Conditions générales d’utilisation | Nord Stratégie',
    description: 'Consultez les conditions générales d’utilisation du site Nord Stratégie.',
  },
  '/mentions-legales': {
    title: 'Mentions légales | Nord Stratégie',
    description: 'Consultez les mentions légales du site de l’association Nord Stratégie.',
  },
  '/politique-confidentialite': {
    title: 'Politique de confidentialité | Nord Stratégie',
    description: 'Découvrez comment Nord Stratégie protège et utilise les données personnelles traitées sur son site.',
  },
};

function normalizedBaseUrl() {
  const configuredUrl = process.env.SITE_URL?.trim();
  const fallbackUrl = `http://localhost:${process.env.PORT || 3000}`;
  return (configuredUrl || fallbackUrl).replace(/\/+$/, '');
}

function absoluteUrl(value, baseUrl = normalizedBaseUrl()) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl}${value.startsWith('/') ? value : `/${value}`}`;
}

function organizationSchema(baseUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${baseUrl}/#organization`,
    name: SITE_NAME,
    url: baseUrl,
    logo: `${baseUrl}/icons/favicon.svg`,
    description: DEFAULT_DESCRIPTION,
    foundingDate: '2007',
    email: 'nord.strategie@gmail.com',
    areaServed: {
      '@type': 'AdministrativeArea',
      name: 'Bruay-sur-l’Escaut et ses alentours',
    },
    knowsAbout: [
      'Jeux de figurines',
      'Wargames',
      'Modélisme',
      'Peinture de figurines',
      'Jeux de plateau',
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Salle Musmeaux, rue Émile Zola',
      postalCode: '59860',
      addressLocality: 'Bruay-sur-l’Escaut',
      addressCountry: 'FR',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Renseignements',
      email: 'nord.strategie@gmail.com',
      availableLanguage: 'fr',
    },
    sameAs: [
      'https://www.facebook.com/nordstrategie/?locale=fr_FR',
      'https://discord.gg/ws3YHhukB8',
    ],
  };
}

function safeStructuredData(items) {
  return items.map((item) => JSON.stringify(item).replace(/</g, '\\u003c'));
}

export function applySeo(res, overrides = {}) {
  const currentSeo = res.locals.seo || {};
  const baseUrl = currentSeo.baseUrl || normalizedBaseUrl();
  const canonicalPath = overrides.canonicalPath ?? currentSeo.canonicalPath;
  const schemas = overrides.schemas ?? currentSeo.schemas ?? [];

  res.locals.seo = {
    ...currentSeo,
    ...overrides,
    baseUrl,
    canonicalUrl: overrides.canonicalUrl
      || (canonicalPath ? absoluteUrl(canonicalPath, baseUrl) : currentSeo.canonicalUrl),
    imageUrl: absoluteUrl(overrides.imageUrl ?? currentSeo.imageUrl, baseUrl),
    structuredData: safeStructuredData(schemas),
  };
}

export function provideSeo(req, res, next) {
  const baseUrl = normalizedBaseUrl();
  const pathname = req.path === '/' ? '/' : req.path.replace(/\/+$/, '');
  const pageSeo = STATIC_PAGE_SEO[pathname] || {};
  const noindex = PRIVATE_PATH_PREFIXES.some((prefix) => (
    prefix.endsWith('/') ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`)
  ));
  const schemas = pageSeo.schema === 'organization' ? [organizationSchema(baseUrl)] : [];

  res.locals.seo = {
    baseUrl,
    siteName: SITE_NAME,
    title: pageSeo.title || `${SITE_NAME} | Association de jeux de figurines`,
    description: pageSeo.description || DEFAULT_DESCRIPTION,
    canonicalPath: pathname,
    canonicalUrl: absoluteUrl(pathname, baseUrl),
    imageUrl: null,
    type: 'website',
    robots: noindex ? 'noindex, nofollow' : 'index, follow',
    structuredData: safeStructuredData(schemas),
  };

  if (noindex) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return next();
}

export function showRobotsTxt(req, res) {
  const baseUrl = normalizedBaseUrl();
  res.type('text/plain');
  return res.send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /account',
    'Disallow: /admindashboard',
    'Disallow: /admin',
    'Disallow: /auth',
    'Disallow: /booking',
    'Disallow: /members',
    'Disallow: /tables',
    'Disallow: /events/assaut-de-bruay',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n'));
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function showSitemapXml(req, res, next) {
  try {
    const baseUrl = normalizedBaseUrl();
    const publicPages = ['/', '/news', '/about', '/contact', '/accessibility'];
    const newsPosts = await NewsPost.findAll({
      attributes: ['id', 'updatedAt'],
      order: [['publishedAt', 'DESC']],
    });
    const urls = [
      ...publicPages.map((pathname) => ({ location: `${baseUrl}${pathname}` })),
      ...newsPosts.map((post) => ({
        location: `${baseUrl}/news/${post.id}`,
        lastModified: post.updatedAt?.toISOString(),
      })),
    ];
    const entries = urls.map(({ location, lastModified }) => [
      '  <url>',
      `    <loc>${xmlEscape(location)}</loc>`,
      ...(lastModified ? [`    <lastmod>${xmlEscape(lastModified)}</lastmod>`] : []),
      '  </url>',
    ].join('\n')).join('\n');

    res.type('application/xml');
    return res.send([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      entries,
      '</urlset>',
      '',
    ].join('\n'));
  } catch (error) {
    return next(error);
  }
}
