import {MetadataRoute} from 'next'

import {env} from '@/env'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_APP_URL || 'https://example.com'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/(app)/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
