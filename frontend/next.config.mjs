/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force new build ID to break cache
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'standalone',
  
  // Disable caching of built assets to avoid stale bundles on Railway
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
    ];
  },

  // Proxy API calls to avoid CORS/Mixed Content issues
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://modulanalityc-production.up.railway.app/api/:path*',
      },
    ];
  },
};

export default nextConfig;
