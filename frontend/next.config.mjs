/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.tomy.me",
        port: "",
      },
    ],
  },
}

export default nextConfig
