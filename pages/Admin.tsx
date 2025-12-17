
import React, { useState, useEffect, useRef } from 'react';
import { 
    LayoutDashboard, BookOpen, List, Users, Settings, Image as ImageIcon, 
    Plus, Edit, Trash2, Save, X, ChevronRight, ChevronDown, 
    Search, Upload, Palette, Globe, Menu, MessageSquare, Flag,
    FileText, Link as LinkIcon, Download, Code, GripVertical, AlertTriangle, RefreshCw, Copy, LogOut, ArrowLeft, Check, CheckCircle,
    TrendingUp, BarChart3, Calendar, Activity, HardDrive, Clock, MousePointerClick, Star
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DataProvider } from '../services/dataProvider';
import { AuthService } from '../services/auth';
import { Comic, Genre, AdConfig, User, StaticPage, ThemeConfig, Report, Chapter, MediaFile, Analytics, Comment } from '../types';
import SimpleEditor from '../components/SimpleEditor';
import { DEFAULT_THEME, SEED_STATIC_PAGES } from '../services/seedData';
import { summarizeComic } from '../services/geminiService';
import AppModal, { ModalType } from '../components/AppModal';

// Gợi ý kích thước cho từng vị trí quảng cáo
const AD_DIMENSIONS: Record<string, string> = {
    'home_header': 'Rộng: 1200px | Cao: 300px - 400px',
    'home_middle': 'Rộng: 1200px | Cao: 250px',
    'home_bottom': 'Rộng: 1200px | Cao: 250px',
    'detail_sidebar': 'Rộng: 300px | Cao: 500px - 600px (Dọc)',
    'reader_top': 'Rộng: 1000px | Cao: 150px - 250px',
    'reader_middle': 'Rộng: 800px | Cao: 400px - 600px (Lớn)',
    'reader_bottom': 'Rộng: 1000px | Cao: 150px - 250px',
    'reader_float_left': 'Rộng: 300px - 400px | Cao: 600px (Cố định)',
    'reader_float_right': 'Rộng: 300px - 400px | Cao: 600px (Cố định)',
};

const AVAILABLE_FONTS = [
    { name: 'Inter', label: 'Inter (Hiện đại - Mặc định)' },
    { name: 'Roboto', label: 'Roboto (Tiêu chuẩn)' },
    { name: 'Open Sans', label: 'Open Sans (Dễ đọc)' },
    { name: 'Patrick Hand', label: 'Patrick Hand (Truyện tranh)' },
    { name: 'Playfair Display', label: 'Playfair Display (Sang trọng)' },
    { name: 'Merriweather', label: 'Merriweather (Báo chí)' },
    { name: 'Comfortaa', label: 'Comfortaa (Bo tròn)' }
];

const parseChapterImagesHtml = (html: string, baseUrl: string) => {
    const images: string[] = [];
    let origin = 'https://dilib.vn'; 
    try {
        if (baseUrl) origin = new URL(baseUrl).origin;
    } catch(e) {}

    const isDilib = origin.includes('dilib.vn');

    if (isDilib) {
        const regex = /["']([^"']+\/img\/comic\/[^"']+)["']/g;
        let match;
        
        while ((match = regex.exec(html)) !== null) {
            let src = match[1];
            src = src.trim();
            if (src.startsWith('//')) src = 'https:' + src;
            else if (src.startsWith('/')) src = origin + src;
            else if (!src.startsWith('http')) src = origin + '/' + src;

            if (src.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)) {
                if (!images.includes(src)) images.push(src);
            }
        }
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const allImgs = doc.querySelectorAll('img');

    allImgs.forEach(img => {
        let src = img.getAttribute('data-original') || img.getAttribute('data-src') || img.getAttribute('data-cdn') || img.getAttribute('src');
        if (src) {
            src = src.trim();
            if (src.startsWith('//')) src = 'https:' + src;
            else if (src.startsWith('/')) src = origin + src;
            else if (!src.startsWith('http')) src = origin + '/' + src;

            if (isDilib) {
                if (src.includes('/img/comic/') && !images.includes(src)) images.push(src);
            } else {
                if (!src.includes('icon') && !src.includes('logo') && !src.includes('ads') && src.startsWith('http') && !images.includes(src)) images.push(src);
            }
        }
    });

    return [...new Set(images)];
};

const parseComicHtml = (html: string, baseUrl: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const origin = new URL(baseUrl).origin;
    
    let title = '';
    const titleSelectors = ['h1[itemprop="name"]', 'h1.title-detail', '.story-detail-info h1', 'h1', 'title'];
    for (const sel of titleSelectors) {
        const el = doc.querySelector(sel);
        if (el && el.textContent) { title = el.textContent.trim(); break; }
    }
    title = title.replace(/ - Chapter \d+$/, '').replace(/ - Truyện.+$/, '').replace(/ \|.+$/, '').trim();

    let coverImage = '';
    const imgSelectors = ['.col-image img', '.book_avatar img', '.poster img', 'meta[property="og:image"]'];
    for (const sel of imgSelectors) {
        const el = doc.querySelector(sel);
        if (el) {
            let src = el.getAttribute('src') || el.getAttribute('content');
            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                if (!src.startsWith('http')) src = origin + (src.startsWith('/') ? '' : '/') + src;
                coverImage = src;
                break;
            }
        }
    }

    let description = '';
    const descSelectors = ['.detail-content p', 'div[itemprop="description"]', '.story-detail-info .detail-content'];
    for (const sel of descSelectors) {
        const el = doc.querySelector(sel);
        if (el && el.textContent) { description = el.textContent.trim(); break; }
    }

    const chapters: {url: string, title: string, number: number}[] = [];
    const chapListSelectors = ['div.col-md-3 a', '.list-chapter nav ul li a', '#chapter-list a', '.row-chapter a'];
    let links: NodeListOf<Element> | Element[] | null = null;
    
    for (const sel of chapListSelectors) {
        const found = doc.querySelectorAll(sel);
        if (found.length > 0) { links = Array.from(found); break; }
    }
    
    if (!links) links = Array.from(doc.querySelectorAll('a')).filter(el => /chapter|chap|chương/i.test(el.textContent || '') || /chapter|chap/i.test(el.getAttribute('href')||''));

    if (links) {
        links.forEach(a => {
            let href = a.getAttribute('href');
            if (href) {
                if (href.startsWith('//')) href = 'https:' + href;
                if (!href.startsWith('http')) href = origin + (href.startsWith('/') ? '' : '/') + href;
                
                const rawText = a.textContent?.trim() || '';
                let number = 0;
                const matchText = rawText.match(/(Chapter|Chap|Chương)[\s]*(\d+(\.\d+)?)/i);
                if (matchText) number = parseFloat(matchText[2]);
                else {
                    const matchUrl = href.match(/(chapter|chap)[-._]?(\d+(\.\d+)?)/i);
                    if (matchUrl) number = parseFloat(matchUrl[2]);
                }
                const finalTitle = rawText || `Chapter ${number}`;
                if (!chapters.some(c => c.url === href) && number >= 0) chapters.push({ url: href, title: finalTitle, number });
            }
        });
    }
    chapters.sort((a, b) => b.number - a.number);
    return { title, coverImage, description, chapters };
};

