import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Keep the private app out of search engines (the public page is themanishchauhan.in/cafecorp).
          // Not blocked in robots.txt on purpose: crawlers must fetch a page to see noindex.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
