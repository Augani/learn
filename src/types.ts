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

export interface CareerTrackBook {
  title: string;
  author: string;
  year: number;
  free?: boolean;
  description: string;
}

export interface CareerTrack {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'beginner-intermediate' | 'intermediate-advanced';
  icon: string;
  color: string;
  estimatedHours: number;
  topicIds: string[];
  books: CareerTrackBook[];
}

export interface Manifest {
  tracks: Track[];
  careerTracks: CareerTrack[];
  totalLessons: number;
  generatedAt: string;
}

export type ViewState = 'tracks' | 'track' | 'lesson' | 'complete' | 'settings' | 'careerTrack';
export type Theme = 'dark' | 'light' | 'sepia';
