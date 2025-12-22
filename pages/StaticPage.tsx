import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DataProvider } from '../services/dataProvider';
import { StaticPage as StaticPageType } from '../types';

const StaticPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [page, setPage] = useState<StaticPageType | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPage = async () => {
            if (slug) {
                setLoading(true);
                const data = await DataProvider.getStaticPageBySlug(slug);
                setPage(data);
                setLoading(false);
            }
        };
        fetchPage();
    }, [slug]);

    if (loading) return <div className="min-h-screen flex items-center justify-center text-primary">Đang tải...</div>;
    
    if (!page) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400">
            <h1 className="text-3xl font-bold text-white mb-2">404</h1>
            <p>Trang không tồn tại.</p>
        </div>
    );

    return (
        <div className="min-h-screen py-10">
            <div className="container mx-auto px-4 max-w-4xl">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-8 border-b border-white/10 pb-4">
                    {page.title}
                </h1>
                <div 
                    className="prose prose-invert prose-lg max-w-none text-slate-300"
                    dangerouslySetInnerHTML={{ __html: page.content }}
                />
            </div>
        </div>
    );
};

export default StaticPage;