
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getComicById, getComics } from '../services/mockData';
import { DataProvider } from '../services/dataProvider';
import { summarizeComic } from '../services/geminiService';
import { Comic, Comment } from '../types';
import { Star, Eye, List, BookOpen, Bot, User, Tag, ChevronLeft, ChevronRight, MessageSquare, Send } from 'lucide-react';
import AdDisplay from '../components/AdDisplay';

const ComicDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [comic, setComic] = useState<Comic | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  
  // Recommendations State
  const [recommendations, setRecommendations] = useState<Comic[]>([]);
  const [recPage, setRecPage] = useState(0);
  const [isHoveringRecs, setIsHoveringRecs] = useState(false); 

  // Comments State
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState({ userName: '', content: '', rating: 5 });
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    const fetchComic = async () => {
        if(id) {
            setLoading(true);
            const [currentComic, allComics, allComments] = await Promise.all([
                getComicById(id),
                getComics(),
                DataProvider.getComments()
            ]);
            setComic(currentComic);

            // Filter Recommendations:
            // 1. Must be marked isRecommended
            // 2. Not the current comic
            // 3. Limit to 18 total (enough for 3 pages of 6)
            const recs = allComics
                .filter(c => c.isRecommended && c.id !== id)
                .slice(0, 18);
            setRecommendations(recs);

            // Filter approved comments for this comic
            const comicComments = allComments.filter(c => c.comicId === id && c.isApproved).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setComments(comicComments);

            setLoading(false);
            window.scrollTo(0, 0); // Reset scroll
        }
    };
    fetchComic();
  }, [id]);

  const handleAiSummarize = async () => {
      if (!comic) return;
      setLoadingAi(true);
      const summary = await summarizeComic(comic.title, comic.description);
      setAiSummary(summary);
      setLoadingAi(false);
  };

  const handlePostComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!comic || !newComment.userName || !newComment.content) return;

      setSubmittingComment(true);
      const comment: Comment = {
          id: `cmt-${Date.now()}`,
          comicId: comic.id,
          userName: newComment.userName,
          content: newComment.content,
          rating: newComment.rating,
          date: new Date().toISOString(),
          isApproved: false // Requires admin approval
      };

      await DataProvider.saveComment(comment);
      alert('Bình luận của bạn đã được gửi và đang chờ duyệt!');
      setNewComment({ userName: '', content: '', rating: 5 });
      setSubmittingComment(false);
  };

  // Pagination Logic for "You Might Like"
  const itemsPerPage = 6; // 3 cols x 2 rows
  const totalPages = Math.ceil(recommendations.length / itemsPerPage);
  
  const nextRecPage = () => setRecPage(prev => (prev + 1) % totalPages);
  const prevRecPage = () => setRecPage(prev => (prev - 1 + totalPages) % totalPages);

  // Auto-play Slider Effect
  useEffect(() => {
      if (totalPages <= 1 || isHoveringRecs) return;

      const interval = setInterval(() => {
          setRecPage(prev => (prev + 1) % totalPages); // Always loop forward
      }, 4000); 

      return () => clearInterval(interval);
  }, [totalPages, isHoveringRecs]); // Removed recPage dependency to avoid reset race conditions

  const currentRecs = recommendations.slice(
      recPage * itemsPerPage, 
      (recPage + 1) * itemsPerPage
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary">Đang tải...</div>;
  if (!comic) return <div className="min-h-screen flex items-center justify-center text-red-500">Không tìm thấy truyện</div>;

  return (
    <div className="min-h-screen pb-12">
        {/* Background Blur */}
        <div className="h-64 md:h-80 w-full overflow-hidden relative">
            <img src={comic.coverImage} className="w-full h-full object-cover blur-xl opacity-30" alt="Background" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-darker"></div>
        </div>

        <div className="container mx-auto px-4 -mt-32 md:-mt-40 relative z-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-8">
                {/* Cover Image */}
                <div className="flex-shrink-0 mx-auto md:mx-0 w-48 md:w-64 rounded-lg shadow-2xl overflow-hidden border-4 border-card">
                    <img src={comic.coverImage} className="w-full h-full object-cover" alt={comic.title} />
                </div>

                {/* Info */}
                <div className="flex-grow pt-4 md:pt-12 text-center md:text-left">
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{comic.title}</h1>
                    <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-sm text-slate-300 mb-4">
                        <span className="flex items-center gap-1"><User size={14}/> {comic.author}</span>
                        <span className="flex items-center gap-1"><Tag size={14}/> {comic.status}</span>
                        <span className="flex items-center gap-1 text-yellow-400"><Star size={14} fill="currentColor"/> {comic.rating}</span>
                        <span className="flex items-center gap-1"><Eye size={14}/> {Math.floor(comic.views).toLocaleString()}</span>
                    </div>

                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-6">
                        {comic.genres.map(genre => (
                            <span key={genre} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs text-slate-200 transition-colors cursor-pointer border border-white/5">
                                {genre}
                            </span>
                        ))}
                    </div>

                    <div className="flex justify-center md:justify-start gap-4 mb-8">
                        <Link to={`/read/${comic.chapters[0].id}`} className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary/20">
                            <BookOpen size={20} />
                            Đọc Từ Đầu
                        </Link>
                         <Link to={`/read/${comic.chapters[comic.chapters.length - 1].id}`} className="bg-card hover:bg-card/80 text-white border border-white/10 px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all">
                            Đọc Mới Nhất
                        </Link>
                    </div>
                </div>
            </div>

            {/* Description Section */}
            <div className="mt-10 mb-8">
                <div className="bg-card rounded-2xl p-6 border border-white/5 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <BookOpen size={20} className="text-secondary" />
                            Nội dung
                        </h3>
                        <button 
                            onClick={handleAiSummarize}
                            disabled={loadingAi}
                            className="text-xs flex items-center gap-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                            <Bot size={14} />
                            {loadingAi ? 'Đang tóm tắt...' : 'AI Tóm tắt'}
                        </button>
                    </div>
                    
                    {aiSummary && (
                            <div className="mb-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-200 text-sm animate-in fade-in zoom-in-95">
                            <div className="flex items-center gap-2 mb-2 font-bold text-purple-400">
                                <Bot size={16} /> Gemini đánh giá:
                            </div>
                            {aiSummary}
                            </div>
                    )}
                    
                    {/* Render HTML Description (Supported by CMS Editor) */}
                    <div className="text-slate-300 leading-relaxed text-sm md:text-base prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: comic.description }} />
                </div>
            </div>

            {/* Content Grid */}
            <div className="flex flex-col lg:flex-row gap-8 items-stretch">
                
                {/* Left Column: Chapters & Comments */}
                <div className="lg:w-2/3 flex flex-col gap-8">
                    {/* Chapter List */}
                    <div className="bg-card rounded-2xl p-6 border border-white/5 shadow-lg flex-shrink-0">
                         <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 flex-shrink-0">
                            <List size={20} className="text-primary" />
                            Danh sách chương
                        </h3>
                        <div className="grid gap-2">
                            {comic.chapters.map(chap => (
                                <Link 
                                    key={chap.id} 
                                    to={`/read/${chap.id}`}
                                    className="flex items-center justify-between p-3 rounded-lg bg-dark hover:bg-white/5 border border-white/5 transition-colors group"
                                >
                                    <span className="font-medium text-slate-300 group-hover:text-primary transition-colors">{chap.title}</span>
                                    <span className="text-xs text-slate-500">{new Date(chap.updatedAt).toLocaleDateString('vi-VN')}</span>
                                </Link>
                            ))}
                        </div>
                        {comic.chapters.length === 0 && <div className="text-slate-500 italic">Chưa có chương nào.</div>}
                    </div>

                    {/* Comments Section */}
                    <div className="bg-card rounded-2xl p-6 border border-white/5 shadow-lg h-full">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <MessageSquare size={20} className="text-green-500" />
                            Bình luận & Đánh giá
                        </h3>

                        {/* Comment Form */}
                        <form onSubmit={handlePostComment} className="mb-8 bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <input 
                                    type="text" 
                                    placeholder="Tên của bạn" 
                                    className="bg-dark border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary focus:outline-none"
                                    value={newComment.userName}
                                    onChange={e => setNewComment({...newComment, userName: e.target.value})}
                                    required
                                />
                                <div className="flex items-center gap-2 bg-dark border border-white/10 rounded-lg px-3">
                                    <span className="text-sm text-slate-400">Đánh giá:</span>
                                    {[1,2,3,4,5].map(star => (
                                        <button 
                                            key={star} 
                                            type="button" 
                                            onClick={() => setNewComment({...newComment, rating: star})}
                                            className={`p-1 ${newComment.rating >= star ? 'text-yellow-400' : 'text-slate-600'}`}
                                        >
                                            <Star size={16} fill="currentColor" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <textarea 
                                placeholder="Viết bình luận của bạn..." 
                                className="w-full bg-dark border border-white/10 rounded-lg p-3 text-white text-sm focus:border-primary focus:outline-none mb-4"
                                rows={3}
                                value={newComment.content}
                                onChange={e => setNewComment({...newComment, content: e.target.value})}
                                required
                            />
                            <div className="flex justify-end">
                                <button type="submit" disabled={submittingComment} className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                                    <Send size={14} /> Gửi Bình Luận
                                </button>
                            </div>
                        </form>

                        {/* Comment List */}
                        <div className="space-y-4">
                            {comments.length === 0 ? (
                                <p className="text-slate-500 text-center italic">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
                            ) : (
                                comments.map(comment => (
                                    <div key={comment.id} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="font-bold text-white text-sm mr-2">{comment.userName}</span>
                                                <span className="text-xs text-slate-500">{new Date(comment.date).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                            <div className="flex text-yellow-500">
                                                {Array.from({length: comment.rating}).map((_, i) => (
                                                    <Star key={i} size={12} fill="currentColor" />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-slate-300 text-sm">{comment.content}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Related & Ads - STICKY SIDEBAR */}
                <div className="lg:w-1/3 w-full space-y-6">
                     {/* Sticky wrapper */}
                    <div className="sticky top-24 space-y-6">
                        
                        {/* AD SIDEBAR */}
                        <AdDisplay position="detail_sidebar" />

                        {/* YOU MIGHT LIKE - SLIDER */}
                        {recommendations.length > 0 && (
                            <div 
                                className="bg-card rounded-2xl p-5 border border-white/5 shadow-lg"
                                onMouseEnter={() => setIsHoveringRecs(true)}
                                onMouseLeave={() => setIsHoveringRecs(false)}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-white text-lg">Có thể bạn thích</h3>
                                    {totalPages > 1 && (
                                        <div className="flex gap-2">
                                            <button onClick={prevRecPage} className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors">
                                                <ChevronLeft size={16}/>
                                            </button>
                                            <button onClick={nextRecPage} className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors">
                                                <ChevronRight size={16}/>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Grid 3 columns (Small thumbnails) */}
                                <div className="grid grid-cols-3 gap-3 min-h-[200px]">
                                    {currentRecs.map(rec => (
                                        <Link to={`/comic/${rec.id}`} key={rec.id} className="group flex flex-col gap-1">
                                            <div className="aspect-[2/3] rounded-lg overflow-hidden relative border border-white/5">
                                                <img src={rec.coverImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                                                {/* Views Overlay */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                                     <div className="flex items-center justify-center gap-1 text-[10px] text-white">
                                                         <Eye size={8}/> {Math.floor(rec.views/1000)}K
                                                     </div>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-[11px] md:text-xs text-slate-300 line-clamp-2 leading-tight group-hover:text-primary transition-colors text-center mt-1">{rec.title}</h4>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                                
                                {/* Dots Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex justify-center gap-1 mt-4">
                                        {Array.from({length: totalPages}).map((_, idx) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => setRecPage(idx)}
                                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === recPage ? 'w-4 bg-primary' : 'w-1.5 bg-white/20'}`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Ad in Detail Page */}
            <div className="mt-12">
                <AdDisplay position="detail_bottom" />
            </div>
        </div>
    </div>
  );
};

export default ComicDetail;
