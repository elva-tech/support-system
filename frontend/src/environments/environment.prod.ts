// Default for Docker/nginx same-origin proxy. Overwritten at build when API_URL is set (Vercel).
export const environment = {
  production: true,
  apiUrl: '/api'
};
