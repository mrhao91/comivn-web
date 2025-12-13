
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getChapterPages, getComicById } from '../services/mockData';
import { DataProvider } from '../services/dataProvider';
import { Page, Comic, Chapter } from '../types';
import { ChevronLeft, ChevronRight, Home, Flag } from 'lucide-react';
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
            // Quick Fix: Extract potential Comic ID
            // Format thường là comicId-chapterId hoặc comicId đơn giản
            const comicIdPart = chapterId.includes('-chapter') ? chapterId.split('-chapter')[0] : chapterId.split('-')[0];
            
            // Lấy thông tin truyện trước để có context (tiêu đề, danh sách chap)
            const comicData = await getComicById(comicIdPart);
            
            if (comicData) {
                setComic(comicData);
                const foundChapter = comicData.chapters.find(c => c.id === chapterId);
                
                if (foundChapter) {
                    setCurrentChapter(foundChapter);
                    // Lấy danh sách ảnh của chapter
                    const pageData = await getChapterPages(chapterId);
                    setPages(pageData);
                } else {
                    // Nếu không tìm thấy chap trong list của truyện (có thể do ID URL khác format),
                    // vẫn thử load pages để người dùng đọc được nội dung
                    const pageData = await getChapterPages(chapterId);
                    if (pageData && pageData.length > 0) {
                        setPages(pageData);
                        setCurrentChapter({ 
                            id: chapterId, 
                            comicId: comicData.id, 
                            number: 0, 
                            title: 'Chương hiện tại', 
                            updatedAt: new Date().toISOString() 
                        });
                    } else {
                        setError("Chương này không tồn tại hoặc chưa có nội dung.");
                    }
                }
            } else {
                 // Fallback: nếu không lấy được info truyện, chỉ load ảnh
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

  // Xử lý ẩn/hiện Header khi cuộn
  useEffect(() => {
      const handleScroll = () => {
          const currentScrollY = window.scrollY;
          if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
              setShowHeader(false); // Cuộn xuống -> Ẩn
          } else {
              setShowHeader(true);  // Cuộn lên -> Hiện
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

      let newIndex = direction === 'next' ? currentIndex - 1 : currentIndex + 1; // Vì chapters thường sort DESC (mới nhất đầu)
      
      // Kiểm tra bounds
      if (newIndex >= 0 && newIndex < comic.chapters.length) {
          navigate(`/doc/${comic.chapters[newIndex].id}`);
      }
  };

  const handleReportError = async () => {
      if (!comic || !currentChapter) {
          alert("Dữ liệu chương chưa tải xong, vui lòng thử lại sau vài giây.");
          return;
      }
      
      const reason = window.prompt("Mô tả lỗi bạn gặp phải (ví dụ: ảnh die, sai chương, load chậm...):");
      if (reason) {
          try {
              const success = await DataProvider.sendReport(comic.id, currentChapter.id, reason);
              if (success) {
                  alert("Cảm ơn bạn đã báo lỗi. Admin sẽ kiểm tra sớm nhất!");
              } else {
                  alert("Có lỗi khi gửi báo cáo. Vui lòng thử lại.");
              }
          } catch (e) {
              console.error("Report error:", e);
              alert("Lỗi kết nối. Vui lòng kiểm tra mạng.");
          }
      }
  };

  // Logic điều hướng
  const hasNext = comic && currentChapter && comic.chapters.findIndex(c => c.id === currentChapter.id) > 0;
  const hasPrev = comic && currentChapter && comic.chapters.findIndex(c => c.id === currentChapter.id) < comic.chapters.length - 1;

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-white">Đang tải trang...</div>;
  
  if (error) return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
          <p className="text-xl text-red-500">{error}</p>
          <button onClick={() => navigate('/')} className="text-primary hover:underline flex items-center gap-2"><Home size={18}/> Quay về trang chủ</button>
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

        {/* Floating Ads */}
        <AdDisplay position="reader_float_left" />
        <AdDisplay position="reader_float_right" />

        {/* Top Bar (Sticky) */}
        <div className={`fixed top-0 left-0 right-0 bg-black/90 text-white z-50 transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
                <div className="flex items-center gap-4">
                    <Link to={comic ? `/truyen/${comic.slug || comic.id}` : '/'} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-300 hover:text-white">
                        <ChevronLeft />
                    </Link>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm line-clamp-1 text-slate-200">{comic?.title || 'Đang đọc truyện'}</span>
                        <span className="text-xs text-primary">{currentChapter?.title || ''}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <button 
                        onClick={handleReportError}
                        className="flex items-center gap-1 p-2 hover:bg-white/10 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                        title="Báo lỗi chương truyện"
                    >
                        <Flag size={18} />
                        <span className="hidden md:inline text-sm font-medium">Báo lỗi</span>
                    </button>
                     <Link to="/" className="p-2 hover:bg-white/10 rounded-full text-slate-300 hover:text-white" title="Trang chủ">
                        <Home size={20} />
                     </Link>
                </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="max-w-3xl mx-auto pt-14 pb-24 min-h-screen bg-black" onClick={() => setShowHeader(!showHeader)}>
            <div className="p-4 bg-[#1a1a1a] mb-2">
                <p className="text-center text-[10px] text-gray-500 mb-1">QUẢNG CÁO</p>
                <AdDisplay position="reader_top" />
            </div>

            {/* Render Pages */}
            <div className="flex flex-col items-center">
                {pages.map((page, index) => (
                    <React.Fragment key={page.id || index}>
                        <img 
                            src={page.imageUrl}
                            alt={`Page ${page.pageNumber}`}
                            className="w-full h-auto block"
                            loading="lazy"
                        />
                        {/* Middle Ad */}
                        {index === middleIndex && (
                            <div className="w-full py-4 bg-[#1a1a1a]">
                                <p className="text-center text-[10px] text-gray-500 mb-1">QUẢNG CÁO</p>
                                <AdDisplay position="reader_middle" />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
            
            {/* Removed Bottom Ad Block */}
        </div>

        {/* Bottom Bar (Navigation) */}
        <div className={`fixed bottom-0 left-0 right-0 bg-black/90 text-white z-50 border-t border-white/10 transition-transform duration-300 ${showHeader ? 'translate-y-0' : 'translate-y-full'}`}>
             <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex gap-2">
                    <button 
                        onClick={() => navigateChapter('prev')}
                        disabled={!hasPrev}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${!hasPrev ? 'text-slate-600 cursor-not-allowed' : 'text-slate-200 hover:bg-white/10 hover:text-white'}`}
                    >
                        <ChevronLeft size={20} />
                        <span className="hidden md:inline">Chap trước</span>
                    </button>
                </div>

                 <div className="text-sm font-medium text-slate-400">
                    {/* Page counter or simplified text */}
                    {pages.length > 0 ? `${pages.length} trang` : ''}
                 </div>

                <button 
                     onClick={() => navigateChapter('next')}
                     disabled={!hasNext}
                     className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${!hasNext ? 'text-slate-600 cursor-not-allowed' : 'text-slate-200 hover:bg-white/10 hover:text-white'}`}
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
