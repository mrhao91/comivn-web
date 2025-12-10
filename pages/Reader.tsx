
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getChapterPages, getComicById } from '../services/mockData';
import { Page, Comic, Chapter } from '../types';
import { ChevronLeft, ChevronRight, Home, List, Settings } from 'lucide-react';
import AdDisplay from '../components/AdDisplay';

const Reader: React.FC = () => {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [comic, setComic] = useState<Comic | undefined>(undefined);
  const [currentChapter, setCurrentChapter] = useState<Chapter | undefined>(undefined);
  const [showHeader, setShowHeader] = useState(true);
  
  // Track previous scroll for auto-hiding header
  const lastScrollY = useRef(0);

  useEffect(() => {
    const fetchData = async () => {
        if (!chapterId) return;
        setLoading(true);
        // Find comic and chapter info (In real app, API returns this together)
        // Here we have to search a bit inefficiently due to mock structure
        // This logic simulates "fetching chapter details"
        
        // Mock finding the comic that owns this chapter
        // Since we don't have a direct "getChapter" API in mock that returns comic, 
        // we'll fetch the comic by splitting ID (assuming ID format comic-X-chapter-Y)
        const comicIdPart = chapterId.split('-chapter-')[0]; 
        const comicData = await getComicById(comicIdPart);
        
        if (comicData) {
            setComic(comicData);
            const foundChapter = comicData.chapters.find(c => c.id === chapterId);
            setCurrentChapter(foundChapter);
            
            const pageData = await getChapterPages(chapterId);
            setPages(pageData);
        }
        setLoading(false);
        window.scrollTo(0, 0);
    };

    fetchData();
  }, [chapterId]);

  useEffect(() => {
      const handleScroll = () => {
          const currentScrollY = window.scrollY;
          if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
              setShowHeader(false); // Scroll down -> Hide
          } else {
              setShowHeader(true); // Scroll up -> Show
          }
          lastScrollY.current = currentScrollY;
      };

      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigateChapter = (direction: 'next' | 'prev') => {
      if (!comic || !currentChapter) return;
      
      const currentIndex = comic.chapters.findIndex(c => c.id === currentChapter.id);
      if (currentIndex === -1) return;

      // Note: Chapters are usually sorted DESC (newest first) in array
      // So 'next' chapter (higher number) is actually index - 1 if sorted DESC
      // But let's assume standard logic: Next Chapter means Chapter N -> Chapter N+1
      
      // Let's rely on array index for simplicity:
      // If chapters are [10, 9, 8... 1]
      // Current is 9 (index 1). Next chapter (10) is index 0. Prev chapter (8) is index 2.
      
      let newIndex = direction === 'next' ? currentIndex - 1 : currentIndex + 1;
      
      if (newIndex >= 0 && newIndex < comic.chapters.length) {
          navigate(`/read/${comic.chapters[newIndex].id}`);
      }
  };

  const hasNext = comic && currentChapter && comic.chapters.findIndex(c => c.id === currentChapter.id) > 0;
  const hasPrev = comic && currentChapter && comic.chapters.findIndex(c => c.id === currentChapter.id) < comic.chapters.length - 1;

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-white">Đang tải trang...</div>;

  // Calculate middle index for inserting ad
  const middleIndex = Math.max(1, Math.floor(pages.length / 2));

  return (
    <div className="bg-[#111] min-h-screen relative">
        {/* Floating Ads (Left & Right - Only Visible on Large Screens) */}
        <AdDisplay position="reader_float_left" />
        <AdDisplay position="reader_float_right" />

        {/* Sticky Header */}
        <div className={`fixed top-0 left-0 right-0 bg-black/90 text-white z-50 transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
                <div className="flex items-center gap-4">
                    <Link to={comic ? `/comic/${comic.id}` : '/'} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ChevronLeft />
                    </Link>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm line-clamp-1">{comic?.title}</span>
                        <span className="text-xs text-slate-400">{currentChapter?.title}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <Link to="/" className="p-2 hover:bg-white/10 rounded-full">
                        <Home size={20} />
                     </Link>
                </div>
            </div>
        </div>

        {/* Reader Content */}
        <div className="max-w-3xl mx-auto pt-14 pb-24 min-h-screen bg-black" onClick={() => setShowHeader(!showHeader)}>
            
            {/* AD: READER TOP */}
            <div className="p-4 bg-[#1a1a1a] mb-2">
                <p className="text-center text-[10px] text-gray-500 mb-1">QUẢNG CÁO</p>
                <AdDisplay position="reader_top" />
            </div>

            {pages.map((page, index) => (
                <React.Fragment key={page.id}>
                    <img 
                        src={page.imageUrl}
                        alt={`Page ${page.pageNumber}`}
                        className="w-full h-auto block"
                        loading="lazy"
                    />
                    {/* AD: READER MIDDLE (Inserted after middle page) */}
                    {index === middleIndex && (
                        <div className="py-4 bg-[#1a1a1a]">
                            <p className="text-center text-[10px] text-gray-500 mb-1">QUẢNG CÁO</p>
                            <AdDisplay position="reader_middle" />
                        </div>
                    )}
                </React.Fragment>
            ))}
            
            {/* AD: READER BOTTOM */}
            <div className="bg-[#222] p-4 mt-8">
                <p className="text-center text-xs text-gray-500 mb-2">QUẢNG CÁO</p>
                <AdDisplay position="reader_bottom" />
            </div>
        </div>

        {/* Navigation Footer */}
        <div className={`fixed bottom-0 left-0 right-0 bg-black/90 text-white z-50 border-t border-white/10 transition-transform duration-300 ${showHeader ? 'translate-y-0' : 'translate-y-full'}`}>
             <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                <button 
                    onClick={() => navigateChapter('prev')}
                    disabled={!hasPrev}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${!hasPrev ? 'text-slate-600 cursor-not-allowed' : 'text-slate-200 hover:bg-white/10'}`}
                >
                    <ChevronLeft size={20} />
                    <span className="hidden md:inline">Chap trước</span>
                </button>

                 <div className="text-sm font-medium text-primary">
                    {currentChapter?.number} / {comic?.chapters[0]?.number}
                 </div>

                <button 
                     onClick={() => navigateChapter('next')}
                     disabled={!hasNext}
                     className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${!hasNext ? 'text-slate-600 cursor-not-allowed' : 'text-slate-200 hover:bg-white/10'}`}
                >
                    <span className="hidden md:inline">Chap sau</span>
                    <ChevronRight size={20} />
                </button>
             </div>
        </div>
    </div>
  );
};

export default Reader;
