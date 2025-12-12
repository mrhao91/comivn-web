
import React, { useEffect } from 'react';

interface SEOHeadProps {
    title: string;
    description?: string;
    keywords?: string;
    image?: string;
    url?: string;
}

const SEOHead: React.FC<SEOHeadProps> = ({ title, description, keywords, image, url }) => {
    useEffect(() => {
        // 1. Update Title
        document.title = title || 'ComiVN - Đọc Truyện Tranh Online';

        // 2. Helper to update meta tags
        const updateMeta = (name: string, content: string) => {
            let tag = document.querySelector(`meta[name="${name}"]`);
            if (!tag) {
                tag = document.createElement('meta');
                tag.setAttribute('name', name);
                document.head.appendChild(tag);
            }
            tag.setAttribute('content', content);
        };

        const updateOg = (property: string, content: string) => {
             let tag = document.querySelector(`meta[property="${property}"]`);
             if (!tag) {
                 tag = document.createElement('meta');
                 tag.setAttribute('property', property);
                 document.head.appendChild(tag);
             }
             tag.setAttribute('content', content);
        };

        // 3. Update Meta Description & Keywords
        if (description) {
            updateMeta('description', description);
            updateOg('og:description', description);
        }
        if (keywords) {
            updateMeta('keywords', keywords);
        }

        // 4. Update OG Tags (Social Media)
        updateOg('og:title', title);
        if (image) updateOg('og:image', image);
        if (url) updateOg('og:url', url);
        updateOg('og:type', 'website');

    }, [title, description, keywords, image, url]);

    return null; // This component renders nothing visually
};

export default SEOHead;
