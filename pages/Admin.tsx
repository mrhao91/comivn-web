
import React, { useEffect, useState, useRef } from 'react';
import { DataProvider } from '../services/dataProvider';
import { Comic, Genre, Chapter, Page, AdConfig, Comment, StaticPage, ThemeConfig, User } from '../types';
import { Plus, Trash2, Edit, Save, X, LayoutDashboard, Image as ImageIcon, Tags, Book, List, Upload, LogOut, Home, MonitorPlay, MessageSquare, FileText, CheckCircle, XCircle, Settings, Palette, Globe, Users, ShieldAlert, Eye, Loader } from 'lucide-react';
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
      homeLayout: { showSlider: true, showHot: true, showNew: true }, siteName: 'ComiVN'
  };
  const [themeForm, setThemeForm] = useState<ThemeConfig>(defaultTheme);
  const [userForm, setUserForm] = useState<{id?: string|number, username: string, password: string, role: string}>({ username: '', password: '', role: 'editor' });
  const [isEditingUser, setIsEditingUser] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const pagesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const role = AuthService.getRole();
    const user = AuthService.getUser();
    setCurrentUserRole(role);
    if(user) setCurrentUsername(user.username);
    
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
        if(activeView === 'settings') { try { const t = await DataProvider.getTheme(); setThemeForm({ ...defaultTheme, ...(t || {}) }); } catch(e){} }
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
  
  const handleSubmitComic = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSaving(true);
    const newComic: Comic = {
      id: editingComicId || `comic-${Date.now()}`,
      title: comicForm.title || 'No Title', 
      slug: comicForm.slug || toSlug(comicForm.title || ''),
      coverImage: comicForm.coverImage || '', author: comicForm.author || '', status: comicForm.status as any, genres: comicForm.genres || [], description: comicForm.description || '', views: comicForm.views || 0,
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
                
                {/* 1. COMIC LIST (Safe Rendering) */}
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
                                        <td className="p-4"><span className="text-xs px-2 py-1 rounded bg-white/10">{c.status}</span></td>
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

                {/* 2. GENRES LIST (Safe Rendering) */}
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

                {/* 3. COMIC EDITOR (ADD/EDIT) */}
                {(activeView === 'add-comic' || activeView === 'edit-comic') && (
                    <div className="bg-card rounded-xl border border-white/10 p-6 max-w-4xl mx-auto">
                        <h2 className="text-xl font-bold text-white mb-6">{editingComicId ? 'Sửa Truyện' : 'Thêm Truyện'}</h2>
                        <form onSubmit={handleSubmitComic} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input type="text" placeholder="Tên truyện" required value={comicForm.title} onChange={handleTitleChange} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/>
                                <input type="text" placeholder="Tác giả" value={comicForm.author} onChange={e => setComicForm({...comicForm, author: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/>
                            </div>
                            <div className="flex gap-2">
                                <input type="text" placeholder="Link ảnh bìa (hoặc upload)" value={comicForm.coverImage} onChange={e => setComicForm({...comicForm, coverImage: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white"/>
                                <button type="button" disabled={isUploading} onClick={() => coverInputRef.current?.click()} className="bg-white/10 px-4 rounded text-white">{isUploading ? <Loader className="animate-spin"/> : <Upload/>}</button>
                                <input type="file" ref={coverInputRef} className="hidden" onChange={handleUploadCover} accept="image/*" />
                            </div>
                            <div className="flex flex-wrap gap-2 p-2 bg-dark rounded border border-white/10">
                                {Array.isArray(genres) && genres.map(g => (
                                    <label key={g.id} className="flex items-center gap-1 cursor-pointer">
                                        <input type="checkbox" checked={comicForm.genres?.includes(g.name)} onChange={() => { const newG = comicForm.genres?.includes(g.name) ? comicForm.genres.filter(x=>x!==g.name) : [...(comicForm.genres||[]), g.name]; setComicForm({...comicForm, genres: newG}); }} />
                                        <span className="text-sm text-slate-300">{g.name}</span>
                                    </label>
                                ))}
                            </div>
                            <SimpleEditor value={comicForm.description || ''} onChange={v => setComicForm({...comicForm, description: v})} label="Mô tả" />
                            {renderSEOFields(comicForm, setComicForm)}
                            <div className="flex justify-end gap-2"><button type="button" onClick={() => setActiveView('list')} className="px-4 py-2 text-slate-400">Hủy</button><button type="submit" disabled={isSaving} className="bg-primary text-white px-6 py-2 rounded font-bold">Lưu</button></div>
                        </form>
                    </div>
                )}
                
                {/* 4. CHAPTER MANAGER (Safe Rendering) */}
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

                {/* 5. CHAPTER EDITOR (Safe Rendering) */}
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
