import { useState, useEffect, useCallback } from 'react';
import { Settings, ChevronLeft, ArrowRight, Check, X, ArrowUp, BookOpen, Layers, Zap, Brain, Server, Code2, GraduationCap, Download, CheckCircle, WifiOff, Trash2 } from 'lucide-react';
import { motion, useScroll, useSpring } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Track, LessonMeta, Manifest, ViewState, Theme } from './types';
import { useOffline } from './useOffline';
import { getCachedLesson } from './offline';

const BASE_URL = import.meta.env.BASE_URL;

const TRACK_CATEGORIES: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  'rust': { label: 'Systems', icon: Code2, color: 'text-orange-500' },
  'go': { label: 'Systems', icon: Code2, color: 'text-cyan-400' },
  'c-cpp-for-ml': { label: 'Systems', icon: Code2, color: 'text-blue-400' },
  'python-for-ai': { label: 'AI/ML', icon: Brain, color: 'text-yellow-400' },
  'math-for-ai': { label: 'AI/ML', icon: Brain, color: 'text-purple-400' },
  'ml-fundamentals': { label: 'AI/ML', icon: Brain, color: 'text-green-400' },
  'applied-ml': { label: 'AI/ML', icon: Brain, color: 'text-green-400' },
  'advanced-deep-learning': { label: 'AI/ML', icon: Brain, color: 'text-pink-400' },
  'reinforcement-learning': { label: 'AI/ML', icon: Brain, color: 'text-violet-400' },
  'llms-transformers': { label: 'AI/ML', icon: Brain, color: 'text-amber-400' },
  'ai-engineering': { label: 'AI/ML', icon: Brain, color: 'text-emerald-400' },
  'nlp': { label: 'AI/ML', icon: Brain, color: 'text-teal-400' },
  'computer-vision': { label: 'AI/ML', icon: Brain, color: 'text-sky-400' },
  'docker': { label: 'Infra', icon: Server, color: 'text-orange-500' },
  'kubernetes': { label: 'Infra', icon: Server, color: 'text-blue-400' },
  'cloud-architecture': { label: 'Infra', icon: Server, color: 'text-orange-400' },
  'sre-observability': { label: 'Infra', icon: Server, color: 'text-red-400' },
  'mlops': { label: 'Infra', icon: Server, color: 'text-indigo-400' },
  'system-design': { label: 'Architecture', icon: Zap, color: 'text-yellow-500' },
  'distributed-systems': { label: 'Architecture', icon: Zap, color: 'text-rose-400' },
  'networking': { label: 'Architecture', icon: Zap, color: 'text-cyan-500' },
  'api-design': { label: 'Architecture', icon: Zap, color: 'text-lime-400' },
};

function parseHash(): { view: ViewState; trackId?: string; filename?: string } {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash || hash === '/') return { view: 'tracks' };
  if (hash === 'settings') return { view: 'settings' };

  const parts = hash.split('/');
  if (parts.length === 2) {
    return { view: 'lesson', trackId: parts[0], filename: parts[1] };
  }
  if (parts.length === 1) {
    return { view: 'track', trackId: parts[0] };
  }
  return { view: 'tracks' };
}

function setHash(path: string) {
  window.history.pushState(null, '', `#/${path}`);
}

