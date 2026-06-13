/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output keeps the Docker/Frankfurt image small and Azure-portable.
  output: "standalone",
  eslint: {
    // Demo build must never be blocked by lint; we run lint separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
