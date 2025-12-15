
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DataProvider } from '../services/dataProvider';
import { getComicById, getComics } from '../services/mockData';
import { Comic, Comment } from '../types';
import SEOHead from '../components/SEOHead';
import AdDisplay from '../components/AdDisplay';
import { Eye, BookOpen, Clock, List, Star, Send, User, MessageSquare, ChevronLeft, ChevronRight, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { AuthService } from '../services/auth';

const ComicDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [comic, setComic] = useState<Comic | null>(null);
  const [relatedComics, setRelatedComics] = useState<Comic[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State cho phân trang "Truyện cùng thể loại"
  const [recPage, setRecPage] = useState(0);
  const REC_ITEMS_PER_PAGE = 9; 

  // State cho bình luận
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const user = AuthService.getUser();

  // State cho xem thêm/thu gọn mô tả
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // GIỚI HẠN KÝ TỰ MÔ TẢ
  const DESC_LIMIT = 300; 

  useEffect(() => {
    const fetchComic = async () => {
        if(id) {
            setLoading(true);
            try {
                // 1. Tăng View
                await DataProvider.incrementView(id);

                // 2. Lấy dữ liệu
                const [currentComic, allComics, allComments] = await Promise.all([
                    getComicById(id),
                    getComics(),
                    DataProvider.getComments()
                ]);
                
                if (currentComic) {
                    setComic(currentComic);
                    // Lọc truyện cùng thể loại (trừ truyện hiện tại)
                    const related = allComics.filter(c => 
                        c.id !== id && c.genres.some(g => currentComic.genres.includes(g))
                    );
                    setRelatedComics(related);
                }
                
                if (allComments) {
                    // Lọc bình luận của truyện này và sắp xếp mới nhất
                    const comicComments = allComments
                        .filter(c => c.comicId === id)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    setComments(comicComments);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
                setRecPage(0); // Reset trang slide khi đổi truyện
                setIsDescExpanded(false); // Reset trạng thái xem thêm
                window.scrollTo(0, 0);
            }
        }
    };
    fetchComic();
  }, [id]);

  const handlePostComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newComment.trim() || !id) return;
      if (!user) {
          alert("Vui lòng đăng nhập để bình luận (tính năng đang phát triển, hiện tại Admin mới có user)");
          return;
      }

      setSubmittingComment(true);
      const comment: Comment = {
          id: `cmt-${Date.now()}`,
          comicId: id,
          userName: user.username || 'Thành viên',
          content: newComment,
          date: new Date().toISOString(),
          isApproved: true,
          rating: 5
      };

      await DataProvider.saveComment(comment);
      setComments([comment, ...comments]);
      setNewComment('');
      setSubmittingComment(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary">Đang tải dữ liệu...</div>;
  if (!comic) return <div className="min-h-screen flex items-center justify-center text-white">Không tìm thấy truyện</div>;

  // Tính toán phân trang cho Related Comics
  const totalRecPages = Math.ceil(relatedComics.length / REC_ITEMS_PER_PAGE);
  const currentRecs = relatedComics.slice(recPage * REC_ITEMS_PER_PAGE, (recPage + 1) * REC_ITEMS_PER_PAGE);

  // Helper tạo link chapter SEO friendly
  const getChapterLink = (chapterNum: number) => {
      return `/doc/${comic.slug || comic.id}-chap-${chapterNum}`;
  };

  // Logic hiển thị mô tả
  const renderDescription = () => {
      const description = comic.description || "Đang cập nhật...";
      const shouldTruncate = description.length > DESC_LIMIT;

      // Class xử lý text alignment trên mobile/desktop
      const textClass = "prose prose-invert max-w-none text-slate-300 leading-relaxed text-sm md:text-base";

      if (!shouldTruncate || isDescExpanded) {
          return (
              <div className={`${textClass} animate-in fade-in duration-300`}>
                  {description.split('\n').map((line, i) => (
                      <p key={i} className="mb-1 last:mb-0">{line}</p>
                  ))}
              </div>
          );
      }

      // Truncate logic
      let truncatedText = description.slice(0, DESC_LIMIT);
      const lastSpace = truncatedText.lastIndexOf(' ');
      if (lastSpace > 0) truncatedText = truncatedText.slice(0, lastSpace);

      return (
          <div className={`${textClass} relative`}>
              <p>{truncatedText}...</p>
              {/* Fade effect match with header background */}
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-darker/50 to-transparent pointer-events-none"></div>
          </div>
      );
  };

  return (
    <div className="pb-10 bg-darker min-h-screen">
        <SEOHead 
            title={`${comic.title} - ComiVN`}
            description={comic.description}
            image={comic.coverImage}
            url={window.location.href}
        />
        
        {/* Background Blur Effect */}
        <div className="relative h-[450px] md:h-[500px] overflow-hidden">
            <img src={comic.coverImage} className="w-full h-full object-cover blur-xl opacity-20" alt="bg" />
            <div className="absolute inset-0 bg-gradient-to-t from-darker via-darker/90 to-transparent"></div>
        </div>

        <div className="container mx-auto px-4 -mt-[380px] md:-mt-[420px] relative z-10">
            {/* Top Section: Info */}
            <div className="flex flex-col md:flex-row gap-8 mb-8">
                <div className="flex-shrink-0 mx-auto md:mx-0 group perspective">
                    <div className="relative w-56 md:w-72 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border-4 border-card transform transition-transform duration-500 group-hover:scale-105 group-hover:rotate-1">
                        <img 
                            src={comic.coverImage} 
                            alt={comic.title} 
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 bg-primary/90 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            {comic.status}
                        </div>
                    </div>
                </div>
                
                <div className="flex-grow pt-4 text-center md:text-left text-white">
                    <h1 className="text-3xl md:text-5xl font-extrabold mb-3 leading-tight tracking-tight">{comic.title}</h1>
                    
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-6 text-sm">
                        {comic.genres.map(g => (
                            <Link key={g} to={`/categories?genre=${g}`} className="px-3 py-1 bg-white/5 hover:bg-primary/20 text-slate-300 hover:text-primary rounded-full border border-white/10 transition-colors">
                                {g}
                            </Link>
                        ))}
                    </div>
                    
                    <div className="flex flex-wrap justify-center md:justify-start gap-6 text-sm text-slate-300 mb-6 p-4 bg-white/5 rounded-xl border border-white/5 inline-flex">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><Eye size={18}/></div>
                            <div className="flex flex-col text-left">
                                <span className="text-xs text-slate-500">Lượt xem</span>
                                <span className="font-bold">{comic.views.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="w-px bg-white/10"></div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-yellow-500/10 text-yellow-400 rounded-lg"><Star size={18}/></div>
                            <div className="flex flex-col text-left">
                                <span className="text-xs text-slate-500">Đánh giá</span>
                                <span className="font-bold">{comic.rating || 5.0}</span>
                            </div>
                        </div>
                        <div className="w-px bg-white/10"></div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-green-500/10 text-green-400 rounded-lg"><User size={18}/></div>
                            <div className="flex flex-col text-left">
                                <span className="text-xs text-slate-500">Tác giả</span>
                                <span className="font-bold">{comic.author || 'Đang cập nhật'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center md:justify-start gap-4 mb-6">
                        {comic.chapters.length > 0 ? (
                            <>
                                <Link to={getChapterLink(comic.chapters[0].number)} className="bg-primary hover:bg-primary/90 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/25 hover:-translate-y-1 flex items-center gap-2">
                                    <BookOpen size={20}/> Đọc Từ Đầu
                                </Link>
                                <Link to={getChapterLink(comic.chapters[0].number)} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-xl font-bold transition-all border border-white/10 hover:-translate-y-1 flex items-center gap-2">
                                    <Clock size={20}/> Chap Mới Nhất
                                </Link>
                            </>
                        ) : (
                            <button disabled className="bg-slate-700 text-slate-400 px-8 py-3.5 rounded-xl font-bold cursor-not-allowed">
                                Chưa có chương
                            </button>
                        )}
                    </div>

                    {/* DESCRIPTION MOVED HERE */}
                    <div className="bg-white/5 rounded-xl border border-white/5 p-4 text-left">
                         <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <BookOpen size={18} className="text-primary"/> Nội dung
                        </h3>
                        {renderDescription()}
                        {(comic.description && comic.description.length > DESC_LIMIT) && (
                            <div className="mt-2">
                                <button 
                                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                                    className="text-primary hover:text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                                >
                                    {isDescExpanded ? <>Thu gọn <ChevronUp size={12}/></> : <>Xem thêm <ChevronDown size={12}/></>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Chapters & Comments */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Chapter List */}
                    <section className="bg-card rounded-2xl border border-white/10 p-6 shadow-xl">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-between border-b border-white/5 pb-3">
                            <span className="flex items-center gap-2"><List className="text-primary"/> Danh sách chương</span>
                            <span className="text-sm font-normal text-slate-500">{comic.chapters.length} chương</span>
                        </h2>
                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                            <div className="grid grid-cols-1 gap-2">
                                {comic.chapters.map((chapter, idx) => (
                                    <Link 
                                        key={chapter.id} 
                                        to={getChapterLink(chapter.number)}
                                        className={`flex items-center justify-between p-3 rounded-lg transition-all border border-transparent ${idx === 0 ? 'bg-primary/10 border-primary/20' : 'hover:bg-white/5 hover:border-white/10 bg-dark/50'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`text-sm font-medium ${idx === 0 ? 'text-primary' : 'text-slate-300'}`}>
                                                {chapter.title}
                                            </span>
                                            {idx === 0 && <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded font-bold uppercase">New</span>}
                                        </div>
                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                            <Calendar size={12}/>
                                            {chapter.updatedAt ? new Date(chapter.updatedAt).toLocaleDateString('vi-VN') : ''}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                            {comic.chapters.length === 0 && (
                                <div className="p-8 text-center text-slate-500 italic">Hiện chưa có chương nào được đăng tải.</div>
                            )}
                        </div>
                    </section>

                    {/* Comment Section */}
                    <section className="bg-card rounded-2xl border border-white/10 p-6 shadow-xl">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2 border-b border-white/5 pb-3">
                            <MessageSquare className="text-primary"/> Bình luận <span className="text-slate-500 text-base font-normal">({comments.length})</span>
                        </h2>
                        
                        {/* Input Form */}
                        <form onSubmit={handlePostComment} className="mb-8 relative">
                            <textarea 
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Viết bình luận của bạn..."
                                className="w-full bg-dark/50 border border-white/10 rounded-xl p-4 text-slate-200 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all resize-none min-h-[100px]"
                            ></textarea>
                            <div className="absolute bottom-3 right-3">
                                <button 
                                    type="submit" 
                                    disabled={submittingComment || !newComment.trim()}
                                    className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                                >
                                    {submittingComment ? 'Đang gửi...' : <><Send size={14}/> Gửi</>}
                                </button>
                            </div>
                        </form>

                        {/* Comment List */}
                        <div className="space-y-4">
                            {comments.map(cmt => (
                                <div key={cmt.id} className="flex gap-4 p-4 bg-dark/30 rounded-xl border border-white/5">
                                    <div className="flex-shrink-0">
                                        <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center text-white font-bold">
                                            {cmt.userName.charAt(0).toUpperCase()}
                                        </div>
                                    </div>
                                    <div className="flex-grow">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`font-bold text-sm ${cmt.userName === 'Admin' ? 'text-red-400' : 'text-slate-300'}`}>
                                                {cmt.userName}
                                                {cmt.userName === 'Admin' && <span className="ml-2 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded border border-red-500/20">QTV</span>}
                                            </span>
                                            <span className="text-xs text-slate-500">{new Date(cmt.date).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                        <p className="text-sm text-slate-400 leading-relaxed">{cmt.content}</p>
                                    </div>
                                </div>
                            ))}
                            {comments.length === 0 && (
                                <div className="text-center py-6 text-slate-500 text-sm">Chưa có bình luận nào. Hãy là người đầu tiên!</div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Right Column: Sidebar */}
                <div className="space-y-8">
                    <AdDisplay position="detail_sidebar" />
                    
                    {/* Related Comics (Paginated Grid like screenshot) */}
                    <section className="bg-card rounded-2xl border border-white/10 p-5 shadow-xl sticky top-24">
                         <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                            <h2 className="font-bold text-white flex items-center gap-2">
                                Truyện cùng thể loại
                            </h2>
                            {totalRecPages > 1 && (
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => setRecPage(p => (p - 1 + totalRecPages) % totalRecPages)}
                                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                                    >
                                        <ChevronLeft size={16}/>
                                    </button>
                                    <button 
                                        onClick={() => setRecPage(p => (p + 1) % totalRecPages)}
                                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                                    >
                                        <ChevronRight size={16}/>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-3 min-h-[200px]">
                            {currentRecs.map(rec => (
                                <Link to={`/truyen/${rec.slug || rec.id}`} key={rec.id} className="group flex flex-col gap-1">
                                    <div className="aspect-[2/3] rounded-lg overflow-hidden relative border border-white/5 bg-dark">
                                        <img 
                                            src={rec.coverImage} 
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            alt={rec.title}
                                            loading="lazy"
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-4">
                                            <div className="flex items-center justify-center gap-1 text-[10px] text-white font-medium">
                                                <Eye size={10} /> {Math.floor(rec.views/1000)}K
                                            </div>
                                        </div>
                                    </div>
                                    <h4 className="font-medium text-[11px] md:text-xs text-slate-400 line-clamp-2 leading-tight group-hover:text-primary transition-colors text-center mt-1">
                                        {rec.title}
                                    </h4>
                                </Link>
                            ))}
                        </div>

                        {totalRecPages > 1 && (
                            <div className="flex justify-center gap-1 mt-4">
                                {Array.from({length: totalRecPages}).map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setRecPage(idx)}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === recPage ? 'w-4 bg-primary' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ComicDetail;
