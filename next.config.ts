import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ];
  },
  allowedDevOrigins: ["192.168.1.9"],
  experimental: {
    proxyClientMaxBodySize: 25_000_000,
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    resolveAlias: {
      fs: "./empty.js",
      "graceful-fs": "./empty.js",
      net: "./empty.js",
      tls: "./empty.js",
      os: "./empty.js",
      path: "./empty.js",
      socks: "./empty.js",
      stream: "./empty.js",
      http: "./empty.js",
      https: "./empty.js",
      zlib: "./empty.js",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        "graceful-fs": false,
        net: false,
        tls: false,
        os: false,
        path: false,
        socks: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
      };
    }
    return config;
  },
};

export default nextConfig;
