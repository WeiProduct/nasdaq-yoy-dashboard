import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(isGitHubPages
    ? {
        output: "export" as const,
        basePath: "/nasdaq-yoy-dashboard",
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
