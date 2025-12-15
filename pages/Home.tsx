
import React, { useEffect, useState } from 'react';
import { getComics } from '../services/mockData';
import { DataProvider } from '../services/dataProvider';
import { Comic, Genre, ThemeConfig } from '../types';
import ComicCard from '../components/ComicCard';
import { ChevronRight, Flame, Clock, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdDisplay from '../components/AdDisplay';
import SEOHead from '../components/SEOHead';

const Home: React.FC = () => {
  const [comics, setComics] = useState<Comic[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [theme, setTheme] = useState<ThemeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const [comicsData, genresData, themeData] = await Promise.all([
          getComics(),
          DataProvider.getGenres(),
          DataProvider.getTheme()
      ]);
      setComics(comicsData);
      setGenres(genresData);
      setTheme(themeData);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Slider Auto-play
  useEffect(() => {
      const interval = setInterval(() => {
          setCurrentSlide((prev) => (prev === 9 ? 0 : prev + 1)); // Loop top 10
      }, 5000);
      return () => clearInterval(interval);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev === 9 ? 0 : prev + 1));
  const prevSlide = () => setCurrentSlide((prev) => (prev === 0 ? 9 : prev - 1));

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-primary">Đang tải...</div>;
  }

  const sliderComics = comics.slice(0, 10);
  const latestComics = comics; 
  const homeGenres = genres.filter(g => g.isShowHome);

  return (
    <div className="pb-10">
        {/* SEO */}
        <SEOHead 
            title={theme?.homeMetaTitle || 'ComiVN - Trang Chủ'} 
            description={theme?.homeMetaDescription}
            keywords={theme?.homeMetaKeywords}
            url={window.location.href}
        />

        {/* Hero Slider */}
        <div className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden mb-10 group">
            {sliderComics.map((comic, index) => {
                const hasChapters = comic.chapters && comic.chapters.length > 0;
                // Update to SEO Friendly URL: slug-chap-number
                const readLink = hasChapters 
                    ? `/doc/${comic.slug || comic.id}-chap-${comic.chapters[0].number}` 
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
                                <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight drop-shadow-lg">
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

        <div className="container mx-auto px-4 space-y-12">
            <AdDisplay position="home_header" />

            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-white">
                        <Flame className="text-orange-500" />
                        Truyện Hot
                    </h2>
                    <a href="#" className="text-sm text-slate-400 hover:text-primary flex items-center gap-1">
                        Xem tất cả <ChevronRight size={16} />
                    </a>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                    {comics.slice(0, 6).map(comic => (
                        <ComicCard key={`hot-${comic.id}`} comic={comic} />
                    ))}
                </div>
            </div>

            <AdDisplay position="home_middle" />

            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-white">
                        <Clock className="text-blue-500" />
                        Mới Cập Nhật
                    </h2>
                    <a href="#" className="text-sm text-slate-400 hover:text-primary flex items-center gap-1">
                        Xem tất cả <ChevronRight size={16} />
                    </a>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                    {latestComics.slice(0, 12).map(comic => (
                        <ComicCard key={comic.id} comic={comic} />
                    ))}
                </div>
            </div>

             {homeGenres.map(genre => {
                 const genreComics = comics.filter(c => c.genres.includes(genre.name)).slice(0, 6);
                 if (genreComics.length === 0) return null;

                 return (
                    <div key={genre.id}>
                        <div className="flex items-center justify-between mb-6 border-l-4 border-primary pl-4">
                            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-white">
                                {genre.name}
                            </h2>
                            <Link to={`/categories?genre=${genre.name}`} className="text-sm text-slate-400 hover:text-primary flex items-center gap-1">
                                Xem thêm <ChevronRight size={16} />
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8">
                            {genreComics.map(comic => (
                                <ComicCard key={`${genre.id}-${comic.id}`} comic={comic} />
                            ))}
                        </div>
                    </div>
                 );
             })}

             <AdDisplay position="home_bottom" />
        </div>
    </div>
  );
};

export default Home;