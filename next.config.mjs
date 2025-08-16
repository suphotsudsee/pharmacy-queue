
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { appDir: true },
  webpack: (config, { dev }) => {
    if (dev && config.cache && config.cache.type === 'filesystem') {
      // Disable FS cache in dev to avoid ENOENT rename issues on some Windows setups
      config.cache = false;
    }
    return config;
  }
};
export default nextConfig;
