
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

  return (
    <footer className="bg-card py-8 border-t border-white/10 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <div className="mb-4 flex justify-center items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-primary to-secondary rounded-md flex items-center justify-center text-white text-xs font-bold">
                C
            </div>
            <span className="font-bold text-lg text-slate-200">ComiVN</span>
        </div>
        
        {/* Dynamic Footer Content */}
        {footerContent ? (
            <div className="text-slate-400 text-sm mb-4 prose prose-invert prose-sm max-w-none mx-auto" dangerouslySetInnerHTML={{ __html: footerContent }} />
        ) : (
            <p className="text-slate-400 text-sm mb-4">
              Nền tảng đọc truyện tranh trực tuyến miễn phí hàng đầu Việt Nam.
            </p>
        )}

        <div className="flex justify-center gap-4 text-slate-500 text-sm mt-4 flex-wrap">
            {footerMenu.map((item, idx) => (
                <Link key={idx} to={item.url} className="hover:text-primary">{item.label}</Link>
            ))}
            <span className="text-slate-700 hidden md:inline">|</span>
            <Link to="/login" className="hover:text-primary flex items-center gap-1"><Lock size={12}/> Admin</Link>
        </div>
        <p className="text-slate-600 text-xs mt-6">
          © {new Date().getFullYear()} ComiVN. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
