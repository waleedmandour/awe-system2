import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove standalone output for Vercel (it handles this automatically)
  // Keep pdfkit as an external Node.js module so its internal __dirname
  // path resolution (for font AFM data files) works correctly at runtime.
  // Without this, Turbopack bundles pdfkit and breaks font file loading.
  serverExternalPackages: ['pdfkit'],
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  // Enable experimental features for better PWA support
  experimental: {
    // Enable PWA features
  },
  // Allow Moodle domain for LTI cross-origin launches
  async headers() {
    return [
      {
        source: '/api/lti/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
