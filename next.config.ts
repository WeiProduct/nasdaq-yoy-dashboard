import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const githubPagesBasePath =
  process.env.GITHUB_PAGES_BASE_PATH ?? "/nasdaq-yoy-dashboard";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(isGitHubPages
    ? {
        output: "export" as const,
        basePath: githubPagesBasePath,
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
