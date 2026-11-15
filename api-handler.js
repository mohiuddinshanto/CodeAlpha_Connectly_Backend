import { app } from './app.js';

const API_PATH_QUERY_PARAM = '__connectly_path';

export function normalizeApiPath(url = '/') {
  const queryIndex = url.indexOf('?');
  const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : url.slice(queryIndex);
  const searchParams = new URLSearchParams(query);

  if (searchParams.has(API_PATH_QUERY_PARAM)) {
    const apiPath = searchParams.get(API_PATH_QUERY_PARAM).replace(/^\/+/, '');
    searchParams.delete(API_PATH_QUERY_PARAM);
    const remainingQuery = searchParams.toString();
    return `${apiPath ? `/api/${apiPath}` : '/api'}${
      remainingQuery ? `?${remainingQuery}` : ''
    }`;
  }

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
