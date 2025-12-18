
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useParams } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import ComicDetail from './pages/ComicDetail';
import Reader from './pages/Reader';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Categories from './pages/Categories';
import StaticPage from './pages/StaticPage';
import { AuthService } from './services/auth';
import { DataProvider } from './services/dataProvider';
import SEOHead from './components/SEOHead';
import { DEFAULT_THEME } from './services/seedData';

// Layout for public pages
const PublicLayout: React.FC = () => {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
};

// Helper: Redirect Legacy URLs
const RedirectComic = () => { const { id } = useParams(); return <Navigate to={`/truyen/${id}`} replace />; };
const RedirectReader = () => { const { id } = useParams(); return <Navigate to={`/doc/${id}`} replace />; };

// 404 Page
const NotFound = () => (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-4">
        <SEOHead title="404 - Không tìm thấy trang" />
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-slate-300 mb-6">Trang bạn tìm kiếm không tồn tại hoặc đã bị xóa.</p>
        <a href="/" className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-lg text-white transition-colors">Về Trang Chủ</a>
    </div>
);

const App: React.FC = () => {
  const [loginUrl, setLoginUrl] = useState('/login');

  useEffect(() => {
    const loadTheme = async () => {
        const themeData = await DataProvider.getTheme();
        // Merge fetched theme with default theme to ensure no undefined values
        const theme = { ...DEFAULT_THEME, ...themeData };
        
        const root = document.documentElement;
        
        setLoginUrl(theme.loginUrl || '/login');

        // Colors
        root.style.setProperty('--color-primary', theme.primaryColor || '#d97706');
        root.style.setProperty('--color-secondary', theme.secondaryColor || '#78350f');
        root.style.setProperty('--color-dark', theme.backgroundColor || '#1c1917');
        root.style.setProperty('--color-card', theme.cardColor || '#292524');
        root.style.setProperty('--color-darker', '#0c0a09'); 

        // Header & Footer Custom Colors
        root.style.setProperty('--header-bg', theme.headerBg || theme.backgroundColor || '#1c1917');
        root.style.setProperty('--header-text', theme.headerText || '#e2e8f0');
        root.style.setProperty('--footer-bg', theme.footerBg || theme.cardColor || '#292524');
        root.style.setProperty('--footer-text', theme.footerText || '#94a3b8');
        
        // Font Handling
        let fontStack = "'Inter', sans-serif"; // Default fallback
        if (theme.fontFamily) {
            const fontName = theme.fontFamily;
            // Map specific Google Fonts to load
            if (['Roboto', 'Open Sans', 'Patrick Hand', 'Playfair Display', 'Merriweather', 'Comfortaa'].includes(fontName)) {
                // Check if link already exists
                if (!document.querySelector(`link[href*="${fontName.replace(/ /g, '+')}"]`)) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@300;400;500;700&display=swap`;
                    document.head.appendChild(link);
                }
                fontStack = `'${fontName}', sans-serif`;
                if (fontName === 'Playfair Display' || fontName === 'Merriweather') {
                    fontStack = `'${fontName}', serif`;
                }
                if (fontName === 'Patrick Hand') {
                    fontStack = `'${fontName}', cursive`;
                }
            } else if (theme.fontFamily === 'serif') {
                fontStack = "Georgia, Cambria, 'Times New Roman', Times, serif";
            } else if (theme.fontFamily === 'mono') {
                fontStack = "'Courier New', Courier, monospace";
            }
        }
        root.style.setProperty('--font-family', fontStack);

        // Update Favicon
        if (theme.favicon) {
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = theme.favicon;
        }
    };
    loadTheme();
  }, []);
  
  // Protected Route Component (uses loginUrl from state)
  const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      if (!AuthService.isAuthenticated()) {
          return <Navigate to={loginUrl} replace />;
      }
      return <>{children}</>;
  };

  return (
    <BrowserRouter>
        <Routes>
          {/* === PUBLIC ROUTES === */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/truyen/:id" element={<ComicDetail />} />
            <Route path="/p/:slug" element={<StaticPage />} />
            
            {/* Redirect Legacy Routes (Fix lỗi URL cũ) */}
            <Route path="/comic/:id" element={<RedirectComic />} />
            
            {/* 404 Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* === STANDALONE ROUTES (No Header/Footer) === */}
          <Route path={loginUrl} element={<Login />} />
          
          {/* Reader Routes: Optimized first, then legacy catch-all */}
          {/* Use :chapterSlug to capture "chap-1" because React Router v6 doesn't support partial dynamic segments like chap-:num */}
          <Route path="/doc/:slug/:chapterSlug" element={<Reader />} />
          <Route path="/doc/:chapterId" element={<Reader />} />
          
          {/* Redirect Legacy Reader */}
          <Route path="/read/:id" element={<RedirectReader />} />
          
          
          {/* Admin Page */}
          <Route 
            path="/admin" 
            element={
                <ProtectedRoute>
                    <Admin />
                </ProtectedRoute>
            } 
          />
        </Routes>
    </BrowserRouter>
  );
};

export default App;