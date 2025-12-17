
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { DataProvider } from '../services/dataProvider';

const Footer: React.FC = () => {
  const [footerContent, setFooterContent] = useState<string>('');
  const [footerMenu, setFooterMenu] = useState<{label: string, url: string}[]>([]);

  useEffect(() => {
      const loadFooter = async () => {
          const theme = await DataProvider.getTheme();
          if (theme.footerContent) {
              setFooterContent(theme.footerContent);
          }
          if (theme.footerMenu && theme.footerMenu.length > 0) {
              setFooterMenu(theme.footerMenu);
          } else {
              // Fallback default
               setFooterMenu([
                  { label: 'Điều khoản', url: '/p/dieu-khoan' },
                  { label: 'Chính sách riêng tư', url: '/p/chinh-sach-rieng-tu' },
                  { label: 'Liên hệ', url: '/p/lien-he' }
              ]);
          }
      };
      loadFooter();
  }, []);

  const footerStyle = {
      backgroundColor: 'var(--footer-bg)',
      color: 'var(--footer-text)',
      borderColor: 'rgba(255,255,255,0.1)'
  };

  return (
    <footer className="py-8 border-t mt-auto transition-colors" style={footerStyle}>
      <div className="container mx-auto px-4 text-center">
        <div className="mb-4 flex justify-center items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-primary to-secondary rounded-md flex items-center justify-center text-white text-xs font-bold">
                C
            </div>
            <span className="font-bold text-lg" style={{color: 'var(--footer-text)'}}>ComiVN</span>
        </div>
        
        {/* Dynamic Footer Content */}
        {footerContent ? (
            <div 
                className="text-sm mb-4 prose prose-invert prose-sm max-w-none mx-auto opacity-80" 
                style={{color: 'var(--footer-text)'}}
                dangerouslySetInnerHTML={{ __html: footerContent }} 
            />
        ) : (
            <p className="text-sm mb-4 opacity-80" style={{color: 'var(--footer-text)'}}>
              Nền tảng đọc truyện tranh trực tuyến miễn phí hàng đầu Việt Nam.
            </p>
        )}

        <div className="flex justify-center gap-4 text-sm mt-4 flex-wrap opacity-70">
            {footerMenu.map((item, idx) => (
                <Link key={idx} to={item.url} className="hover:text-primary transition-colors" style={{color: 'var(--footer-text)'}}>{item.label}</Link>
            ))}
            <span className="hidden md:inline opacity-50">|</span>
            <Link to="/login" className="hover:text-primary flex items-center gap-1" style={{color: 'var(--footer-text)'}}><Lock size={12}/> Admin</Link>
        </div>
        <p className="text-xs mt-6 opacity-50" style={{color: 'var(--footer-text)'}}>
          © {new Date().getFullYear()} ComiVN. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
