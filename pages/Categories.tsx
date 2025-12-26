import React, { useEffect, useState } from 'react';
import { DataProvider } from '../services/dataProvider';
import { Comic, Genre, ThemeConfig } from '../types';
import ComicCard from '../components/ComicCard';
import { Tags, Filter, LayoutGrid, List } from 'lucide-react';
import SEOHead from '../components/SEOHead';
import { DEFAULT_THEME } from '../services/seedData';
import { Link } from 'react-router-dom';

const Categories: React.FC = () => {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [comics, setComics] = useState<Comic[]>([]);
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortOrder, setSortOrder] = useState<'latest' | 'title-asc' | 'title-desc'>('latest');

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        const [gData, cData, tData] = await Promise.all([
            DataProvider.getGenres(),
            DataProvider.getComics(),
            DataProvider.getTheme()
        ]);
        setGenres(gData);
        setComics(cData);
        if (tData) setTheme({ ...DEFAULT_THEME, ...tData });
        
        // Check query param for genre
        const params = new URLSearchParams(window.location.search);
        const genreParam = params.get('genre');
        if (genreParam) {
            setSelectedGenre(genreParam);
        } else if (gData.length > 0 && !selectedGenre) {
            // Default to first if needed, or null for All
            // setSelectedGenre(gData[0].name); 
        }
        setLoading(false);
    };
    fetchData();
  }, []);

  const filteredComics = selectedGenre 
    ? comics.filter(c => c.genres.includes(selectedGenre)) 
    : comics;

  let sortedAndFilteredComics = [...filteredComics];
  if (sortOrder === 'title-asc') {
    sortedAndFilteredComics.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortOrder === 'title-desc') {
    sortedAndFilteredComics.sort((a, b) => b.title.localeCompare(a.title));
  }

  const currentGenreObj = genres.find(g => g.name === selectedGenre);

  // SEO Logic
  let pageTitle, pageDesc, pageKeywords;
  
  if (selectedGenre && currentGenreObj) {
      pageTitle = currentGenreObj.metaTitle || `Truyện ${selectedGenre} - ${theme.siteName || 'ComiVN'}`;
      pageDesc = currentGenreObj.metaDescription || `Tổng hợp truyện tranh thể loại ${selectedGenre} hay nhất.`;
      pageKeywords = currentGenreObj.metaKeywords || `truyen ${selectedGenre}, truyen tranh`;
  } else {
      pageTitle = theme.categoriesMetaTitle || 'Danh Sách Thể Loại - ComiVN';
      pageDesc = theme.categoriesMetaDescription || 'Khám phá hàng ngàn đầu truyện hấp dẫn đa dạng thể loại.';
      pageKeywords = theme.categoriesMetaKeywords || 'the loai truyen, truyen tranh online';
  }

  return (
    <div className="min-h-screen pb-12">
        {/* SEO */}
        <SEOHead 
            title={pageTitle}
            description={pageDesc}
            keywords={pageKeywords}
            url={window.location.href}
        />

        {/* Header */}
        <div className="bg-gradient-to-b from-card to-darker py-10 border-b border-white/5">
            <div className="container mx-auto px-4">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
                    <Tags className="text-primary" />
                    Kho Truyện Theo Thể Loại
                </h1>
                <p className="text-slate-400">Khám phá hàng ngàn đầu truyện hấp dẫn đa dạng thể loại.</p>
            </div>
        </div>

        <div className="container mx-auto px-4 mt-8 flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-64 flex-shrink-0">
                <div className="bg-card rounded-xl border border-white/10 p-4 sticky top-24">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <Filter size={18} /> Lọc thể loại
                    </h3>
                    <div className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 custom-scrollbar">
                        <button 
                            onClick={() => setSelectedGenre(null)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium text-left whitespace-nowrap transition-colors ${!selectedGenre ? 'bg-primary text-dark font-bold' : 'hover:bg-white/10 text-slate-300'}`}
                        >
                            Tất cả
                        </button>
                        {genres.map(g => (
                            <button 
                                key={g.id}
                                onClick={() => setSelectedGenre(g.name)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium text-left whitespace-nowrap transition-colors ${selectedGenre === g.name ? 'bg-primary text-dark font-bold' : 'hover:bg-white/10 text-slate-300'}`}
                            >
                                {g.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-grow">
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-white">
                            {selectedGenre ? `Truyện ${selectedGenre}` : 'Tất cả truyện'}
                        </h2>
                        <span className="text-sm text-slate-500">{sortedAndFilteredComics.length} kết quả</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as any)}
                            className="bg-card border border-white/10 rounded-md px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-primary"
                        >
                            <option value="latest">Mới nhất</option>
                            <option value="title-asc">Tên A-Z</option>
                            <option value="title-desc">Tên Z-A</option>
                        </select>
                        <div className="flex items-center p-0.5 bg-card rounded-md border border-white/10">
                            <button
                                title="Xem dạng lưới"
                                aria-label="Xem dạng lưới"
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-primary text-dark' : 'text-slate-400 hover:text-white'}`}
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                title="Xem dạng danh sách"
                                aria-label="Xem dạng danh sách"
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-primary text-dark' : 'text-slate-400 hover:text-white'}`}
                            >
                                <List size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-primary">Đang tải...</div>
                ) : sortedAndFilteredComics.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
                            {sortedAndFilteredComics.map(comic => (
                                <ComicCard key={comic.id} comic={comic} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {sortedAndFilteredComics.map(comic => (
                                <Link to={`/truyen/${comic.slug || comic.id}`} key={comic.id} className="group bg-card/50 hover:bg-card border border-transparent hover:border-white/10 p-3 rounded-lg flex gap-4 transition-colors">
                                    <div className="flex-shrink-0 w-20 h-28 rounded-md overflow-hidden bg-dark">
                                        <img src={comic.coverImage} alt={comic.title} className="w-full h-full object-cover"/>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                                        <div>
                                            <h3 className="font-bold text-base text-slate-200 truncate group-hover:text-primary transition-colors">{comic.title}</h3>
                                            <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                                                {comic.chapters[0] ? `Chương ${comic.chapters[0].number}` : 'Chưa có chương'}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-2 line-clamp-2" dangerouslySetInnerHTML={{ __html: comic.description.replace(/<[^>]+>/g, '') }} />
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2 line-clamp-1">
                                            {comic.genres.join(', ')}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )
                ) : (
                    <div className="text-center py-20 bg-card rounded-xl border border-white/5 border-dashed">
                        <p className="text-slate-400 mb-2">Chưa có truyện nào thuộc thể loại này.</p>
                        <button onClick={() => setSelectedGenre(null)} className="text-primary hover:underline">
                            Xem tất cả truyện
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default Categories;