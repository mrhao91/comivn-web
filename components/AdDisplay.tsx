
import React, { useEffect, useState } from 'react';
import { DataProvider } from '../services/dataProvider';
import { AdConfig } from '../types';

interface AdDisplayProps {
    position: 'home_header' | 'home_middle' | 'home_bottom' | 'detail_sidebar' | 'detail_bottom' | 'reader_top' | 'reader_bottom' | 'reader_middle' | 'reader_float_left' | 'reader_float_right';
    className?: string;
}

const AdDisplay: React.FC<AdDisplayProps> = ({ position, className = '' }) => {
    const [ad, setAd] = useState<AdConfig | null>(null);

    useEffect(() => {
        const fetchAd = async () => {
            const allAds = await DataProvider.getAds();
            // Filter ads for this position and check active status
            const activeAds = allAds.filter(a => a.position === position && a.isActive);
            if (activeAds.length > 0) {
                // For simplicity, take the last added one (or could be random)
                setAd(activeAds[activeAds.length - 1]);
            }
        };
        fetchAd();
    }, [position]);

    if (!ad) return null;

    // Handle Floating Ads (Fixed position on sides)
    // CẢI TIẾN: 
    // - Tăng kích thước width lên gấp đôi: w-[250px] (màn hình to vừa) và w-[400px] (màn hình rất to)
    // - Vị trí ghim: cách tâm màn hình 400px (để không che nội dung truyện)
    if (position === 'reader_float_left' || position === 'reader_float_right') {
        const positionClass = position === 'reader_float_left' 
            ? 'right-[calc(50%+400px)]' 
            : 'left-[calc(50%+400px)]'; 

        return (
            <div className={`fixed top-1/2 -translate-y-1/2 z-40 hidden xl:block w-[250px] 2xl:w-[400px] ${positionClass} ${className}`}>
                <a 
                    href={ad.linkUrl || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="block relative overflow-hidden rounded-lg group shadow-xl border border-white/10"
                >
                    <img 
                        src={ad.imageUrl} 
                        alt={ad.title || "Quảng cáo"} 
                        className="w-full h-auto object-cover"
                        width="400"
                        height="600"
                        loading="lazy"
                    />
                     <div className="absolute top-0 right-0 bg-black/50 text-white text-[10px] px-2 py-0.5">AD</div>
                     <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                </a>
            </div>
        );
    }

    // Handle Standard Ads (In-flow)
    // CẢI TIẾN: Tăng maxHeight lên 600px để hình to gấp đôi
    return (
        <div className={`w-full flex justify-center my-4 ${className}`}>
            <a 
                href={ad.linkUrl || '#'} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="block relative overflow-hidden rounded-lg group shadow-lg max-w-full"
            >
                <img 
                    src={ad.imageUrl} 
                    alt={ad.title || "Quảng cáo"} 
                    className="max-w-full h-auto object-cover transition-transform group-hover:scale-105"
                    style={{ 
                        maxHeight: (position === 'reader_bottom' || position === 'reader_top' || position === 'reader_middle') ? '600px' : 'auto' 
                    }}
                    width="1200"
                    height="250"
                    loading="lazy"
                />
                <div className="absolute top-0 right-0 bg-black/50 text-white text-[10px] px-2 py-0.5">AD</div>
            </a>
        </div>
    );
};

export default AdDisplay;
