/** @type {import('next').NextConfig} */
const isProduction = process.env.NEXT_PUBLIC_DEPLOYMENT === 'PRODUCTION';
const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

// Default values
let assetPrefix = '';
let basePath = '';
let apiBaseUrl = 'https://rpdb-backend-eqgxdrekhegcdmdn.eastus-01.azurewebsites.net';

if (isProduction || isGithubActions) {
  const repo = process.env.GITHUB_REPOSITORY ?.replace(/.*?\//, '') || process.env.NEXT_PUBLIC_REPO_NAME;

  // // Get the version from environment variable (set in GitHub Actions)
  // const version = process.env.NEXT_PUBLIC_VERSION || 'latest';

  // // Ensure correct paths for each version
  // assetPrefix = `/${repo}/${version}/`;
  // basePath = `/${repo}/${version}`;
  assetPrefix = `/${repo}`;
  basePath = `/${repo}`;
  apiBaseUrl = 'https://rpdb-backend-eqgxdrekhegcdmdn.eastus-01.azurewebsites.net';
}

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: basePath,
  assetPrefix: assetPrefix,
  trailingSlash: true,
  env: {
    API_BASE_URL: apiBaseUrl,
    BASE_PATH: basePath,
  },
  webpack: (config) => {
    config.resolve.alias['@arcgis/core'] = '@arcgis/core';
    return config;
  },

  async headers() {
    return [{
      source: '/(.*)',
      headers: [{
        key: 'Access-Control-Allow-Origin',
        value: '*',
      }, ],
    }, ];
  },
  async redirects() {
    return [{
      source: '/home',
      destination: '/',
      permanent: true,
    }, ];
  },
};

export default nextConfig;