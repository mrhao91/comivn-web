
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getChapterPages, getComicById } from '../services/mockData';
import { DataProvider } from '../services/dataProvider';
import { Page, Comic, Chapter } from '../types';
import { ChevronLeft, ChevronRight, Flag, AlertCircle } from 'lucide-react';
import AdDisplay from '../components/AdDisplay';
import SEOHead from '../components/SEOHead';
import Header from '../components/Header'; // Import Global Header

const Reader: React.FC = () => {
  // Support both new SEO URL (/doc/:slug/:chapterSlug e.g. chap-1) and Legacy URL (/doc/:chapterId)
  const { chapterId, slug, chapterSlug } = useParams<{ chapterId?: string; slug?: string; chapterSlug?: string }>();
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [comic, setComic] = useState<Comic | undefined>(undefined);
  const [currentChapter, setCurrentChapter] = useState<Chapter | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
        if (!chapterId && (!slug || !chapterSlug)) {
            setError("Không tìm thấy chương truyện này.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let comicSlugOrId = '';
            let targetChapterNumber = -1;
            let targetChapterId = '';

            if (slug && chapterSlug) {
                // New SEO Friendly URL: /doc/:slug/chap-1
                // We need to parse "chap-1" to get the number 1
                const match = chapterSlug.match(/^chap-(\d+(\.\d+)?)$/);
                if (match) {
                    comicSlugOrId = slug;
                    targetChapterNumber = parseFloat(match[1]);
                } else {
                    setError("Đường dẫn chương không hợp lệ.");
                    setLoading(false);
                    return;
                }
            } else if (chapterId) {
                // Legacy URL handling
                const slugMatch = chapterId.match(/(.*)-chap-(\d+(\.\d+)?)$/);

                if (slugMatch) {
                    comicSlugOrId = slugMatch[1];
                    targetChapterNumber = parseFloat(slugMatch[2]);
                } else {
                    comicSlugOrId = chapterId.includes('-chapter') ? chapterId.split('-chapter')[0] : chapterId.split('-')[0];
                    targetChapterId = chapterId;
                }
            }

            // 2. Lấy thông tin truyện dựa trên Slug hoặc ID
            const comicData = await getComicById(comicSlugOrId);
            
            if (comicData) {
                setComic(comicData);
                
                // 3. Tìm Chapter Object
                let foundChapter: Chapter | undefined;

                if (targetChapterNumber !== -1) {
                    // Tìm theo số chapter (cho URL SEO)
                    foundChapter = comicData.chapters.find(c => c.number === targetChapterNumber);
                } else {
                    // Tìm theo ID (cho URL Cũ)
                    foundChapter = comicData.chapters.find(c => c.id === targetChapterId);
                }
                
                if (foundChapter) {
                    setCurrentChapter(foundChapter);
                    // 4. Lấy danh sách ảnh của chapter đó
                    const pageData = await getChapterPages(foundChapter.id);
                    setPages(pageData);
                } else {
                    // Fallback: Nếu không tìm thấy chapter trong list comic
                    if (targetChapterNumber === -1 && targetChapterId) {
                         const pageData = await getChapterPages(targetChapterId);
                         if (pageData && pageData.length > 0) {
                             setPages(pageData);
                             setCurrentChapter({ 
                                 id: targetChapterId, 
                                 comicId: comicData.id, 
                                 number: 0, 
                                 title: 'Chương hiện tại', 
                                 updatedAt: new Date().toISOString() 
                             });
                         } else {
                             setError("Chương này không tồn tại.");
                         }
                    } else {
                        setError(`Không tìm thấy Chapter ${targetChapterNumber} của truyện này.`);
                    }
                }
            } else {
                 setError("Không tìm thấy thông tin truyện.");
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
  }, [chapterId, slug, chapterSlug]);

  // Helper chuyển đổi sang URL SEO Mới
  const getChapterUrl = (c: Chapter, comicData?: Comic) => {
      const targetComic = comicData || comic;
      if (!targetComic) return `/doc/${c.id}`;
      const s = targetComic.slug || targetComic.id;
      return `/doc/${s}/chap-${c.number}`;
  };

  const handleChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedChapId = e.target.value;
      const selectedChap = comic?.chapters.find(c => c.id === selectedChapId);
      if (selectedChap) {
          navigate(getChapterUrl(selectedChap));
      }
  };

  const navigateChapter = (direction: 'next' | 'prev') => {
      if (!comic || !currentChapter) return;
      const currentIndex = comic.chapters.findIndex(c => c.id === currentChapter.id);
      if (currentIndex === -1) return;

      // Danh sách chapter thường sort giảm dần (Mới nhất -> Cũ nhất)
      // Next (Chap sau) = Số lớn hơn = Index NHỎ hơn (nếu sort DESC)
      let newIndex = direction === 'next' ? currentIndex - 1 : currentIndex + 1; 
      
      if (newIndex >= 0 && newIndex < comic.chapters.length) {
          navigate(getChapterUrl(comic.chapters[newIndex]));
      }
  };

  const handleReportError = async () => {
      if (!comic || !currentChapter) return;
      const reason = window.prompt("Mô tả lỗi (ảnh die, sai chương...):");
      if (reason) {
          const success = await DataProvider.sendReport(comic.id, currentChapter.id, reason);
          if (success) {
              alert("Đã gửi báo lỗi thành công. Cảm ơn bạn!");
          } else {
              alert("Gửi báo lỗi thất bại. Vui lòng thử lại sau.");
          }
      }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-white">Đang tải trang...</div>;
  if (error) return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
          <AlertCircle size={48} className="text-red-500"/>
          <p className="text-xl">{error}</p>
          <Link to="/" className="text-primary hover:underline">Về trang chủ</Link>
      </div>
  );

  const currentIndex = comic?.chapters.findIndex(c => c.id === currentChapter?.id) ?? -1;
  const hasNext = currentIndex > 0; // Có index nhỏ hơn (chap số to hơn)
  const hasPrev = currentIndex < (comic?.chapters.length || 0) - 1; // Có index lớn hơn (chap số nhỏ hơn)

  const pageTitle = comic && currentChapter 
    ? `${comic.title} - ${currentChapter.title}` 
    : 'Đọc truyện';

  return (
    <div className="bg-[#1a1a1a] min-h-screen text-slate-300 font-sans flex flex-col">
        <SEOHead 
            title={pageTitle}
            description={`Đọc truyện ${comic?.title} ${currentChapter?.title} tiếng Việt chất lượng cao.`}
            url={window.location.href}
        />

        {/* Global Header (Replacing the old custom header) */}
        <Header />

        {/* Breadcrumbs & Title */}
        <div className="container mx-auto px-4 py-4">
             <div className="text-xs md:text-sm text-slate-500 mb-2 flex flex-wrap items-center gap-1">
                 <Link to="/" className="hover:text-white">Trang chủ</Link> 
                 <span>/</span>
                 <Link to={`/truyen/${comic?.slug || comic?.id}`} className="hover:text-white">{comic?.title}</Link>
                 <span>/</span>
                 <span className="text-slate-300">{currentChapter?.title}</span>
             </div>
             <h1 className="text-xl md:text-2xl font-bold text-white mb-1">
                 {comic?.title} - <span className="text-primary">{currentChapter?.title}</span>
             </h1>
             <p className="text-xs text-slate-500 italic">Cập nhật: {currentChapter?.updatedAt ? new Date(currentChapter.updatedAt).toLocaleDateString() : 'N/A'}</p>
        </div>

        {/* Top Navigation Bar */}
        <div className="bg-[#222] py-3 sticky top-16 md:top-16 z-30 shadow-md border-y border-white/5">
            <div className="container mx-auto px-4 flex justify-center gap-2">
                 <button 
                    onClick={() => navigateChapter('prev')}
                    disabled={!hasPrev}
                    className={`px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-1 ${!hasPrev ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <ChevronLeft size={16}/> Trước
                </button>

                <select 
                    value={currentChapter?.id} 
                    onChange={handleChapterChange}
                    className="bg-[#333] text-white border border-white/10 rounded px-2 py-1.5 outline-none focus:border-primary text-sm max-w-[150px] md:max-w-[300px]"
                >
                    {comic?.chapters.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                </select>

                <button 
                         onClick={() => navigateChapter('next')}
                         disabled={!hasNext}
                         className={`px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-1 ${!hasNext ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Sau <ChevronRight size={16}/>
                </button>
            </div>
        </div>
        
        <div className="container mx-auto px-4 text-center py-2">
            <button onClick={handleReportError} className="text-xs text-slate-500 hover:text-red-400 flex items-center justify-center gap-1 w-full">
                <Flag size={12}/> Báo lỗi chương này
            </button>
        </div>

        {/* Ads Top */}
        <div className="container mx-auto px-4">
             <AdDisplay position="reader_top" />
        </div>

        {/* Content - Images */}
        <div className="flex flex-col items-center min-h-[500px] bg-[#111] my-4 max-w-5xl mx-auto shadow-2xl">
             {pages.map((page, idx) => (
                <React.Fragment key={idx}>
                     <img 
                        src={page.imageUrl} 
                        alt={`Trang ${page.pageNumber}`} 
                        className="w-full h-auto max-w-full block"
                        loading="lazy"
                    />
                    {idx === Math.floor(pages.length / 2) && (
                        <div className="w-full bg-[#111] py-4">
                            <AdDisplay position="reader_middle" />
                        </div>
                    )}
                </React.Fragment>
            ))}
        </div>

        {/* Ads Bottom */}
        <div className="container mx-auto px-4">
             <AdDisplay position="reader_bottom" />
        </div>

        {/* Bottom Navigation Bar */}
        <div className="bg-[#222] py-6 border-t border-white/5 mt-6">
             <div className="container mx-auto px-4 flex flex-col items-center gap-4">
                 <div className="text-white font-bold text-lg">Bạn đang đọc {comic?.title} - {currentChapter?.title}</div>
                 
                 <div className="flex justify-center gap-2 w-full">
                     <button 
                        onClick={() => navigateChapter('prev')}
                        disabled={!hasPrev}
                        className={`px-6 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1 ${!hasPrev ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <ChevronLeft size={18}/> Chap Trước
                    </button>
                    
                    <button 
                         onClick={() => navigateChapter('next')}
                         disabled={!hasNext}
                         className={`px-6 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1 ${!hasNext ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Chap Sau <ChevronRight size={18}/>
                    </button>
                 </div>

                 <div className="flex gap-4 text-sm text-slate-500 mt-2">
                     <Link to="/" className="hover:text-primary">Trang chủ</Link>
                     <span>•</span>
                     <Link to={`/truyen/${comic?.slug || comic?.id}`} className="hover:text-primary">Thông tin truyện</Link>
                 </div>
             </div>
        </div>

        {/* Floating PC Ads */}
        <AdDisplay position="reader_float_left" />
        <AdDisplay position="reader_float_right" />
    </div>
  );
};

export default Reader;