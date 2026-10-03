import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // firebase-admin's conditional exports confuse Next.js's bundler/
  // tracer (ERR_REQUIRE_ESM at runtime on Vercel) when it tries to
  // bundle the package itself. Marking it external makes Next.js
  // require() it directly from node_modules at runtime instead.
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
