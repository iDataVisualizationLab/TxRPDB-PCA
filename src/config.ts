// config.js

export const route = `https://rpdb-backend-eqgxdrekhegcdmdn.eastus-01.azurewebsites.net/get-proxy?path=`
export const routeDownload = `https://rpdb-backend-eqgxdrekhegcdmdn.eastus-01.azurewebsites.net/download-proxy?path=`
export const routeUploadContent = `https://rpdb-backend-eqgxdrekhegcdmdn.eastus-01.azurewebsites.net/post-proxy?path=`
export const routePublic = process.env.NEXT_PUBLIC_DEPLOYMENT === "PRODUCTION"
    ? `/${process.env.NEXT_PUBLIC_REPO_NAME}`
    : "";
export const BASE_PATH = process.env.BASE_PATH || '';

export function getFrontendBaseUrl() {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${BASE_PATH}`;
}