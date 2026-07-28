import { mkdir, writeFile } from 'node:fs/promises';

const worker = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || url.pathname.includes('.')) return response;

    const routeUrl = new URL(request.url);
    routeUrl.pathname =
      url.pathname === '/' ? '/index.html' : url.pathname.replace(/\\/$/, '') + '.html';
    response = await env.ASSETS.fetch(new Request(routeUrl, request));
    if (response.status !== 404) return response;

    routeUrl.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(routeUrl, request));
  },
};
`;

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/server/index.js', import.meta.url), worker.trimStart());
