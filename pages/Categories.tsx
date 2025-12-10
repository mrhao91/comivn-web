import React, { useEffect, useState } from 'react';
import { DataProvider } from '../services/dataProvider';
import { Comic, Genre } from '../types';
import ComicCard from '../components/ComicCard';
import { Tags, Filter } from 'lucide-react';

const Categories: React.FC = () => {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [comics, setComics] = useState<Comic[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        const [gData, cData] = await Promise.all([
            DataProvider.getGenres(),
            DataProvider.getComics()
        ]);
        setGenres(gData);
        setComics(cData);
        
        // Select first genre by default if available
        if (gData.length > 0 && !selectedGenre) {
            setSelectedGenre(gData[0].name);
        }
        setLoading(false);
    };
    fetchData();
  }, []);

  const filteredComics = selectedGenre 
    ? comics.filter(c => c.genres.includes(selectedGenre)) 
    : comics;

  return (
    <div className="min-h-screen pb-12">
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
            {/* Sidebar / Filter (Horizontal on mobile, vertical on desktop) */}
            <div className="w-full md:w-64 flex-shrink-0">
                <div className="bg-card rounded-xl border border-white/10 p-4 sticky top-24">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <Filter size={18} /> Lọc thể loại
                    </h3>
                    <div className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 custom-scrollbar">
                        <button 
                            onClick={() => setSelectedGenre(null)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium text-left whitespace-nowrap transition-colors ${!selectedGenre ? 'bg-primary text-white' : 'hover:bg-white/10 text-slate-300'}`}
                        >
                            Tất cả
                        </button>
                        {genres.map(g => (
                            <button 
                                key={g.id}
                                onClick={() => setSelectedGenre(g.name)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium text-left whitespace-nowrap transition-colors ${selectedGenre === g.name ? 'bg-primary text-white' : 'hover:bg-white/10 text-slate-300'}`}
                            >
                                {g.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-grow">
                 <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">
                        {selectedGenre ? `Truyện ${selectedGenre}` : 'Tất cả truyện'}
                    </h2>
                    <span className="text-sm text-slate-500">{filteredComics.length} kết quả</span>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-primary">Đang tải...</div>
                ) : filteredComics.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                        {filteredComics.map(comic => (
                            <ComicCard key={comic.id} comic={comic} />
                        ))}
                    </div>
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
