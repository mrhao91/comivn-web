
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getChapterPages, getComicById } from '../services/mockData';
import { Page, Comic, Chapter } from '../types';
import { ChevronLeft, ChevronRight, Home, List, Settings } from 'lucide-react';
import AdDisplay from '../components/AdDisplay';
import SEOHead from '../components/SEOHead';

const Reader: React.FC = () => {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [comic, setComic] = useState<Comic | undefined>(undefined);
  const [currentChapter, setCurrentChapter] = useState<Chapter | undefined>(undefined);
  const [showHeader, setShowHeader] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const lastScrollY = useRef(0);

  useEffect(() => {
    const fetchData = async () => {
        // Handle "undefined" string literal bug explicitly
        if (!chapterId || chapterId === 'undefined') {
            setError("Không tìm thấy chương truyện này.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Assuming ID format like "comic-1-chapter-5" or extracting ID logic
            // We'll try to guess comic ID if naming convention is followed, or just fetch directly if logic is different.
            // In a real app, backend usually provides "comicId" when fetching chapter info.
            
            // Quick Fix: Extract potential Comic ID
            const comicIdPart = chapterId.includes('-chapter') ? chapterId.split('-chapter')[0] : chapterId.split('-')[0];
            const comicData = await getComicById(comicIdPart);
            
            if (comicData) {
                setComic(comicData);
                const foundChapter = comicData.chapters.find(c => c.id === chapterId);
                
                if (foundChapter) {
                    setCurrentChapter(foundChapter);
                    const pageData = await getChapterPages(chapterId);
                    setPages(pageData);
                } else {
                    setError("Chương này không tồn tại trong truyện.");
                }
            } else {
                 // Even if comic lookup fails by ID string, maybe we can just load pages?
                 // But UI needs title. Let's try to load pages anyway.
                 const pageData = await getChapterPages(chapterId);
                 if (pageData && pageData.length > 0) {
                     setPages(pageData);
                 } else {
                     setError("Không thể tải nội dung chương.");
                 }
            }
        } catch (err) {
            console.error(err);
            setError("Đã xảy ra lỗi khi tải trang.");
        } finally {
            setLoading(false);
            window.scrollTo(0, 0);
        }
    };

    fetchData();
  }, [chapterId]);

  useEffect(() => {
      const handleScroll = () => {
          const currentScrollY = window.scrollY;
          if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
              setShowHeader(false);
          } else {
              setShowHeader(true);
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

      let newIndex = direction === 'next' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < comic.chapters.length) {
          navigate(`/doc/${comic.chapters[newIndex].id}`);
      }
  };

  const hasNext = comic && currentChapter && comic.chapters.findIndex(c => c.id === currentChapter.id) > 0;
  const hasPrev = comic && currentChapter && comic.chapters.findIndex(c => c.id === currentChapter.id) < comic.chapters.length - 1;

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-white">Đang tải trang...</div>;
  
  if (error) return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
          <p className="text-xl text-red-500">{error}</p>
          <button onClick={() => navigate(-1)} className="text-primary hover:underline">Quay lại</button>
      </div>
  );

  const middleIndex = Math.max(1, Math.floor(pages.length / 2));
  
  // Dynamic Page Title
  const pageTitle = comic && currentChapter 
    ? `${comic.title} - ${currentChapter.title} | ComiVN` 
    : 'Đọc truyện - ComiVN';

  return (
    <div className="bg-[#111] min-h-screen relative">
        {/* SEO */}
        <SEOHead 
            title={pageTitle}
            description={`Đọc truyện ${comic?.title} ${currentChapter?.title} chất lượng cao.`}
            url={window.location.href}
        />

        <AdDisplay position="reader_float_left" />
        <AdDisplay position="reader_float_right" />

        <div className={`fixed top-0 left-0 right-0 bg-black/90 text-white z-50 transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
                <div className="flex items-center gap-4">
                    <Link to={comic ? `/truyen/${comic.slug || comic.id}` : '/'} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ChevronLeft />
                    </Link>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm line-clamp-1">{comic?.title || 'Đang đọc truyện'}</span>
                        <span className="text-xs text-slate-400">{currentChapter?.title || ''}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <Link to="/" className="p-2 hover:bg-white/10 rounded-full">
                        <Home size={20} />
                     </Link>
                </div>
            </div>
        </div>

        <div className="max-w-3xl mx-auto pt-14 pb-24 min-h-screen bg-black" onClick={() => setShowHeader(!showHeader)}>
            <div className="p-4 bg-[#1a1a1a] mb-2">
                <p className="text-center text-[10px] text-gray-500 mb-1">QUẢNG CÁO</p>
                <AdDisplay position="reader_top" />
            </div>

            {pages.map((page, index) => (
                <React.Fragment key={page.id || index}>
                    <img 
                        src={page.imageUrl}
                        alt={`Page ${page.pageNumber}`}
                        className="w-full h-auto block"
                        loading="lazy"
                    />
                    {index === middleIndex && (
                        <div className="py-4 bg-[#1a1a1a]">
                            <p className="text-center text-[10px] text-gray-500 mb-1">QUẢNG CÁO</p>
                            <AdDisplay position="reader_middle" />
                        </div>
                    )}
                </React.Fragment>
            ))}
            
            <div className="bg-[#222] p-4 mt-8">
                <p className="text-center text-xs text-gray-500 mb-2">QUẢNG CÁO</p>
                <AdDisplay position="reader_bottom" />
            </div>
        </div>

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
