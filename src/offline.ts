import type { Track, LessonMeta } from './types';

const CACHE_NAME = 'learn-offline-v1';
const BASE_URL = import.meta.env.BASE_URL;

function lessonUrl(lesson: LessonMeta): string {
  return `${BASE_URL}lessons/${lesson.trackId}/${lesson.filename}`;
}

function manifestUrl(): string {
  return `${BASE_URL}lessons/manifest.json`;
}

async function openCache(): Promise<Cache> {
  return caches.open(CACHE_NAME);
}

export async function downloadLesson(lesson: LessonMeta): Promise<void> {
  const cache = await openCache();
  const url = lessonUrl(lesson);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  await cache.put(url, response);
}

export async function downloadTrack(
  track: Track,
  onProgress?: (progress: number) => void
): Promise<void> {
  const cache = await openCache();

  const mUrl = manifestUrl();
  const manifestResponse = await fetch(mUrl);
  if (manifestResponse.ok) {
    await cache.put(mUrl, manifestResponse);
  }

  const lessons = track.lessons;
  let completed = 0;

  for (const lesson of lessons) {
    const url = lessonUrl(lesson);
    const response = await fetch(url);
    if (response.ok) {
      await cache.put(url, response);
    }
    completed++;
    onProgress?.(Math.round((completed / lessons.length) * 100));
  }
}

export async function isLessonDownloaded(lesson: LessonMeta): Promise<boolean> {
  const cache = await openCache();
  const match = await cache.match(lessonUrl(lesson));
  return match !== undefined;
}

export async function isTrackDownloaded(track: Track): Promise<boolean> {
  const cache = await openCache();
  for (const lesson of track.lessons) {
    const match = await cache.match(lessonUrl(lesson));
    if (!match) return false;
  }
  return track.lessons.length > 0;
}

export async function getCachedLesson(lesson: LessonMeta): Promise<string | null> {
  const cache = await openCache();
  const response = await cache.match(lessonUrl(lesson));
  if (!response) return null;
  return response.text();
}

export async function removeTrack(track: Track): Promise<void> {
  const cache = await openCache();
  for (const lesson of track.lessons) {
    await cache.delete(lessonUrl(lesson));
  }
}

export async function getDownloadedTracks(tracks: Track[]): Promise<string[]> {
  const downloaded: string[] = [];
  for (const track of tracks) {
    if (await isTrackDownloaded(track)) {
      downloaded.push(track.id);
    }
  }
  return downloaded;
}

export async function getStorageEstimate(): Promise<{ used: number; total: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage ?? 0,
      total: estimate.quota ?? 0,
    };
  }
  return { used: 0, total: 0 };
}

export async function clearAllDownloads(): Promise<void> {
  await caches.delete(CACHE_NAME);
}
