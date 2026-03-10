export interface Track {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
  status: string;
  order: number;
  lessons: LessonMeta[];
}

export interface LessonMeta {
  id: string;
  filename: string;
  title: string;
  trackId: string;
  order: number;
  wordCount: number;
  isReference: boolean;
}

export interface Manifest {
  tracks: Track[];
  totalLessons: number;
  generatedAt: string;
}

export type ViewState = 'tracks' | 'track' | 'lesson' | 'complete' | 'settings';
export type Theme = 'dark' | 'light' | 'sepia';
