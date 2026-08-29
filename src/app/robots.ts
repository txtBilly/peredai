import type { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ten2ten.ru';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private / transactional areas that must never be indexed.
        disallow: [
          '/api/',
          '/admin',
          '/*/account',
          '/*/chats',
          '/*/pay',
          '/*/verify',
          '/*/background',
          '/*/gate',
          '/*/reset',
          '/*/saved',
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
