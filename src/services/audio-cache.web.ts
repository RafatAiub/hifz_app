const CACHE_NAME = 'hifz-audio-v1';

export async function resolveAudioSource(url: string) {
  if (!('caches' in globalThis)) return url;
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(url);
  if (!cached) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Audio download failed');
    await cache.put(url, response.clone());
  }
  return url;
}

export async function isAudioCached(url: string) {
  if (!('caches' in globalThis)) return false;
  return Boolean(await (await caches.open(CACHE_NAME)).match(url));
}
