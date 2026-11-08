/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a local test build run without touching the dev server's .next folder:
  //   NEXT_DIST_DIR=.next-check npx next build
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
