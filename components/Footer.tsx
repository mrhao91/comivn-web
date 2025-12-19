import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { DataProvider } from '../services/dataProvider';
import { ThemeConfig } from '../types';
import { DEFAULT_THEME } from '../services/seedData';

const Footer: React.FC = () => {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);

  useEffect(() => {
      const loadFooter = async () => {
          const themeData = await DataProvider.getTheme();
          setTheme({ ...DEFAULT_THEME, ...themeData });
      };
      loadFooter();
  }, []);

  const footerStyle = {
      backgroundColor: 'var(--footer-bg)',
      color: 'var(--footer-text)',
      borderColor: 'rgba(255,255,255,0.1)'
  };

  const footerMenu = theme.footerMenu && theme.footerMenu.length > 0
    ? theme.footerMenu
    : DEFAULT_THEME.footerMenu || [];

  return (
    <footer className="py-8 border-t mt-auto transition-colors" style={footerStyle}>
      <div className="container mx-auto px-4 text-center">
        <Link to="/" className="mb-4 flex justify-center items-center gap-2 group">
             {theme.logoUrl ? (
                <img src={theme.logoUrl} alt={theme.siteName} className="h-10 w-auto transition-transform group-hover:scale-105" />
            ) : (
                <>
                    <div className="w-6 h-6 bg-gradient-to-br from-primary to-secondary rounded-md flex items-center justify-center text-white text-xs font-bold transition-transform group-hover:scale-110">
                        C
                    </div>
                    <span className="font-bold text-lg" style={{color: 'var(--footer-text)'}}>{theme.siteName}</span>
                </>
            )}
        </Link>
        
        {/* Dynamic Footer Content */}
        {theme.footerContent ? (
            <div 
                className="text-sm mb-4 prose prose-invert prose-sm max-w-none mx-auto opacity-80" 
                style={{color: 'var(--footer-text)'}}
                dangerouslySetInnerHTML={{ __html: theme.footerContent }} 
            />
        ) : (
            <p className="text-sm mb-4 opacity-80" style={{color: 'var(--footer-text)'}}>
              Thiết kế bởi Hạo Nam
            </p>
        )}

        <div className="flex justify-center gap-4 text-sm mt-4 flex-wrap opacity-70">
            {footerMenu.map((item, idx) => (
                <Link key={idx} to={item.url} className="hover:text-primary transition-colors" style={{color: 'var(--footer-text)'}}>{item.label}</Link>
            ))}
        </div>
        <p className="text-xs mt-6 opacity-50" style={{color: 'var(--footer-text)'}}>
          © {new Date().getFullYear()} {theme.siteName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;