
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
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

// Layout for public pages (Home, Categories, Details)
// Includes Header and Footer
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

const App: React.FC = () => {
  // Load Theme
  useEffect(() => {
    const loadTheme = async () => {
        const theme = await DataProvider.getTheme();
        const root = document.documentElement;
        
        root.style.setProperty('--color-primary', theme.primaryColor);
        root.style.setProperty('--color-secondary', theme.secondaryColor);
        root.style.setProperty('--color-dark', theme.backgroundColor);
        root.style.setProperty('--color-card', theme.cardColor);
        
        let fontStack = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
        if (theme.fontFamily === 'serif') fontStack = "Georgia, Cambria, 'Times New Roman', Times, serif";
        if (theme.fontFamily === 'mono') fontStack = "'Courier New', Courier, monospace";
        root.style.setProperty('--font-family', fontStack);

        // Adjust Darker shade slightly based on background
        // For simplicity we just use blackish color for darker
        root.style.setProperty('--color-darker', '#0c0a09'); 
    };
    loadTheme();
  }, []);

  return (
    <HashRouter>
        <Routes>
          {/* === PUBLIC ROUTES (With Header & Footer) === */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/comic/:id" element={<ComicDetail />} />
            <Route path="/p/:slug" element={<StaticPage />} />
          </Route>

          {/* === STANDALONE ROUTES (No Header/Footer) === */}
          
          {/* Reader Page */}
          <Route path="/read/:chapterId" element={<Reader />} />
          
          {/* Login Page */}
          <Route path="/login" element={<Login />} />
          
          {/* Admin Page - Separate Layout */}
          <Route 
            path="/admin" 
            element={
                <ProtectedRoute>
                    <Admin />
                </ProtectedRoute>
            } 
          />
        </Routes>
    </HashRouter>
  );
};

export default App;
