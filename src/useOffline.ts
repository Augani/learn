import { useState, useEffect, useCallback } from 'react';
import type { Track, LessonMeta } from './types';
import {
  downloadTrack as dlTrack,
  removeTrack as rmTrack,
  isLessonDownloaded as isLessonDl,
  getDownloadedTracks,
  getStorageEstimate,
  clearAllDownloads,
} from './offline';

interface OfflineState {
  downloadedTracks: Set<string>;
  downloadingTrackId: string | null;
  downloadProgress: number;
  isOnline: boolean;
  storageUsed: number;
  storageTotal: number;
}

interface OfflineActions {
  downloadTrack: (track: Track) => Promise<void>;
  removeTrack: (track: Track) => Promise<void>;
  isTrackOffline: (trackId: string) => boolean;
  isLessonDownloaded: (lesson: LessonMeta) => Promise<boolean>;
  clearAll: () => Promise<void>;
  refreshStatus: (tracks: Track[]) => Promise<void>;
}

export type UseOfflineReturn = OfflineState & OfflineActions;

export function useOffline(tracks: Track[]): UseOfflineReturn {
  const [downloadedTracks, setDownloadedTracks] = useState<Set<string>>(new Set());
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageTotal, setStorageTotal] = useState(0);

  const refreshStorage = useCallback(async () => {
    const estimate = await getStorageEstimate();
    setStorageUsed(estimate.used);
    setStorageTotal(estimate.total);
  }, []);

  const refreshStatus = useCallback(async (allTracks: Track[]) => {
    if (allTracks.length === 0) return;
    const ids = await getDownloadedTracks(allTracks);
    setDownloadedTracks(new Set(ids));
    await refreshStorage();
  }, [refreshStorage]);

  useEffect(() => {
    refreshStatus(tracks);
  }, [tracks, refreshStatus]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const downloadTrack = useCallback(async (track: Track) => {
    if (downloadingTrackId) return;
    setDownloadingTrackId(track.id);
    setDownloadProgress(0);
    try {
      await dlTrack(track, (progress) => setDownloadProgress(progress));
      setDownloadedTracks((prev) => new Set([...prev, track.id]));
      await refreshStorage();
    } finally {
      setDownloadingTrackId(null);
      setDownloadProgress(0);
    }
  }, [downloadingTrackId, refreshStorage]);

  const removeTrack = useCallback(async (track: Track) => {
    await rmTrack(track);
    setDownloadedTracks((prev) => {
      const next = new Set(prev);
      next.delete(track.id);
      return next;
    });
    await refreshStorage();
  }, [refreshStorage]);

  const isTrackOffline = useCallback((trackId: string): boolean => {
    return downloadedTracks.has(trackId);
  }, [downloadedTracks]);

  const isLessonDownloaded = useCallback(async (lesson: LessonMeta): Promise<boolean> => {
    return isLessonDl(lesson);
  }, []);

  const clearAll = useCallback(async () => {
    await clearAllDownloads();
    setDownloadedTracks(new Set());
    await refreshStorage();
  }, [refreshStorage]);

  return {
    downloadedTracks,
    downloadingTrackId,
    downloadProgress,
    isOnline,
    storageUsed,
    storageTotal,
    downloadTrack,
    removeTrack,
    isTrackOffline,
    isLessonDownloaded,
    clearAll,
    refreshStatus,
  };
}
