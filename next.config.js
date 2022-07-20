const { withSuperjson } = require("next-superjson");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = module.exports = withSuperjson()(nextConfig);
