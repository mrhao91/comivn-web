
import React, { useEffect, useState, useRef } from 'react';
import { DataProvider } from '../services/dataProvider';
import { Comic, Genre, Chapter, Page, AdConfig, Comment, StaticPage, ThemeConfig, User } from '../types';
import { Plus, Trash2, Edit, Save, X, LayoutDashboard, Image as ImageIcon, Tags, Book, List, Upload, LogOut, Home, MonitorPlay, MessageSquare, FileText, CheckCircle, XCircle, Settings, Palette, Globe, Users, ShieldAlert, Eye, Loader, CheckSquare, Info, FilePlus, Link as LinkIcon, Menu as MenuIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../services/auth';
import SimpleEditor from '../components/SimpleEditor';

// Helper: Slug Generator
const toSlug = (str: string) => {
    if (!str) return '';
    return str.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/([^0-9a-z-\s])/g, '')
        .replace(/(\s+)/g, '-')
        .replace(/-+/g, '-').replace(/^-+|-+$/g, '');
};

const Admin: React.FC = () => {
  const [comics, setComics] = useState<Comic[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [ads, setAds] = useState<AdConfig[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const navigate = useNavigate();
  
  // Role & Auth
  const [currentUserRole, setCurrentUserRole] = useState<string>('editor');
  const [currentUsername, setCurrentUsername] = useState<string>('');

  // UI State
  const [activeView, setActiveView] = useState<string>('list');
  const [editingComicId, setEditingComicId] = useState<string | null>(null);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [currentComic, setCurrentComic] = useState<Comic | null>(null); 
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Forms
  const [comicForm, setComicForm] = useState<Partial<Comic>>({ title: '', slug: '', coverImage: '', author: '', description: '', genres: [], status: 'Đang tiến hành', views: 0, isRecommended: false, metaTitle: '', metaDescription: '', metaKeywords: '' });
  const [chapterForm, setChapterForm] = useState<{title: string, number: number}>({ title: '', number: 0 });
  const [chapterPages, setChapterPages] = useState<Page[]>([]);
  const [genreForm, setGenreForm] = useState<Partial<Genre>>({ name: '', id: '', isShowHome: false, metaTitle: '', metaDescription: '', metaKeywords: '' });
  const [adForm, setAdForm] = useState<Partial<AdConfig>>({ title: '', imageUrl: '', linkUrl: '#', position: 'home_middle', isActive: true });
  const [editingAdId, setEditingAdId] = useState<string | null>(null);
  const [staticPageForm, setStaticPageForm] = useState<Partial<StaticPage>>({ title: '', slug: '', content: '', metaTitle: '', metaDescription: '', metaKeywords: '' });
  
  const defaultTheme: ThemeConfig = { 
      primaryColor: '#d97706', secondaryColor: '#78350f', backgroundColor: '#1c1917', cardColor: '#292524', fontFamily: 'sans', 
      homeLayout: { showSlider: true, showHot: true, showNew: true }, siteName: 'ComiVN',
      headerMenu: [{ label: 'Trang chủ', url: '/' }, { label: 'Thể loại', url: '/categories' }]
  };
  const [themeForm, setThemeForm] = useState<ThemeConfig>(defaultTheme);
  const [userForm, setUserForm] = useState<{id?: string|number, username: string, password: string, role: string}>({ username: '', password: '', role: 'editor' });
  const [isEditingUser, setIsEditingUser] = useState(false);

  // Menu Add Form State
  const [newMenuItem, setNewMenuItem] = useState({ label: '', url: '' });

  const coverInputRef = useRef<HTMLInputElement>(null);
  const pagesInputRef = useRef<HTMLInputElement>(null);
  const adImageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const role = AuthService.getRole();
    const user = AuthService.getUser();
    setCurrentUserRole(role);
    if(user) setCurrentUsername(user.username);
    
    // Check permission logic
    if (role !== 'admin' && ['ads', 'users', 'settings', 'pages'].includes(activeView)) {
        setActiveView('list');
    }
    refreshData(role);
  }, [activeView]);

  const refreshData = async (role: string) => {
    try {
        const c = await DataProvider.getComics();
        setComics(Array.isArray(c) ? c : []); 
    } catch (e) { setComics([]); }
    
    try {
        const g = await DataProvider.getGenres();
        setGenres(Array.isArray(g) ? g : []); 
    } catch (e) { setGenres([]); }

    if (activeView === 'comments') {
        try { const c = await DataProvider.getComments(); setComments(Array.isArray(c) ? c : []); } catch(e){ setComments([]); }
    }
    
    if (role === 'admin') {
        if(activeView === 'ads') { try { const a = await DataProvider.getAds(); setAds(Array.isArray(a) ? a : []); } catch(e){ setAds([]); } }
        if(activeView === 'pages') { try { const p = await DataProvider.getStaticPages(); setStaticPages(Array.isArray(p) ? p : []); } catch(e){ setStaticPages([]); } }
        if(activeView === 'settings') { 
            try { 
                const t = await DataProvider.getTheme(); 
                setThemeForm({ ...defaultTheme, ...(t || {}) }); 
            } catch(e){} 
        }
        if(activeView === 'users') { try { const u = await DataProvider.getUsers(AuthService.getToken()); setUsers(Array.isArray(u) ? u : []); } catch(e){ setUsers([]); } }
    }
  };

  const handleLogout = () => { AuthService.logout(); navigate('/login'); };

  // Handlers
  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => { 
      if(e.target.files?.[0]) { 
          setIsUploading(true);
          try {
              const url = await DataProvider.uploadImage(e.target.files[0]); 
              setComicForm(p=>({...p, coverImage:url})); 
          } catch(err: any) { alert(err.message); } 
          finally { setIsUploading(false); }
      } 
  };

  const handleUploadAdImage = async (e: React.ChangeEvent<HTMLInputElement>) => { 
      if(e.target.files?.[0]) { 
          setIsUploading(true);
          try {
              const url = await DataProvider.uploadImage(e.target.files[0]); 
              setAdForm(p=>({...p, imageUrl:url})); 
          } catch(err: any) { alert(err.message); } 
          finally { setIsUploading(false); }
      } 
  };
  
  const handleSubmitComic = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSaving(true);
    const newComic: Comic = {
      id: editingComicId || `comic-${Date.now()}`,
      title: comicForm.title || 'No Title', 
      slug: comicForm.slug || toSlug(comicForm.title || ''),
      coverImage: comicForm.coverImage || '', 
      author: comicForm.author || '', 
      status: (comicForm.status === 'Hoàn thành' ? 'Hoàn thành' : 'Đang tiến hành'),
      genres: comicForm.genres || [], description: comicForm.description || '', views: comicForm.views || 0,
      chapters: editingComicId ? (comics.find(c=>c.id===editingComicId)?.chapters||[]) : [],
      isRecommended: comicForm.isRecommended, 
      metaTitle: comicForm.metaTitle, metaDescription: comicForm.metaDescription, metaKeywords: comicForm.metaKeywords
    };
    await DataProvider.saveComic(newComic, AuthService.getToken());
    setIsSaving(false); refreshData(currentUserRole); setComicForm({title:'', slug:'', coverImage:'', author:'', description:'', genres:[], status:'Đang tiến hành', views:0}); setEditingComicId(null); setActiveView('list');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
      const t = e.target.value; const s = toSlug(t); 
      setComicForm(p => ({...p, title: t, slug: (!p.slug || p.slug !== s) ? s : p.slug })); 
  };

  // Safe Rendering Helpers
  const renderSEOFields = (form: any, setForm: any) => (
      <div className="bg-white/5 p-4 rounded-xl border border-white/10 mt-6">
          <h3 className="text-white font-bold flex items-center gap-2 mb-4"><Globe className="text-blue-400" size={18} /> Cấu hình SEO</h3>
          <div className="space-y-4">
              <div><label className="text-sm text-slate-400 block mb-1">Meta Title</label><input type="text" value={form.metaTitle || ''} onChange={e => setForm({...form, metaTitle: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm"/></div>
              <div><label className="text-sm text-slate-400 block mb-1">Meta Description</label><textarea value={form.metaDescription || ''} onChange={e => setForm({...form, metaDescription: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm" rows={2}/></div>
              <div><label className="text-sm text-slate-400 block mb-1">Meta Keywords</label><input type="text" value={form.metaKeywords || ''} onChange={e => setForm({...form, metaKeywords: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm"/></div>
          </div>
      </div>
  );

  // Get Ad Dimension Hint
  const getAdSizeHint = (pos?: string) => {
    switch (pos) {
        case 'home_header': return 'Gợi ý: 1200x250px (Banner lớn đầu trang)';
        case 'home_middle':
        case 'home_bottom': return 'Gợi ý: 1200x200px (Banner ngang dài)';
        case 'detail_sidebar': return 'Gợi ý: 300x250px hoặc 300x600px (Vuông hoặc Dọc)';
        case 'detail_bottom': return 'Gợi ý: 1000x150px (Banner ngang)';
        case 'reader_top':
        case 'reader_middle':
        case 'reader_bottom': return 'Gợi ý: 800x150px (Banner ngang nhỏ)';
        case 'reader_float_left':
        case 'reader_float_right': return 'Gợi ý: 300x600px (Banner dọc chạy theo màn hình)';
        default: return '';
    }
  };

  // Define required system pages
  const SYSTEM_PAGES = [
      { title: 'Điều Khoản Sử Dụng', slug: 'dieu-khoan' },
      { title: 'Chính Sách Riêng Tư', slug: 'chinh-sach-rieng-tu' },
      { title: 'Liên Hệ', slug: 'lien-he' }
  ];

  // Helper for Settings View: Add Menu Item
  const handleAddMenuItem = () => {
      if (!newMenuItem.label || !newMenuItem.url) return;
      const currentMenu = themeForm.headerMenu || [];
      setThemeForm({ ...themeForm, headerMenu: [...currentMenu, newMenuItem] });
      setNewMenuItem({ label: '', url: '' });
  };

  const handleDeleteMenuItem = (index: number) => {
      const currentMenu = themeForm.headerMenu || [];
      const newMenu = currentMenu.filter((_, i) => i !== index);
      setThemeForm({ ...themeForm, headerMenu: newMenu });
  };

  return (
    <div className="min-h-screen bg-darker p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-white/10 pb-6">
                <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary"><LayoutDashboard size={24} /></div>
                     <div><h1 className="text-2xl font-bold text-white">CMS Admin</h1><div className="text-sm text-slate-400">Xin chào, <span className="text-white font-bold">{currentUsername}</span></div></div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/')} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg flex items-center gap-2 text-sm"><Home size={16} /> Website</button>
                    <button onClick={handleLogout} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center gap-2 text-sm"><LogOut size={16} /> Đăng xuất</button>
                </div>
            </div>

            {/* Access Check */}
            {(currentUserRole !== 'admin' && ['ads', 'users', 'settings', 'pages'].includes(activeView)) ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl border border-red-500/20 text-center">
                    <ShieldAlert size={48} className="text-red-500 mb-4" /><h2 className="text-2xl font-bold text-white mb-2">Truy cập bị từ chối</h2>
                    <button onClick={() => setActiveView('list')} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg">Quay lại</button>
                </div>
            ) : (
            <>
                {/* Menu Tabs */}
                <div className="flex mb-6 overflow-x-auto pb-2 gap-2 custom-scrollbar">
                    <button onClick={() => setActiveView('list')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 flex-shrink-0 ${activeView === 'list' ? 'bg-primary text-white' : 'bg-card text-slate-400'}`}><Book size={16}/> Truyện</button>
                    <button onClick={() => setActiveView('genres')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 flex-shrink-0 ${activeView === 'genres' ? 'bg-primary text-white' : 'bg-card text-slate-400'}`}><Tags size={16}/> Thể loại</button>
                    {/* Only show other tabs if admin */}
                    {currentUserRole === 'admin' && (<>
                        <button onClick={() => setActiveView('ads')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 flex-shrink-0 ${activeView === 'ads' ? 'bg-primary text-white' : 'bg-card text-slate-400'}`}><MonitorPlay size={16}/> Quảng Cáo</button>
                        <button onClick={() => setActiveView('pages')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 flex-shrink-0 ${activeView === 'pages' ? 'bg-primary text-white' : 'bg-card text-slate-400'}`}><FileText size={16}/> Trang Tĩnh</button>
                        <button onClick={() => setActiveView('users')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 flex-shrink-0 ${activeView === 'users' ? 'bg-primary text-white' : 'bg-card text-slate-400'}`}><Users size={16}/> Tài Khoản</button>
                        <button onClick={() => setActiveView('settings')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 flex-shrink-0 ${activeView === 'settings' ? 'bg-primary text-white' : 'bg-card text-slate-400'}`}><Settings size={16}/> Cấu Hình</button>
                    </>)}
                    <div className="flex-grow"></div>
                    <button onClick={() => { setComicForm({title: '', slug: '', coverImage: '', author: '', description: '', genres: [], status: 'Đang tiến hành', views: 0}); setEditingComicId(null); setActiveView('add-comic'); }} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 flex-shrink-0 bg-green-600 hover:bg-green-700 text-white shadow`}><Plus size={16} /> Thêm Truyện</button>
                </div>

                {/* --- VIEWS --- */}
                
                {/* 1. COMIC LIST */}
                {activeView === 'list' && (
                    <div className="bg-card rounded-xl border border-white/10 overflow-hidden shadow-xl">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-slate-400 text-sm uppercase font-bold"><tr><th className="p-4">Cover</th><th className="p-4">Thông tin</th><th className="p-4">Views</th><th className="p-4">Trạng thái</th><th className="p-4 text-right">Hành động</th></tr></thead>
                            <tbody className="divide-y divide-white/5">
                                {Array.isArray(comics) && comics.map(c => (
                                    <tr key={c.id} className="text-slate-300 hover:bg-white/5">
                                        <td className="p-4 w-20"><img src={c.coverImage || 'https://via.placeholder.com/50'} className="w-12 h-16 object-cover rounded bg-dark border border-white/10" /></td>
                                        <td className="p-4"><div className="font-bold text-white mb-1">{c.title}</div><div className="text-xs text-slate-500">{Array.isArray(c.genres) ? c.genres.join(', ') : ''} • {c.chapters?.length || 0} chương</div></td>
                                        <td className="p-4 text-white font-bold">{c.views?.toLocaleString()}</td>
                                        <td className="p-4">
                                            {/* Fix Status Display logic if data is corrupted */}
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${c.status === 'Hoàn thành' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                {c.status && c.status.includes('Hoàn') ? 'Hoàn thành' : 'Đang tiến hành'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right whitespace-nowrap">
                                            <button onClick={() => { setCurrentComic(c); setActiveView('manage-chapters'); }} className="text-xs bg-primary/20 text-primary px-3 py-1 rounded mr-2">Chapters</button>
                                            <button onClick={() => { setComicForm({...c}); setEditingComicId(c.id); setActiveView('edit-comic'); }} className="p-2 text-blue-400"><Edit size={18} /></button>
                                            <button onClick={async () => { if(window.confirm('Xóa?')) { await DataProvider.deleteComic(c.id, AuthService.getToken()); refreshData(currentUserRole); } }} className="p-2 text-red-400"><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {comics.length === 0 && (<tr><td colSpan={5} className="p-8 text-center text-slate-500">Chưa có dữ liệu.</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 2. GENRES LIST */}
                {activeView === 'genres' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-1">
                            <div className="bg-card rounded-xl border border-white/10 p-6 sticky top-4">
                                <h2 className="text-xl font-bold text-white mb-6">Thêm Thể Loại</h2>
                                <form onSubmit={async (e) => { e.preventDefault(); await DataProvider.saveGenre({ ...genreForm, id: genreForm.id || `g-${Date.now()}`, slug: toSlug(genreForm.name!) } as Genre, AuthService.getToken()); setGenreForm({}); refreshData(currentUserRole); }} className="space-y-4">
                                    <input type="text" placeholder="Tên thể loại" required value={genreForm.name || ''} onChange={e => setGenreForm({...genreForm, name: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-3 text-white"/>
                                    <label className="flex items-center gap-2"><input type="checkbox" checked={genreForm.isShowHome || false} onChange={e => setGenreForm({...genreForm, isShowHome: e.target.checked})}/> Hiển thị Home</label>
                                    <button type="submit" className="w-full bg-primary text-white py-2 rounded font-bold">Lưu</button>
                                </form>
                            </div>
                        </div>
                        <div className="md:col-span-2 flex flex-col gap-3">
                            {Array.isArray(genres) && genres.map(g => (
                                <div key={g.id} className="bg-card p-4 rounded-xl border border-white/10 flex justify-between items-center">
                                    <div><div className="font-bold text-white">{g.name}</div><div className="text-xs text-slate-500">{g.slug}</div></div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setGenreForm(g)} className="p-2 text-blue-400"><Edit size={16}/></button>
                                        <button onClick={async () => { if(window.confirm('Xóa?')) { await DataProvider.deleteGenre(g.id, AuthService.getToken()); refreshData(currentUserRole); } }} className="p-2 text-red-400"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* 3. ADS VIEW (Updated with Upload) */}
                {activeView === 'ads' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1">
                            <div className="bg-card rounded-xl border border-white/10 p-6">
                                <h2 className="text-xl font-bold text-white mb-6">Thêm Quảng Cáo</h2>
                                <form onSubmit={async (e) => { e.preventDefault(); await DataProvider.saveAd({ ...adForm, id: adForm.id || `ad-${Date.now()}` } as AdConfig, AuthService.getToken()); setAdForm({ title: '', imageUrl: '', linkUrl: '#', position: 'home_middle', isActive: true }); refreshData(currentUserRole); }} className="space-y-4">
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Vị trí hiển thị</label>
                                        <select value={adForm.position} onChange={e => setAdForm({...adForm, position: e.target.value as any})} className="w-full bg-dark border border-white/10 rounded p-3 text-white mb-1">
                                            <option value="home_header">Trang chủ (Đầu trang)</option>
                                            <option value="home_middle">Trang chủ (Giữa)</option>
                                            <option value="home_bottom">Trang chủ (Cuối)</option>
                                            <option value="detail_sidebar">Chi tiết (Cột bên)</option>
                                            <option value="detail_bottom">Chi tiết (Cuối)</option>
                                            <option value="reader_top">Đọc truyện (Đầu)</option>
                                            <option value="reader_middle">Đọc truyện (Giữa các ảnh)</option>
                                            <option value="reader_bottom">Đọc truyện (Cuối)</option>
                                            <option value="reader_float_left">Đọc truyện (Trôi Trái)</option>
                                            <option value="reader_float_right">Đọc truyện (Trôi Phải)</option>
                                        </select>
                                        <p className="text-xs text-yellow-500 flex items-center gap-1">
                                            <Info size={12}/> {getAdSizeHint(adForm.position)}
                                        </p>
                                    </div>

                                    <input type="text" placeholder="Tiêu đề (tuỳ chọn)" value={adForm.title || ''} onChange={e => setAdForm({...adForm, title: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-3 text-white"/>
                                    
                                    <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Hình ảnh Banner</label>
                                        <div className="flex gap-2">
                                            <input type="text" placeholder="Link ảnh hoặc upload" required value={adForm.imageUrl || ''} onChange={e => setAdForm({...adForm, imageUrl: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-3 text-white"/>
                                            <button type="button" disabled={isUploading} onClick={() => adImageInputRef.current?.click()} className="bg-white/10 px-4 rounded text-white hover:bg-white/20">
                                                {isUploading ? <Loader className="animate-spin" size={18}/> : <Upload size={18}/>}
                                            </button>
                                            <input type="file" ref={adImageInputRef} className="hidden" onChange={handleUploadAdImage} accept="image/*" />
                                        </div>
                                        {adForm.imageUrl && <img src={adForm.imageUrl} className="mt-2 w-full h-24 object-contain bg-black/20 rounded border border-white/5" alt="Preview"/>}
                                    </div>

                                    <input type="text" placeholder="Link đích" value={adForm.linkUrl || ''} onChange={e => setAdForm({...adForm, linkUrl: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-3 text-white"/>
                                    
                                    <label className="flex items-center gap-2"><input type="checkbox" checked={adForm.isActive || false} onChange={e => setAdForm({...adForm, isActive: e.target.checked})}/> Kích hoạt</label>
                                    <button type="submit" className="w-full bg-primary text-white py-2 rounded font-bold">Lưu</button>
                                </form>
                            </div>
                        </div>
                        <div className="lg:col-span-2 space-y-4">
                            {ads.map(ad => (
                                <div key={ad.id} className="bg-card p-4 rounded-xl border border-white/10 flex items-start gap-4">
                                    <img src={ad.imageUrl} className="w-32 h-20 object-cover rounded bg-dark" />
                                    <div className="flex-1">
                                        <div className="font-bold text-white">{ad.title || 'Không tiêu đề'}</div>
                                        <div className="text-xs text-slate-500">Vị trí: {ad.position} • {ad.isActive ? <span className="text-green-400">Hiện</span> : <span className="text-red-400">Ẩn</span>}</div>
                                        <div className="text-xs text-blue-400 truncate">{ad.linkUrl}</div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button onClick={() => setAdForm(ad)} className="p-2 bg-white/5 rounded hover:bg-white/10"><Edit size={16}/></button>
                                        <button onClick={async () => { if(window.confirm('Xóa?')) { await DataProvider.deleteAd(ad.id, AuthService.getToken()); refreshData(currentUserRole); } }} className="p-2 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* 4. STATIC PAGES VIEW (Updated) */}
                {activeView === 'pages' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                         <div className="lg:col-span-2">
                            <div className="bg-card rounded-xl border border-white/10 p-6">
                                <h2 className="text-xl font-bold text-white mb-6">Editor Trang Tĩnh</h2>
                                <form onSubmit={async (e) => { e.preventDefault(); await DataProvider.saveStaticPage(staticPageForm as StaticPage); setStaticPageForm({title: '', slug: '', content: ''}); refreshData(currentUserRole); alert('Đã lưu!'); }} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="text" placeholder="Tiêu đề trang" required value={staticPageForm.title || ''} onChange={e => { const t = e.target.value; setStaticPageForm({...staticPageForm, title: t, slug: toSlug(t)}) }} className="bg-dark border border-white/10 rounded p-3 text-white"/>
                                        <input type="text" placeholder="Slug (URL)" required value={staticPageForm.slug || ''} onChange={e => setStaticPageForm({...staticPageForm, slug: e.target.value})} className="bg-dark border border-white/10 rounded p-3 text-white"/>
                                    </div>
                                    <SimpleEditor value={staticPageForm.content || ''} onChange={v => setStaticPageForm({...staticPageForm, content: v})} label="Nội dung trang" height="400px"/>
                                    {renderSEOFields(staticPageForm, setStaticPageForm)}
                                    <button type="submit" className="bg-primary text-white px-8 py-2 rounded font-bold">Lưu Trang</button>
                                </form>
                            </div>
                         </div>
                         <div className="lg:col-span-1 space-y-6">
                             {/* System Pages Section */}
                             <div>
                                 <h3 className="font-bold text-white mb-3 flex items-center gap-2"><FileText size={18}/> Trang Hệ Thống</h3>
                                 <div className="space-y-2">
                                     {SYSTEM_PAGES.map(sp => {
                                         const existing = staticPages.find(p => p.slug === sp.slug);
                                         return (
                                             <div key={sp.slug} className={`p-3 rounded-lg border flex justify-between items-center ${existing ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/10 border-dashed'}`}>
                                                 <div>
                                                     <div className={`font-bold ${existing ? 'text-green-400' : 'text-slate-400'}`}>{sp.title}</div>
                                                     <div className="text-[10px] text-slate-500">{sp.slug}</div>
                                                 </div>
                                                 <button 
                                                    onClick={() => {
                                                        if (existing) setStaticPageForm(existing);
                                                        else setStaticPageForm({ title: sp.title, slug: sp.slug, content: `<h2>${sp.title}</h2><p>Nội dung đang cập nhật...</p>` });
                                                    }}
                                                    className={`px-3 py-1 rounded text-xs font-bold ${existing ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-primary text-white hover:bg-primary/90'}`}
                                                 >
                                                     {existing ? 'Sửa' : 'Tạo nhanh'}
                                                 </button>
                                             </div>
                                         )
                                     })}
                                 </div>
                             </div>

                             {/* Other Pages Section */}
                             <div>
                                 <h3 className="font-bold text-white mb-3 flex items-center gap-2"><FilePlus size={18}/> Trang Khác</h3>
                                 <div className="space-y-2">
                                     {staticPages.filter(p => !SYSTEM_PAGES.some(sp => sp.slug === p.slug)).map(p => (
                                         <div key={p.slug} className="bg-card p-4 rounded-xl border border-white/10 group">
                                             <div className="flex justify-between items-start">
                                                 <div>
                                                     <div className="font-bold text-white">{p.title}</div>
                                                     <div className="text-xs text-slate-500 mb-2">/p/{p.slug}</div>
                                                 </div>
                                                 <button onClick={() => setStaticPageForm(p)} className="p-1.5 bg-white/5 rounded text-blue-400 hover:bg-white/10"><Edit size={14}/></button>
                                             </div>
                                         </div>
                                     ))}
                                     {staticPages.filter(p => !SYSTEM_PAGES.some(sp => sp.slug === p.slug)).length === 0 && (
                                         <p className="text-xs text-slate-500 italic">Chưa có trang tuỳ chỉnh nào.</p>
                                     )}
                                 </div>
                             </div>
                         </div>
                    </div>
                )}
                
                {/* 5. USERS VIEW (Was Missing) */}
                {activeView === 'users' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                             <div className="bg-card rounded-xl border border-white/10 p-6">
                                <h2 className="text-xl font-bold text-white mb-6">Quản lý Tài Khoản</h2>
                                <form onSubmit={async (e) => { e.preventDefault(); await DataProvider.saveUser(userForm as User, AuthService.getToken()); setUserForm({username: '', password: '', role: 'editor'}); setIsEditingUser(false); refreshData(currentUserRole); }} className="space-y-4">
                                    <input type="text" placeholder="Tên đăng nhập" required value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-3 text-white"/>
                                    <input type="text" placeholder="Mật khẩu (Để trống nếu không đổi)" required={!isEditingUser} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-3 text-white"/>
                                    <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})} className="w-full bg-dark border border-white/10 rounded p-3 text-white">
                                        <option value="editor">Biên tập viên (Editor)</option>
                                        <option value="admin">Quản trị viên (Admin)</option>
                                    </select>
                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 bg-primary text-white py-2 rounded font-bold">{isEditingUser ? 'Cập nhật' : 'Thêm mới'}</button>
                                        {isEditingUser && <button type="button" onClick={() => { setIsEditingUser(false); setUserForm({username:'', password:'', role: 'editor'}); }} className="px-4 py-2 bg-white/10 text-white rounded">Hủy</button>}
                                    </div>
                                </form>
                            </div>
                        </div>
                        <div className="space-y-3">
                            {users.map(u => (
                                <div key={u.id} className="bg-card p-4 rounded-xl border border-white/10 flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-white flex items-center gap-2">
                                            {u.username} 
                                            <span className={`text-[10px] px-2 py-0.5 rounded ${u.role==='admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>{u.role}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setUserForm({...u, password: ''}); setIsEditingUser(true); }} className="p-2 bg-white/5 rounded hover:bg-white/10"><Edit size={16}/></button>
                                        <button onClick={async () => { if(u.username !== 'admin' && window.confirm('Xóa?')) { await DataProvider.deleteUser(u.id, AuthService.getToken()); refreshData(currentUserRole); } }} disabled={u.username === 'admin'} className="p-2 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 disabled:opacity-50"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 6. SETTINGS VIEW (Updated with Menu Config) */}
                {activeView === 'settings' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                         <div className="bg-card rounded-xl border border-white/10 p-8">
                            <h2 className="text-2xl font-bold text-white mb-6">Cấu Hình Giao Diện</h2>
                            <form onSubmit={async (e) => { e.preventDefault(); await DataProvider.saveTheme(themeForm, AuthService.getToken()); alert('Đã lưu cấu hình!'); window.location.reload(); }} className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-400 border-b border-white/5 pb-2">Màu Sắc & Font</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs block text-slate-500 mb-1">Màu chủ đạo (Primary)</label><div className="flex gap-2"><input type="color" value={themeForm.primaryColor} onChange={e => setThemeForm({...themeForm, primaryColor: e.target.value})} className="h-10 w-10 rounded cursor-pointer bg-transparent"/><input type="text" value={themeForm.primaryColor} onChange={e => setThemeForm({...themeForm, primaryColor: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded px-2 text-white"/></div></div>
                                        <div><label className="text-xs block text-slate-500 mb-1">Màu phụ (Secondary)</label><div className="flex gap-2"><input type="color" value={themeForm.secondaryColor} onChange={e => setThemeForm({...themeForm, secondaryColor: e.target.value})} className="h-10 w-10 rounded cursor-pointer bg-transparent"/><input type="text" value={themeForm.secondaryColor} onChange={e => setThemeForm({...themeForm, secondaryColor: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded px-2 text-white"/></div></div>
                                    </div>
                                    <div><label className="text-xs block text-slate-500 mb-1">Font chữ</label><select value={themeForm.fontFamily} onChange={e => setThemeForm({...themeForm, fontFamily: e.target.value as any})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"><option value="sans">Không chân (Sans-serif)</option><option value="serif">Có chân (Serif)</option><option value="mono">Đơn không gian (Monospace)</option></select></div>
                                </div>
                                
                                <div className="space-y-4">
                                    <h3 className="font-bold text-slate-400 border-b border-white/5 pb-2">Bố cục Trang Chủ</h3>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-center gap-2"><input type="checkbox" checked={themeForm.homeLayout?.showSlider} onChange={e => setThemeForm({...themeForm, homeLayout: {...themeForm.homeLayout, showSlider: e.target.checked}})}/> Hiển thị Slider</label>
                                        <label className="flex items-center gap-2"><input type="checkbox" checked={themeForm.homeLayout?.showHot} onChange={e => setThemeForm({...themeForm, homeLayout: {...themeForm.homeLayout, showHot: e.target.checked}})}/> Hiển thị Truyện Hot</label>
                                        <label className="flex items-center gap-2"><input type="checkbox" checked={themeForm.homeLayout?.showNew} onChange={e => setThemeForm({...themeForm, homeLayout: {...themeForm.homeLayout, showNew: e.target.checked}})}/> Hiển thị Mới Cập Nhật</label>
                                    </div>
                                </div>

                                <SimpleEditor value={themeForm.footerContent || ''} onChange={v => setThemeForm({...themeForm, footerContent: v})} label="Nội dung Footer (HTML)" height="150px" />
                                
                                <button type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold shadow-lg">Lưu Cấu Hình</button>
                            </form>
                        </div>
                        
                        <div className="space-y-6">
                            {/* Menu Configuration */}
                            <div className="bg-card rounded-xl border border-white/10 p-8">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <MenuIcon size={20} className="text-blue-400"/> Cấu hình Menu Header
                                </h3>
                                
                                <div className="space-y-3 mb-6">
                                    {(!themeForm.headerMenu || themeForm.headerMenu.length === 0) && (
                                        <p className="text-slate-500 italic text-sm">Chưa có menu nào.</p>
                                    )}
                                    {themeForm.headerMenu?.map((item, index) => (
                                        <div key={index} className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                                            <div className="flex-1">
                                                <div className="font-bold text-white text-sm">{item.label}</div>
                                                <div className="text-xs text-slate-500">{item.url}</div>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => handleDeleteMenuItem(index)}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-dark p-4 rounded-lg border border-white/10">
                                    <h4 className="text-sm font-bold text-slate-300 mb-3">Thêm menu mới</h4>
                                    <div className="space-y-3">
                                        <input 
                                            type="text" 
                                            placeholder="Tên hiển thị (VD: Liên hệ)" 
                                            className="w-full bg-card border border-white/10 rounded p-2 text-white text-sm"
                                            value={newMenuItem.label}
                                            onChange={e => setNewMenuItem({...newMenuItem, label: e.target.value})}
                                        />
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="Đường dẫn (VD: /p/lien-he)" 
                                                className="flex-1 bg-card border border-white/10 rounded p-2 text-white text-sm"
                                                value={newMenuItem.url}
                                                onChange={e => setNewMenuItem({...newMenuItem, url: e.target.value})}
                                            />
                                            <button 
                                                type="button" 
                                                onClick={handleAddMenuItem}
                                                className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700"
                                            >
                                                <Plus size={18}/>
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500">
                                            Gợi ý: Dùng <code>/p/slug</code> cho trang tĩnh, <code>/categories</code> cho thể loại.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* SEO Settings */}
                            <div className="bg-card rounded-xl border border-white/10 p-8">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Globe className="text-blue-400" size={20} /> SEO Trang Chủ</h3>
                                <div className="space-y-4">
                                    <div><label className="text-sm text-slate-400 block mb-1">Meta Title</label><input type="text" value={themeForm.homeMetaTitle || ''} onChange={e => setThemeForm({...themeForm, homeMetaTitle: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm"/></div>
                                    <div><label className="text-sm text-slate-400 block mb-1">Meta Description</label><textarea value={themeForm.homeMetaDescription || ''} onChange={e => setThemeForm({...themeForm, homeMetaDescription: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm" rows={2}/></div>
                                    <div><label className="text-sm text-slate-400 block mb-1">Meta Keywords</label><input type="text" value={themeForm.homeMetaKeywords || ''} onChange={e => setThemeForm({...themeForm, homeMetaKeywords: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm"/></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. COMIC EDITOR (Already present, keeping structure intact) */}
                {(activeView === 'add-comic' || activeView === 'edit-comic') && (
                    <div className="bg-card rounded-xl border border-white/10 p-6 max-w-4xl mx-auto">
                        <h2 className="text-xl font-bold text-white mb-6">{editingComicId ? 'Sửa Truyện' : 'Thêm Truyện'}</h2>
                        <form onSubmit={handleSubmitComic} className="space-y-4">
                            {/* Improved Grid Layout */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Tên truyện</label>
                                    <input type="text" placeholder="Nhập tên truyện" required value={comicForm.title} onChange={handleTitleChange} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Tác giả</label>
                                        <input type="text" placeholder="Tên tác giả" value={comicForm.author} onChange={e => setComicForm({...comicForm, author: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/>
                                     </div>
                                     <div>
                                        <label className="text-xs text-slate-400 mb-1 block">Trạng thái</label>
                                        <select 
                                            value={comicForm.status} 
                                            onChange={e => setComicForm({...comicForm, status: e.target.value as any})}
                                            className="w-full bg-dark border border-white/10 rounded p-2 text-white appearance-none"
                                        >
                                            <option value="Đang tiến hành">Đang tiến hành</option>
                                            <option value="Hoàn thành">Hoàn thành</option>
                                        </select>
                                     </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                     <label className="text-xs text-slate-400 mb-1 block">Ảnh bìa</label>
                                     <div className="flex gap-2">
                                        <input type="text" placeholder="Link ảnh hoặc upload" value={comicForm.coverImage} onChange={e => setComicForm({...comicForm, coverImage: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white"/>
                                        <button type="button" disabled={isUploading} onClick={() => coverInputRef.current?.click()} className="bg-white/10 px-4 rounded text-white hover:bg-white/20">{isUploading ? <Loader className="animate-spin" size={18}/> : <Upload size={18}/>}</button>
                                        <input type="file" ref={coverInputRef} className="hidden" onChange={handleUploadCover} accept="image/*" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 mt-6">
                                    <label className="flex items-center gap-2 cursor-pointer bg-white/5 px-4 py-2 rounded hover:bg-white/10">
                                        <input type="checkbox" checked={comicForm.isRecommended} onChange={e => setComicForm({...comicForm, isRecommended: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                                        <span className="text-sm font-medium text-white">Đề xuất (Hot)</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Thể loại</label>
                                <div className="flex flex-wrap gap-2 p-3 bg-dark rounded border border-white/10 min-h-[50px]">
                                    {Array.isArray(genres) && genres.map(g => (
                                        <label key={g.id} className={`flex items-center gap-1 cursor-pointer px-3 py-1 rounded-full text-xs border transition-colors ${comicForm.genres?.includes(g.name) ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                                            <input type="checkbox" className="hidden" checked={comicForm.genres?.includes(g.name)} onChange={() => { const newG = comicForm.genres?.includes(g.name) ? comicForm.genres.filter(x=>x!==g.name) : [...(comicForm.genres||[]), g.name]; setComicForm({...comicForm, genres: newG}); }} />
                                            {comicForm.genres?.includes(g.name) && <CheckSquare size={12}/>}
                                            <span>{g.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <SimpleEditor value={comicForm.description || ''} onChange={v => setComicForm({...comicForm, description: v})} label="Mô tả" />
                            {renderSEOFields(comicForm, setComicForm)}
                            <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                                <button type="button" onClick={() => setActiveView('list')} className="px-6 py-2 text-slate-400 hover:text-white transition-colors">Hủy</button>
                                <button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-white px-8 py-2 rounded font-bold shadow-lg shadow-primary/20 flex items-center gap-2">
                                    <Save size={18}/> Lưu Truyện
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                
                {/* 8. CHAPTER MANAGER & EDITOR (Keeping existing structure) */}
                {activeView === 'manage-chapters' && currentComic && (
                    <div className="bg-card rounded-xl border border-white/10 p-6">
                         <div className="flex justify-between mb-4"><h2 className="text-xl font-bold text-white">Quản lý Chapter: {currentComic.title}</h2><div><button onClick={() => { setChapterForm({ title: `Chapter ${(currentComic.chapters?.length||0)+1}`, number: (currentComic.chapters?.length||0)+1 }); setChapterPages([]); setEditingChapterId(null); setActiveView('edit-chapter'); }} className="bg-green-600 text-white px-4 py-2 rounded mr-2">Thêm Mới</button><button onClick={() => setActiveView('list')} className="bg-white/10 text-white px-4 py-2 rounded">Quay lại</button></div></div>
                         <table className="w-full text-left text-slate-300">
                             <thead><tr><th className="p-2">Tên</th><th className="p-2">Ngày</th><th className="p-2 text-right">Hành động</th></tr></thead>
                             <tbody>
                                 {currentComic.chapters?.map(c => (
                                     <tr key={c.id} className="hover:bg-white/5">
                                         <td className="p-2">{c.title}</td><td className="p-2 text-xs">{new Date(c.updatedAt).toLocaleDateString()}</td>
                                         <td className="p-2 text-right">
                                             <button onClick={async () => { setEditingChapterId(c.id); setChapterForm({title: c.title, number: c.number}); setChapterPages(await DataProvider.getChapterPages(c.id)); setActiveView('edit-chapter'); }} className="text-blue-400 mr-2"><Edit size={16}/></button>
                                             <button onClick={async () => { if(window.confirm('Xóa?')) { await DataProvider.deleteChapter(c.id, AuthService.getToken()); setCurrentComic(await DataProvider.getComicById(currentComic.id) || null); } }} className="text-red-400"><Trash2 size={16}/></button>
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                    </div>
                )}

                {activeView === 'edit-chapter' && currentComic && (
                    <div className="bg-card rounded-xl border border-white/10 p-6">
                        <h2 className="text-xl font-bold text-white mb-6">Editor Chapter</h2>
                        <form onSubmit={async (e) => { e.preventDefault(); setIsSaving(true); await DataProvider.saveChapter({ id: editingChapterId || `${currentComic.id}-ch-${Date.now()}`, comicId: currentComic.id, title: chapterForm.title, number: chapterForm.number, updatedAt: new Date().toISOString() }, chapterPages, AuthService.getToken()); setIsSaving(false); setCurrentComic(await DataProvider.getComicById(currentComic.id) || null); setActiveView('manage-chapters'); }} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4"><input type="text" required value={chapterForm.title} onChange={e => setChapterForm({...chapterForm, title: e.target.value})} className="bg-dark border border-white/10 rounded p-2 text-white"/><input type="number" required value={chapterForm.number} onChange={e => setChapterForm({...chapterForm, number: parseFloat(e.target.value)})} className="bg-dark border border-white/10 rounded p-2 text-white"/></div>
                            <div className="border-t border-white/10 pt-4">
                                <div className="flex gap-4 mb-4"><button type="button" disabled={isUploading} onClick={() => pagesInputRef.current?.click()} className="bg-primary text-white px-4 py-2 rounded">{isUploading ? 'Đang tải...' : 'Upload Ảnh'}</button><input type="file" ref={pagesInputRef} multiple accept="image/*" className="hidden" onChange={async (e) => { if(e.target.files) { setIsUploading(true); const newP = []; for(let i=0; i<e.target.files.length; i++) { try { const url = await DataProvider.uploadImage(e.target.files[i]); newP.push({ imageUrl: url, pageNumber: chapterPages.length + i + 1 }); } catch(err){} } setChapterPages([...chapterPages, ...newP]); setIsUploading(false); } }} /></div>
                                <div className="grid grid-cols-6 gap-2">{chapterPages.map((p, i) => (<div key={i} className="relative group"><img src={p.imageUrl} className="w-full h-32 object-cover rounded"/><button type="button" onClick={() => setChapterPages(chapterPages.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100"><X size={12}/></button></div>))}</div>
                            </div>
                            <div className="flex justify-end gap-2"><button type="button" onClick={() => setActiveView('manage-chapters')} className="px-4 py-2 text-slate-400">Hủy</button><button type="submit" disabled={isSaving} className="bg-primary text-white px-6 py-2 rounded font-bold">Lưu</button></div>
                        </form>
                    </div>
                )}
            </>
            )}
        </div>
    </div>
  );
};

export default Admin;
