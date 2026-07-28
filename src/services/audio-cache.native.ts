import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

const audioDirectory = new Directory(Paths.cache, 'hifz-audio');

async function fileFor(url: string) {
  if (!audioDirectory.exists) {
    audioDirectory.create({ intermediates: true, idempotent: true });
  }
  const name = `${await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    url,
  )}.mp3`;
  return new File(audioDirectory, name);
}

export async function resolveAudioSource(url: string) {
  const target = await fileFor(url);
  if (target.exists) return target.uri;
  const downloaded = await File.downloadFileAsync(url, target, {
    idempotent: true,
  });
  return downloaded.uri;
}

export async function isAudioCached(url: string) {
  return (await fileFor(url)).exists;
}
