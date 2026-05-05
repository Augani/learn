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
  'cs-fundamentals': 1,
  'computer-architecture': 1.5,
  'data-representation-encoding': 1.75,
  'digital-logic-circuit-foundations': 1.875,
  'boot-process-firmware': 1.9375,
  'bus-io-peripherals': 1.96875,
  'history-mental-models-computing': 1.984375,
  'rust': 2,
  'linux-fundamentals': 3,
  'os-concepts': 4,
  'data-structures': 5,
  'databases': 6,
  'networking': 7,
  'python-for-ai': 8,
  'math-for-ai': 9,
  'ml-fundamentals': 10,
  'applied-ml': 11,
  'advanced-deep-learning': 12,
  'reinforcement-learning': 13,
  'llms-transformers': 14,
  'ai-engineering': 15,
  'nlp': 16,
  'computer-vision': 17,
  'c-cpp-for-ml': 18,
  'go': 19,
  'concurrency-parallelism': 20,
  'distributed-systems': 21,
  'api-design': 22,
  'docker': 23,
  'kubernetes': 24,
  'system-design': 25,
  'cloud-architecture': 26,
  'sre-observability': 27,
  'mlops': 28,
  'data-engineering': 29,
  'security-cryptography': 30,
  'compilers-interpreters': 31,
  'typescript-web': 32,
  'discrete-math': 33,
  'testing-quality': 34,
  'design-patterns': 35,
  'ci-cd-pipelines': 36,
  'infrastructure-as-code': 37,
  'message-queues-streaming': 38,
  'authentication-authorization': 39,
  'ml-systems-at-scale': 40,
  'ml-research-to-production': 41,
  'advanced-llm-engineering': 42,
  'ml-performance-optimization': 43,
  'advanced-system-design': 44,
  'platform-engineering': 45,
  'math-foundations': 46,
  'gpu-cuda-fundamentals': 47,
  'ml-glossary': 48,
  'ml-scale-infrastructure': 49,
  'build-deploy-llm': 50,
  'time-series-forecasting': 51,
  'ethics-fairness-ai': 52,
  'dsa-mastery': 53,
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
    'cs-fundamentals': 'CS Fundamentals',
    'computer-architecture': 'Computer Architecture',
    'data-representation-encoding': 'Data Representation & Encoding',
    'digital-logic-circuit-foundations': 'Digital Logic & Circuit Foundations',
    'boot-process-firmware': 'Boot Process & Firmware',
    'bus-io-peripherals': 'Bus Architecture, I/O & Peripherals',
    'history-mental-models-computing': 'History & Mental Models of Computing',
    'testing-quality': 'Testing & Quality',
    'design-patterns': 'Design Patterns',
    'ci-cd-pipelines': 'CI/CD Pipelines',
    'infrastructure-as-code': 'Infrastructure as Code',
    'message-queues-streaming': 'Message Queues & Streaming',
    'authentication-authorization': 'Authentication & Authorization',
    'ml-systems-at-scale': 'ML Systems at Scale',
    'ml-research-to-production': 'ML Research to Production',
    'advanced-llm-engineering': 'Advanced LLM Engineering',
    'ml-performance-optimization': 'ML Performance Optimization',
    'advanced-system-design': 'Advanced System Design',
    'platform-engineering': 'Platform Engineering',
    'math-foundations': 'Math Foundations',
    'gpu-cuda-fundamentals': 'GPU & CUDA Fundamentals',
    'ml-glossary': 'ML Glossary',
    'ml-scale-infrastructure': 'Scale & Infrastructure',
    'build-deploy-llm': 'Build & Deploy LLM Capstone',
    'time-series-forecasting': 'Time Series & Forecasting',
    'ethics-fairness-ai': 'Ethics, Fairness & Responsible AI',
    'dsa-mastery': 'DSA Mastery',
  };
  return titles[dirName] || dirName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface CareerTrackBook {
  title: string;
  author: string;
  year: number;
  free?: boolean;
  description: string;
}

interface CareerTrack {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  icon: string;
  color: string;
  estimatedHours: number;
  topicIds: string[];
  books: CareerTrackBook[];
}

