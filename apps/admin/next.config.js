/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@trunkjunk/shared"],
  experimental: { typedRoutes: false },
};
module.exports = nextConfig;