const Admin: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'comics' | 'genres' | 'settings' | 'users' | 'ads' | 'reports' | 'static' | 'media' | 'comments'>('dashboard');
    const [loading, setLoading] = useState(false);
    
    // Data States
    const [comics, setComics] = useState<Comic[]>([]);
    const [genres, setGenres] = useState<Genre[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [reports, setReports] = useState<Report[]>([]);
    const [ads, setAds] = useState<AdConfig[]>([]);
    const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]); 
    const [comments, setComments] = useState<Comment[]>([]);
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(DEFAULT_THEME);
    const [analytics, setAnalytics] = useState<Analytics>({ totalViews: 0, todayViews: 0, monthViews: 0 });

    // Dashboard Filter State
    const [topComicsTimeframe, setTopComicsTimeframe] = useState<'day' | 'week' | 'month'>('day');

    // Modal State
    const [modal, setModal] = useState<{
        isOpen: boolean;
        type: ModalType;
        title: string;
        message: React.ReactNode;
        confirmText?: string;
        onConfirm?: (val?: string) => void;
        defaultValue?: string;
    }>({ isOpen: false, type: 'alert', title: '', message: '' });

    // Helper functions for Modal
    const showAlert = (msg: string, title = 'Thông báo') => setModal({ isOpen: true, type: 'alert', title, message: msg });
    const showConfirm = (msg: string, onConfirm: () => void, title = 'Xác nhận', type: ModalType = 'confirm', confirmText = 'Đồng ý') => setModal({ isOpen: true, type, title, message: msg, onConfirm, confirmText });
    const showPrompt = (msg: string, onConfirm: (val: string) => void, defaultValue = '', title = 'Nhập thông tin') => setModal({ isOpen: true, type: 'prompt', title, message: msg, defaultValue, onConfirm: (val) => { if(val) onConfirm(val); }, confirmText: 'Lưu' });
    const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

    // Form States
    const [isEditing, setIsEditing] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chapterInputRef = useRef<HTMLInputElement>(null);
    const mediaInputRef = useRef<HTMLInputElement>(null);

    // Forms
    const [comicForm, setComicForm] = useState<Comic>({ id: '', title: '', coverImage: '', author: '', status: 'Đang tiến hành', genres: [], description: '', views: 0, chapters: [], isRecommended: false, slug: '', metaTitle: '', metaDescription: '', metaKeywords: '' });
    const [isEditingChapter, setIsEditingChapter] = useState(false);
    const [chapterForm, setChapterForm] = useState<{id: string, title: string, number: number, pagesContent: string}>({ id: '', title: '', number: 0, pagesContent: '' });
    const [genreForm, setGenreForm] = useState<Genre>({ id: '', name: '', slug: '', isShowHome: false });
    const [adForm, setAdForm] = useState<AdConfig>({ id: '', position: 'home_middle', imageUrl: '', linkUrl: '', isActive: true, title: '' });
    const [userForm, setUserForm] = useState<User>({ id: 0, username: '', password: '', role: 'editor' });
    const [staticForm, setStaticForm] = useState<StaticPage>({ slug: '', title: '', content: '' });

    // Leech States
    const [leechUrl, setLeechUrl] = useState('');
    const [leechSourceChapters, setLeechSourceChapters] = useState<{url: string, title: string, number: number}[]>([]);
    const [leechSelectedChapters, setLeechSelectedChapters] = useState<string[]>([]);
    const [isLeeching, setIsLeeching] = useState(false);
    const [leechProgress, setLeechProgress] = useState('');
    const [leechError, setLeechError] = useState<string | null>(null);
    const [showManualLeech, setShowManualLeech] = useState(false);
    const [manualHtml, setManualHtml] = useState('');
    const [leechStorageMode, setLeechStorageMode] = useState<'url' | 'upload'>('url');

    useEffect(() => {
        if (!AuthService.isAuthenticated()) { navigate('/login'); return; }
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'dashboard' || activeTab === 'comics') setComics(await DataProvider.getComics());
            if (activeTab === 'dashboard' || activeTab === 'genres' || activeTab === 'comics') setGenres(await DataProvider.getGenres());
            if (activeTab === 'dashboard' || activeTab === 'users') setUsers(await DataProvider.getUsers());
            if (activeTab === 'dashboard' || activeTab === 'reports') setReports(await DataProvider.getReports());
            if (activeTab === 'dashboard') setAnalytics(await DataProvider.getAnalytics());
            if (activeTab === 'ads') setAds(await DataProvider.getAds());
            if (activeTab === 'static') setStaticPages(await DataProvider.getStaticPages());
            if (activeTab === 'media') setMediaFiles(await DataProvider.getMedia());
            if (activeTab === 'comments') setComments(await DataProvider.getComments());
            if (activeTab === 'settings') setThemeConfig({ ...DEFAULT_THEME, ...(await DataProvider.getTheme()) });
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // --- Actions ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: 'comic' | 'ad' | 'theme-favicon') => {
        if (e.target.files?.[0]) {
            setIsUploadingFile(true);
            try {
                const url = await DataProvider.uploadImage(e.target.files[0]);
                if (url) {
                    if (targetField === 'comic') setComicForm(prev => ({ ...prev, coverImage: url }));
                    else if (targetField === 'ad') setAdForm(prev => ({ ...prev, imageUrl: url }));
                    else if (targetField === 'theme-favicon') setThemeConfig(prev => ({ ...prev, favicon: url }));
                }
            } catch (error) { showAlert("Lỗi upload."); } 
            finally { setIsUploadingFile(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
        }
    };

    const handleChapterImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            setIsUploadingFile(true);
            try {
                const newUrls = [];
                for (let i = 0; i < e.target.files.length; i++) {
                    const url = await DataProvider.uploadImage(e.target.files[i]);
                    if (url) newUrls.push(url);
                }
                setChapterForm(prev => ({ ...prev, pagesContent: prev.pagesContent + (prev.pagesContent ? '\n' : '') + newUrls.join('\n') }));
            } catch (error) { showAlert("Lỗi upload."); } 
            finally { setIsUploadingFile(false); if (chapterInputRef.current) chapterInputRef.current.value = ''; }
        }
    };

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            setIsUploadingFile(true);
            try {
                for (let i = 0; i < e.target.files.length; i++) await DataProvider.uploadImage(e.target.files[i]);
                setMediaFiles(await DataProvider.getMedia());
            } catch (error) { showAlert("Lỗi upload."); } 
            finally { setIsUploadingFile(false); if (mediaInputRef.current) mediaInputRef.current.value = ''; }
        }
    };

    const handleScanLeech = async () => {
        setLeechError(null); setLeechSourceChapters([]); setIsScanning(true);
        if (showManualLeech && manualHtml) {
            try {
                const data = parseComicHtml(manualHtml, 'https://dilib.vn');
                setComicForm(prev => ({ ...prev, title: data.title || prev.title, description: data.description || prev.description, coverImage: data.coverImage || prev.coverImage }));
                setLeechSourceChapters(data.chapters || []);
                showAlert(`✅ Đã tìm thấy ${data.chapters?.length} chapter!`);
            } catch (e: any) { setLeechError('Lỗi: ' + e.message); } finally { setIsScanning(false); }
            return;
        }
        if (!leechUrl) { setLeechError('Nhập Link hoặc HTML.'); setIsScanning(false); return; }
        try {
            const token = localStorage.getItem('comivn_auth_token');
            const res = await fetch('/v1/leech', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }, body: JSON.stringify({ url: leechUrl }) });
            const result = await res.json();
            if (!result.success) {
                if (result.html) { setManualHtml(result.html); setShowManualLeech(true); throw new Error(result.error || "Bị chặn Bot. Copy HTML thủ công."); }
                throw new Error(result.error || "Lỗi kết nối.");
            }
            const data = parseComicHtml(result.html, leechUrl);
            setComicForm(prev => ({ ...prev, title: data.title || prev.title, description: data.description || prev.description, coverImage: data.coverImage || prev.coverImage }));
            setLeechSourceChapters(data.chapters || []);
        } catch (err: any) { setLeechError(`${err.message}`); } finally { setIsScanning(false); }
    };

    const handleRunLeech = async () => {
        if (showManualLeech && manualHtml && leechSelectedChapters.length === 0) {
             try {
                let images = parseChapterImagesHtml(manualHtml, leechUrl || 'https://dilib.vn');
                if (images.length === 0) { showAlert("Không tìm thấy ảnh!"); return; }
                
                showPrompt("Nhập tên Chapter:", async (chapterTitle) => {
                    const nextNum = (chapterTitle.match(/\d+(\.\d+)?/) || [])[0] ? parseFloat((chapterTitle.match(/\d+(\.\d+)?/) || [])[0]) : 0;
                    setIsLeeching(true);
                    
                    try {
                        // Nếu chọn upload lên host
                        if (leechStorageMode === 'upload') {
                            const uploadedUrls = [];
                            const token = localStorage.getItem('comivn_auth_token');
                            for (let i = 0; i < images.length; i++) {
                                setLeechProgress(`⏳ Đang tải ảnh ${i+1}/${images.length}...`);
                                try {
                                    const res = await fetch('/v1/upload-url', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                                        body: JSON.stringify({ url: images[i] })
                                    });
                                    const data = await res.json();
                                    if (data.success && data.url) uploadedUrls.push(data.url);
                                    else uploadedUrls.push(images[i]); // Fallback nếu upload lỗi
                                } catch (e) { uploadedUrls.push(images[i]); }
                            }
                            images = uploadedUrls;
                        }

                        await DataProvider.saveChapter({ id: `${comicForm.id || 'new'}-chap-${nextNum}-${Date.now()}`, comicId: comicForm.id, number: nextNum, title: chapterTitle, updatedAt: new Date().toISOString() }, images.map((url, idx) => ({ imageUrl: url, pageNumber: idx + 1 })));
                        showAlert(`✅ Đã lưu ${images.length} ảnh!`);
                        if (comicForm.id) { const updated = await DataProvider.getComicById(comicForm.id); if (updated) setComicForm(updated); }
                        setManualHtml('');
                    } catch(e: any) { showAlert("Lỗi: " + e.message); }
                    finally { setIsLeeching(false); setLeechProgress(''); }
                }, "Chapter New");

             } catch(e: any) { showAlert("Lỗi: " + e.message); }
             return;
        }

        if (leechSelectedChapters.length === 0) { showAlert("Chưa chọn chapter"); return; }
        if (!comicForm.id) {
            const id = `comic-${Date.now()}`;
            await DataProvider.saveComic({ ...comicForm, id, slug: comicForm.slug || comicForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') });
            setComicForm(prev => ({ ...prev, id }));
        }
        setIsLeeching(true); setLeechError(null);
        let successCount = 0;
        const chaptersToLeech = leechSourceChapters.filter(c => leechSelectedChapters.includes(c.url));
        const token = localStorage.getItem('comivn_auth_token');

        for (const chap of chaptersToLeech) {
            setLeechProgress(`⏳ Đang quét: ${chap.title}...`);
            try {
                const res = await fetch('/v1/leech', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }, body: JSON.stringify({ url: chap.url }) });
                const result = await res.json();
                if (result.success && result.html) {
                    let images = parseChapterImagesHtml(result.html, chap.url);
                    
                    if (images.length > 0) {
                        // Nếu chế độ là Upload lên host
                        if (leechStorageMode === 'upload') {
                            const uploadedUrls = [];
                            for (let i = 0; i < images.length; i++) {
                                setLeechProgress(`⏳ ${chap.title}: Tải ảnh ${i+1}/${images.length}...`);
                                try {
                                    const upRes = await fetch('/v1/upload-url', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                                        body: JSON.stringify({ url: images[i] })
                                    });
                                    const upData = await upRes.json();
                                    if (upData.success && upData.url) uploadedUrls.push(upData.url);
                                    else uploadedUrls.push(images[i]);
                                } catch (e) { uploadedUrls.push(images[i]); }
                            }
                            images = uploadedUrls;
                        }

                        if (images.length > 0) {
                            await DataProvider.saveChapter({ id: `${comicForm.id}-chap-${chap.number}-${Date.now()}`, comicId: comicForm.id, number: chap.number, title: chap.title, updatedAt: new Date().toISOString() }, images.map((url, idx) => ({ imageUrl: url, pageNumber: idx + 1 })));
                            successCount++;
                        }
                    }
                }
            } catch (e) {}
            await new Promise(r => setTimeout(r, 1000));
        }
        setLeechProgress(`✅ Hoàn tất! Thành công: ${successCount}`);
        setIsLeeching(false);
        if (comicForm.id) { const updated = await DataProvider.getComicById(comicForm.id); if (updated) setComicForm(updated); }
        setLeechSelectedChapters([]); 
    };

    const handleStartEdit = async (id: string) => { setLoading(true); setComicForm({ id: '', title: '', coverImage: '', author: '', status: 'Đang tiến hành', genres: [], description: '', views: 0, chapters: [], isRecommended: false, slug: '', metaTitle: '', metaDescription: '', metaKeywords: '' }); setLeechSourceChapters([]); const f = await DataProvider.getComicById(id); if (f) { setComicForm(f); setIsEditing(true); } setLoading(false); };
    const handleSaveComic = async () => { const id = comicForm.id || `comic-${Date.now()}`; const slug = comicForm.slug || comicForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'); await DataProvider.saveComic({ ...comicForm, id, slug }); setIsEditing(false); loadData(); };
    const handleDeleteComic = async (id: string) => { showConfirm('Bạn có chắc muốn xóa truyện này? Hành động không thể hoàn tác.', async () => { await DataProvider.deleteComic(id); loadData(); }, 'Xóa Truyện', 'danger'); };
    const handleAutoSummarize = async () => { if (!comicForm.title) return; const s = await summarizeComic(comicForm.title, comicForm.description); setComicForm({...comicForm, description: s}); };
    const handleEditChapter = async (c: Chapter) => { setLoading(true); const p = await DataProvider.getChapterPages(c.id); setChapterForm({ id: c.id, title: c.title, number: c.number, pagesContent: p.map(x => x.imageUrl).join('\n') }); setIsEditingChapter(true); setLoading(false); };
    const handleAddChapter = () => { const n = comicForm.chapters.length > 0 ? Math.max(...comicForm.chapters.map(c => c.number)) + 1 : 1; setChapterForm({ id: '', title: `Chapter ${n}`, number: n, pagesContent: '' }); setIsEditingChapter(true); };
    const handleQuickAddChapter = async (id: string) => { await handleStartEdit(id); handleAddChapter(); };
    const handleSaveChapter = async () => { if (!comicForm.id) return showAlert("Lưu truyện trước!"); setIsUploadingFile(true); const cid = chapterForm.id || `${comicForm.id}-chap-${chapterForm.number}-${Date.now()}`; await DataProvider.saveChapter({ id: cid, comicId: comicForm.id, number: chapterForm.number, title: chapterForm.title, updatedAt: new Date().toISOString() }, chapterForm.pagesContent.split('\n').map(x => x.trim()).filter(Boolean).map((u, i) => ({ imageUrl: u, pageNumber: i + 1 }))); const updated = await DataProvider.getComicById(comicForm.id); if (updated) setComicForm(updated); setIsUploadingFile(false); setIsEditingChapter(false); };
    const handleDeleteChapter = async (id: string) => { showConfirm('Xóa chapter này?', async () => { await DataProvider.deleteChapter(id, comicForm.id); const u = await DataProvider.getComicById(comicForm.id); if (u) setComicForm(u); }, 'Xóa Chapter', 'danger'); };
    const handleSaveGenre = async () => { await DataProvider.saveGenre({ ...genreForm, id: genreForm.id || `g-${Date.now()}`, slug: genreForm.slug || genreForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }); setGenreForm({ id: '', name: '', slug: '', isShowHome: false }); loadData(); };
    const handleDeleteGenre = async (id: string) => { showConfirm('Xóa thể loại này?', async () => { await DataProvider.deleteGenre(id); loadData(); }, 'Xóa Thể loại', 'danger'); };
    const handleSaveAd = async () => { await DataProvider.saveAd({ ...adForm, id: adForm.id || `ad-${Date.now()}` }); setAdForm({ id: '', position: 'home_middle', imageUrl: '', linkUrl: '', isActive: true, title: '' }); loadData(); };
    const handleDeleteAd = async (id: string) => { showConfirm('Xóa quảng cáo này?', async () => { await DataProvider.deleteAd(id); loadData(); }, 'Xóa Quảng cáo', 'danger'); };
    const handleSaveUser = async () => { await DataProvider.saveUser(userForm); setUserForm({ id: 0, username: '', password: '', role: 'editor' }); loadData(); };
    const handleDeleteUser = async (id: string | number) => { showConfirm('Xóa người dùng này?', async () => { await DataProvider.deleteUser(id); loadData(); }, 'Xóa User', 'danger'); };
    const handleSaveTheme = async () => { await DataProvider.saveTheme(themeConfig); showAlert("Đã lưu cấu hình thành công!"); window.location.reload(); };
    const handleSaveStatic = async () => { await DataProvider.saveStaticPage(staticForm); setStaticForm({ slug: '', title: '', content: '' }); loadData(); };
    const handleSeedStaticPages = async () => { showConfirm('Tạo lại các trang tĩnh mẫu?', async () => { for (const p of SEED_STATIC_PAGES) await DataProvider.saveStaticPage(p); loadData(); showAlert("Đã tạo xong!"); }); };
    const handleDeleteReport = async (id: string) => { showConfirm('Xóa báo cáo này?', async () => { await DataProvider.deleteReport(id); loadData(); }, 'Xóa Báo cáo', 'danger'); };
    const handleDeleteMedia = async (name: string) => { showConfirm(`Xóa file ${name}?`, async () => { await DataProvider.deleteMedia(name); loadData(); }, 'Xóa Ảnh', 'danger'); };
    const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text.startsWith('/') ? `${window.location.origin}${text}` : text).then(() => showAlert("Đã copy vào clipboard!")); };
    const formatFileSize = (bytes: number) => { if (bytes === 0) return '0 B'; const i = Math.floor(Math.log(bytes) / Math.log(1024)); return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + ['B', 'KB', 'MB', 'GB'][i]; };
    const handleApproveComment = async (id: string) => { await DataProvider.approveComment(id); loadData(); };
    const handleDeleteComment = async (id: string) => { showConfirm('Xóa bình luận này?', async () => { await DataProvider.deleteComment(id); loadData(); }, 'Xóa Bình luận', 'danger'); };

    // --- Renderers ---
    const renderMenuEditor = (items: any[], onChange: any, title: string) => (
        <div className="bg-dark/50 border border-white/10 p-3 rounded-lg mb-4">
            <h4 className="text-sm font-bold text-slate-300 mb-2 flex justify-between">{title}<button onClick={() => onChange([...items, { label: 'New', url: '/' }])} className="text-xs bg-primary px-2 py-1 rounded text-white flex gap-1"><Plus size={12}/> Thêm</button></h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">{items.map((item, idx) => (<div key={idx} className="flex gap-2 items-center"><GripVertical size={16} className="text-slate-600"/><input value={item.label} onChange={e => { const n = [...items]; n[idx].label = e.target.value; onChange(n); }} className="flex-1 bg-dark border border-white/10 rounded px-2 py-1 text-xs text-white"/><input value={item.url} onChange={e => { const n = [...items]; n[idx].url = e.target.value; onChange(n); }} className="flex-1 bg-dark border border-white/10 rounded px-2 py-1 text-xs text-white"/><button onClick={() => onChange(items.filter((_, i) => i !== idx))} className="text-red-400"><Trash2 size={14}/></button></div>))}</div>
        </div>
    );

    const renderComicsTab = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-white">Quản lý Truyện</h2>{!isEditing && <button onClick={() => { setComicForm({ id: '', title: '', coverImage: '', author: '', status: 'Đang tiến hành', genres: [], description: '', views: 0, chapters: [], isRecommended: false, slug: '', metaTitle: '', metaDescription: '', metaKeywords: '' }); setIsEditing(true); }} className="bg-primary text-white px-4 py-2 rounded flex items-center gap-2"><Plus size={18} /> Thêm Truyện</button>}</div>
            {isEditing ? (
                <div className="bg-card border border-white/10 p-6 rounded-xl animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div><label className="text-xs text-slate-400 mb-1 block">Tên truyện</label><input type="text" value={comicForm.title} onChange={e => setComicForm({...comicForm, title: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div>
                        <div><label className="text-xs text-slate-400 mb-1 block">Tác giả</label><input type="text" value={comicForm.author} onChange={e => setComicForm({...comicForm, author: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div>
                        <div><label className="text-xs text-slate-400 mb-1 block">Ảnh bìa</label><div className="flex gap-2"><input type="text" value={comicForm.coverImage} onChange={e => setComicForm({...comicForm, coverImage: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white"/><label className="cursor-pointer bg-blue-600 px-3 py-2 rounded text-white"><input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={(e) => handleFileUpload(e, 'comic')} /><Upload size={16}/></label></div></div>
                         <div className="grid grid-cols-2 gap-2">
                             <div><label className="text-xs text-slate-400 mb-1 block">Trạng thái</label><select value={comicForm.status} onChange={e => setComicForm({...comicForm, status: e.target.value as any})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"><option value="Đang tiến hành">Đang tiến hành</option><option value="Hoàn thành">Hoàn thành</option></select></div>
                             <div><label className="text-xs text-slate-400 mb-1 block">Views</label><input type="number" value={comicForm.views} onChange={e => setComicForm({...comicForm, views: parseInt(e.target.value) || 0})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div>
                        </div>
                    </div>
                    <div className="mb-4"><label className="text-xs text-slate-400 mb-1 block">Thể loại</label><div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-dark rounded border border-white/10">{genres.map(g => (<label key={g.id} className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={comicForm.genres.includes(g.name)} onChange={e => { const newGenres = e.target.checked ? [...comicForm.genres, g.name] : comicForm.genres.filter(name => name !== g.name); setComicForm({...comicForm, genres: newGenres}); }} className="accent-primary"/>{g.name}</label>))}</div></div>
                    <div className="mb-4"><div className="flex justify-between items-center mb-1"><label className="text-xs text-slate-400">Mô tả</label><button type="button" onClick={handleAutoSummarize} className="text-xs text-primary hover:underline">✨ AI Tóm tắt</button></div><SimpleEditor value={comicForm.description} onChange={val => setComicForm({...comicForm, description: val})} height="150px"/></div>
                    <div className="bg-dark/50 p-4 rounded-lg border border-white/5 space-y-3 mt-4 mb-6"><h5 className="text-sm font-bold text-primary flex items-center gap-2"><Globe size={16}/> SEO</h5><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="md:col-span-2"><label className="text-xs text-slate-400 mb-1 block">URL Slug</label><input type="text" value={comicForm.slug || ''} onChange={e => setComicForm({...comicForm, slug: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div><div><label className="text-xs text-slate-400 mb-1 block">Meta Title</label><input type="text" value={comicForm.metaTitle || ''} onChange={e => setComicForm({...comicForm, metaTitle: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div><div><label className="text-xs text-slate-400 mb-1 block">Meta Keywords</label><input type="text" value={comicForm.metaKeywords || ''} onChange={e => setComicForm({...comicForm, metaKeywords: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div><div className="md:col-span-2"><label className="text-xs text-slate-400 mb-1 block">Meta Description</label><textarea value={comicForm.metaDescription || ''} onChange={e => setComicForm({...comicForm, metaDescription: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white h-20"/></div></div></div>
                    <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-500/20 p-4 rounded-lg mb-6"><div className="flex justify-between items-start mb-2"><h3 className="font-bold text-white flex items-center gap-2"><Download size={18}/> Leech Truyện</h3><button onClick={() => setShowManualLeech(!showManualLeech)} className="text-xs bg-indigo-500/20 text-indigo-200 px-2 py-1 rounded flex items-center gap-1 border border-indigo-500/30"><Code size={12}/> {showManualLeech ? "Ẩn HTML" : "Nhập HTML"}</button></div>{leechError && <div className="mb-3 p-3 bg-red-500/20 text-red-300 text-sm">{leechError}</div>}{showManualLeech ? (<div className="mb-3"><textarea value={manualHtml} onChange={e => setManualHtml(e.target.value)} className="w-full h-32 bg-dark border border-white/10 rounded p-2 text-xs font-mono text-slate-300" placeholder="HTML..."/><div className="mt-2 flex justify-end gap-2"><button onClick={leechSourceChapters.length > 0 ? handleRunLeech : handleScanLeech} disabled={!manualHtml} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold">{leechSourceChapters.length > 0 ? "Tìm ảnh" : "Phân tích"}</button></div></div>) : (<div className="flex gap-2 mb-3"><input type="text" placeholder="Link truyện..." value={leechUrl} onChange={e => setLeechUrl(e.target.value)} className="flex-1 bg-dark border border-white/10 rounded px-3 py-2 text-sm text-white"/><button onClick={handleScanLeech} disabled={isScanning} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold min-w-[80px]">{isScanning ? '...' : 'Quét'}</button></div>)}{leechSourceChapters.length > 0 && !showManualLeech && (<div className="space-y-3 pt-3 mt-3 border-t border-white/10"><div className="max-h-40 overflow-y-auto bg-dark border border-white/10 rounded p-2"><div className="flex justify-between items-center mb-2 px-1"><label className="text-xs text-slate-400 flex items-center gap-2"><input type="checkbox" onChange={e => setLeechSelectedChapters(e.target.checked ? leechSourceChapters.map(c => c.url) : [])} checked={leechSelectedChapters.length === leechSourceChapters.length && leechSourceChapters.length > 0}/> Tất cả</label><span className="text-xs text-indigo-400 font-bold">{leechSelectedChapters.length} chọn</span></div><div className="grid grid-cols-3 gap-1">{leechSourceChapters.map((c, idx) => (<label key={idx} className="flex items-center gap-2 text-xs p-1 hover:bg-white/5 rounded truncate"><input type="checkbox" checked={leechSelectedChapters.includes(c.url)} onChange={e => { if (e.target.checked) setLeechSelectedChapters(prev => [...prev, c.url]); else setLeechSelectedChapters(prev => prev.filter(u => u !== c.url)); }}/> {c.title}</label>))}</div></div>
                    <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
                        <label className="text-xs text-slate-400 block font-bold mb-1">Chế độ lưu ảnh:</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                <input type="radio" name="leech_mode" checked={leechStorageMode === 'url'} onChange={() => setLeechStorageMode('url')} className="accent-primary"/> 
                                Chỉ lưu URL hình ảnh
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                <input type="radio" name="leech_mode" checked={leechStorageMode === 'upload'} onChange={() => setLeechStorageMode('upload')} className="accent-primary"/> 
                                Upload hình ảnh lên host
                            </label>
                        </div>
                    </div>
                    <button onClick={handleRunLeech} disabled={isLeeching || (leechSelectedChapters.length === 0 && !manualHtml)} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors">{isLeeching ? <><RefreshCw size={18} className="animate-spin"/> {leechProgress || 'Đang xử lý...'}</> : <><Download size={18}/> Leech Ngay</>}</button>{leechProgress && !isLeeching && <div className="text-xs text-center text-slate-300 font-medium bg-white/5 p-2 rounded">{leechProgress}</div>}</div>)}</div>
                    <div className="flex justify-end gap-3 border-b border-white/10 pb-6 mb-6"><button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded bg-white/5 text-slate-300">Hủy</button><button onClick={handleSaveComic} className="px-4 py-2 rounded bg-primary text-white font-bold flex items-center gap-2"><Save size={18} /> Lưu</button></div>
                    <div className="space-y-4"><div className="flex justify-between items-center"><h3 className="text-lg font-bold text-white flex items-center gap-2"><List size={18}/> Chapters</h3><button onClick={handleAddChapter} disabled={!comicForm.id} className="text-sm bg-white/10 text-white px-3 py-1.5 rounded flex items-center gap-2"><Plus size={16}/> Thêm</button></div><div className="bg-dark border border-white/10 rounded max-h-[400px] overflow-y-auto"><table className="w-full text-sm text-left"><thead className="bg-white/5 text-xs text-slate-400 uppercase sticky top-0"><tr><th className="p-3">Tên</th><th className="p-3">Số</th><th className="p-3">Ngày</th><th className="p-3 text-right">#</th></tr></thead><tbody>{(comicForm.chapters || []).map(chap => (<tr key={chap.id} className="hover:bg-white/5 text-slate-300"><td className="p-3">{chap.title}</td><td className="p-3">{chap.number}</td><td className="p-3 text-xs">{new Date(chap.updatedAt).toLocaleDateString()}</td><td className="p-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => handleEditChapter(chap)} className="text-blue-400"><Edit size={14}/></button><button onClick={() => handleDeleteChapter(chap.id)} className="text-red-400"><Trash2 size={14}/></button></div></td></tr>))}</tbody></table></div></div>
                </div>
            ) : (
                <div className="bg-card border border-white/10 rounded-xl overflow-hidden"><table className="w-full text-left text-sm text-slate-300"><thead className="bg-white/5 text-xs uppercase text-slate-400"><tr><th className="p-3">Truyện</th><th className="p-3">Trạng thái</th><th className="p-3">Views</th><th className="p-3 text-right">#</th></tr></thead><tbody className="divide-y divide-white/5">{comics.map(c => (<tr key={c.id} className="hover:bg-white/5"><td className="p-3 font-medium text-white flex items-center gap-3"><img src={c.coverImage} className="w-8 h-12 object-cover rounded" alt=""/><div><div className="line-clamp-1">{c.title}</div><div className="text-xs text-slate-500">{c.chapters?.length || 0} chương</div></div></td><td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${c.status === 'Hoàn thành' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>{c.status}</span></td><td className="p-3">{c.views.toLocaleString()}</td><td className="p-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => handleQuickAddChapter(c.id)} className="text-green-400"><Plus size={16}/></button><button onClick={() => handleStartEdit(c.id)} className="text-blue-400"><Edit size={16}/></button><button onClick={() => handleDeleteComic(c.id)} className="text-red-400"><Trash2 size={16}/></button></div></td></tr>))}</tbody></table></div>
            )}
            {isEditingChapter && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"><div className="bg-card border border-white/10 w-full max-w-2xl rounded-xl shadow-2xl"><div className="flex justify-between items-center p-4 border-b border-white/10"><h3 className="text-lg font-bold text-white">{chapterForm.id ? 'Sửa Chapter' : 'Thêm Mới'}</h3><button onClick={() => setIsEditingChapter(false)} className="text-slate-400 hover:text-white"><X size={20}/></button></div><div className="p-6 space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-slate-400 mb-1 block">Số (Order)</label><input type="number" value={chapterForm.number} onChange={e => setChapterForm({...chapterForm, number: parseFloat(e.target.value)})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div><div><label className="text-xs text-slate-400 mb-1 block">Tên hiển thị</label><input type="text" value={chapterForm.title} onChange={e => setChapterForm({...chapterForm, title: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div></div><div><div className="flex justify-between items-center mb-1"><label className="text-xs text-slate-400">Link ảnh (Mỗi dòng 1 link)</label><label className="text-xs bg-blue-600 px-3 py-1 rounded cursor-pointer flex items-center gap-1 text-white"><input type="file" multiple accept="image/*" className="hidden" ref={chapterInputRef} onChange={handleChapterImagesUpload}/>{isUploadingFile ? <RefreshCw size={12} className="animate-spin"/> : <Upload size={12}/>} Upload</label></div><textarea value={chapterForm.pagesContent} onChange={e => setChapterForm({...chapterForm, pagesContent: e.target.value})} className="w-full h-64 bg-dark border border-white/10 rounded p-2 text-white text-sm font-mono whitespace-pre"></textarea></div><div className="flex justify-end gap-2 pt-2"><button onClick={() => setIsEditingChapter(false)} className="px-4 py-2 rounded bg-white/5 text-slate-300">Hủy</button><button onClick={handleSaveChapter} disabled={isUploadingFile} className="px-4 py-2 rounded bg-primary text-white font-bold flex items-center gap-2">{isUploadingFile ? 'Đang tải...' : <><Save size={18}/> Lưu</>}</button></div></div></div></div>)}
        </div>
    );

    const renderGenresTab = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Quản lý Thể loại</h2>
            <div className="bg-card border border-white/10 p-4 rounded-xl">
                <div className="flex gap-2 mb-4">
                    <input type="text" placeholder="Tên thể loại" value={genreForm.name} onChange={e => setGenreForm({...genreForm, name: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white"/>
                    <input type="text" placeholder="Slug (tùy chọn)" value={genreForm.slug} onChange={e => setGenreForm({...genreForm, slug: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white"/>
                    <label className="flex items-center gap-2 text-slate-300 px-2 cursor-pointer select-none"><input type="checkbox" checked={genreForm.isShowHome || false} onChange={e => setGenreForm({...genreForm, isShowHome: e.target.checked})}/> Hiện trang chủ</label>
                    <button onClick={handleSaveGenre} className="bg-primary text-white px-4 py-2 rounded flex items-center gap-2"><Save size={16}/> Lưu</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-white/5 uppercase text-xs"><tr><th className="p-3">Tên</th><th className="p-3">Slug</th><th className="p-3">Trang chủ</th><th className="p-3 text-right">Xóa</th></tr></thead>
                        <tbody>
                            {genres.map(g => (
                                <tr key={g.id} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="p-3 cursor-pointer hover:text-primary" onClick={() => setGenreForm(g)}>{g.name}</td>
                                    <td className="p-3">{g.slug}</td>
                                    <td className="p-3">{g.isShowHome ? <Check size={16} className="text-green-500"/> : <X size={16} className="text-slate-500"/>}</td>
                                    <td className="p-3 text-right"><button onClick={() => handleDeleteGenre(g.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderAdsTab = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Quản lý Quảng cáo</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-card border border-white/10 p-4 rounded-xl h-fit">
                    <h3 className="font-bold text-white mb-4">Thêm / Sửa Quảng Cáo</h3>
                    <div className="space-y-3">
                        <div><label className="text-xs text-slate-400">Tiêu đề (Ghi chú)</label><input type="text" value={adForm.title || ''} onChange={e => setAdForm({...adForm, title: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div>
                        <div>
                            <label className="text-xs text-slate-400">Vị trí</label>
                            <select value={adForm.position} onChange={e => setAdForm({...adForm, position: e.target.value as any})} className="w-full bg-dark border border-white/10 rounded p-2 text-white">
                                {Object.keys(AD_DIMENSIONS).map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                            <p className="text-[10px] text-primary mt-1">{AD_DIMENSIONS[adForm.position]}</p>
                        </div>
                        <div>
                             <label className="text-xs text-slate-400">Ảnh Banner</label>
                             <div className="flex gap-2">
                                <input type="text" value={adForm.imageUrl} onChange={e => setAdForm({...adForm, imageUrl: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white" placeholder="URL ảnh"/>
                                <label className="bg-blue-600 hover:bg-blue-700 p-2 rounded text-white cursor-pointer"><input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'ad')}/><Upload size={16}/></label>
                             </div>
                        </div>
                        <div><label className="text-xs text-slate-400">Link Đích</label><input type="text" value={adForm.linkUrl} onChange={e => setAdForm({...adForm, linkUrl: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div>
                        <label className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={adForm.isActive} onChange={e => setAdForm({...adForm, isActive: e.target.checked})}/> Kích hoạt</label>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setAdForm({ id: '', position: 'home_middle', imageUrl: '', linkUrl: '', isActive: true, title: '' })} className="px-3 py-2 bg-white/5 rounded text-slate-300">Reset</button>
                            <button onClick={handleSaveAd} className="px-3 py-2 bg-primary text-white rounded font-bold">Lưu Ad</button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                    {ads.map(ad => (
                        <div key={ad.id} className="bg-card border border-white/10 p-3 rounded-lg flex gap-4 items-center">
                            <img src={ad.imageUrl} alt="" className="w-24 h-16 object-cover rounded bg-black"/>
                            <div className="flex-1">
                                <div className="font-bold text-white text-sm">{ad.title || 'No Title'} <span className="text-xs font-normal text-slate-400">({ad.position})</span></div>
                                <div className="text-xs text-slate-500 truncate">{ad.linkUrl}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setAdForm(ad)} className="p-2 hover:bg-white/10 rounded text-blue-400"><Edit size={16}/></button>
                                <button onClick={() => handleDeleteAd(ad.id)} className="p-2 hover:bg-white/10 rounded text-red-400"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderUsersTab = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Quản lý Thành viên</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-white/10 p-4 rounded-xl h-fit">
                    <h3 className="font-bold text-white mb-4">Thêm / Sửa User</h3>
                    <div className="space-y-3">
                        <input type="text" placeholder="Username" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/>
                        <input type="password" placeholder="Password (để trống nếu không đổi)" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/>
                        <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})} className="w-full bg-dark border border-white/10 rounded p-2 text-white">
                            <option value="admin">Admin</option>
                            <option value="editor">Editor</option>
                        </select>
                        <button onClick={handleSaveUser} className="w-full bg-primary text-white py-2 rounded font-bold">Lưu User</button>
                    </div>
                </div>
                <div className="md:col-span-2">
                    <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-white/5 uppercase text-xs"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3 text-right">#</th></tr></thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                                        <td className="p-3 font-bold text-white" onClick={() => setUserForm({...u, password: ''})}>{u.username}</td>
                                        <td className="p-3 uppercase text-xs">{u.role}</td>
                                        <td className="p-3 text-right"><button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16}/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderReportsTab = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Báo cáo lỗi</h2>
                <button 
                    onClick={loadData} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Làm mới
                </button>
            </div>
            <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-white/5 uppercase text-xs"><tr><th className="p-3">Truyện</th><th className="p-3">Chapter</th><th className="p-3">Nội dung</th><th className="p-3">Thời gian</th><th className="p-3 text-right">#</th></tr></thead>
                    <tbody>
                        {reports.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-slate-500">Không có báo cáo nào.</td></tr> : reports.map(r => (
                            <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="p-3 text-white">{r.comicTitle || r.comicId}</td>
                                <td className="p-3">{r.chapterTitle || r.chapterId}</td>
                                <td className="p-3 text-red-400">{r.message}</td>
                                <td className="p-3 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                                <td className="p-3 text-right"><button onClick={() => handleDeleteReport(r.id)} className="text-slate-400 hover:text-white"><Trash2 size={16}/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderCommentsTab = () => {
        const approvedComments = comments.filter(c => c.isApproved);
        const pendingComments = comments.filter(c => !c.isApproved);

        return (
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">Quản lý Bình luận</h2>
                    <button 
                        onClick={loadData} 
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Làm mới
                    </button>
                </div>
                
                {/* Pending */}
                <div className="bg-card border border-white/10 rounded-xl p-6">
                    <h3 className="font-bold text-yellow-500 mb-4 flex items-center gap-2">
                        <Clock size={20}/> Chờ duyệt ({pendingComments.length})
                    </h3>
                    <div className="space-y-4">
                        {pendingComments.map(c => (
                            <div key={c.id} className="bg-dark border border-white/10 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start">
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-white">{c.userName} <span className="text-slate-500 font-normal">đã bình luận về</span> <span className="text-primary">{c.comicTitle || c.comicId}</span></span>
                                        <span className="text-xs text-slate-500">{new Date(c.date).toLocaleString()}</span>
                                    </div>
                                    <p className="text-sm text-slate-300">{c.content}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleApproveComment(c.id)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium flex items-center gap-1"><Check size={16}/> Duyệt</button>
                                    <button onClick={() => handleDeleteComment(c.id)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium flex items-center gap-1"><Trash2 size={16}/> Xóa</button>
                                </div>
                            </div>
                        ))}
                        {pendingComments.length === 0 && <div className="text-center text-slate-500 italic">Không có bình luận chờ duyệt.</div>}
                    </div>
                </div>

                {/* Approved */}
                <div className="bg-card border border-white/10 rounded-xl p-6">
                     <h3 className="font-bold text-green-500 mb-4 flex items-center gap-2">
                        <CheckCircle size={20}/> Đã duyệt ({approvedComments.length})
                    </h3>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                         {approvedComments.map(c => (
                            <div key={c.id} className="bg-dark/50 border border-white/5 rounded-lg p-4 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                         <span className="font-bold text-slate-300">{c.userName}</span>
                                         <span className="text-xs text-slate-500">• {new Date(c.date).toLocaleDateString()}</span>
                                         <span className="text-xs text-slate-500">• {c.comicTitle}</span>
                                    </div>
                                    <p className="text-sm text-slate-400">{c.content}</p>
                                </div>
                                <button onClick={() => handleDeleteComment(c.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={16}/></button>
                            </div>
                         ))}
                    </div>
                </div>
            </div>
        );
    }

    const renderSettingsTab = () => (
        <div className="w-full space-y-6">
            <h2 className="text-2xl font-bold text-white">Cấu hình Giao diện & SEO</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* Column 1: Colors & Fonts */}
                <div className="bg-card border border-white/10 p-6 rounded-xl space-y-5 h-full flex flex-col">
                    <h3 className="font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2"><Palette size={18}/> Màu sắc & Font chữ</h3>
                    
                    <div className="flex-1 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs text-slate-400 block mb-1">Màu Chủ Đạo</label><div className="flex items-center gap-2"><input type="color" value={themeConfig.primaryColor} onChange={e => setThemeConfig({...themeConfig, primaryColor: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/><span className="text-xs text-slate-500">{themeConfig.primaryColor}</span></div></div>
                            <div><label className="text-xs text-slate-400 block mb-1">Màu Phụ</label><div className="flex items-center gap-2"><input type="color" value={themeConfig.secondaryColor} onChange={e => setThemeConfig({...themeConfig, secondaryColor: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/><span className="text-xs text-slate-500">{themeConfig.secondaryColor}</span></div></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                            <div><label className="text-xs text-slate-400 block mb-1">Màu Nền Header</label><div className="flex items-center gap-2"><input type="color" value={themeConfig.headerBg || '#1c1917'} onChange={e => setThemeConfig({...themeConfig, headerBg: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/><span className="text-xs text-slate-500">{themeConfig.headerBg}</span></div></div>
                            <div><label className="text-xs text-slate-400 block mb-1">Màu Chữ Header</label><div className="flex items-center gap-2"><input type="color" value={themeConfig.headerText || '#e2e8f0'} onChange={e => setThemeConfig({...themeConfig, headerText: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/><span className="text-xs text-slate-500">{themeConfig.headerText}</span></div></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                            <div><label className="text-xs text-slate-400 block mb-1">Màu Nền Footer</label><div className="flex items-center gap-2"><input type="color" value={themeConfig.footerBg || '#292524'} onChange={e => setThemeConfig({...themeConfig, footerBg: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/><span className="text-xs text-slate-500">{themeConfig.footerBg}</span></div></div>
                            <div><label className="text-xs text-slate-400 block mb-1">Màu Chữ Footer</label><div className="flex items-center gap-2"><input type="color" value={themeConfig.footerText || '#94a3b8'} onChange={e => setThemeConfig({...themeConfig, footerText: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/><span className="text-xs text-slate-500">{themeConfig.footerText}</span></div></div>
                        </div>

                        <div className="border-t border-white/5 pt-4">
                            <label className="text-xs text-slate-400 block mb-1">Font chữ Website</label>
                            <select value={themeConfig.fontFamily} onChange={e => setThemeConfig({...themeConfig, fontFamily: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white">
                                {AVAILABLE_FONTS.map(font => (<option key={font.name} value={font.name}>{font.label}</option>))}
                            </select>
                        </div>

                        <div className="border-t border-white/5 pt-4 space-y-3">
                            <div><label className="text-xs text-slate-400 block mb-1">Tên Website</label><input type="text" value={themeConfig.siteName} onChange={e => setThemeConfig({...themeConfig, siteName: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div>
                            <div><label className="text-xs text-slate-400 block mb-1">Favicon URL</label><div className="flex gap-2"><input type="text" value={themeConfig.favicon || ''} onChange={e => setThemeConfig({...themeConfig, favicon: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white"/><label className="cursor-pointer bg-blue-600 px-3 py-2 rounded text-white"><input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'theme-favicon')} /><Upload size={16}/></label></div></div>
                        </div>

                        <div className="border-t border-white/5 pt-4 space-y-3">
                            <label className="text-xs text-slate-400 block mb-1 font-bold">Bố cục Trang chủ</label>
                            <div className="bg-dark/30 border border-white/5 rounded-lg p-3 space-y-2">
                                <label className="flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer select-none"><input type="checkbox" checked={themeConfig.homeLayout?.showSlider ?? true} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...(themeConfig.homeLayout || DEFAULT_THEME.homeLayout), showSlider: e.target.checked}})} className="w-4 h-4 accent-primary rounded bg-dark border-white/20"/><span>Hiển thị Slider Banner</span></label>
                                <label className="flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer select-none"><input type="checkbox" checked={themeConfig.homeLayout?.showHot ?? true} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...(themeConfig.homeLayout || DEFAULT_THEME.homeLayout), showHot: e.target.checked}})} className="w-4 h-4 accent-primary rounded bg-dark border-white/20"/><span>Hiển thị Truyện Hot</span></label>
                                <label className="flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer select-none"><input type="checkbox" checked={themeConfig.homeLayout?.showNew ?? true} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...(themeConfig.homeLayout || DEFAULT_THEME.homeLayout), showNew: e.target.checked}})} className="w-4 h-4 accent-primary rounded bg-dark border-white/20"/><span>Hiển thị Truyện Mới</span></label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 2: Menus & SEO */}
                <div className="space-y-6 flex flex-col h-full">
                    <div className="bg-card border border-white/10 p-6 rounded-xl flex-1">
                        <h3 className="font-bold text-white border-b border-white/10 pb-2 mb-4 flex items-center gap-2"><Menu size={18}/> Cấu hình Menu</h3>
                        {renderMenuEditor(themeConfig.headerMenu || [], (items) => setThemeConfig({ ...themeConfig, headerMenu: items }), "Menu Header (Trên cùng)")}
                        {renderMenuEditor(themeConfig.footerMenu || [], (items) => setThemeConfig({ ...themeConfig, footerMenu: items }), "Menu Footer (Chân trang)")}
                    </div>

                    <div className="bg-card border border-white/10 p-6 rounded-xl space-y-4">
                        <h3 className="font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2"><Globe size={18}/> Cấu hình SEO</h3>
                        <div><h4 className="text-xs font-bold text-primary uppercase mb-2">Trang Chủ</h4><div className="space-y-2"><input type="text" placeholder="Meta Title" value={themeConfig.homeMetaTitle || ''} onChange={e => setThemeConfig({...themeConfig, homeMetaTitle: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm"/><textarea placeholder="Meta Description" value={themeConfig.homeMetaDescription || ''} onChange={e => setThemeConfig({...themeConfig, homeMetaDescription: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm h-16"/></div></div>
                        <div className="border-t border-white/5 pt-3"><h4 className="text-xs font-bold text-primary uppercase mb-2">Trang Danh Sách Thể Loại</h4><div className="space-y-2"><input type="text" placeholder="Meta Title" value={themeConfig.categoriesMetaTitle || ''} onChange={e => setThemeConfig({...themeConfig, categoriesMetaTitle: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm"/><textarea placeholder="Meta Description" value={themeConfig.categoriesMetaDescription || ''} onChange={e => setThemeConfig({...themeConfig, categoriesMetaDescription: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm h-16"/></div></div>
                    </div>
                </div>
            </div>

            <div className="bg-card border border-white/10 p-6 rounded-xl"><h3 className="font-bold text-white border-b border-white/10 pb-2 mb-4">Footer Content (HTML/Text)</h3><SimpleEditor value={themeConfig.footerContent || ''} onChange={val => setThemeConfig({...themeConfig, footerContent: val})} height="150px" /></div>
            <button onClick={handleSaveTheme} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-xl shadow-primary/20 text-lg flex items-center justify-center gap-2 transition-transform hover:-translate-y-1"><Save size={24}/> Lưu Toàn Bộ Cấu Hình</button>
        </div>
    );
    
    const renderStaticTab = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-white">Trang tĩnh</h2><button onClick={handleSeedStaticPages} className="text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded flex items-center gap-2"><RefreshCw size={14}/> Reset Mẫu</button></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-card border border-white/10 p-4 rounded-xl h-fit space-y-3">
                    <h3 className="font-bold text-white">Sửa trang</h3>
                    <input type="text" placeholder="Tiêu đề" value={staticForm.title} onChange={e => setStaticForm({...staticForm, title: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/>
                    <input type="text" placeholder="Slug (URL)" value={staticForm.slug} onChange={e => setStaticForm({...staticForm, slug: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/>
                    <SimpleEditor value={staticForm.content} onChange={val => setStaticForm({...staticForm, content: val})} height="300px"/>
                    <button onClick={handleSaveStatic} className="w-full bg-primary text-white py-2 rounded font-bold">Lưu Trang</button>
                </div>
                <div className="lg:col-span-2 bg-card border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-white/5 uppercase text-xs"><tr><th className="p-3">Tiêu đề</th><th className="p-3">Slug</th></tr></thead>
                        <tbody>
                            {staticPages.map(p => (
                                <tr key={p.slug} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setStaticForm(p)}>
                                    <td className="p-3 text-white font-medium hover:text-primary">{p.title}</td>
                                    <td className="p-3 text-slate-500">{p.slug}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderMediaTab = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-white">Thư viện ảnh</h2><label className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded font-bold cursor-pointer flex items-center gap-2"><input type="file" multiple accept="image/*" className="hidden" ref={mediaInputRef} onChange={handleMediaUpload}/>{isUploadingFile ? <RefreshCw size={18} className="animate-spin"/> : <Upload size={18}/>} Upload Ảnh</label></div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {mediaFiles.map((file, idx) => (
                    <div key={idx} className="bg-card border border-white/10 rounded-lg overflow-hidden group relative">
                        <div className="aspect-square bg-black/50 flex items-center justify-center overflow-hidden">
                            <img src={file.url} alt={file.name} className="w-full h-full object-cover transition-transform group-hover:scale-110"/>
                        </div>
                        <div className="p-2 bg-dark border-t border-white/5">
                            <div className="text-xs text-white truncate font-medium mb-1" title={file.name}>{file.name}</div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-slate-500">{formatFileSize(file.size)}</span>
                                <div className="flex gap-1">
                                    <button onClick={() => copyToClipboard(file.url)} className="p-1 hover:bg-white/10 rounded text-blue-400" title="Copy Link"><Copy size={12}/></button>
                                    <button onClick={() => handleDeleteMedia(file.name)} className="p-1 hover:bg-white/10 rounded text-red-400" title="Xóa"><Trash2 size={12}/></button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderDashboard = () => {
        // Calculations
        const topComics = [...comics].sort((a, b) => b.views - a.views).slice(0, 5);
        const latestComics = [...comics].sort((a, b) => new Date(b.chapters[0]?.updatedAt || 0).getTime() - new Date(a.chapters[0]?.updatedAt || 0).getTime()).slice(0, 5);

        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* 1. Existing Top Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-card p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-bl-full group-hover:bg-blue-500/10 transition-colors"></div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="p-3 bg-blue-500/20 text-blue-500 rounded-lg"><BookOpen size={24}/></div>
                            <span className="text-xs text-slate-400 font-bold bg-white/5 px-2 py-1 rounded">+12 tuần này</span>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-1 relative z-10">{comics.length}</h3>
                        <p className="text-slate-400 text-sm relative z-10">Đầu truyện</p>
                    </div>

                    <div className="bg-card p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group hover:border-green-500/30 transition-colors">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-green-500/5 rounded-bl-full group-hover:bg-green-500/10 transition-colors"></div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="p-3 bg-green-500/20 text-green-400 rounded-lg"><Users size={24}/></div>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-1 relative z-10">{users.length}</h3>
                        <p className="text-slate-400 text-sm relative z-10">Thành viên</p>
                    </div>

                    <div className="bg-card p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group hover:border-orange-500/30 transition-colors">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/5 rounded-bl-full group-hover:bg-orange-500/10 transition-colors"></div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="p-3 bg-orange-500/20 text-orange-500 rounded-lg"><Flag size={24}/></div>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-1 relative z-10">{reports.length}</h3>
                        <p className="text-slate-400 text-sm relative z-10">Báo cáo lỗi</p>
                    </div>

                    <div className="bg-card p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group hover:border-purple-500/30 transition-colors">
                        <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-bl-full group-hover:bg-purple-500/10 transition-colors"></div>
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div className="p-3 bg-purple-500/20 text-purple-500 rounded-lg"><List size={24}/></div>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-1 relative z-10">{genres.length}</h3>
                        <p className="text-slate-400 text-sm relative z-10">Thể loại</p>
                    </div>
                </div>

                {/* 2. Main Stats Section: Traffic & Leaderboard */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: General Analytics */}
                    <div className="lg:col-span-1 bg-card border border-white/10 rounded-xl shadow-lg p-6 flex flex-col gap-6">
                         <div className="flex items-center gap-2 mb-2">
                             <div className="p-2 bg-primary/20 rounded-lg text-primary"><Activity size={20} /></div>
                             <h3 className="text-lg font-bold text-white">Tổng quan lượt xem</h3>
                         </div>
                         
                         {/* Total Views Big Card */}
                         <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 rounded-xl p-6 text-center">
                             <span className="text-slate-400 text-sm uppercase tracking-wider">Tổng lượt xem trang web</span>
                             <div className="text-4xl lg:text-5xl font-extrabold text-white mt-2 mb-1 drop-shadow-lg">
                                 {analytics.totalViews.toLocaleString()}
                             </div>
                             <div className="text-green-400 text-xs font-medium flex items-center justify-center gap-1">
                                 <TrendingUp size={12}/> +5.2% so với tháng trước
                             </div>
                         </div>

                         {/* Mini Stats */}
                         <div className="space-y-4">
                             <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                 <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500"><Calendar size={16}/></div>
                                     <div className="flex flex-col">
                                         <span className="text-sm font-medium text-slate-300">Hôm nay</span>
                                         <span className="text-xs text-slate-500">Thống kê</span>
                                     </div>
                                 </div>
                                 <span className="font-bold text-white">{analytics.todayViews.toLocaleString()}</span>
                             </div>

                             <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                 <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500"><BarChart3 size={16}/></div>
                                     <div className="flex flex-col">
                                         <span className="text-sm font-medium text-slate-300">Tháng này</span>
                                         <span className="text-xs text-slate-500">Thống kê</span>
                                     </div>
                                 </div>
                                 <span className="font-bold text-white">{analytics.monthViews.toLocaleString()}</span>
                             </div>
                             
                             <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                                 <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500"><MousePointerClick size={16}/></div>
                                     <div className="flex flex-col">
                                         <span className="text-sm font-medium text-slate-300">Trung bình / Truyện</span>
                                         <span className="text-xs text-slate-500">Hiệu suất</span>
                                     </div>
                                 </div>
                                 <span className="font-bold text-white">{comics.length > 0 ? (analytics.totalViews / comics.length).toFixed(0) : 0}</span>
                             </div>
                         </div>
                    </div>

                    {/* Right: Leaderboard */}
                    <div className="lg:col-span-2 bg-card border border-white/10 rounded-xl shadow-lg flex flex-col">
                        <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500"><TrendingUp size={20} /></div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Top Truyện Xem Nhiều</h3>
                                    <p className="text-xs text-slate-500">Thống kê theo lượt xem thực tế</p>
                                </div>
                            </div>
                            
                            {/* Time Filters */}
                            <div className="flex bg-dark p-1 rounded-lg border border-white/10">
                                {['day', 'week', 'month'].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTopComicsTimeframe(t as any)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${topComicsTimeframe === t ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        {t === 'day' ? 'Hôm nay' : t === 'week' ? 'Tuần này' : 'Tháng này'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto">
                            <div className="space-y-6">
                                {topComics.map((comic, index) => {
                                    const maxViews = topComics[0]?.views || 1;
                                    const percentage = (comic.views / maxViews) * 100;
                                    
                                    return (
                                        <div key={comic.id} className="relative group">
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${index === 0 ? 'bg-yellow-500 text-black' : index === 1 ? 'bg-slate-300 text-black' : index === 2 ? 'bg-orange-700 text-white' : 'bg-white/10 text-slate-400'}`}>
                                                    {index + 1}
                                                </div>
                                                <img src={comic.coverImage} className="w-10 h-14 object-cover rounded bg-dark border border-white/10" alt={comic.title} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-sm font-bold text-white truncate pr-2 group-hover:text-primary transition-colors cursor-pointer" onClick={() => handleStartEdit(comic.id)}>{comic.title}</span>
                                                        <span className="text-xs font-bold text-slate-300">{comic.views.toLocaleString()}</span>
                                                    </div>
                                                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${index === 0 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-primary'}`} 
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="mt-6 pt-4 border-t border-white/5 text-center">
                                <p className="text-[10px] text-slate-500 italic">* Dữ liệu hiển thị dựa trên tổng lượt xem tích lũy.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Bottom Grid: System & Recent */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     {/* System Status */}
                     <div className="bg-card border border-white/10 rounded-xl p-6">
                         <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                             <HardDrive size={18} className="text-slate-400"/> Trạng thái hệ thống
                         </h3>
                         <div className="space-y-4">
                             <div>
                                 <div className="flex justify-between text-xs mb-1">
                                     <span className="text-slate-400">Dung lượng ảnh (Ước tính)</span>
                                     <span className="text-white font-bold">{(comics.length * 15 + 120).toFixed(0)} MB / 5 GB</span>
                                 </div>
                                 <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                     <div className="h-full bg-blue-500 w-[5%]"></div>
                                 </div>
                             </div>
                             <div>
                                 <div className="flex justify-between text-xs mb-1">
                                     <span className="text-slate-400">Database Records</span>
                                     <span className="text-white font-bold">{(comics.length * 20 + 500)} rows</span>
                                 </div>
                                 <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                     <div className="h-full bg-green-500 w-[12%]"></div>
                                 </div>
                             </div>
                             <div className="pt-2 flex gap-2">
                                 <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/20">Server: Online</span>
                                 <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/20">Database: Connected</span>
                             </div>
                         </div>
                     </div>

                     {/* Recent Updates */}
                     <div className="bg-card border border-white/10 rounded-xl p-6">
                         <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                             <Clock size={18} className="text-slate-400"/> Vừa cập nhật
                         </h3>
                         <div className="space-y-3">
                             {latestComics.slice(0, 3).map(c => (
                                 <div key={c.id} className="flex gap-3 items-center p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer" onClick={() => handleStartEdit(c.id)}>
                                     <img src={c.coverImage} className="w-10 h-10 object-cover rounded" alt=""/>
                                     <div className="flex-1 min-w-0">
                                         <div className="text-sm font-medium text-white truncate">{c.title}</div>
                                         <div className="text-xs text-slate-500">
                                             {c.chapters[0] ? `Đã đăng ${c.chapters[0].title}` : 'Chưa có chương'}
                                         </div>
                                     </div>
                                     <div className="text-[10px] text-slate-500 whitespace-nowrap">
                                         {c.chapters[0]?.updatedAt ? new Date(c.chapters[0].updatedAt).toLocaleDateString() : 'N/A'}
                                     </div>
                                 </div>
                             ))}
                             <button onClick={() => setActiveTab('comics')} className="w-full text-center text-xs text-primary hover:underline pt-2">Xem tất cả truyện</button>
                         </div>
                     </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-darker flex text-slate-200">
             <AppModal 
                isOpen={modal.isOpen} 
                type={modal.type} 
                title={modal.title} 
                message={modal.message} 
                confirmText={modal.confirmText}
                defaultValue={modal.defaultValue}
                onConfirm={modal.onConfirm} 
                onClose={closeModal} 
             />
             
             {/* Sidebar */}
             <div className="w-64 bg-card border-r border-white/10 hidden md:flex flex-col flex-shrink-0">
                 <div className="h-16 flex items-center px-6 border-b border-white/10">
                     <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Admin Panel</span>
                 </div>
                 <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                     {[
                         {id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard},
                         {id: 'comics', label: 'Truyện tranh', icon: BookOpen},
                         {id: 'comments', label: 'Bình luận', icon: MessageSquare},
                         {id: 'genres', label: 'Thể loại', icon: List},
                         {id: 'media', label: 'Thư viện ảnh', icon: ImageIcon},
                         {id: 'ads', label: 'Quảng cáo', icon: LayoutDashboard},
                         {id: 'users', label: 'Thành viên', icon: Users},
                         {id: 'reports', label: 'Báo lỗi', icon: AlertTriangle},
                         {id: 'static', label: 'Trang tĩnh', icon: FileText},
                         {id: 'settings', label: 'Cấu hình', icon: Settings},
                     ].map(item => (
                         <button 
                            key={item.id}
                            onClick={() => setActiveTab(item.id as any)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                         >
                             <item.icon size={18}/> {item.label}
                         </button>
                     ))}
                 </nav>
                 <div className="p-4 border-t border-white/10">
                     <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-sm px-2"><ArrowLeft size={16}/> Về trang chủ</Link>
                     <button onClick={AuthService.logout} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm px-2 font-medium w-full"><LogOut size={16}/> Đăng xuất</button>
                 </div>
             </div>
             
             {/* Mobile Header */}
             <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-white/10 flex items-center justify-between px-4 z-50">
                <span className="font-bold text-white">Admin Panel</span>
                <button onClick={AuthService.logout}><LogOut size={20} className="text-red-400"/></button>
             </div>

             {/* Content */}
             <div className="flex-1 overflow-y-auto h-screen relative pt-16 md:pt-0">
                 <div className="p-4 md:p-8 max-w-full mx-auto">
                    {activeTab === 'dashboard' && renderDashboard()}
                    {activeTab === 'comics' && renderComicsTab()}
                    {activeTab === 'genres' && renderGenresTab()}
                    {activeTab === 'ads' && renderAdsTab()}
                    {activeTab === 'users' && renderUsersTab()}
                    {activeTab === 'reports' && renderReportsTab()}
                    {activeTab === 'comments' && renderCommentsTab()}
                    {activeTab === 'settings' && renderSettingsTab()}
                    {activeTab === 'static' && renderStaticTab()}
                    {activeTab === 'media' && renderMediaTab()}
                 </div>
             </div>
        </div>
    );
};

export default Admin;