const CAREER_TRACKS: CareerTrack[] = [
  {
    id: 'backend-engineer',
    title: 'Backend Engineer',
    description: 'Build robust, scalable server-side systems. Learn databases, APIs, concurrency, and deployment — everything needed to design and maintain the systems behind modern applications.',
    difficulty: 'beginner-intermediate',
    icon: 'Server',
    color: 'text-emerald-500',
    estimatedHours: 200,
    topicIds: [
      'cs-fundamentals', 'data-structures', 'databases', 'go', 'networking',
      'api-design', 'linux-fundamentals', 'testing-quality', 'design-patterns',
      'concurrency-parallelism', 'ci-cd-pipelines', 'authentication-authorization',
      'message-queues-streaming', 'system-design', 'docker', 'security-cryptography',
    ],
    books: [
      { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', year: 2017, description: 'The modern backend engineering bible' },
      { title: 'System Design Interview (Vol 1 & 2)', author: 'Alex Xu', year: 2020, description: 'Practical system design walkthroughs' },
      { title: 'Building Microservices', author: 'Sam Newman', year: 2021, description: 'Microservices architecture patterns' },
      { title: 'The Go Programming Language', author: 'Alan Donovan and Brian Kernighan', year: 2015, description: 'The definitive Go book' },
    ],
  },
  {
    id: 'ml-engineer',
    title: 'ML Engineer',
    description: 'Build, train, deploy, and monitor machine learning models at scale. From mathematical foundations to production MLOps pipelines.',
    difficulty: 'intermediate-advanced',
    icon: 'Brain',
    color: 'text-purple-500',
    estimatedHours: 220,
    topicIds: [
      'python-for-ai', 'math-for-ai', 'data-structures', 'ml-fundamentals',
      'advanced-deep-learning', 'llms-transformers', 'applied-ml', 'testing-quality',
      'ci-cd-pipelines', 'mlops', 'docker', 'kubernetes', 'cloud-architecture',
      'data-engineering', 'math-foundations', 'gpu-cuda-fundamentals', 'ml-glossary',
    ],
    books: [
      { title: 'Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow', author: 'Aurelien Geron', year: 2022, description: 'The most practical ML book' },
      { title: 'Designing Machine Learning Systems', author: 'Chip Huyen', year: 2022, description: 'Production ML system design' },
      { title: 'Deep Learning', author: 'Ian Goodfellow, Yoshua Bengio, and Aaron Courville', year: 2016, free: true, description: 'The deep learning bible — free at deeplearningbook.org' },
    ],
  },
  {
    id: 'systems-programmer',
    title: 'Systems Programmer',
    description: 'Work at the OS, compiler, and runtime level. Build the infrastructure that other software runs on. Master memory, concurrency, and low-level programming.',
    difficulty: 'intermediate-advanced',
    icon: 'Cpu',
    color: 'text-orange-500',
    estimatedHours: 180,
    topicIds: [
      'cs-fundamentals', 'data-structures', 'c-cpp-for-ml', 'rust', 'os-concepts',
      'concurrency-parallelism', 'networking', 'compilers-interpreters',
      'linux-fundamentals', 'discrete-math',
    ],
    books: [
      { title: 'The Rust Programming Language', author: 'Steve Klabnik and Carol Nichols', year: 2023, free: true, description: 'The official Rust book — free at doc.rust-lang.org/book' },
      { title: 'Operating Systems: Three Easy Pieces', author: 'Remzi and Andrea Arpaci-Dusseau', year: 2018, free: true, description: 'Best OS textbook — free at pages.cs.wisc.edu/~remzi/OSTEP' },
      { title: 'Crafting Interpreters', author: 'Robert Nystrom', year: 2021, free: true, description: 'Build two interpreters from scratch — free at craftinginterpreters.com' },
    ],
  },
  {
    id: 'cloud-devops-engineer',
    title: 'Cloud / DevOps Engineer',
    description: 'Automate infrastructure, manage deployments, and keep systems running reliably at scale. Master containers, orchestration, CI/CD, and cloud services.',
    difficulty: 'beginner-intermediate',
    icon: 'Cloud',
    color: 'text-sky-500',
    estimatedHours: 170,
    topicIds: [
      'linux-fundamentals', 'networking', 'docker', 'kubernetes', 'ci-cd-pipelines',
      'infrastructure-as-code', 'cloud-architecture', 'sre-observability',
      'security-cryptography', 'message-queues-streaming', 'databases',
    ],
    books: [
      { title: 'Kubernetes in Action', author: 'Marko Luksa', year: 2024, description: 'The most thorough Kubernetes book' },
      { title: 'Terraform: Up & Running', author: 'Yevgeniy Brikman', year: 2022, description: 'Infrastructure as Code with Terraform' },
      { title: 'Site Reliability Engineering', author: 'Betsy Beyer et al.', year: 2016, free: true, description: 'How Google runs production — free at sre.google/books' },
    ],
  },
  {
    id: 'fullstack-developer',
    title: 'Full-Stack Developer',
    description: 'Build complete web applications from database to browser. Learn frontend, backend, APIs, authentication, and deployment.',
    difficulty: 'beginner-intermediate',
    icon: 'Layers',
    color: 'text-violet-500',
    estimatedHours: 190,
    topicIds: [
      'cs-fundamentals', 'data-structures', 'typescript-web', 'databases',
      'api-design', 'testing-quality', 'ci-cd-pipelines', 'authentication-authorization',
      'networking', 'linux-fundamentals', 'docker', 'security-cryptography',
      'system-design',
    ],
    books: [
      { title: 'Effective TypeScript', author: 'Dan Vanderkam', year: 2024, description: '83 ways to improve your TypeScript' },
      { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', year: 2017, description: 'Understand the data layer deeply' },
      { title: 'The Road to React', author: 'Robin Wieruch', year: 2024, description: 'Modern React with hooks and TypeScript' },
    ],
  },
  {
    id: 'ai-engineer',
    title: 'AI Engineer',
    description: 'Build AI-powered products. Focus on integrating LLMs, building RAG systems, agents, and production AI tooling rather than training models from scratch.',
    difficulty: 'intermediate',
    icon: 'Sparkles',
    color: 'text-amber-500',
    estimatedHours: 190,
    topicIds: [
      'math-foundations', 'gpu-cuda-fundamentals', 'ml-glossary',
      'python-for-ai', 'ml-fundamentals', 'llms-transformers', 'nlp',
      'ai-engineering', 'applied-ml', 'testing-quality', 'api-design',
      'databases', 'docker', 'cloud-architecture', 'ci-cd-pipelines',
    ],
    books: [
      { title: 'Build a Large Language Model (From Scratch)', author: 'Sebastian Raschka', year: 2024, description: 'Understand what is under the hood of LLMs' },
      { title: 'Natural Language Processing with Transformers', author: 'Lewis Tunstall, Leandro von Werra, and Thomas Wolf', year: 2022, description: 'Practical transformer-based NLP by Hugging Face authors' },
      { title: 'Designing Machine Learning Systems', author: 'Chip Huyen', year: 2022, description: 'Production AI system design' },
    ],
  },
  {
    id: 'data-scientist',
    title: 'Data Scientist',
    description: 'Analyze data, build predictive models, and communicate insights. From statistics and EDA through hypothesis testing, visualization, ML, and time series — the complete data science toolkit.',
    difficulty: 'beginner-intermediate',
    icon: 'BarChart3',
    color: 'text-cyan-500',
    estimatedHours: 200,
    topicIds: [
      'python-for-ai',
      'math-foundations',
      'math-for-ai',
      'data-structures',
      'databases',
      'applied-ml',
      'ml-fundamentals',
      'time-series-forecasting',
      'testing-quality',
      'ethics-fairness-ai',
    ],
    books: [
      { title: 'Python for Data Analysis', author: 'Wes McKinney', year: 2022, description: "The pandas creator's guide to data wrangling" },
      { title: 'An Introduction to Statistical Learning', author: 'Gareth James, Daniela Witten, Trevor Hastie, and Robert Tibshirani', year: 2023, free: true, description: 'Practical statistical learning — free PDF at statlearning.com' },
      { title: 'Storytelling with Data', author: 'Cole Nussbaumer Knaflic', year: 2015, description: 'Data visualization and communication' },
      { title: 'Forecasting: Principles and Practice', author: 'Rob J Hyndman and George Athanasopoulos', year: 2021, free: true, description: 'The forecasting bible — free at otexts.com/fpp3' },
    ],
  },
  {
    id: 'data-engineer',
    title: 'Data Engineer',
    description: 'Build and maintain data infrastructure that powers analytics and ML. Design pipelines, warehouses, and streaming systems.',
    difficulty: 'intermediate',
    icon: 'Database',
    color: 'text-teal-500',
    estimatedHours: 160,
    topicIds: [
      'python-for-ai', 'databases', 'data-engineering', 'linux-fundamentals',
      'message-queues-streaming', 'docker', 'kubernetes', 'infrastructure-as-code',
      'cloud-architecture', 'distributed-systems', 'ci-cd-pipelines',
    ],
    books: [
      { title: 'Fundamentals of Data Engineering', author: 'Joe Reis and Matt Housley', year: 2022, description: 'Modern data engineering foundations' },
      { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', year: 2017, description: 'The data systems architecture bible' },
      { title: 'The Data Warehouse Toolkit', author: 'Ralph Kimball and Margy Ross', year: 2013, description: 'Dimensional modeling bible' },
    ],
  },
  {
    id: 'security-engineer',
    title: 'Security Engineer',
    description: 'Defend systems, find vulnerabilities, and build secure infrastructure. Covers application security, cryptography, and infrastructure security.',
    difficulty: 'intermediate-advanced',
    icon: 'Shield',
    color: 'text-red-500',
    estimatedHours: 175,
    topicIds: [
      'cs-fundamentals', 'networking', 'linux-fundamentals', 'os-concepts',
      'security-cryptography', 'authentication-authorization', 'docker',
      'kubernetes', 'cloud-architecture', 'api-design', 'databases',
      'ci-cd-pipelines',
    ],
    books: [
      { title: 'Serious Cryptography', author: 'Jean-Philippe Aumasson', year: 2024, description: 'Modern applied cryptography' },
      { title: 'Real-World Cryptography', author: 'David Wong', year: 2021, description: 'Practical crypto for developers' },
      { title: 'OAuth 2 in Action', author: 'Justin Richer and Antonio Sanso', year: 2017, description: 'Deep dive into OAuth 2.0' },
    ],
  },
  {
    id: 'site-reliability-engineer',
    title: 'Site Reliability Engineer',
    description: 'Keep systems reliable at scale. Balance development velocity with system reliability using SLOs, error budgets, observability, and automation.',
    difficulty: 'intermediate-advanced',
    icon: 'Activity',
    color: 'text-rose-500',
    estimatedHours: 200,
    topicIds: [
      'linux-fundamentals', 'networking', 'os-concepts', 'databases', 'docker',
      'kubernetes', 'ci-cd-pipelines', 'infrastructure-as-code',
      'cloud-architecture', 'sre-observability', 'message-queues-streaming',
      'distributed-systems', 'system-design', 'security-cryptography',
    ],
    books: [
      { title: 'Site Reliability Engineering', author: 'Betsy Beyer, Chris Jones, Jennifer Petoff, and Niall Richard Murphy', year: 2016, free: true, description: 'How Google runs production — free at sre.google/books' },
      { title: 'Observability Engineering', author: 'Charity Majors, Liz Fong-Jones, and George Miranda', year: 2022, description: 'Modern observability practices' },
      { title: 'Systems Performance', author: 'Brendan Gregg', year: 2020, description: 'Performance analysis and tuning' },
    ],
  },
  {
    id: 'advanced-ml-engineer',
    title: 'Advanced ML Engineer',
    description: 'For seasoned ML engineers ready to train and serve models at massive scale. Covers distributed training, LLM internals, performance optimization, and research engineering.',
    difficulty: 'advanced',
    icon: 'Brain',
    color: 'text-fuchsia-500',
    estimatedHours: 250,
    topicIds: [
      'ml-systems-at-scale', 'advanced-llm-engineering', 'ml-performance-optimization',
      'ml-research-to-production', 'advanced-deep-learning', 'llms-transformers',
      'c-cpp-for-ml', 'mlops', 'distributed-systems', 'concurrency-parallelism',
      'gpu-cuda-fundamentals', 'ml-scale-infrastructure', 'build-deploy-llm',
    ],
    books: [
      { title: 'Build a Large Language Model (From Scratch)', author: 'Sebastian Raschka', year: 2024, description: 'Understand LLMs from the ground up' },
      { title: 'Programming Massively Parallel Processors', author: 'David Kirk and Wen-mei Hwu', year: 2022, description: 'GPU programming fundamentals' },
      { title: 'Designing Machine Learning Systems', author: 'Chip Huyen', year: 2022, description: 'Production ML at scale' },
      { title: 'Deep Learning', author: 'Ian Goodfellow, Yoshua Bengio, and Aaron Courville', year: 2016, free: true, description: 'The deep learning bible — free at deeplearningbook.org' },
    ],
  },
  {
    id: 'staff-backend-engineer',
    title: 'Staff+ Backend Engineer',
    description: 'For senior engineers leveling up to staff/principal. Master advanced system design, distributed architecture at scale, and technical strategy.',
    difficulty: 'advanced',
    icon: 'Zap',
    color: 'text-yellow-500',
    estimatedHours: 230,
    topicIds: [
      'advanced-system-design', 'distributed-systems', 'system-design',
      'message-queues-streaming', 'databases', 'concurrency-parallelism',
      'design-patterns', 'sre-observability', 'security-cryptography',
      'cloud-architecture', 'infrastructure-as-code', 'platform-engineering',
    ],
    books: [
      { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', year: 2017, description: 'The distributed systems and data bible' },
      { title: 'Staff Engineer: Leadership Beyond the Management Track', author: 'Will Larson', year: 2021, description: 'The staff engineer playbook' },
      { title: 'Building Microservices', author: 'Sam Newman', year: 2021, description: 'Advanced microservices patterns' },
      { title: 'Understanding Distributed Systems', author: 'Roberto Vitillo', year: 2022, description: 'Practical distributed systems guide' },
    ],
  },
  {
    id: 'platform-engineer',
    title: 'Platform Engineer',
    description: 'Build internal developer platforms that accelerate engineering teams. Design golden paths, self-service infrastructure, and developer experience tooling.',
    difficulty: 'intermediate-advanced',
    icon: 'Layers',
    color: 'text-indigo-500',
    estimatedHours: 190,
    topicIds: [
      'platform-engineering', 'kubernetes', 'docker', 'ci-cd-pipelines',
      'infrastructure-as-code', 'cloud-architecture', 'sre-observability',
      'api-design', 'design-patterns', 'testing-quality',
      'security-cryptography', 'message-queues-streaming',
    ],
    books: [
      { title: 'Team Topologies', author: 'Matthew Skelton and Manuel Pais', year: 2019, description: 'How teams should be organized for fast flow' },
      { title: 'Platform Engineering on Kubernetes', author: 'Mauricio Salatino', year: 2024, description: 'Building platforms on K8s' },
      { title: 'Site Reliability Engineering', author: 'Betsy Beyer et al.', year: 2016, free: true, description: 'How Google runs production — free at sre.google/books' },
    ],
  },
  {
    id: 'ml-research-engineer',
    title: 'ML Research Engineer',
    description: 'Bridge the gap between ML research and production. Implement papers, build custom architectures, design experiments, and ship research into products.',
    difficulty: 'advanced',
    icon: 'Sparkles',
    color: 'text-cyan-500',
    estimatedHours: 200,
    topicIds: [
      'ml-research-to-production', 'ml-performance-optimization', 'advanced-deep-learning',
      'llms-transformers', 'math-for-ai', 'c-cpp-for-ml', 'python-for-ai',
      'ml-fundamentals', 'reinforcement-learning', 'computer-vision',
    ],
    books: [
      { title: 'Deep Learning', author: 'Ian Goodfellow, Yoshua Bengio, and Aaron Courville', year: 2016, free: true, description: 'The deep learning bible — free at deeplearningbook.org' },
      { title: 'Machine Learning Engineering', author: 'Andriy Burkov', year: 2020, description: 'From research to production' },
      { title: 'Pattern Recognition and Machine Learning', author: 'Christopher Bishop', year: 2006, description: 'Theoretical ML foundations' },
    ],
  },
];

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

  const trackMap = new Map(tracks.map(t => [t.id, t]));
  const validCareerTracks = CAREER_TRACKS.map(ct => ({
    ...ct,
    topicIds: ct.topicIds.filter(id => trackMap.has(id)),
  }));

  const manifest = {
    tracks,
    careerTracks: validCareerTracks,
    totalLessons: tracks.reduce((sum, t) => sum + t.lessonCount, 0),
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`Generated manifest: ${manifest.totalLessons} lessons across ${tracks.length} tracks, ${validCareerTracks.length} career tracks`);
}

main();
