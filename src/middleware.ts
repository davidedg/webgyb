import type { MiddlewareHandler } from 'astro';

/**
 * Runtime subfolder support via BASE_PATH environment variable.
 *
 * When BASE_PATH=/webgyb is set at container startup, this middleware patches
 * every HTML response so the app works correctly behind a prefix-stripping
 * reverse proxy (e.g. Nginx location /webgyb/ { proxy_pass http://app/; }).
 *
 * Two transforms are applied to the HTML:
 *  1. Inject <base href="/webgyb/"> so all relative URLs resolve to the right subfolder.
 *  2. Rewrite Astro's absolute /_astro/ asset paths to ./_astro/ (relative), so
 *     the <base> tag can resolve them correctly.
 *
 * No rebuild is required — BASE_PATH is read at request time from the environment.
 */
export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next();

  const basePath = (process.env.BASE_PATH ?? '').replace(/\/+$/, '');
  if (!basePath) return response;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();

  // 1. Inject <base> tag immediately after <head> so relative URLs resolve correctly.
  html = html.replace('<head>', `<head><base href="${basePath}/">`);

  // 2. Make Astro's /_astro/ paths relative so <base> can resolve them.
  //    Covers href="/_astro/", src="/_astro/", component-url="/_astro/", etc.
  html = html.replace(/"\/(_astro\/)/g, '"./$1');

  const newHeaders = new Headers(response.headers);
  newHeaders.delete('content-length'); // recalculated by runtime after body change

  return new Response(html, {
    status: response.status,
    headers: newHeaders,
  });
};
