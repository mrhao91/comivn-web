import React, { useEffect } from 'react';
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

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (!AuthService.isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
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
  useEffect(() => {
    const loadTheme = async () => {
        const themeData = await DataProvider.getTheme();
        // Merge fetched theme with default theme to ensure no undefined values
        const theme = { ...DEFAULT_THEME, ...themeData };
        
        const root = document.documentElement;
        
        // Use fallbacks to prevent "undefined" CSS variables causing black screen
        root.style.setProperty('--color-primary', theme.primaryColor || '#d97706');
        root.style.setProperty('--color-secondary', theme.secondaryColor || '#78350f');
        root.style.setProperty('--color-dark', theme.backgroundColor || '#1c1917');
        root.style.setProperty('--color-card', theme.cardColor || '#292524');
        root.style.setProperty('--color-darker', '#0c0a09'); 
        
        let fontStack = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
        if (theme.fontFamily === 'serif') fontStack = "Georgia, Cambria, 'Times New Roman', Times, serif";
        if (theme.fontFamily === 'mono') fontStack = "'Courier New', Courier, monospace";
        root.style.setProperty('--font-family', fontStack);
    };
    loadTheme();
  }, []);

  return (
    <BrowserRouter>
        <Routes>
          {/* === PUBLIC ROUTES === */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/truyen/:id" element={<ComicDetail />} />
            <Route path="/p/:slug" element={<StaticPage />} />
            <Route path="/login" element={<Login />} />
            
            {/* Redirect Legacy Routes (Fix lỗi URL cũ) */}
            <Route path="/comic/:id" element={<RedirectComic />} />
            
            {/* 404 Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* === STANDALONE ROUTES === */}
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