
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, X, BookOpen, LayoutDashboard, LogOut, User } from 'lucide-react';
import { AuthService } from '../services/auth';
import { DataProvider } from '../services/dataProvider';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuItems, setMenuItems] = useState<{label: string, url: string}[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  
  const isAuthenticated = AuthService.isAuthenticated();

  useEffect(() => {
      // Fetch dynamic menu from theme
      const loadTheme = async () => {
          const theme = await DataProvider.getTheme();
          if (theme.headerMenu && theme.headerMenu.length > 0) {
              setMenuItems(theme.headerMenu);
          } else {
              // Fallback default
              setMenuItems([
                  { label: 'Trang chủ', url: '/' },
                  { label: 'Thể loại', url: '/categories' }
              ]);
          }
      };
      loadTheme();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      console.log("Searching for:", searchQuery);
    }
  };

  const handleLogout = () => {
      AuthService.logout();
      navigate('/');
  };

  // Use inline style for dynamic CSS variables from theme
  const headerStyle = {
      backgroundColor: 'var(--header-bg)',
      color: 'var(--header-text)',
      borderColor: 'rgba(255,255,255,0.1)'
  };

  return (
    <header className="sticky top-0 z-50 border-b transition-colors" style={headerStyle}>
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center text-white font-bold transform group-hover:scale-110 transition-transform">
                C
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400" style={{color: 'var(--header-text)'}}>
                ComiVN
            </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {menuItems.map((item, index) => (
              <Link key={index} to={item.url} className="hover:text-primary transition-colors opacity-90 hover:opacity-100" style={{color: 'var(--header-text)'}}>
                  {item.label}
              </Link>
          ))}
          
          {/* Secret Entry Point: Only show Login Icon if NOT authenticated */}
          {!isAuthenticated && (
            <Link to="/login" className="hover:text-primary transition-colors opacity-50 hover:opacity-100" title="Đăng nhập Admin" style={{color: 'var(--header-text)'}}>
                <User size={16} />
            </Link>
          )}
        </nav>

        {/* Search Bar (Desktop) */}
        <form onSubmit={handleSearch} className="hidden md:flex items-center relative">
            <input 
                type="text" 
                placeholder="Tìm truyện..." 
                className="bg-black/20 border border-white/10 rounded-full py-1.5 px-4 pl-10 text-sm focus:outline-none focus:border-primary w-64 transition-all focus:w-72 placeholder-white/50"
                style={{ color: 'var(--header-text)' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="w-4 h-4 absolute left-3.5 opacity-50" style={{color: 'var(--header-text)'}} />
        </form>

        {/* Mobile Menu Toggle */}
        <button 
            className="md:hidden opacity-80"
            style={{color: 'var(--header-text)'}}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
            {isMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-b border-white/10 p-4 absolute w-full left-0 animate-in slide-in-from-top-2 shadow-2xl z-50" style={{backgroundColor: 'var(--header-bg)', color: 'var(--header-text)'}}>
            <form onSubmit={handleSearch} className="mb-4 relative">
                <input 
                    type="text" 
                    placeholder="Tìm kiếm..." 
                    className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-4 pl-10 text-sm placeholder-white/50"
                    style={{color: 'var(--header-text)'}}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="w-4 h-4 absolute left-3.5 top-3 opacity-50" style={{color: 'var(--header-text)'}} />
            </form>
            <nav className="flex flex-col gap-4">
                {menuItems.map((item, index) => (
                    <Link key={index} to={item.url} onClick={() => setIsMenuOpen(false)} style={{color: 'var(--header-text)'}}>
                        {item.label}
                    </Link>
                ))}
                {!isAuthenticated && (
                    <Link to="/login" className="opacity-50" onClick={() => setIsMenuOpen(false)} style={{color: 'var(--header-text)'}}>Đăng nhập Admin</Link>
                )}
            </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
