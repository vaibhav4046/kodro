/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so the flagship deploys to any free host (Vercel, Pages) with
  // zero backend. All "realtime" data is mocked client-side.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
