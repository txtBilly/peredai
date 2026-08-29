import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ten2ten.ru';

// Public, crawlable routes (per locale). Auth/account/admin/api and anything
// behind a session are intentionally excluded.
const ROUTES = ['browse', 'welcome', 'list', 'safety', 'terms', 'privacy', 'personal-data-consent'];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    // locale root
    entries.push({
      url: `${APP_URL}/${locale}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: locale === 'ru' ? 1 : 0.8,
    });
    for (const route of ROUTES) {
      entries.push({
        url: `${APP_URL}/${locale}/${route}`,
        lastModified: now,
        changeFrequency: route === 'browse' ? 'hourly' : 'weekly',
        priority: route === 'browse' ? 0.9 : 0.6,
      });
    }
  }
  return entries;
}
