// Vite proxies this same-origin route to the local Go development API.
export const config = {
  apiBaseUrl: '/api',
  requestTimeout: 12000,
};
