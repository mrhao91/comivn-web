import React, { useEffect, useState } from 'react';
import { getComics } from '../services/mockData';
import { DataProvider } from '../services/dataProvider';
import { Comic, Genre, ThemeConfig } from '../types';
import ComicCard from '../components/ComicCard';
import { ChevronRight, Flame, Clock, ChevronLeft, List, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdDisplay from '../components/AdDisplay';
import SEOHead from '../components/SEOHead';
import { DEFAULT_THEME } from '../services/seedData';

const Home: React.FC = () => {
  const [comics, setComics] = useState<Comic[]>([]);
  const [theme, setTheme] = useState<ThemeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const [comicsData, themeData] = await Promise.all([
          DataProvider.getComics(),
          DataProvider.getTheme()
      ]);
      setComics(comicsData);
      setTheme(themeData && Object.keys(themeData).length > 0 ? { ...DEFAULT_THEME, ...themeData } : DEFAULT_THEME);
      setLoading(false);
    };
    fetchData();
  }, []);

  const hotComics = [...comics].sort((a, b) => b.views - a.views);
  const sliderComics = hotComics.slice(0, 10);

  useEffect(() => {
    if (sliderComics.length === 0) return;
    const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev >= sliderComics.length - 1 ? 0 : prev + 1));
    }, 3000);
    return () => clearInterval(interval);
  }, [sliderComics.length]);

  const nextSlide = () => {
    if (sliderComics.length === 0) return;
    setCurrentSlide((prev) => (prev >= sliderComics.length - 1 ? 0 : prev + 1));
  };
  const prevSlide = () => {
    if (sliderComics.length === 0) return;
    setCurrentSlide((prev) => (prev === 0 ? sliderComics.length - 1 : prev - 1));
  };

  if (loading || !theme) {
    return <div className="min-h-screen flex items-center justify-center text-primary">Đang tải...</div>;
  }

  const latestComics = comics; // API đã trả về sắp xếp theo ngày cập nhật mới nhất
  
  const homeGenres = theme?.homeLayout?.homeGenres || [];
  
  const showSlider = theme?.homeLayout?.showSlider ?? true;
  const showHot = theme?.homeLayout?.showHot ?? true;
  const showNew = theme?.homeLayout?.showNew ?? true;
  const currentLayout = theme?.siteLayout || 'classic';

  const hotCount = theme?.homeLayout?.hotComicsCount || 6;
  const newCount = theme?.homeLayout?.newComicsCount || (currentLayout === 'minimalist' ? 9 : 12);
  const genreCount = theme?.homeLayout?.genreComicsCount || 6;

  const renderComicsGrid = (title: string, icon: React.ReactNode, comicsList: Comic[], viewAllLink: string) => {
    if (comicsList.length === 0) return null;

    return (
        <div>
            <div className="flex items-center justify-between mb-6 border-l-4 border-primary pl-4">
                <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-white">
                    {icon} {title}
                </h2>
                <Link to={viewAllLink} className="text-sm text-slate-400 hover:text-primary flex items-center gap-1">
                    Xem thêm <ChevronRight size={16} />
                </Link>
            </div>
            {currentLayout === 'minimalist' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {comicsList.map(comic => (
                        <Link to={`/truyen/${comic.slug || comic.id}`} key={comic.id} className="group bg-card/50 hover:bg-card border border-transparent hover:border-white/10 p-3 rounded-lg flex gap-4 transition-colors">
                            <div className="flex-shrink-0 w-20 h-[115px] rounded-md overflow-hidden">
                                <img src={comic.coverImage} alt={comic.title} className="w-full h-full object-cover"/>
                            </div>
                            <div className="flex-1 flex flex-col justify-between py-1">
                                <div>
                                    <h3 className="font-bold text-sm text-slate-200 line-clamp-2 leading-tight group-hover:text-primary transition-colors">{comic.title}</h3>
                                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">{comic.genres.join(', ')}</p>
                                </div>
                                <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                                    <span>{comic.chapters[0] ? `Chap ${comic.chapters[0].number}` : 'Mới'}</span>
                                    <span className="flex items-center gap-1"><Eye size={12}/> {Math.floor(comic.views/1000)}K</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className={`grid grid-cols-2 ${currentLayout === 'modern' ? 'md:grid-cols-5' : 'md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'} gap-x-4 gap-y-8`}>
                    {comicsList.map(comic => (
                        <ComicCard key={comic.id} comic={comic} />
                    ))}
                </div>
            )}
        </div>
    );
  }

  return (
    <div className="pb-10">
        <SEOHead 
            title={theme?.homeMetaTitle || 'ComiVN - Trang Chủ'} 
            description={theme?.homeMetaDescription}
            keywords={theme?.homeMetaKeywords}
            url={window.location.href}
        />

        {showSlider && currentLayout !== 'minimalist' && sliderComics.length > 0 && (
            <div className={`relative w-full overflow-hidden mb-10 group ${currentLayout === 'modern' ? 'h-[70vh] md:h-[80vh]' : 'h-[50vh] md:h-[60vh]'}`}>
                {sliderComics.map((comic, index) => {
                    const hasChapters = comic.chapters && comic.chapters.length > 0;
                    const readLink = hasChapters 
                        ? `/doc/${comic.slug || comic.id}/chap-${comic.chapters[0].number}` 
                        : `/truyen/${comic.slug || comic.id}`;
                    const readLabel = hasChapters ? "Đọc Ngay" : "Xem Ngay";

                    return (
                    <div 
                        key={comic.id}
                        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                    >
                        <div className="absolute inset-0">
                            <img src={comic.coverImage} className="w-full h-full object-cover opacity-40 blur-sm scale-105" alt="Background" />
                            <div className="absolute inset-0 bg-gradient-to-t from-darker via-darker/60 to-transparent"></div>
                            <div className="absolute inset-0 bg-gradient-to-r from-darker via-darker/40 to-transparent"></div>
                        </div>
                        
                        <div className="container mx-auto px-4 h-full flex items-end pb-16 relative z-10">
                            <div className="flex gap-6 md:gap-10 items-end animate-in slide-in-from-bottom-10 fade-in duration-700">
                                <img 
                                    src={comic.coverImage} 
                                    alt={comic.title}
                                    className="hidden md:block w-48 h-72 object-cover rounded-lg shadow-2xl border-2 border-white/10"
                                />
                                
                                <div className="max-w-2xl mb-2">
                                    <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full mb-4 inline-block shadow-lg shadow-primary/30">
                                        TOP {index + 1} NỔI BẬT
                                    </span>
                                    <h1 className="text-2xl md:text-[2rem] leading-tight font-extrabold text-white mb-4 drop-shadow-lg">
                                        <Link to={`/truyen/${comic.slug || comic.id}`} className="hover:text-primary transition-colors">
                                            {comic.title}
                                        </Link>
                                    </h1>
                                    <div className="flex flex-wrap gap-2 mb-4 text-xs md:text-sm text-slate-300">
                                         {comic.genres.map(g => <span key={g} className="px-2 py-1 bg-white/10 rounded">{g}</span>)}
                                    </div>
                                    <p className="text-slate-300 text-sm md:text-base line-clamp-2 md:line-clamp-3 mb-8 max-w-lg drop-shadow-md">
                                        {comic.description}
                                    </p>
                                    <div className="flex gap-3">
                                        <Link to={readLink} className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/25 hover:-translate-y-1">
                                            {readLabel}
                                        </Link>
                                        <Link to={`/truyen/${comic.slug || comic.id}`} className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl font-medium transition-all backdrop-blur-md border border-white/10">
                                            Chi tiết
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )})}

                <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-primary/80 text-white p-3 rounded-full backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all">
                    <ChevronLeft size={24} />
                </button>
                <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-primary/80 text-white p-3 rounded-full backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all">
                    <ChevronRight size={24} />
                </button>
                
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                    {sliderComics.map((_, idx) => (
                        <button 
                            key={idx}
                            onClick={() => setCurrentSlide(idx)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${currentSlide === idx ? 'w-8 bg-primary' : 'w-2 bg-white/30 hover:bg-white/60'}`}
                        />
                    ))}
                </div>
            </div>
        )}

        <div className={`container mx-auto px-4 space-y-12 ${!showSlider || currentLayout === 'minimalist' || sliderComics.length === 0 ? 'mt-10' : ''}`}>
            <AdDisplay position="home_header" />

            {showHot && renderComicsGrid("Truyện Hot", <Flame className="text-orange-500" />, hotComics.slice(0, hotCount), "#")}
            
            <AdDisplay position="home_middle" />
            
            {showNew && renderComicsGrid("Mới Cập Nhật", <Clock className="text-blue-500" />, latestComics.slice(0, newCount), "#")}

             {homeGenres.map(genre => renderComicsGrid(
                 genre.name, 
                 <List />,
                 comics.filter(c => c.genres.includes(genre.name)).slice(0, genreCount),
                 `/categories?genre=${genre.slug}`
             ))}

             <AdDisplay position="home_bottom" />
        </div>
    </div>
  );
};

export default Home;