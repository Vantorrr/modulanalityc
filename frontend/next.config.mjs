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
  // Disable static optimization to ensure fresh builds
  output: 'standalone',
};

export default nextConfig;
