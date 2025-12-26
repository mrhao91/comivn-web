import React from 'react';
import { Link } from 'react-router-dom';
import { Comic } from '../types';
import { Eye, CheckCircle } from 'lucide-react';

interface ComicCardProps {
  comic: Comic;
}

const ComicCard: React.FC<ComicCardProps> = ({ comic }) => {
  return (
    <Link to={`/truyen/${comic.slug || comic.id}`} className="group relative flex flex-col">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-card mb-3 shadow-lg">
        {/* Badge Chapter */}
        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded z-10 font-bold border border-white/10">
          {comic.chapters[0]?.number ? `Chap ${comic.chapters[0].number}` : 'Mới'}
        </div>

        {/* Badge Completed (Full) */}
        {comic.status === 'Hoàn thành' && (
            <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] px-2 py-1 rounded z-10 font-bold shadow-lg flex items-center gap-1">
                <CheckCircle size={10} /> Full
            </div>
        )}
        
        {/* Image */}
        <img 
            src={comic.coverImage} 
            alt={comic.title} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            width="200"
            height="300"
        />
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
            <div className="flex items-center gap-2 text-xs text-white mb-1">
                <span className="flex items-center gap-1"><Eye size={12}/> {Math.floor(comic.views / 1000)}K</span>
            </div>
            <p className="text-xs text-slate-300 line-clamp-2">
                {comic.genres.join(', ')}
            </p>
        </div>
      </div>
      
      {/* Title */}
      <h3 className="font-semibold text-sm md:text-base text-slate-100 line-clamp-1 group-hover:text-primary transition-colors">
        {comic.title}
      </h3>
      <p className="text-xs text-slate-200 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] mt-1 flex justify-between items-center">
         <span>{comic.chapters[0]?.updatedAt ? new Date(comic.chapters[0].updatedAt).toLocaleDateString('vi-VN') : ''}</span>
      </p>
    </Link>
  );
};

export default ComicCard;