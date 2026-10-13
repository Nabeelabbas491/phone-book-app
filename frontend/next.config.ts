import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle for the Docker image.
  output: 'standalone',
  poweredByHeader: false,
  // Hide the Next.js dev-tools badge shown during `next dev`.
  devIndicators: false,
};

export default nextConfig;
