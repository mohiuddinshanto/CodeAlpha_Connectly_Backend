import { app } from './app.js';

export function normalizeApiPath(url = '/') {
  const queryIndex = url.indexOf('?');
  const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : url.slice(queryIndex);

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return url;
  }

  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `/api${path === '/' ? '' : path}${query}`;
}

export default function apiHandler(req, res) {
  req.url = normalizeApiPath(req.url);
  app(req, res);
}
