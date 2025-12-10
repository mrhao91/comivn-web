import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, X, BookOpen, LayoutDashboard, LogOut, User } from 'lucide-react';
import { AuthService } from '../services/auth';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check auth status on every render (simple approach for this demo)
  const isAuthenticated = AuthService.isAuthenticated();

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

  return (
    <header className="sticky top-0 z-50 bg-dark/95 backdrop-blur-md border-b border-white/10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center text-white font-bold transform group-hover:scale-110 transition-transform">
                C
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                ComiVN
            </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <Link to="/" className="hover:text-primary transition-colors">Trang chủ</Link>
          <Link to="/categories" className="hover:text-primary transition-colors">Thể loại</Link>
          
          {/* Secret Entry Point: Only show Login Icon if NOT authenticated.
              If authenticated, we hide it completely to respect the "Hidden Admin" request. 
              The user can only access admin via /admin URL. 
          */}
          {!isAuthenticated && (
            <Link to="/login" className="hover:text-primary transition-colors opacity-50 hover:opacity-100" title="Đăng nhập Admin">
                <User size={16} />
            </Link>
          )}
        </nav>

        {/* Search Bar (Desktop) */}
        <form onSubmit={handleSearch} className="hidden md:flex items-center relative">
            <input 
                type="text" 
                placeholder="Tìm truyện..." 
                className="bg-card border border-white/10 rounded-full py-1.5 px-4 pl-10 text-sm focus:outline-none focus:border-primary w-64 text-slate-200 transition-all focus:w-72"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="w-4 h-4 absolute left-3.5 text-slate-400" />
        </form>

        {/* Mobile Menu Toggle */}
        <button 
            className="md:hidden text-slate-300"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
            {isMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-card border-b border-white/10 p-4 absolute w-full left-0 animate-in slide-in-from-top-2 shadow-2xl z-50">
            <form onSubmit={handleSearch} className="mb-4 relative">
                <input 
                    type="text" 
                    placeholder="Tìm kiếm..." 
                    className="w-full bg-dark border border-white/10 rounded-lg py-2 px-4 pl-10 text-sm text-slate-200"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            </form>
            <nav className="flex flex-col gap-4 text-slate-300">
                <Link to="/" onClick={() => setIsMenuOpen(false)}>Trang chủ</Link>
                <Link to="/categories" onClick={() => setIsMenuOpen(false)}>Thể loại</Link>
                {!isAuthenticated && (
                    <Link to="/login" className="text-slate-500" onClick={() => setIsMenuOpen(false)}>Đăng nhập Admin</Link>
                )}
            </nav>
        </div>
      )}
    </header>
  );
};

export default Header;