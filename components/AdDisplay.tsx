
import React, { useEffect, useState, useRef } from 'react';
import { DataProvider } from '../services/dataProvider';
import { AdConfig } from '../types';

interface AdDisplayProps {
    position: 'home_header' | 'home_middle' | 'home_bottom' | 'detail_sidebar' | 'detail_bottom' | 'reader_top' | 'reader_bottom' | 'reader_middle' | 'reader_float_left' | 'reader_float_right';
    className?: string;
}

const ScriptAd: React.FC<{ scriptCode: string; className?: string }> = ({ scriptCode, className }) => {
    const adRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (adRef.current) {
            // Clear previous content
            adRef.current.innerHTML = '';
            
            // Create a temporary div to parse the script string
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = scriptCode;

            const scripts = tempDiv.querySelectorAll('script');
            
            // Append non-script elements directly
            Array.from(tempDiv.childNodes).forEach(node => {
                if (node.nodeName.toLowerCase() !== 'script') {
                    adRef.current!.appendChild(node.cloneNode(true));
                }
            });

            // Re-create and append script elements to make them execute
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                if (oldScript.innerHTML) {
                    newScript.innerHTML = oldScript.innerHTML;
                }
                adRef.current!.appendChild(newScript);
            });
        }
    }, [scriptCode]);

    return <div ref={adRef} className={className} />;
};


const AdDisplay: React.FC<AdDisplayProps> = ({ position, className = '' }) => {
    const [ad, setAd] = useState<AdConfig | null>(null);

    useEffect(() => {
        const fetchAd = async () => {
            const allAds = await DataProvider.getAds();
            const activeAds = allAds.filter(a => a.position === position && a.isActive);
            if (activeAds.length > 0) {
                setAd(activeAds[activeAds.length - 1]);
            }
        };
        fetchAd();
    }, [position]);

    if (!ad) return null;

    // Ưu tiên hiển thị Script Ad
    if (ad.scriptCode) {
        const isFloating = position === 'reader_float_left' || position === 'reader_float_right';
        const positionClass = isFloating 
            ? (position === 'reader_float_left' ? 'xl:right-[calc(50%+528px)]' : 'xl:left-[calc(50%+528px)]')
            : '';
        const layoutClass = isFloating 
            ? `my-4 w-full flex justify-center xl:w-[250px] 2xl:w-[400px] xl:fixed xl:top-1/2 xl:-translate-y-1/2 z-40 ${positionClass}`
            : 'w-full flex justify-center my-4';
            
        return <ScriptAd scriptCode={ad.scriptCode} className={`${layoutClass} ${className}`} />;
    }

    // Fallback: Hiển thị Image Ad
    if (ad.imageUrl) {
        if (position === 'reader_float_left' || position === 'reader_float_right') {
            const positionClass = position === 'reader_float_left' 
                ? 'xl:right-[calc(50%+528px)]' 
                : 'xl:left-[calc(50%+528px)]'; 

            return (
                <div className={`my-4 w-full flex justify-center xl:w-[250px] 2xl:w-[400px] xl:fixed xl:top-1/2 xl:-translate-y-1/2 z-40 ${positionClass} ${className}`}>
                    <a 
                        href={ad.linkUrl || '#'} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="block relative overflow-hidden rounded-lg group shadow-xl border border-white/10 w-full max-w-3xl xl:max-w-full"
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
    }
    
    return null;
};

export default AdDisplay;