export default function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('tracks');
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentLesson, setCurrentLesson] = useState<LessonMeta | null>(null);
  const [lessonContent, setLessonContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
  const [scale, setScale] = useState(() => parseInt(localStorage.getItem('scale') || '100', 10));
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('completedLessons') || '[]'); }
    catch { return []; }
  });

  const offline = useOffline(manifest?.tracks ?? []);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  useEffect(() => {
    fetch(`${BASE_URL}lessons/manifest.json`)
      .then(r => r.json())
      .then(setManifest)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!manifest) return;

    const navigate = () => {
      const { view, trackId, filename } = parseHash();
      if (view === 'settings') {
        setCurrentView('settings');
        return;
      }
      if (trackId) {
        const track = manifest.tracks.find(t => t.id === trackId);
        if (!track) { setCurrentView('tracks'); return; }
        setCurrentTrack(track);
        if (filename) {
          const lesson = track.lessons.find(l => l.filename === filename || l.filename === `${filename}.md`);
          if (lesson) {
            loadLessonContent(lesson);
            setCurrentLesson(lesson);
            setCurrentView('lesson');
          } else {
            setCurrentView('track');
          }
        } else {
          setCurrentView('track');
        }
      } else {
        setCurrentView('tracks');
        setCurrentTrack(null);
        setCurrentLesson(null);
      }
    };

    navigate();
    window.addEventListener('popstate', navigate);
    return () => window.removeEventListener('popstate', navigate);
  }, [manifest]);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => { localStorage.setItem('scale', scale.toString()); }, [scale]);
  useEffect(() => { localStorage.setItem('completedLessons', JSON.stringify(completedLessons)); }, [completedLessons]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setScrollProgress(windowHeight > 0 ? totalScroll / windowHeight : 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const loadLessonContent = useCallback(async (lesson: LessonMeta) => {
    setLoadingContent(true);
    try {
      const cached = await getCachedLesson(lesson);
      if (cached) {
        setLessonContent(cached);
        setLoadingContent(false);
        return;
      }
      const res = await fetch(`${BASE_URL}lessons/${lesson.trackId}/${lesson.filename}`);
      const text = await res.text();
      setLessonContent(text);
    } catch {
      if (!navigator.onLine) {
        setLessonContent('# Offline\n\nThis lesson hasn\'t been downloaded for offline reading yet. Connect to the internet or download this track first.');
      } else {
        setLessonContent('# Error\n\nFailed to load lesson content.');
      }
    } finally {
      setLoadingContent(false);
    }
  }, []);

  const openTrack = useCallback((track: Track) => {
    setCurrentTrack(track);
    setCurrentView('track');
    setHash(track.id);
    scrollToTop();
  }, []);

  const openLesson = useCallback(async (lesson: LessonMeta) => {
    setCurrentLesson(lesson);
    setCurrentView('lesson');
    setHash(`${lesson.trackId}/${lesson.filename}`);
    scrollToTop();
    await loadLessonContent(lesson);
  }, [loadLessonContent]);

  const navigateTo = useCallback((view: ViewState) => {
    setCurrentView(view);
    if (view === 'tracks') {
      setHash('');
      setCurrentTrack(null);
      setCurrentLesson(null);
    } else if (view === 'track' && currentTrack) {
      setHash(currentTrack.id);
      setCurrentLesson(null);
    } else if (view === 'lesson' && currentLesson) {
      setHash(`${currentLesson.trackId}/${currentLesson.filename}`);
    } else if (view === 'settings') {
      setHash('settings');
    }
  }, [currentTrack, currentLesson]);

  const handleLessonComplete = () => {
    if (currentLesson && !completedLessons.includes(currentLesson.id)) {
      setCompletedLessons(prev => [...prev, currentLesson.id]);
    }
    setCurrentView('complete');
  };

  const getNextLesson = (): LessonMeta | null => {
    if (!currentTrack || !currentLesson) return null;
    const lessons = currentTrack.lessons.filter(l => !l.isReference);
    const idx = lessons.findIndex(l => l.id === currentLesson.id);
    return idx !== -1 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
  };

  const getPrevLesson = (): LessonMeta | null => {
    if (!currentTrack || !currentLesson) return null;
    const lessons = currentTrack.lessons.filter(l => !l.isReference);
    const idx = lessons.findIndex(l => l.id === currentLesson.id);
    return idx > 0 ? lessons[idx - 1] : null;
  };

  const getCurrentLessonIndex = (): number => {
    if (!currentTrack || !currentLesson) return 0;
    const lessons = currentTrack.lessons.filter(l => !l.isReference);
    return lessons.findIndex(l => l.id === currentLesson.id);
  };

  const getTrackProgress = (track: Track): number => {
    const trackLessons = track.lessons.filter(l => !l.isReference);
    if (trackLessons.length === 0) return 0;
    const completed = trackLessons.filter(l => completedLessons.includes(l.id)).length;
    return Math.round((completed / trackLessons.length) * 100);
  };

  const getTableOfContents = (content: string) => {
    const headings = content.match(/^#{1,3}\s+(.+)$/gm) || [];
    return headings.map(heading => {
      const level = heading.match(/^#+/)?.[0].length || 1;
      const text = heading.replace(/^#+\s+/, '');
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      return { level, text, id };
    });
  };

  const filteredTracks = manifest?.tracks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const totalCompleted = completedLessons.length;
  const totalLessons = manifest?.totalLessons || 0;
  const overallProgress = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  const categories = ['All', 'Systems', 'AI/ML', 'Infra', 'Architecture'];
  const [activeCategory, setActiveCategory] = useState('All');

  const categoryFilteredTracks = filteredTracks.filter(t => {
    if (activeCategory === 'All') return true;
    const cat = TRACK_CATEGORIES[t.id];
    return cat?.label === activeCategory;
  });

  const renderTracks = () => (
    <div className="min-h-screen flex flex-col">
      <div className="relative overflow-hidden border-b border-theme">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 via-transparent to-amber-600/5"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

        <div className="relative p-6 max-w-3xl mx-auto pt-8 pb-10">
          <header className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-3 text-xs font-mono tracking-widest text-secondary">
              <div className="w-3 h-3 bg-orange-600"></div>
              SYSTEM
              {!offline.isOnline && (
                <span className="flex items-center gap-1 text-amber-500 ml-2">
                  <WifiOff size={12} />
                  OFFLINE
                </span>
              )}
            </div>
            <button onClick={() => navigateTo('settings')} className="text-secondary hover:text-[var(--text-primary)] transition-colors p-2">
              <Settings size={20} />
            </button>
          </header>

          <div className="mb-8">
            <h1 className="font-display text-7xl sm:text-8xl uppercase leading-[0.8] tracking-tight mb-6">
              Learn<br/>
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">Everything</span>
            </h1>
            <p className="text-secondary font-sans text-lg max-w-lg leading-relaxed">
              Systems programming, AI/ML engineering, infrastructure, and architecture.
              From first principles to production systems.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="border border-theme p-4 bg-surface/50">
              <div className="font-display text-3xl mb-1">{manifest?.tracks.length}</div>
              <div className="text-[10px] font-mono tracking-widest text-secondary uppercase">Tracks</div>
            </div>
            <div className="border border-theme p-4 bg-surface/50">
              <div className="font-display text-3xl mb-1">{totalLessons}</div>
              <div className="text-[10px] font-mono tracking-widest text-secondary uppercase">Lessons</div>
            </div>
            <div className="border border-theme p-4 bg-surface/50">
              <div className="font-display text-3xl mb-1">{overallProgress}%</div>
              <div className="text-[10px] font-mono tracking-widest text-secondary uppercase">Complete</div>
            </div>
          </div>

          {overallProgress > 0 && (
            <div className="h-1 bg-surface w-full rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-600 to-amber-600"
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <input
            type="text"
            placeholder="SEARCH TRACKS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-b-2 border-theme pb-2 font-display text-xl uppercase tracking-wide text-secondary placeholder:text-secondary focus:outline-none focus:border-orange-600 focus:text-[var(--text-primary)] transition-colors"
          />
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 text-[10px] font-mono tracking-widest uppercase whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-[var(--text-primary)] text-[var(--bg-color)]'
                  : 'border border-theme text-secondary hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="space-y-4 pb-20">
          {categoryFilteredTracks.map((track) => {
            const progress = getTrackProgress(track);
            const cat = TRACK_CATEGORIES[track.id];
            const IconComponent = cat?.icon || GraduationCap;

            return (
              <motion.div
                key={track.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group cursor-pointer border border-theme hover:border-orange-600/50 p-5 transition-all hover:bg-surface/50"
                onClick={() => openTrack(track)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <IconComponent size={12} className={cat?.color || 'text-secondary'} />
                      <span className="text-[10px] font-mono tracking-widest text-secondary uppercase">
                        {cat?.label || 'General'} • {track.lessonCount} lessons
                      </span>
                      {progress === 100 && (
                        <span className="text-[10px] font-mono tracking-widest text-green-500 uppercase flex items-center gap-1">
                          <Check size={10} /> Done
                        </span>
                      )}
                      {offline.isTrackOffline(track.id) && (
                        <span className="text-[10px] font-mono tracking-widest text-orange-500 uppercase flex items-center gap-1">
                          <CheckCircle size={10} /> OFFLINE
                        </span>
                      )}
                    </div>
                    <h2 className="font-display text-3xl sm:text-4xl uppercase leading-[0.85] tracking-tight group-hover:text-orange-500 transition-colors">
                      {track.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (offline.isTrackOffline(track.id)) {
                          offline.removeTrack(track);
                        } else {
                          offline.downloadTrack(track);
                        }
                      }}
                      className={`p-2 transition-colors ${
                        offline.isTrackOffline(track.id)
                          ? 'text-orange-500 hover:text-red-500'
                          : 'text-secondary hover:text-orange-500'
                      }`}
                      title={offline.isTrackOffline(track.id) ? 'Remove offline data' : 'Download for offline'}
                    >
                      {offline.downloadingTrackId === track.id ? (
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      ) : offline.isTrackOffline(track.id) ? (
                        <CheckCircle size={20} />
                      ) : (
                        <Download size={20} />
                      )}
                    </button>
                    <ArrowRight size={20} className="text-secondary group-hover:text-orange-500 transition-colors group-hover:translate-x-1 transform" />
                  </div>
                </div>
                {offline.downloadingTrackId === track.id && (
                  <div className="mt-3 h-1 bg-theme w-full rounded-full overflow-hidden">
                    <div className="h-full bg-orange-600 transition-all duration-300 rounded-full" style={{ width: `${offline.downloadProgress}%` }}></div>
                  </div>
                )}
                {progress > 0 && (
                  <div className="mt-3 h-0.5 bg-theme w-full rounded-full overflow-hidden">
                    <div className="h-full bg-orange-600 transition-all duration-500 rounded-full" style={{ width: `${progress}%` }}></div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderTrackLessons = () => {
    if (!currentTrack) return null;
    const lessons = currentTrack.lessons.filter(l => !l.isReference);
    const references = currentTrack.lessons.filter(l => l.isReference);

    return (
      <div className="min-h-screen p-6 max-w-2xl mx-auto flex flex-col">
        <header className="flex justify-between items-center mb-12">
          <button
            onClick={() => { navigateTo('tracks'); setSearchQuery(''); }}
            className="flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-secondary hover:text-[var(--text-primary)] transition-colors group"
          >
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Tracks
          </button>
          <button onClick={() => navigateTo('settings')} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
            <Settings size={20} />
          </button>
        </header>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 bg-orange-600"></div>
            <span className="text-[10px] font-mono tracking-widest text-secondary uppercase">
              {currentTrack.lessonCount} lessons • {getTrackProgress(currentTrack)}% complete
            </span>
          </div>
          <h1 className="font-display text-5xl sm:text-6xl uppercase leading-[0.85] tracking-tight mb-4">
            {currentTrack.title.split(' ').map((word, i) => (
              <span key={i} className={i % 2 !== 0 ? 'text-secondary' : ''}>
                {word}{' '}
              </span>
            ))}
          </h1>
        </div>

        <div className="mb-6">
          {offline.downloadingTrackId === currentTrack.id ? (
            <div className="border border-orange-600/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono tracking-widest text-orange-500 uppercase">Downloading...</span>
                <span className="text-[10px] font-mono tracking-widest text-orange-500">{offline.downloadProgress}%</span>
              </div>
              <div className="h-1 bg-theme w-full rounded-full overflow-hidden">
                <div className="h-full bg-orange-600 transition-all duration-300 rounded-full" style={{ width: `${offline.downloadProgress}%` }}></div>
              </div>
            </div>
          ) : offline.isTrackOffline(currentTrack.id) ? (
            <button
              onClick={() => offline.removeTrack(currentTrack)}
              className="w-full border border-orange-600/50 p-4 flex items-center justify-between text-orange-500 hover:border-red-600/50 hover:text-red-500 transition-colors"
            >
              <span className="text-[10px] font-mono tracking-widest uppercase flex items-center gap-2">
                <CheckCircle size={14} /> Available Offline
              </span>
              <span className="text-[10px] font-mono tracking-widest uppercase">Remove</span>
            </button>
          ) : (
            <button
              onClick={() => offline.downloadTrack(currentTrack)}
              className="w-full border border-theme p-4 flex items-center justify-center gap-2 text-secondary hover:text-orange-500 hover:border-orange-600/50 transition-colors"
            >
              <Download size={14} />
              <span className="text-[10px] font-mono tracking-widest uppercase">Download for Offline</span>
            </button>
          )}
        </div>

        <div className="flex-1 space-y-4 pb-12">
          {lessons.map((lesson, idx) => (
            <div
              key={lesson.id}
              className="group cursor-pointer border-b border-theme pb-4 last:border-0 flex items-start gap-4"
              onClick={() => openLesson(lesson)}
            >
              <div className="flex-shrink-0 mt-1">
                {completedLessons.includes(lesson.id) ? (
                  <div className="w-6 h-6 bg-green-500/20 border border-green-500 flex items-center justify-center">
                    <Check size={14} className="text-green-500" />
                  </div>
                ) : (
                  <div className="w-6 h-6 border border-theme flex items-center justify-center">
                    <span className="text-[10px] font-mono text-secondary">{String(idx + 1).padStart(2, '0')}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-xl sm:text-2xl uppercase tracking-tight group-hover:text-orange-500 transition-colors leading-tight">
                  {lesson.title}
                </h3>
                <span className="text-[10px] font-mono tracking-widest text-secondary uppercase">
                  {Math.ceil(lesson.wordCount / 200)} min read
                </span>
              </div>
              <ArrowRight size={16} className="text-secondary group-hover:text-orange-500 transition-colors mt-2 flex-shrink-0" />
            </div>
          ))}

          {references.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-8 mb-4">
                <Layers size={14} className="text-secondary" />
                <span className="text-[10px] font-mono tracking-widest text-secondary uppercase">Reference Files</span>
              </div>
              {references.map((ref) => (
                <div
                  key={ref.id}
                  className="group cursor-pointer border-b border-theme pb-4 last:border-0 flex items-center gap-4"
                  onClick={() => openLesson(ref)}
                >
                  <BookOpen size={16} className="text-secondary flex-shrink-0" />
                  <h3 className="font-mono text-sm group-hover:text-orange-500 transition-colors flex-1">
                    {ref.title}
                  </h3>
                  <ArrowRight size={14} className="text-secondary group-hover:text-orange-500 transition-colors flex-shrink-0" />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderLesson = () => {
    if (!currentLesson || !currentTrack) return null;

    return (
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur-md border-b border-theme flex flex-col">
          <div className="px-4 py-3 flex justify-between items-center max-w-5xl mx-auto w-full">
            <div className="flex items-center flex-1">
              <button
                onClick={() => navigateTo('track')}
                className="flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-secondary hover:text-[var(--text-primary)] transition-colors group"
              >
                <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                <span className="hidden sm:inline">{currentTrack.title}</span>
              </button>
            </div>
            <div className="flex flex-col items-center justify-center flex-1 min-w-0 px-4">
              <div className="text-[10px] font-mono tracking-widest text-secondary uppercase flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 bg-orange-600 inline-block rounded-full"></span>
                {currentTrack.title}
              </div>
              <div className="text-sm font-display tracking-wide uppercase truncate w-full text-center hidden md:block">
                {currentLesson.title}
              </div>
            </div>
            <div className="flex items-center justify-end gap-4 sm:gap-6 flex-1">
              {!offline.isOnline && (
                <WifiOff size={14} className="text-amber-500" />
              )}
              <div className="text-xs font-mono tracking-widest text-secondary uppercase hidden sm:block tabular-nums">
                {Math.round(scrollProgress * 100)}% READ
              </div>
              <button
                onClick={() => navigateTo('settings')}
                className="text-secondary hover:text-[var(--text-primary)] transition-colors"
              >
                <Settings size={16} />
              </button>
            </div>
          </div>
          <div className="h-0.5 bg-theme w-full origin-left">
            <motion.div className="h-full bg-orange-600 origin-left" style={{ scaleX }} />
          </div>
        </header>

        <main className="flex-1 p-6 max-w-3xl mx-auto w-full" style={{ fontSize: `${scale}%` }}>
          <div className="mb-12 mt-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 bg-orange-600"></div>
              <span className="text-[10px] font-mono tracking-widest text-secondary uppercase">
                {Math.ceil(currentLesson.wordCount / 200)} min read
              </span>
            </div>
            <h1 className="font-display text-6xl sm:text-7xl uppercase leading-[0.85] tracking-tight mb-8">
              {currentLesson.title.split(' ').map((word, i) => (
                <span key={i} className={i % 2 !== 0 ? 'text-secondary' : ''}>
                  {word}{' '}
                </span>
              ))}
            </h1>
          </div>

          {loadingContent ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-secondary font-mono text-sm tracking-widest uppercase animate-pulse">Loading...</div>
            </div>
          ) : (
            <>
              {getTableOfContents(lessonContent).length > 2 && (
                <div className="mb-12 p-6 border border-theme bg-surface/50 rounded-lg">
                  <h2 className="font-display text-xl uppercase tracking-wide mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-orange-600 inline-block"></span>
                    Table of Contents
                  </h2>
                  <ul className="space-y-2 font-mono text-sm">
                    {getTableOfContents(lessonContent).map((item, index) => (
                      <li key={index} style={{ paddingLeft: `${(item.level - 1) * 1.5}rem` }}>
                        <a
                          href={`#${item.id}`}
                          className="text-secondary hover:text-[var(--text-primary)] transition-colors hover:underline decoration-orange-500 underline-offset-4"
                          onClick={(e) => {
                            e.preventDefault();
                            const element = document.getElementById(item.id);
                            if (element) {
                              const y = element.getBoundingClientRect().top + window.scrollY - 100;
                              window.scrollTo({ top: y, behavior: 'smooth' });
                            }
                          }}
                        >
                          {item.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="markdown-body">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    h1: ({ children, ...props }) => {
                      const id = children?.toString().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || '';
                      return <h1 id={id} {...props}>{children}</h1>;
                    },
                    h2: ({ children, ...props }) => {
                      const id = children?.toString().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || '';
                      return <h2 id={id} {...props}>{children}</h2>;
                    },
                    h3: ({ children, ...props }) => {
                      const id = children?.toString().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || '';
                      return <h3 id={id} {...props}>{children}</h3>;
                    },
                    code: ({ className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');
                      if (match) {
                        return (
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.85rem' }}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        );
                      }
                      if (codeString.includes('\n')) {
                        return (
                          <pre className="ascii-block"><code>{codeString}</code></pre>
                        );
                      }
                      return <code className={className} {...props}>{children}</code>;
                    },
                    pre: ({ children }) => <>{children}</>,
                    a: ({ href, children, ...props }) => {
                      if (href?.endsWith('.md') && currentTrack) {
                        const filename = href.split('/').pop() || '';
                        const targetLesson = currentTrack.lessons.find(l => l.filename === filename);
                        if (targetLesson) {
                          return (
                            <a
                              href="#"
                              onClick={(e) => { e.preventDefault(); openLesson(targetLesson); }}
                              className="text-orange-500 hover:underline cursor-pointer"
                              {...props}
                            >
                              {children}
                            </a>
                          );
                        }
                      }
                      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                    },
                  }}
                >
                  {lessonContent}
                </Markdown>
              </div>

              <div className="mt-24 border-t border-theme pt-8">
                <div className="flex items-center justify-between gap-4 mb-8">
                  {getPrevLesson() ? (
                    <button
                      onClick={() => openLesson(getPrevLesson()!)}
                      className="flex items-center gap-2 border border-theme px-4 py-3 text-xs font-mono tracking-widest uppercase text-secondary hover:text-[var(--text-primary)] hover:border-orange-600/50 transition-colors"
                    >
                      <ChevronLeft size={14} />
                      <span className="hidden sm:inline">{getPrevLesson()!.title}</span>
                      <span className="sm:hidden">Previous</span>
                    </button>
                  ) : <div />}
                  <span className="text-[10px] font-mono tracking-widest text-secondary tabular-nums">
                    {getCurrentLessonIndex() + 1} / {currentTrack.lessons.filter(l => !l.isReference).length}
                  </span>
                  {getNextLesson() ? (
                    <button
                      onClick={() => openLesson(getNextLesson()!)}
                      className="flex items-center gap-2 border border-theme px-4 py-3 text-xs font-mono tracking-widest uppercase text-secondary hover:text-[var(--text-primary)] hover:border-orange-600/50 transition-colors"
                    >
                      <span className="hidden sm:inline">{getNextLesson()!.title}</span>
                      <span className="sm:hidden">Next</span>
                      <ArrowRight size={14} />
                    </button>
                  ) : <div />}
                </div>

                {!currentLesson.isReference && (
                  <div className="mb-12 flex justify-center">
                    <button
                      onClick={handleLessonComplete}
                      className="bg-[var(--text-primary)] text-[var(--bg-color)] font-display text-2xl px-8 py-4 uppercase tracking-wide hover:opacity-80 transition-opacity flex items-center gap-3"
                    >
                      Complete Lesson <Check size={24} />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 bg-[var(--text-primary)] text-[var(--bg-color)] p-3 rounded-full shadow-lg hover:opacity-80 transition-opacity z-50"
            aria-label="Back to top"
          >
            <ArrowUp size={24} />
          </button>
        )}
      </div>
    );
  };

  const renderComplete = () => {
    if (!currentLesson || !currentTrack) return null;
    const nextLesson = getNextLesson();

    return (
      <div className="min-h-screen p-6 max-w-2xl mx-auto flex flex-col">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-secondary">
            <div className="w-2 h-2 bg-white" style={{ backgroundColor: 'var(--text-primary)' }}></div>
            SYSTEM
          </div>
          <button onClick={() => navigateTo('track')} className="text-secondary hover:text-[var(--text-primary)] transition-colors">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 flex flex-col justify-center">
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 bg-orange-600"></div>
              <span className="text-[10px] font-mono tracking-widest text-secondary uppercase">Lesson Complete</span>
            </div>
            <h1 className="font-display text-7xl sm:text-8xl uppercase leading-[0.85] tracking-tight">
              {currentLesson.title.split(' ').map((word, i) => (
                <span key={i} className={i % 2 !== 0 ? 'text-secondary block' : 'block'}>
                  {word}
                </span>
              ))}
              <span className="block text-[var(--text-primary)]">FINISHED</span>
            </h1>
          </div>

          <div className="grid grid-cols-2 border border-theme mb-12">
            <div className="p-6 border-r border-theme">
              <div className="font-display text-4xl mb-1">{Math.ceil(currentLesson.wordCount / 200)}</div>
              <div className="text-[10px] font-mono tracking-widest text-secondary uppercase">Min Read</div>
            </div>
            <div className="p-6">
              <div className="font-display text-4xl mb-1">{currentLesson.wordCount.toLocaleString()}</div>
              <div className="text-[10px] font-mono tracking-widest text-secondary uppercase">Words Read</div>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-end mb-4">
              <h3 className="font-display text-2xl uppercase tracking-wide">Track Progress</h3>
              <span className="text-orange-600 font-mono text-xs tracking-widest">{getTrackProgress(currentTrack)}% COMPLETE</span>
            </div>
            <div className="h-1 bg-surface w-full">
              <div className="h-full bg-[var(--text-primary)] transition-all duration-500" style={{ width: `${getTrackProgress(currentTrack)}%` }}></div>
            </div>
          </div>

          {nextLesson && (
            <button
              onClick={() => openLesson(nextLesson)}
              className="w-full bg-[var(--text-primary)] text-[var(--bg-color)] font-display text-2xl p-6 uppercase tracking-wide hover:opacity-80 transition-opacity flex items-center justify-between mb-4"
            >
              <span>Next: {nextLesson.title}</span>
              <ArrowRight size={24} />
            </button>
          )}

          <button
            onClick={() => navigateTo('track')}
            className="w-full border border-theme p-4 text-xs font-mono tracking-widest uppercase text-secondary hover:text-[var(--text-primary)] hover:bg-surface transition-colors"
          >
            Return to Track
          </button>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="min-h-screen p-6 max-w-2xl mx-auto flex flex-col">
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-secondary">
          <div className="w-2 h-2 bg-white" style={{ backgroundColor: 'var(--text-primary)' }}></div>
          SYSTEM
        </div>
        <button
          onClick={() => navigateTo(currentLesson ? 'lesson' : currentTrack ? 'track' : 'tracks')}
          className="text-secondary hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={20} />
        </button>
      </header>

      <h1 className="font-display text-6xl sm:text-7xl uppercase leading-[0.85] tracking-tight mb-16">
        Reading<br/>Settings
      </h1>

      <div className="space-y-12 flex-1">
        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-1.5 bg-orange-600"></div>
            <span className="text-[10px] font-mono tracking-widest text-secondary uppercase">Typography</span>
          </div>
          <div className="border border-theme p-4 flex items-center justify-between">
            <button
              onClick={() => setScale(Math.max(80, scale - 10))}
              className="border border-theme w-10 h-10 flex items-center justify-center font-display text-xl hover:bg-surface transition-colors"
            >
              A-
            </button>
            <span className="font-mono text-sm tracking-widest">{scale}% SCALE</span>
            <button
              onClick={() => setScale(Math.min(150, scale + 10))}
              className="border border-theme w-10 h-10 flex items-center justify-center font-display text-xl hover:bg-surface transition-colors"
            >
              A+
            </button>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-1.5 bg-orange-600"></div>
            <span className="text-[10px] font-mono tracking-widest text-secondary uppercase">Interface Theme</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {(['dark', 'light', 'sepia'] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`border p-6 flex flex-col items-center gap-4 transition-colors ${theme === t ? 'border-[var(--text-primary)]' : 'border-theme hover:border-[var(--text-primary)]'}`}
              >
                <div className={`w-6 h-6 rounded-full ${t === 'dark' ? 'bg-[#111]' : t === 'light' ? 'bg-white' : 'bg-[#f4ecd8]'} border border-gray-500`}></div>
                <span className="text-[10px] font-mono tracking-widest uppercase">{t}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-1.5 bg-orange-600"></div>
            <span className="text-[10px] font-mono tracking-widest text-secondary uppercase">Offline Storage</span>
          </div>
          <div className="border border-theme p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono tracking-widest text-secondary uppercase">Storage Used</span>
              <span className="text-[10px] font-mono tracking-widest text-secondary">
                {offline.storageUsed > 0 ? `${(offline.storageUsed / 1024 / 1024).toFixed(1)} MB` : '0 MB'}
                {offline.storageTotal > 0 ? ` / ${(offline.storageTotal / 1024 / 1024 / 1024).toFixed(1)} GB` : ''}
              </span>
            </div>
            {offline.storageTotal > 0 && (
              <div className="h-1 bg-theme w-full rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-600 rounded-full"
                  style={{ width: `${Math.min((offline.storageUsed / offline.storageTotal) * 100, 100)}%` }}
                ></div>
              </div>
            )}
            <div className="mt-3 text-[10px] font-mono tracking-widest text-secondary uppercase">
              {offline.downloadedTracks.size} track{offline.downloadedTracks.size !== 1 ? 's' : ''} downloaded
            </div>
          </div>
          <button
            onClick={() => offline.clearAll()}
            className="w-full border border-red-900 p-4 text-xs font-mono tracking-widest uppercase text-red-500 hover:bg-red-950 transition-colors flex items-center justify-center gap-2 mb-4"
          >
            <Trash2 size={14} />
            Clear All Downloads
          </button>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-1.5 bg-orange-600"></div>
            <span className="text-[10px] font-mono tracking-widest text-secondary uppercase">Data</span>
          </div>
          <button
            onClick={() => { setCompletedLessons([]); }}
            className="w-full border border-red-900 p-4 text-xs font-mono tracking-widest uppercase text-red-500 hover:bg-red-950 transition-colors"
          >
            Reset All Progress
          </button>
        </section>
      </div>

      <div className="mt-12">
        <button
          onClick={() => navigateTo(currentLesson ? 'lesson' : currentTrack ? 'track' : 'tracks')}
          className="w-full bg-[var(--text-primary)] text-[var(--bg-color)] font-mono text-xs tracking-widest p-4 uppercase hover:opacity-80 transition-opacity"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );

  if (!manifest) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-secondary font-mono text-sm tracking-widest uppercase animate-pulse">Loading System...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-300">
      {currentView === 'tracks' && renderTracks()}
      {currentView === 'track' && renderTrackLessons()}
      {currentView === 'lesson' && renderLesson()}
      {currentView === 'complete' && renderComplete()}
      {currentView === 'settings' && renderSettings()}
    </div>
  );
}
