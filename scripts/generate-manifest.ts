import fs from 'fs';
import path from 'path';

const LESSONS_DIR = path.resolve(__dirname, '../lessons');
const OUTPUT_DIR = path.resolve(__dirname, '../public/lessons');

interface LessonMeta {
  id: string;
  filename: string;
  title: string;
  trackId: string;
  order: number;
  wordCount: number;
  isReference: boolean;
}

interface Track {
  id: string;
  title: string;
  description: string;
  lessonCount: number;
  status: string;
  order: number;
  lessons: LessonMeta[];
}

const TRACK_ORDER: Record<string, number> = {
  'rust': 1,
  'linux-fundamentals': 2,
  'os-concepts': 3,
  'data-structures': 4,
  'databases': 5,
  'networking': 6,
  'python-for-ai': 7,
  'math-for-ai': 8,
  'ml-fundamentals': 9,
  'applied-ml': 10,
  'advanced-deep-learning': 11,
  'reinforcement-learning': 12,
  'llms-transformers': 13,
  'ai-engineering': 14,
  'nlp': 15,
  'computer-vision': 16,
  'c-cpp-for-ml': 17,
  'go': 18,
  'concurrency-parallelism': 19,
  'distributed-systems': 20,
  'api-design': 21,
  'docker': 22,
  'kubernetes': 23,
  'system-design': 24,
  'cloud-architecture': 25,
  'sre-observability': 26,
  'mlops': 27,
  'data-engineering': 28,
  'security-cryptography': 29,
  'compilers-interpreters': 30,
  'typescript-web': 31,
  'discrete-math': 32,
};

function extractTitle(content: string, filename: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1].trim();
  return filename.replace('.md', '').replace(/^\d+-/, '').replace(/-/g, ' ');
}

function extractDescription(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---') && !trimmed.startsWith('```')) {
      return trimmed.slice(0, 120);
    }
  }
  return '';
}

function formatTrackTitle(dirName: string): string {
  const titles: Record<string, string> = {
    'rust': 'Rust',
    'databases': 'Databases',
    'os-concepts': 'Operating Systems',
    'linux-fundamentals': 'Linux/Unix Fundamentals',
    'data-structures': 'Data Structures & Algorithms',
    'networking': 'Networking',
    'ml-fundamentals': 'Machine Learning Fundamentals',
    'llms-transformers': 'LLMs & Transformers',
    'docker': 'Docker Deep Dive',
    'kubernetes': 'Kubernetes',
    'system-design': 'System Design',
    'security-cryptography': 'Security & Cryptography',
    'compilers-interpreters': 'Compilers & Interpreters',
    'math-for-ai': 'Math for AI',
    'python-for-ai': 'Python for AI Engineers',
    'applied-ml': 'Applied Machine Learning',
    'advanced-deep-learning': 'Advanced Deep Learning',
    'ai-engineering': 'AI Engineering',
    'mlops': 'MLOps & Production ML',
    'data-engineering': 'Data Engineering for ML',
    'distributed-systems': 'Distributed Systems',
    'go': 'Go',
    'concurrency-parallelism': 'Concurrency & Parallelism',
    'api-design': 'API Design & Protocols',
    'reinforcement-learning': 'Reinforcement Learning',
    'cloud-architecture': 'Cloud Architecture & IaC',
    'typescript-web': 'TypeScript & Modern Web',
    'sre-observability': 'SRE & Observability',
    'computer-vision': 'Computer Vision',
    'nlp': 'NLP Deep Dive',
    'c-cpp-for-ml': 'C/C++ for ML Engineers',
    'discrete-math': 'Discrete Math & Logic',
  };
  return titles[dirName] || dirName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const trackDirs = fs.readdirSync(LESSONS_DIR).filter(entry => {
    const fullPath = path.join(LESSONS_DIR, entry);
    return fs.statSync(fullPath).isDirectory();
  });

  const tracks: Track[] = [];

  for (const trackDir of trackDirs) {
    const trackPath = path.join(LESSONS_DIR, trackDir);
    const outputTrackPath = path.join(OUTPUT_DIR, trackDir);
    fs.mkdirSync(outputTrackPath, { recursive: true });

    const files = fs.readdirSync(trackPath)
      .filter(f => f.endsWith('.md'))
      .sort();

    const lessons: LessonMeta[] = [];
    let trackDescription = '';

    for (const file of files) {
      const content = fs.readFileSync(path.join(trackPath, file), 'utf-8');
      fs.copyFileSync(path.join(trackPath, file), path.join(outputTrackPath, file));

      const isReference = file.startsWith('reference-');
      const isRoadmap = file === '00-roadmap.md';
      const orderMatch = file.match(/^(\d+)-/);
      const order = orderMatch ? parseInt(orderMatch[1], 10) : 999;

      if (isRoadmap) {
        trackDescription = extractDescription(content);
      }

      if (!isRoadmap) {
        lessons.push({
          id: `${trackDir}/${file.replace('.md', '')}`,
          filename: file,
          title: extractTitle(content, file),
          trackId: trackDir,
          order: isReference ? 900 + lessons.length : order,
          wordCount: content.split(/\s+/).length,
          isReference,
        });
      }
    }

    lessons.sort((a, b) => a.order - b.order);

    tracks.push({
      id: trackDir,
      title: formatTrackTitle(trackDir),
      description: trackDescription,
      lessonCount: lessons.filter(l => !l.isReference).length,
      status: 'Complete',
      order: TRACK_ORDER[trackDir] || 99,
      lessons,
    });
  }

  tracks.sort((a, b) => a.order - b.order);

  const manifest = {
    tracks,
    totalLessons: tracks.reduce((sum, t) => sum + t.lessonCount, 0),
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`Generated manifest: ${manifest.totalLessons} lessons across ${tracks.length} tracks`);
}

main();
