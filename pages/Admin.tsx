
import React, { useEffect, useState, useRef } from 'react';
import { DataProvider } from '../services/dataProvider';
import { Comic, Genre, AdConfig, User, ThemeConfig, Report, StaticPage, Chapter, Page, MediaFile } from '../types';
import SimpleEditor from '../components/SimpleEditor';
import { Plus, Trash2, Edit, Save, LayoutDashboard, Book, Users, FileText, Settings, Image as ImageIcon, MessageSquare, AlertTriangle, Check, X, RefreshCw, Upload, Globe, Database, Link as LinkIcon, Menu, List, Copy, FolderOpen } from 'lucide-react';
import { summarizeComic } from '../services/geminiService';
import { DEFAULT_THEME, SEED_STATIC_PAGES } from '../services/seedData';

const Admin: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'comics' | 'genres' | 'settings' | 'users' | 'ads' | 'reports' | 'static' | 'media'>('comics');
    const [loading, setLoading] = useState(false);
    
    // Data States
    const [comics, setComics] = useState<Comic[]>([]);
    const [genres, setGenres] = useState<Genre[]>([]);
    const [ads, setAds] = useState<AdConfig[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [reports, setReports] = useState<Report[]>([]);
    const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]); // New state for Media
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(DEFAULT_THEME);

    // Form States
    const [isEditing, setIsEditing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chapterInputRef = useRef<HTMLInputElement>(null);
    const mediaInputRef = useRef<HTMLInputElement>(null); // New Ref for Media Tab
    
    // Comic Form
    const [comicForm, setComicForm] = useState<Comic>({
        id: '', title: '', coverImage: '', author: '', status: 'Đang tiến hành', genres: [], description: '', views: 0, chapters: [], isRecommended: false
    });

    // Chapter Form
    const [isEditingChapter, setIsEditingChapter] = useState(false);
    const [chapterForm, setChapterForm] = useState<{id: string, title: string, number: number, pagesContent: string}>({
        id: '', title: '', number: 0, pagesContent: ''
    });

    // Genre Form
    const [genreForm, setGenreForm] = useState<Genre>({ id: '', name: '', slug: '', isShowHome: false });
    
    // Ad Form
    const [adForm, setAdForm] = useState<AdConfig>({ id: '', position: 'home_middle', imageUrl: '', linkUrl: '', isActive: true, title: '' });

    // User Form
    const [userForm, setUserForm] = useState<User>({ id: 0, username: '', password: '', role: 'editor' });

    // Static Page Form
    const [staticForm, setStaticForm] = useState<StaticPage>({ slug: '', title: '', content: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [c, g, a, u, r, t, s, m] = await Promise.all([
                DataProvider.getComics(),
                DataProvider.getGenres(),
                DataProvider.getAds(),
                DataProvider.getUsers(),
                DataProvider.getReports(),
                DataProvider.getTheme(),
                DataProvider.getStaticPages(),
                DataProvider.getMedia()
            ]);
            setComics(c);
            setGenres(g);
            setAds(a);
            setUsers(u);
            setReports(r);
            setMediaFiles(m); // Set media files
            
            // Merge with default to ensure structure exists
            setThemeConfig({
                ...DEFAULT_THEME,
                ...t,
                headerMenu: t.headerMenu || DEFAULT_THEME.headerMenu || [],
                footerMenu: t.footerMenu || DEFAULT_THEME.footerMenu || [],
                footerContent: t.footerContent || ''
            });
            
            setStaticPages(s);
        } catch (error) {
            console.error("Load data failed", error);
        } finally {
            setLoading(false);
        }
    };

    // --- UPLOAD HELPER ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: 'comic' | 'ad') => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            try {
                const url = await DataProvider.uploadImage(e.target.files[0]);
                if (url) {
                    if (targetField === 'comic') {
                        setComicForm(prev => ({ ...prev, coverImage: url }));
                    } else if (targetField === 'ad') {
                        setAdForm(prev => ({ ...prev, imageUrl: url }));
                    }
                } else {
                    alert("Upload thất bại. Vui lòng kiểm tra lại server.");
                }
            } catch (error) {
                console.error(error);
                alert("Lỗi khi upload ảnh.");
            } finally {
                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const handleChapterImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setUploading(true);
            try {
                const newUrls: string[] = [];
                for (let i = 0; i < e.target.files.length; i++) {
                    const file = e.target.files[i];
                    const url = await DataProvider.uploadImage(file);
                    if (url) newUrls.push(url);
                }
                
                setChapterForm(prev => ({
                    ...prev,
                    pagesContent: prev.pagesContent + (prev.pagesContent ? '\n' : '') + newUrls.join('\n')
                }));
            } catch (error) {
                console.error(error);
                alert("Lỗi khi upload ảnh chapter.");
            } finally {
                setUploading(false);
                if (chapterInputRef.current) chapterInputRef.current.value = '';
            }
        }
    };

    // --- MEDIA TAB LOGIC ---
    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setUploading(true);
            try {
                // Upload sequentially
                for (let i = 0; i < e.target.files.length; i++) {
                    await DataProvider.uploadImage(e.target.files[i]);
                }
                // Reload media list
                const m = await DataProvider.getMedia();
                setMediaFiles(m);
            } catch (error) {
                console.error(error);
                alert("Lỗi khi upload ảnh vào thư viện.");
            } finally {
                setUploading(false);
                if (mediaInputRef.current) mediaInputRef.current.value = '';
            }
        }
    };

    const handleDeleteMedia = async (fileName: string) => {
        if (window.confirm(`Bạn có chắc muốn xóa file: ${fileName}? Hành động này không thể hoàn tác.`)) {
            const success = await DataProvider.deleteMedia(fileName);
            if (success) {
                const m = await DataProvider.getMedia();
                setMediaFiles(m);
            } else {
                alert("Xóa thất bại (File có thể không tồn tại hoặc lỗi quyền).");
            }
        }
    };

    const copyToClipboard = (text: string) => {
        // Resolve absolute URL if needed, but usually relative URL from DataProvider is enough for <img> src
        // But for admin usage, let's provide the full URL if it starts with /
        let urlToCopy = text;
        if (text.startsWith('/')) {
            urlToCopy = `${window.location.origin}${text}`;
        }
        
        navigator.clipboard.writeText(urlToCopy).then(() => {
            alert("Đã copy link ảnh!");
        }).catch(err => {
            console.error('Could not copy text: ', err);
        });
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // --- COMIC LOGIC ---
    const handleStartEdit = async (comicId: string) => {
        setLoading(true);
        // Clear previous state first to show empty form/loader
        setComicForm({ id: '', title: '', coverImage: '', author: '', status: 'Đang tiến hành', genres: [], description: '', views: 0, chapters: [], isRecommended: false });
        
        try {
            // Lấy dữ liệu chi tiết đầy đủ (bao gồm full chapters) thay vì dùng dữ liệu list
            const fullComic = await DataProvider.getComicById(comicId);
            if (fullComic) {
                setComicForm(fullComic);
                setIsEditing(true);
            } else {
                alert("Không tìm thấy thông tin truyện.");
            }
        } catch (error) {
            console.error("Error fetching comic details:", error);
            alert("Lỗi khi tải thông tin truyện.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveComic = async () => {
        const id = comicForm.id || `comic-${Date.now()}`;
        // Auto slug generation if empty
        let slug = comicForm.slug;
        if (!slug && comicForm.title) {
            slug = comicForm.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
        }
        
        const newComic = { ...comicForm, id, slug };
        await DataProvider.saveComic(newComic);
        setIsEditing(false);
        loadData();
    };
    const handleDeleteComic = async (id: string) => {
        if(window.confirm('Xóa truyện này?')) { await DataProvider.deleteComic(id); loadData(); }
    };
    const handleAutoSummarize = async () => {
        if (!comicForm.title || !comicForm.description) { alert("Cần nhập tên và mô tả trước."); return; }
        const summary = await summarizeComic(comicForm.title, comicForm.description);
        setComicForm({...comicForm, description: summary});
    };

    // --- CHAPTER LOGIC ---
    const handleEditChapter = async (chapter: Chapter) => {
        setLoading(true);
        const pages = await DataProvider.getChapterPages(chapter.id);
        setChapterForm({
            id: chapter.id,
            title: chapter.title,
            number: chapter.number,
            pagesContent: pages.map(p => p.imageUrl).join('\n')
        });
        setIsEditingChapter(true);
        setLoading(false);
    };

    const handleAddChapter = () => {
        // Auto calculate next chapter number
        const nextNum = comicForm.chapters.length > 0 ? Math.max(...comicForm.chapters.map(c => c.number)) + 1 : 1;
        setChapterForm({
            id: '',
            title: `Chapter ${nextNum}`,
            number: nextNum,
            pagesContent: ''
        });
        setIsEditingChapter(true);
    };

    // Chức năng thêm nhanh Chapter từ danh sách truyện
    const handleQuickAddChapter = async (comicId: string) => {
        setLoading(true);
        try {
            const fullComic = await DataProvider.getComicById(comicId);
            if(fullComic) {
                setComicForm(fullComic);
                setIsEditing(true);
                const nextNum = fullComic.chapters && fullComic.chapters.length > 0 ? Math.max(...fullComic.chapters.map(c => c.number)) + 1 : 1;
                setChapterForm({
                    id: '',
                    title: `Chapter ${nextNum}`,
                    number: nextNum,
                    pagesContent: ''
                });
                setIsEditingChapter(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSaveChapter = async () => {
        if (!comicForm.id) {
            alert("Vui lòng lưu truyện trước khi thêm chapter.");
            return;
        }

        setUploading(true);
        const chapterId = chapterForm.id || `${comicForm.id}-chapter-${Date.now()}`;
        const pages: Page[] = chapterForm.pagesContent.split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map((url, idx) => ({ imageUrl: url, pageNumber: idx + 1 }));

        const newChapter: Chapter = {
            id: chapterId,
            comicId: comicForm.id,
            number: chapterForm.number,
            title: chapterForm.title,
            updatedAt: new Date().toISOString()
        };

        await DataProvider.saveChapter(newChapter, pages);
        
        // Reload comic details (specifically chapters)
        const updatedComic = await DataProvider.getComicById(comicForm.id);
        if (updatedComic) {
            setComicForm(updatedComic);
        }
        
        setUploading(false);
        setIsEditingChapter(false);
    };

    const handleDeleteChapter = async (id: string) => {
        if(window.confirm('Xóa chapter này?')) { 
            await DataProvider.deleteChapter(id, comicForm.id);
            const updatedComic = await DataProvider.getComicById(comicForm.id);
            if (updatedComic) setComicForm(updatedComic);
        }
    };


    // --- GENRE LOGIC ---
    const handleSaveGenre = async () => {
        const id = genreForm.id || `g-${Date.now()}`;
        const slug = genreForm.slug || genreForm.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
        await DataProvider.saveGenre({ ...genreForm, id, slug });
        setGenreForm({ id: '', name: '', slug: '', isShowHome: false });
        loadData();
    };
    const handleDeleteGenre = async (id: string) => {
        if(window.confirm('Xóa thể loại này?')) { await DataProvider.deleteGenre(id); loadData(); }
    };

    // --- AD LOGIC ---
    const handleSaveAd = async () => {
        const id = adForm.id || `ad-${Date.now()}`;
        await DataProvider.saveAd({ ...adForm, id });
        setAdForm({ id: '', position: 'home_middle', imageUrl: '', linkUrl: '', isActive: true, title: '' });
        loadData();
    };
    const handleDeleteAd = async (id: string) => {
        if(window.confirm('Xóa quảng cáo này?')) { await DataProvider.deleteAd(id); loadData(); }
    };

    // --- USER LOGIC ---
    const handleSaveUser = async () => {
        await DataProvider.saveUser(userForm);
        setUserForm({ id: 0, username: '', password: '', role: 'editor' });
        loadData();
    };
    const handleDeleteUser = async (id: string | number) => {
        if(window.confirm('Xóa thành viên này?')) { await DataProvider.deleteUser(id); loadData(); }
    };

    // --- THEME LOGIC ---
    const handleSaveTheme = async () => {
        await DataProvider.saveTheme(themeConfig);
        alert("Đã lưu cấu hình giao diện!");
        // Reload page to apply changes
        window.location.reload();
    };

    // Helper functions for Menu Management
    const addMenuItem = () => {
        const currentMenu = themeConfig.headerMenu || [];
        setThemeConfig({
            ...themeConfig,
            headerMenu: [...currentMenu, { label: 'Menu Mới', url: '/' }]
        });
    };

    const updateMenuItem = (index: number, field: 'label' | 'url', value: string) => {
        const currentMenu = [...(themeConfig.headerMenu || [])];
        if (currentMenu[index]) {
            currentMenu[index] = { ...currentMenu[index], [field]: value };
            setThemeConfig({ ...themeConfig, headerMenu: currentMenu });
        }
    };

    const removeMenuItem = (index: number) => {
        const currentMenu = [...(themeConfig.headerMenu || [])];
        currentMenu.splice(index, 1);
        setThemeConfig({ ...themeConfig, headerMenu: currentMenu });
    };

    // Helper functions for Footer Menu
    const addFooterMenuItem = () => {
        const currentMenu = themeConfig.footerMenu || [];
        setThemeConfig({
            ...themeConfig,
            footerMenu: [...currentMenu, { label: 'Link Mới', url: '/' }]
        });
    };

    const updateFooterMenuItem = (index: number, field: 'label' | 'url', value: string) => {
        const currentMenu = [...(themeConfig.footerMenu || [])];
        if (currentMenu[index]) {
            currentMenu[index] = { ...currentMenu[index], [field]: value };
            setThemeConfig({ ...themeConfig, footerMenu: currentMenu });
        }
    };

    const removeFooterMenuItem = (index: number) => {
        const currentMenu = [...(themeConfig.footerMenu || [])];
        currentMenu.splice(index, 1);
        setThemeConfig({ ...themeConfig, footerMenu: currentMenu });
    };

    // --- STATIC PAGES LOGIC ---
    const handleSaveStatic = async () => {
        await DataProvider.saveStaticPage(staticForm);
        setStaticForm({ slug: '', title: '', content: '' });
        loadData();
    };

    const handleSeedStaticPages = async () => {
        if(window.confirm('Bạn có chắc chắn muốn tạo các trang mẫu (Điều khoản, Liên hệ, v.v.) không?')) {
            for (const page of SEED_STATIC_PAGES) {
                await DataProvider.saveStaticPage(page);
            }
            loadData();
            alert("Đã tạo xong!");
        }
    };

    // --- REPORT LOGIC ---
    const handleDeleteReport = async (id: string) => {
         if(window.confirm('Xóa báo cáo này?')) { await DataProvider.deleteReport(id); loadData(); }
    };


    // === RENDER TABS ===

    const renderComicsTab = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Quản lý Truyện</h2>
                {!isEditing && (
                    <button onClick={() => {
                        setComicForm({ id: '', title: '', coverImage: '', author: '', status: 'Đang tiến hành', genres: [], description: '', views: 0, chapters: [], isRecommended: false });
                        setIsEditing(true);
                    }} className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium">
                        <Plus size={18} /> Thêm Truyện
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="bg-card border border-white/10 p-6 rounded-xl animate-in fade-in">
                    {/* Comic Info Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Tên truyện</label>
                            <input type="text" value={comicForm.title} onChange={e => setComicForm({...comicForm, title: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white focus:border-primary outline-none"/>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Tác giả</label>
                            <input type="text" value={comicForm.author} onChange={e => setComicForm({...comicForm, author: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white focus:border-primary outline-none"/>
                        </div>
                        <div>
                             <label className="text-xs text-slate-400 mb-1 block">Ảnh bìa</label>
                             <div className="flex gap-2">
                                <input type="text" value={comicForm.coverImage} onChange={e => setComicForm({...comicForm, coverImage: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white focus:border-primary outline-none" placeholder="Nhập URL hoặc upload"/>
                                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-white flex items-center gap-2 text-sm font-medium transition-colors">
                                    <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={(e) => handleFileUpload(e, 'comic')} />
                                    {uploading && fileInputRef.current ? <RefreshCw size={16} className="animate-spin"/> : <Upload size={16}/>}
                                    Upload
                                </label>
                             </div>
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className="text-xs text-slate-400 mb-1 block">Trạng thái</label>
                                <select value={comicForm.status} onChange={e => setComicForm({...comicForm, status: e.target.value as any})} className="w-full bg-dark border border-white/10 rounded p-2 text-white">
                                    <option value="Đang tiến hành">Đang tiến hành</option>
                                    <option value="Hoàn thành">Hoàn thành</option>
                                </select>
                             </div>
                             <div>
                                <label className="text-xs text-slate-400 mb-1 block">Views</label>
                                <input type="number" value={comicForm.views} onChange={e => setComicForm({...comicForm, views: parseInt(e.target.value) || 0})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/>
                             </div>
                        </div>
                    </div>
                    
                    <div className="mb-4">
                        <label className="text-xs text-slate-400 mb-1 block">Thể loại</label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-dark rounded border border-white/10">
                            {genres.map(g => (
                                <label key={g.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white">
                                    <input 
                                        type="checkbox" 
                                        checked={comicForm.genres.includes(g.name)}
                                        onChange={e => {
                                            const newGenres = e.target.checked ? [...comicForm.genres, g.name] : comicForm.genres.filter(name => name !== g.name);
                                            setComicForm({...comicForm, genres: newGenres});
                                        }}
                                        className="accent-primary"
                                    />
                                    {g.name}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-slate-400">Mô tả</label>
                            <button type="button" onClick={handleAutoSummarize} className="text-xs text-primary hover:underline flex items-center gap-1">✨ AI Tóm tắt</button>
                        </div>
                        <SimpleEditor value={comicForm.description} onChange={val => setComicForm({...comicForm, description: val})} height="150px"/>
                    </div>

                    {/* Action Buttons for Comic */}
                    <div className="flex justify-end gap-3 border-b border-white/10 pb-6 mb-6">
                        <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg bg-white/5 text-slate-300">Hủy</button>
                        <button onClick={handleSaveComic} className="px-4 py-2 rounded-lg bg-primary text-white font-bold flex items-center gap-2"><Save size={18} /> Lưu Truyện</button>
                    </div>

                    {/* CHAPTERS MANAGEMENT SECTION */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <List size={18}/> Danh sách Chapter
                                <button onClick={async (e) => {
                                    e.preventDefault();
                                    if(comicForm.id) {
                                        const updated = await DataProvider.getComicById(comicForm.id);
                                        if(updated) setComicForm(updated);
                                    }
                                }} className="ml-2 p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title="Làm mới">
                                    <RefreshCw size={14}/>
                                </button>
                            </h3>
                            <button onClick={handleAddChapter} disabled={!comicForm.id} className="text-sm bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-3 py-1.5 rounded flex items-center gap-2">
                                <Plus size={16}/> Thêm Chapter
                            </button>
                        </div>
                        
                        {!comicForm.id && (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded text-sm text-center">
                                Vui lòng lưu truyện trước khi thêm chapter.
                            </div>
                        )}

                        <div className="bg-dark border border-white/10 rounded overflow-hidden max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white/5 text-xs text-slate-400 uppercase sticky top-0 backdrop-blur-sm z-10">
                                    <tr>
                                        <th className="p-3">Tên Chapter</th>
                                        <th className="p-3">Số</th>
                                        <th className="p-3">Ngày đăng</th>
                                        <th className="p-3 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {(comicForm.chapters || []).map(chap => (
                                        <tr key={chap.id} className="hover:bg-white/5 text-slate-300">
                                            <td className="p-3 font-medium text-white">{chap.title}</td>
                                            <td className="p-3">{chap.number}</td>
                                            <td className="p-3 text-xs">{new Date(chap.updatedAt).toLocaleDateString()}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleEditChapter(chap)} className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded"><Edit size={14}/></button>
                                                    <button onClick={() => handleDeleteChapter(chap.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded"><Trash2 size={14}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!comicForm.chapters || comicForm.chapters.length === 0) && (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-500">Chưa có chapter nào.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                // Comic List Table
                <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-white/5 text-xs uppercase text-slate-400">
                            <tr><th className="p-3">Truyện</th><th className="p-3">Trạng thái</th><th className="p-3">Views</th><th className="p-3 text-right">Thao tác</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {comics.map(c => (
                                <tr key={c.id} className="hover:bg-white/5">
                                    <td className="p-3 font-medium text-white flex items-center gap-3">
                                        <img src={c.coverImage} className="w-8 h-12 object-cover rounded" alt=""/>
                                        <div>
                                            <div className="line-clamp-1">{c.title}</div>
                                            <div className="text-xs text-slate-500">{c.chapters?.length || 0} chương</div>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded text-xs ${c.status === 'Hoàn thành' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="p-3">{c.views.toLocaleString()}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            {/* Quick Add Chapter Button */}
                                            <button onClick={() => handleQuickAddChapter(c.id)} className="p-1.5 hover:bg-green-500/20 text-green-400 rounded" title="Thêm Chapter Nhanh"><Plus size={16}/></button>
                                            <button onClick={() => handleStartEdit(c.id)} className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded"><Edit size={16}/></button>
                                            <button onClick={() => handleDeleteComic(c.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MODAL EDIT CHAPTER */}
            {isEditingChapter && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-card border border-white/10 w-full max-w-2xl rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b border-white/10">
                            <h3 className="text-lg font-bold text-white">
                                {chapterForm.id ? 'Sửa Chapter' : 'Thêm Chapter Mới'}
                            </h3>
                            <button onClick={() => setIsEditingChapter(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Số thứ tự (Order)</label>
                                    <input type="number" value={chapterForm.number} onChange={e => setChapterForm({...chapterForm, number: parseFloat(e.target.value)})} className="w-full bg-dark border border-white/10 rounded p-2 text-white focus:border-primary outline-none"/>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 mb-1 block">Tên hiển thị</label>
                                    <input type="text" value={chapterForm.title} onChange={e => setChapterForm({...chapterForm, title: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white focus:border-primary outline-none"/>
                                </div>
                            </div>
                            
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs text-slate-400">Danh sách ảnh (Mỗi dòng 1 link)</label>
                                    <label className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded cursor-pointer flex items-center gap-1 transition-colors">
                                        <input 
                                            type="file" 
                                            multiple 
                                            accept="image/*" 
                                            className="hidden" 
                                            ref={chapterInputRef}
                                            onChange={handleChapterImagesUpload}
                                        />
                                        {uploading && chapterInputRef.current ? <RefreshCw size={12} className="animate-spin"/> : <Upload size={12}/>}
                                        Upload Nhiều Ảnh
                                    </label>
                                </div>
                                <textarea 
                                    value={chapterForm.pagesContent} 
                                    onChange={e => setChapterForm({...chapterForm, pagesContent: e.target.value})}
                                    className="w-full h-64 bg-dark border border-white/10 rounded p-2 text-white text-xs font-mono focus:border-primary outline-none whitespace-pre"
                                    placeholder="https://example.com/page1.jpg&#10;https://example.com/page2.jpg"
                                ></textarea>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    * Mẹo: Bạn có thể copy link ảnh từ nơi khác và paste vào đây.
                                </p>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsEditingChapter(false)} className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10">Hủy bỏ</button>
                                <button onClick={handleSaveChapter} disabled={uploading} className="px-4 py-2 rounded-lg bg-primary text-white font-bold flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50">
                                    {uploading ? 'Đang tải lên...' : <><Save size={18}/> Lưu Chapter</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderGenresTab = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-4">
                <div className="bg-card border border-white/10 p-5 rounded-xl">
                    <h3 className="font-bold text-white mb-4">{genreForm.id ? 'Sửa thể loại' : 'Thêm thể loại'}</h3>
                    <div className="space-y-3">
                        <input type="text" placeholder="Tên thể loại" value={genreForm.name} onChange={e => setGenreForm({...genreForm, name: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary"/>
                        <input type="text" placeholder="Slug (Tùy chọn)" value={genreForm.slug} onChange={e => setGenreForm({...genreForm, slug: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary"/>
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input type="checkbox" checked={genreForm.isShowHome} onChange={e => setGenreForm({...genreForm, isShowHome: e.target.checked})} className="accent-primary"/>
                            Hiển thị ngoài trang chủ
                        </label>
                        <div className="flex gap-2">
                             <button onClick={handleSaveGenre} className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded font-medium">Lưu</button>
                             {genreForm.id && <button onClick={() => setGenreForm({id:'', name:'', slug:'', isShowHome:false})} className="px-3 bg-white/10 hover:bg-white/20 text-white rounded">Hủy</button>}
                        </div>
                    </div>
                </div>
            </div>
            <div className="md:col-span-2">
                <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-white/5 text-xs uppercase text-slate-400">
                            <tr><th className="p-3">Tên</th><th className="p-3">Slug</th><th className="p-3">Trang chủ</th><th className="p-3 text-right">Thao tác</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {genres.map(g => (
                                <tr key={g.id} className="hover:bg-white/5">
                                    <td className="p-3 font-medium text-white">{g.name}</td>
                                    <td className="p-3 text-slate-500">{g.slug}</td>
                                    <td className="p-3">{g.isShowHome ? <Check size={16} className="text-green-500"/> : <X size={16} className="text-slate-600"/>}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setGenreForm(g)} className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded"><Edit size={16}/></button>
                                            <button onClick={() => handleDeleteGenre(g.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderAdsTab = () => (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                 <div className="bg-card border border-white/10 p-5 rounded-xl sticky top-4">
                    <h3 className="font-bold text-white mb-4">{adForm.id ? 'Sửa quảng cáo' : 'Thêm quảng cáo'}</h3>
                    <div className="space-y-3">
                        <input type="text" placeholder="Tiêu đề (Ghi nhớ)" value={adForm.title || ''} onChange={e => setAdForm({...adForm, title: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary"/>
                        <select value={adForm.position} onChange={e => setAdForm({...adForm, position: e.target.value as any})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary">
                            <option value="home_header">Home Header (Trên cùng)</option>
                            <option value="home_middle">Home Middle (Giữa danh sách)</option>
                            <option value="home_bottom">Home Bottom (Cuối trang)</option>
                            <option value="detail_sidebar">Detail Sidebar (Cột phải)</option>
                            <option value="reader_top">Reader Top (Trên truyện)</option>
                            <option value="reader_middle">Reader Middle (Giữa chapter)</option>
                            <option value="reader_bottom">Reader Bottom (Dưới truyện)</option>
                            <option value="reader_float_left">Reader Float Left (Trôi trái PC)</option>
                            <option value="reader_float_right">Reader Float Right (Trôi phải PC)</option>
                        </select>
                         <div className="flex gap-2">
                            <input type="text" value={adForm.imageUrl} onChange={e => setAdForm({...adForm, imageUrl: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white focus:border-primary outline-none" placeholder="Link ảnh hoặc upload"/>
                            <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 p-2 rounded text-white flex items-center justify-center transition-colors" title="Upload Ảnh">
                                <input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={(e) => handleFileUpload(e, 'ad')} />
                                {uploading && fileInputRef.current ? <RefreshCw size={18} className="animate-spin"/> : <Upload size={18}/>}
                            </label>
                        </div>
                        <input type="text" placeholder="Link đích (Khi click)" value={adForm.linkUrl} onChange={e => setAdForm({...adForm, linkUrl: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary"/>
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input type="checkbox" checked={adForm.isActive} onChange={e => setAdForm({...adForm, isActive: e.target.checked})} className="accent-primary"/>
                            Đang hoạt động
                        </label>
                        <div className="flex gap-2">
                             <button onClick={handleSaveAd} className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded font-medium">Lưu Quảng Cáo</button>
                             {adForm.id && <button onClick={() => setAdForm({id: '', position: 'home_middle', imageUrl: '', linkUrl: '', isActive: true, title: ''})} className="px-3 bg-white/10 hover:bg-white/20 text-white rounded">Hủy</button>}
                        </div>
                    </div>
                 </div>
            </div>
            <div className="lg:col-span-2">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {ads.map(ad => (
                         <div key={ad.id} className="bg-card border border-white/10 rounded-lg p-3 flex gap-3 group">
                             <img src={ad.imageUrl} alt="" className="w-20 h-20 object-cover rounded bg-dark"/>
                             <div className="flex-1 min-w-0">
                                 <h4 className="font-bold text-white text-sm truncate">{ad.title || 'Quảng cáo'}</h4>
                                 <p className="text-xs text-slate-500 mb-1">{ad.position}</p>
                                 <span className={`text-[10px] px-1.5 py-0.5 rounded ${ad.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                     {ad.isActive ? 'Active' : 'Inactive'}
                                 </span>
                             </div>
                             <div className="flex flex-col gap-2">
                                 <button onClick={() => setAdForm(ad)} className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded"><Edit size={14}/></button>
                                 <button onClick={() => handleDeleteAd(ad.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded"><Trash2 size={14}/></button>
                             </div>
                         </div>
                     ))}
                 </div>
            </div>
         </div>
    );

    const renderStaticTab = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="md:col-span-1">
                 <div className="bg-card border border-white/10 p-5 rounded-xl sticky top-4">
                    <h3 className="font-bold text-white mb-4">{staticForm.slug && staticForm.slug !== '' ? 'Sửa trang tĩnh' : 'Thêm trang tĩnh'}</h3>
                    <div className="space-y-3">
                        <input type="text" placeholder="Tiêu đề trang" value={staticForm.title} onChange={e => setStaticForm({...staticForm, title: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary"/>
                        <input type="text" placeholder="Slug (URL)" value={staticForm.slug} onChange={e => setStaticForm({...staticForm, slug: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary"/>
                        <div className="space-y-1">
                             <label className="text-xs text-slate-400">Nội dung</label>
                             <SimpleEditor value={staticForm.content} onChange={val => setStaticForm({...staticForm, content: val})} height="300px"/>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={handleSaveStatic} className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded font-medium">Lưu Trang</button>
                             {staticForm.slug && <button onClick={() => setStaticForm({slug: '', title: '', content: ''})} className="px-3 bg-white/10 hover:bg-white/20 text-white rounded">Hủy</button>}
                        </div>
                    </div>
                 </div>
             </div>
             <div className="md:col-span-2">
                 <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
                    <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-300">Danh sách trang</span>
                        {staticPages.length === 0 && (
                            <button onClick={handleSeedStaticPages} className="text-xs flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors">
                                <Database size={12}/> Khởi tạo trang mẫu
                            </button>
                        )}
                    </div>
                    {staticPages.length === 0 ? (
                        <div className="p-10 text-center text-slate-500">
                            Chưa có trang tĩnh nào. <br/>
                            Hãy nhấn <b>"Khởi tạo trang mẫu"</b> ở trên để tạo các trang cơ bản.
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-white/5 text-xs uppercase text-slate-400">
                                <tr><th className="p-3">Tiêu đề</th><th className="p-3">URL (Slug)</th><th className="p-3 text-right">Thao tác</th></tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {staticPages.map(p => (
                                    <tr key={p.slug} className="hover:bg-white/5">
                                        <td className="p-3 font-medium text-white">{p.title}</td>
                                        <td className="p-3 text-slate-500">/p/{p.slug}</td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => setStaticForm(p)} className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded"><Edit size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
             </div>
        </div>
    );

    const renderUsersTab = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
                 <div className="bg-card border border-white/10 p-5 rounded-xl">
                    <h3 className="font-bold text-white mb-4">{userForm.id ? 'Sửa thành viên' : 'Thêm thành viên'}</h3>
                    <div className="space-y-3">
                        <input type="text" placeholder="Tên đăng nhập" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary"/>
                        <input type="password" placeholder={userForm.id ? "Mật khẩu (Để trống nếu không đổi)" : "Mật khẩu"} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary"/>
                        <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary">
                            <option value="editor">Biên tập viên (Editor)</option>
                            <option value="admin">Quản trị viên (Admin)</option>
                        </select>
                        <div className="flex gap-2">
                             <button onClick={handleSaveUser} className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded font-medium">Lưu</button>
                             {userForm.id !== 0 && <button onClick={() => setUserForm({id: 0, username: '', password: '', role: 'editor'})} className="px-3 bg-white/10 hover:bg-white/20 text-white rounded">Hủy</button>}
                        </div>
                    </div>
                 </div>
            </div>
            <div className="md:col-span-2">
                <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-white/5 text-xs uppercase text-slate-400">
                            <tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3 text-right">Thao tác</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {users.map(u => (
                                <tr key={u.id} className="hover:bg-white/5">
                                    <td className="p-3 font-medium text-white">{u.username}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-500/20 text-slate-400'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setUserForm(u)} className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded"><Edit size={16}/></button>
                                            {u.username !== 'admin' && (
                                                <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded"><Trash2 size={16}/></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderSettingsTab = () => (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-card border border-white/10 p-6 rounded-xl">
                <h3 className="font-bold text-white mb-6 flex items-center gap-2"><Settings size={20}/> Cấu hình giao diện</h3>
                
                <div className="space-y-6">
                    {/* Basic Colors */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Màu chủ đạo (Primary)</label>
                            <div className="flex gap-2">
                                <input type="color" value={themeConfig.primaryColor} onChange={e => setThemeConfig({...themeConfig, primaryColor: e.target.value})} className="h-10 w-12 bg-transparent border-0 cursor-pointer"/>
                                <input type="text" value={themeConfig.primaryColor} onChange={e => setThemeConfig({...themeConfig, primaryColor: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white text-sm"/>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Màu phụ (Secondary)</label>
                            <div className="flex gap-2">
                                <input type="color" value={themeConfig.secondaryColor} onChange={e => setThemeConfig({...themeConfig, secondaryColor: e.target.value})} className="h-10 w-12 bg-transparent border-0 cursor-pointer"/>
                                <input type="text" value={themeConfig.secondaryColor} onChange={e => setThemeConfig({...themeConfig, secondaryColor: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white text-sm"/>
                            </div>
                        </div>
                    </div>
                    
                    {/* Site Info */}
                    <div>
                        <label className="text-xs text-slate-400 mb-1 block">Tên Website</label>
                        <input type="text" value={themeConfig.siteName || ''} onChange={e => setThemeConfig({...themeConfig, siteName: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary"/>
                    </div>

                     <div>
                        <label className="text-xs text-slate-400 mb-1 block">Font chữ</label>
                        <select value={themeConfig.fontFamily} onChange={e => setThemeConfig({...themeConfig, fontFamily: e.target.value as any})} className="w-full bg-dark border border-white/10 rounded p-2 text-white outline-none focus:border-primary">
                            <option value="sans">Sans-serif (Hiện đại)</option>
                            <option value="serif">Serif (Cổ điển)</option>
                            <option value="mono">Monospace (Code)</option>
                        </select>
                    </div>

                    {/* Home Layout */}
                    <div className="border-t border-white/10 pt-4">
                        <label className="text-sm font-bold text-white mb-2 block">Bố cục trang chủ</label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-slate-300">
                                <input type="checkbox" checked={themeConfig.homeLayout.showSlider} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...themeConfig.homeLayout, showSlider: e.target.checked}})} className="accent-primary"/>
                                Hiển thị Slider nổi bật
                            </label>
                            <label className="flex items-center gap-2 text-slate-300">
                                <input type="checkbox" checked={themeConfig.homeLayout.showHot} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...themeConfig.homeLayout, showHot: e.target.checked}})} className="accent-primary"/>
                                Hiển thị Truyện Hot
                            </label>
                            <label className="flex items-center gap-2 text-slate-300">
                                <input type="checkbox" checked={themeConfig.homeLayout.showNew} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...themeConfig.homeLayout, showNew: e.target.checked}})} className="accent-primary"/>
                                Hiển thị Truyện Mới
                            </label>
                        </div>
                    </div>

                    {/* Header Menu Configuration */}
                    <div className="border-t border-white/10 pt-4">
                         <div className="flex justify-between items-center mb-2">
                             <label className="text-sm font-bold text-white flex items-center gap-2"><Menu size={16}/> Menu Header</label>
                             <button onClick={addMenuItem} className="text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded"><Plus size={12}/> Thêm menu</button>
                         </div>
                         <div className="space-y-2">
                             {(themeConfig.headerMenu || []).map((item, idx) => (
                                 <div key={idx} className="flex gap-2 items-center">
                                     <input 
                                        type="text" 
                                        placeholder="Tên Menu"
                                        value={item.label}
                                        onChange={(e) => updateMenuItem(idx, 'label', e.target.value)}
                                        className="flex-1 bg-dark border border-white/10 rounded p-2 text-white text-sm focus:border-primary outline-none"
                                     />
                                     <input 
                                        type="text" 
                                        placeholder="Link (VD: /p/lien-he)"
                                        value={item.url}
                                        onChange={(e) => updateMenuItem(idx, 'url', e.target.value)}
                                        className="flex-1 bg-dark border border-white/10 rounded p-2 text-white text-sm focus:border-primary outline-none"
                                     />
                                     <button onClick={() => removeMenuItem(idx)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={16}/></button>
                                 </div>
                             ))}
                             {(themeConfig.headerMenu || []).length === 0 && <div className="text-slate-500 text-sm italic">Chưa có menu nào.</div>}
                         </div>
                    </div>

                    {/* Footer Menu Configuration */}
                    <div className="border-t border-white/10 pt-4">
                         <div className="flex justify-between items-center mb-2">
                             <label className="text-sm font-bold text-white flex items-center gap-2"><LinkIcon size={16}/> Menu Footer (Liên kết chân trang)</label>
                             <button onClick={addFooterMenuItem} className="text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded"><Plus size={12}/> Thêm link</button>
                         </div>
                         <div className="space-y-2">
                             {(themeConfig.footerMenu || []).map((item, idx) => (
                                 <div key={idx} className="flex gap-2 items-center">
                                     <input 
                                        type="text" 
                                        placeholder="Tên Link"
                                        value={item.label}
                                        onChange={(e) => updateFooterMenuItem(idx, 'label', e.target.value)}
                                        className="flex-1 bg-dark border border-white/10 rounded p-2 text-white text-sm focus:border-primary outline-none"
                                     />
                                     <input 
                                        type="text" 
                                        placeholder="URL (VD: /p/dieu-khoan)"
                                        value={item.url}
                                        onChange={(e) => updateFooterMenuItem(idx, 'url', e.target.value)}
                                        className="flex-1 bg-dark border border-white/10 rounded p-2 text-white text-sm focus:border-primary outline-none"
                                     />
                                     <button onClick={() => removeFooterMenuItem(idx)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded"><Trash2 size={16}/></button>
                                 </div>
                             ))}
                             {(themeConfig.footerMenu || []).length === 0 && <div className="text-slate-500 text-sm italic">Chưa có liên kết nào.</div>}
                         </div>
                    </div>

                    {/* Footer Content */}
                    <div className="border-t border-white/10 pt-4">
                        <label className="text-sm font-bold text-white mb-2 flex items-center gap-2"><LinkIcon size={16}/> Nội dung Footer (Chân trang)</label>
                        <SimpleEditor 
                            value={themeConfig.footerContent || ''} 
                            onChange={val => setThemeConfig({...themeConfig, footerContent: val})}
                            height="150px"
                        />
                        <p className="text-xs text-slate-500 mt-1">Hỗ trợ HTML. Bạn có thể chèn thông tin liên hệ, bản quyền tại đây.</p>
                    </div>

                    <button onClick={handleSaveTheme} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl mt-4 flex items-center justify-center gap-2">
                        <Save size={20}/> Lưu Cấu Hình
                    </button>
                </div>
            </div>
        </div>
    );

    const renderReportsTab = () => (
        <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
             <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                 <h3 className="font-bold text-white">Danh sách báo lỗi từ người dùng</h3>
                 <button onClick={loadData} className="p-2 hover:bg-white/10 rounded-full text-slate-300"><RefreshCw size={16}/></button>
             </div>
             {reports.length === 0 ? (
                 <div className="p-8 text-center text-slate-500">Không có báo cáo nào.</div>
             ) : (
                <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-white/5 text-xs uppercase text-slate-400">
                        <tr><th className="p-3">Truyện / Chương</th><th className="p-3">Nội dung lỗi</th><th className="p-3">Thời gian</th><th className="p-3 text-right">Xử lý</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {reports.map(r => (
                            <tr key={r.id} className="hover:bg-white/5">
                                <td className="p-3">
                                    <div className="font-bold text-white">{r.comicTitle || r.comicId}</div>
                                    <div className="text-xs text-primary">{r.chapterTitle || r.chapterId}</div>
                                </td>
                                <td className="p-3 text-red-300">{r.message}</td>
                                <td className="p-3 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                                <td className="p-3 text-right">
                                    <button onClick={() => handleDeleteReport(r.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded" title="Đã sửa xong / Xóa"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             )}
        </div>
    );

    const renderMediaTab = () => (
        <div className="space-y-6">
            {/* Header / Upload Area */}
            <div className="bg-card border border-white/10 p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                        <FolderOpen className="text-primary"/> Thư viện ảnh
                    </h2>
                    <p className="text-sm text-slate-400">Quản lý tất cả file ảnh đã tải lên.</p>
                </div>
                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20">
                    <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        ref={mediaInputRef}
                        onChange={handleMediaUpload}
                    />
                    {uploading && mediaInputRef.current ? <RefreshCw size={18} className="animate-spin"/> : <Upload size={18}/>}
                    <span>Tải ảnh mới</span>
                </label>
            </div>

            {/* Media Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {mediaFiles.map((file, idx) => (
                    <div key={idx} className="group relative bg-card border border-white/10 rounded-lg overflow-hidden hover:border-primary/50 transition-colors">
                        <div className="aspect-square bg-dark relative">
                            <img 
                                src={file.url} 
                                alt={file.name} 
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                            {/* Overlay Actions */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button 
                                    onClick={() => copyToClipboard(file.url)}
                                    className="p-2 bg-white text-black rounded-full hover:bg-primary hover:text-white transition-colors"
                                    title="Copy Link"
                                >
                                    <Copy size={16}/>
                                </button>
                                <button 
                                    onClick={() => handleDeleteMedia(file.name)}
                                    className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                                    title="Xóa ảnh"
                                >
                                    <Trash2 size={16}/>
                                </button>
                            </div>
                        </div>
                        <div className="p-2">
                            <div className="text-xs text-white font-medium truncate mb-1" title={file.name}>{file.name}</div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500">
                                <span>{formatFileSize(file.size)}</span>
                                <span>{new Date(file.created).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            {mediaFiles.length === 0 && (
                <div className="p-12 text-center text-slate-500 border border-white/10 border-dashed rounded-xl">
                    Chưa có file ảnh nào. Hãy upload ảnh mới.
                </div>
            )}
        </div>
    );

    return (
        <div className="flex min-h-screen bg-darker">
            {/* Sidebar */}
            <aside className="w-64 bg-card border-r border-white/10 hidden md:block flex-shrink-0">
                <div className="p-6">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <LayoutDashboard className="text-primary"/> Admin CP
                    </h1>
                </div>
                <nav className="flex flex-col gap-1 px-3">
                    <button onClick={() => setActiveTab('comics')} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'comics' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <Book size={18} /> Quản lý Truyện
                    </button>
                    <button onClick={() => setActiveTab('genres')} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'genres' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <FileText size={18} /> Thể loại
                    </button>
                    <button onClick={() => setActiveTab('media')} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'media' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <ImageIcon size={18} /> Thư viện ảnh
                    </button>
                    <button onClick={() => setActiveTab('ads')} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'ads' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <Globe size={18} /> Quảng cáo
                    </button>
                    <button onClick={() => setActiveTab('static')} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'static' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <Database size={18} /> Trang tĩnh
                    </button>
                    <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'reports' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <AlertTriangle size={18} /> Báo cáo lỗi
                    </button>
                    <button onClick={() => setActiveTab('users')} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <Users size={18} /> Thành viên
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                        <Settings size={18} /> Cài đặt giao diện
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-8 overflow-y-auto h-screen">
                {loading && <div className="mb-4 text-primary text-sm animate-pulse">Đang đồng bộ dữ liệu...</div>}
                
                {activeTab === 'comics' && renderComicsTab()}
                {activeTab === 'genres' && renderGenresTab()}
                {activeTab === 'media' && renderMediaTab()}
                {activeTab === 'ads' && renderAdsTab()}
                {activeTab === 'users' && renderUsersTab()}
                {activeTab === 'settings' && renderSettingsTab()}
                {activeTab === 'reports' && renderReportsTab()}
                {activeTab === 'static' && renderStaticTab()}
            </main>
        </div>
    );
};

export default Admin;
