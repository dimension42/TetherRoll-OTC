/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@solana/wallet-adapter-react': false,
      '@farcaster/frame-sdk': false,
      '@farcaster/mini-app-solana': false,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
