import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },

  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host" as const, value: "coachingstudio.in" }],
        destination: "/coaching-studio",
        permanent: false,
      },
      {
        source: "/",
        has: [{ type: "host" as const, value: "www.coachingstudio.in" }],
        destination: "/coaching-studio",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;