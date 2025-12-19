
import React, { useEffect, useState, useRef } from 'react';
import { 
    LayoutDashboard, BookOpen, List, Users, Settings, Image as ImageIcon, 
    Plus, Edit, Trash2, Save, X, ChevronRight, ChevronDown, 
    Search, Upload, Palette, Globe, Menu, MessageSquare, Flag,
    FileText, Link as LinkIcon, Download, Code, GripVertical, AlertTriangle, RefreshCw, Copy, LogOut, ArrowLeft, Check, CheckCircle,
    TrendingUp, BarChart3, Calendar, Activity, HardDrive, Clock, MousePointerClick, Star, ShieldCheck, KeyRound, Folder, LayoutGrid, Shrink, Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DataProvider } from '../services/dataProvider';
import { AuthService } from '../services/auth';
import { Comic, Genre, AdConfig, User, StaticPage, ThemeConfig, Report, Chapter, MediaFile, Analytics, Comment, LeechConfig, LeechJob, SystemStats } from '../types';
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

// NEW: Image compression utility
export const compressImage = (file: File, quality = 0.85, maxDimensions = 1200): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxDimensions || height > maxDimensions) {
          if (width > height) {
            height = Math.round((height * maxDimensions) / width);
            width = maxDimensions;
          } else {
            width = Math.round((width * maxDimensions) / height);
            height = maxDimensions;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Canvas toBlob failed'));
            // Force JPEG for better compression, use original name
            const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(newFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const slugify = (str: string) => {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove diacritics
    str = str.replace(/đ/g, 'd'); // replace đ with d
    str = str.replace(/[^a-z0-9\s-]/g, ''); // remove invalid chars
    str = str.replace(/\s+/g, '-'); // collapse whitespace and replace by -
    str = str.replace(/-+/g, '-'); // collapse dashes
    str = str.replace(/^-+|-+$/g, ''); // trim dashes
    return str;
};

// --- GENERIC LEECH PARSERS ---

const genericParseChapterImagesHtml = (html: string, config: LeechConfig) => {
    const images: string[] = [];
    let origin = config.baseUrl;
    try {
        origin = new URL(config.baseUrl).origin;
    } catch (e) {}

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const imageElements = doc.querySelectorAll(config.chapterImageSelector);
    const srcAttrs = config.imageSrcAttribute.split(',').map(s => s.trim());

    imageElements.forEach(img => {
        let src: string | null = null;
        for (const attr of srcAttrs) {
            src = img.getAttribute(attr);
            if (src) break;
        }

        if (src) {
            src = src.trim();
            if (src.startsWith('//')) src = 'https:' + src;
            else if (src.startsWith('/')) src = origin + src;
            else if (!src.startsWith('http')) src = origin + '/' + src;

            if (!images.includes(src)) images.push(src);
        }
    });

    return [...new Set(images)];
};


const genericParseComicHtml = (html: string, config: LeechConfig) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const origin = new URL(config.baseUrl).origin;

    let title = doc.querySelector(config.comicTitleSelector)?.textContent?.trim() || '';
    
    let coverImage = '';
    const coverEl = doc.querySelector(config.comicCoverSelector);
    if (coverEl) {
        let src = coverEl.getAttribute('src') || coverEl.getAttribute('content');
        if (src) {
            if (src.startsWith('//')) src = 'https:' + src;
            if (!src.startsWith('http')) src = origin + (src.startsWith('/') ? '' : '/') + src;
            coverImage = src;
        }
    }
    
    const descriptionNodes = doc.querySelectorAll(config.comicDescriptionSelector);
    const description = Array.from(descriptionNodes)
        .map(node => node.textContent?.trim() || '') 
        .filter(Boolean)
        .join('\n');
    
    let author = '';
    if (config.comicAuthorSelector) {
        const authorEl = doc.querySelector(config.comicAuthorSelector);
        if (authorEl) {
            author = (authorEl.textContent || '').replace(/Tác giả\s*:/i, '').trim();
        }
    }

    const chapters: {url: string, title: string, number: number}[] = [];
    const links = doc.querySelectorAll(config.chapterLinkSelector);
    
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
                    const matchUrl = href.match(/(chapter|chap)[-._/]?(\d+(\.\d+)?)/i);
                    if (matchUrl) number = parseFloat(matchUrl[2]);
                }
                const finalTitle = rawText || `Chapter ${number}`;
                if (!chapters.some(c => c.url === href) && number >= 0) chapters.push({ url: href, title: finalTitle, number });
            }
        });
    }
    chapters.sort((a, b) => b.number - a.number);
    return { title, coverImage, description, chapters, author };
};

const initialLeechConfigForm: LeechConfig = { id: '', name: '', baseUrl: '', comicTitleSelector: 'h1', comicCoverSelector: 'img.book_avatar', comicAuthorSelector: '', uploadCoverImage: false, comicDescriptionSelector: '.detail-content', chapterLinkSelector: '.list-chapter a', chapterImageSelector: '.page-chapter img', imageSrcAttribute: 'src,data-src' };
const initialUserForm: User = { id: '', username: '', password: '', role: 'editor', permissions: [] };

const ALL_PERMISSIONS = [
    {id: 'dashboard', label: 'Dashboard'},
    {id: 'comics', label: 'Truyện tranh'},
    {id: 'comments', label: 'Bình luận'},
    {id: 'genres', label: 'Thể loại'},
    {id: 'media', label: 'Thư viện ảnh'},
    {id: 'ads', label: 'Quảng cáo'},
    {id: 'users', label: 'Thành viên'},
    {id: 'reports', label: 'Báo lỗi'},
    {id: 'static', label: 'Trang tĩnh'},
    {id: 'settings', label: 'Cấu hình'},
    {id: 'leech_configs', label: 'Cấu hình Leech'},
];

const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const Admin: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'comics' | 'genres' | 'settings' | 'users' | 'ads' | 'reports' | 'static' | 'media' | 'comments' | 'leech_configs'>('dashboard');
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
    const [leechConfigs, setLeechConfigs] = useState<LeechConfig[]>([]);
    const [leechJobs, setLeechJobs] = useState<LeechJob[]>([]); 
    const [mediaViewMode, setMediaViewMode] = useState<'grid' | 'tiles' | 'list'>('grid');
    const [mediaPath, setMediaPath] = useState<string[]>([]);
    const [comicSearchQuery, setComicSearchQuery] = useState(''); 
    const [systemStats, setSystemStats] = useState<SystemStats | null>(null); 
    const [compressingFile, setCompressingFile] = useState<string | null>(null); // NEW: Compression state

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
    const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

    // Form States
    const [isEditing, setIsEditing] = useState(false);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    // FIX: Add state for AI summarization
    const [summarizing, setSummarizing] = useState(false);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chapterInputRef = useRef<HTMLInputElement>(null);
    const mediaInputRef = useRef<HTMLInputElement>(null);
    const genreSelectRef = useRef<HTMLSelectElement>(null); 
    const isInitialMount = useRef(true); 

    // Drag-and-drop state for home genres
    const [draggedGenre, setDraggedGenre] = useState<{ name: string, slug: string } | null>(null);

    // Forms
    const [comicForm, setComicForm] = useState<Comic>({ id: '', title: '', coverImage: '', author: '', status: 'Đang tiến hành', genres: [], description: '', views: 0, chapters: [], isRecommended: false, slug: '', metaTitle: '', metaDescription: '', metaKeywords: '' });
    const [isEditingChapter, setIsEditingChapter] = useState(false);
    const [chapterForm, setChapterForm] = useState<{id: string, title: string, number: number, pagesContent: string}>({ id: '', title: '', number: 0, pagesContent: '' });
    const [genreForm, setGenreForm] = useState<Genre>({ id: '', name: '', slug: '', isShowHome: false });
    const [adForm, setAdForm] = useState<AdConfig>({ id: '', position: 'home_middle', imageUrl: '', linkUrl: '', isActive: true, title: '' });
    const [userForm, setUserForm] = useState<User>(initialUserForm);
    const [staticForm, setStaticForm] = useState<StaticPage>({ slug: '', title: '', content: '' });
    const [leechConfigForm, setLeechConfigForm] = useState<LeechConfig>(initialLeechConfigForm);
    const [editorPasswordForm, setEditorPasswordForm] = useState({ password: '' });

    // Leech States
    const [leechUrl, setLeechUrl] = useState('');
    const [selectedLeechConfigId, setSelectedLeechConfigId] = useState<string>('');
    const [leechSourceChapters, setLeechSourceChapters] = useState<{url: string, title: string, number: number}[]>([]);
    const [leechSelectedChapters, setLeechSelectedChapters] = useState<string[]>([]);
    const [leechProgress, setLeechProgress] = useState('');
    const [leechError, setLeechError] = useState<string | null>(null);
    const [leechStorageMode, setLeechStorageMode] = useState<'url' | 'upload'>('url');

    useEffect(() => {
        if (!AuthService.isAuthenticated()) { navigate('/login'); return; }

        if (isInitialMount.current) {
            const allTabs = [
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'comics', label: 'Truyện tranh', icon: BookOpen },
                { id: 'comments', label: 'Bình luận', icon: MessageSquare },
                { id: 'genres', label: 'Thể loại', icon: List },
                { id: 'media', label: 'Thư viện ảnh', icon: ImageIcon },
                { id: 'ads', label: 'Quảng cáo', icon: LayoutDashboard },
                { id: 'users', label: 'Thành viên', icon: Users },
                { id: 'reports', label: 'Báo lỗi', icon: Flag },
                { id: 'static', label: 'Trang tĩnh', icon: FileText },
                { id: 'settings', label: 'Cấu hình', icon: Settings },
                { id: 'leech_configs', label: 'Cấu hình Leech', icon: Download }
            ];

            const permittedTabs = allTabs.filter(tab => AuthService.hasPermission(tab.id));
            const currentTabHasPermission = permittedTabs.some(tab => tab.id === activeTab);

            if (permittedTabs.length > 0 && !currentTabHasPermission) {
                setActiveTab(permittedTabs[0].id as any);
            }
            isInitialMount.current = false;
        }

        loadData();
    }, [activeTab, mediaPath]);

    const loadData = async () => {
        setLoading(true);
        try {
            switch (activeTab) {
                case 'dashboard':
                    await Promise.all([
                        DataProvider.getComics().then(setComics),
                        DataProvider.getGenres().then(setGenres),
                        DataProvider.getUsers().then(setUsers),
                        DataProvider.getReports().then(setReports),
                        DataProvider.getAnalytics().then(setAnalytics),
                        DataProvider.getSystemStats().then(setSystemStats)
                    ]);
                    break;
                case 'comics':
                    await Promise.all([
                        DataProvider.getComics().then(setComics),
                        DataProvider.getGenres().then(setGenres),
                        DataProvider.getLeechConfigs().then(setLeechConfigs)
                    ]);
                    break;
                case 'genres':
                    setGenres(await DataProvider.getGenres());
                    break;
                case 'users':
                    setUsers(await DataProvider.getUsers());
                    break;
                case 'reports':
                    setReports(await DataProvider.getReports());
                    break;
                case 'ads':
                    setAds(await DataProvider.getAds());
                    break;
                case 'static':
                    setStaticPages(await DataProvider.getStaticPages());
                    break;
                case 'media':
                    const pathString = mediaPath.join('/');
                    setMediaFiles(await DataProvider.getMedia(pathString));
                    break;
                case 'comments':
                    setComments(await DataProvider.getComments());
                    break;
                case 'settings':
                    const [theme, genresForSettings] = await Promise.all([
                        DataProvider.getTheme(),
                        DataProvider.getGenres()
                    ]);
                    setThemeConfig({ ...DEFAULT_THEME, ...theme });
                    setGenres(genresForSettings);
                    break;
                case 'leech_configs':
                    setLeechConfigs(await DataProvider.getLeechConfigs());
                    break;
            }
        } catch (e: any) {
            console.error("Failed to load data for tab:", activeTab, e);
            showAlert(`Không thể tải dữ liệu cho mục này. Vui lòng kiểm tra kết nối Server Backend và thử lại. Lỗi: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };


    // --- Actions ---
    // FIX: Add handler for Gemini summarization
    const handleSummarizeDescription = async () => {
        if (!comicForm.title) {
            showAlert("Vui lòng nhập tên truyện trước khi tạo mô tả.", "Thiếu thông tin");
            return;
        }
        setSummarizing(true);
        try {
            const newDescription = await summarizeComic(comicForm.title, comicForm.description);
            setComicForm(prev => ({ ...prev, description: newDescription }));
        } catch (e: any) {
            console.error(e);
            showAlert("Không thể tạo mô tả. Lỗi: " + e.message, "Lỗi AI");
        } finally {
            setSummarizing(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: 'comic' | 'ad' | 'theme-favicon' | 'theme-logo') => {
        if (e.target.files?.[0]) {
            setIsUploadingFile(true);
            try {
                const compressedFile = await compressImage(e.target.files[0]);
                const url = await DataProvider.uploadImage(compressedFile, 'theme');
                if (url) {
                    if (targetField === 'comic') setComicForm(prev => ({ ...prev, coverImage: url }));
                    else if (targetField === 'ad') setAdForm(prev => ({ ...prev, imageUrl: url }));
                    else if (targetField === 'theme-favicon') setThemeConfig(prev => ({ ...prev, favicon: url }));
                    else if (targetField === 'theme-logo') setThemeConfig(prev => ({ ...prev, logoUrl: url }));
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
                    const compressedFile = await compressImage(e.target.files[i]);
                    const url = await DataProvider.uploadImage(compressedFile, slugify(comicForm.slug || comicForm.title), chapterForm.number, i + 1);
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
                const currentFolder = mediaPath.join('/');
                for (let i = 0; i < e.target.files.length; i++) {
                    const compressedFile = await compressImage(e.target.files[i]);
                    await DataProvider.uploadImage(compressedFile, currentFolder);
                }
                loadData();
            } catch (error) { showAlert("Lỗi upload."); } 
            finally { setIsUploadingFile(false); if (mediaInputRef.current) mediaInputRef.current.value = ''; }
        }
    };

    // NEW: Client-side URL fetcher and uploader with compression
    const uploadCompressedImageFromUrl = async (url: string, folder: string, chapterNum?: number, index?: number): Promise<string> => {
        try {
            const blob = await DataProvider.getImageBlob(url);
            if (!blob) throw new Error("Could not fetch image as blob via proxy.");

            const fileName = url.split('/').pop()?.split('?')[0] || `leech-${Date.now()}.jpg`;
            const originalFile = new File([blob], fileName, { type: blob.type });
            
            const compressedFile = await compressImage(originalFile);
            return await DataProvider.uploadImage(compressedFile, folder, chapterNum, index);
        } catch (e: any) {
            console.error('Client-side compression failed, falling back to server-side download for:', url, e.message);
            // Fallback to server-side download if client-side proxy/compression fails
            const newUrl = await DataProvider.uploadImageFromUrl(url, folder, chapterNum, index);
            return newUrl || url; // Return original url if server also fails
        }
    };

    const handleScanLeech = async () => {
        setLeechError(null); setLeechSourceChapters([]); setIsScanning(true); setLeechProgress('');
        const selectedConfig = leechConfigs.find(c => c.id === selectedLeechConfigId);

        if (!selectedConfig) {
            setLeechError("Vui lòng chọn một Server Leech.");
            setIsScanning(false);
            return;
        }

        try {
            let data;
            if (leechUrl && selectedConfig) {
                const result = await DataProvider.getProxiedHtml(leechUrl);
                data = genericParseComicHtml(result, {...selectedConfig, baseUrl: leechUrl});
            } else {
                 setLeechError("Vui lòng nhập Link truyện.");
                 setIsScanning(false);
                 return;
            }

            let finalCoverImage = data.coverImage;
            if (selectedConfig?.uploadCoverImage && data.coverImage) {
                setLeechProgress('⏳ Tải & nén ảnh bìa...');
                try {
                    const comicSlug = comicForm.slug || slugify(data.title);
                    const uploadedUrl = await uploadCompressedImageFromUrl(data.coverImage, comicSlug);
                    if (uploadedUrl) finalCoverImage = uploadedUrl;
                } catch (e) {
                    console.error("Failed to upload cover image:", e);
                    setLeechError('Không thể tải lên ảnh bìa.');
                }
                setLeechProgress('');
            }
            
            setComicForm(prev => ({ 
                ...prev, 
                title: prev.title || data.title, 
                author: prev.author || data.author,
                description: prev.description || data.description, 
                coverImage: prev.coverImage || finalCoverImage,
                slug: prev.slug || slugify(data.title)
            }));
            setLeechSourceChapters(data.chapters || []);

        } catch (err: any) {
             setLeechError(`${err.message}`);
        } finally {
            setIsScanning(false);
        }
    };

    const handleRunLeech = async () => {
        const selectedConfig = leechConfigs.find(c => c.id === selectedLeechConfigId);
        if (!selectedConfig) { showAlert("Vui lòng chọn Server Leech."); return; }
        if (leechSelectedChapters.length === 0) { showAlert("Chưa chọn chapter"); return; }
        
        let currentComicId = comicForm.id;
        if (!currentComicId) {
            currentComicId = `comic-${Date.now()}`;
            await DataProvider.saveComic({ ...comicForm, id: currentComicId, slug: comicForm.slug || slugify(comicForm.title) });
            setComicForm(prev => ({ ...prev, id: currentComicId }));
        }

        const chaptersToLeech = leechSourceChapters.filter(c => leechSelectedChapters.includes(c.url));
        const jobId = `leech-job-${Date.now()}`;
        const newJob: LeechJob = { id: jobId, comicId: currentComicId, comicTitle: comicForm.title, status: 'running', progressText: 'Bắt đầu...', totalChapters: chaptersToLeech.length, completedChapters: 0 };
        setLeechJobs(prev => [newJob, ...prev]);
        setLeechSelectedChapters([]); 

        let successCount = 0;
        try {
            for (const chap of chaptersToLeech) {
                setLeechJobs(prev => prev.map(j => j.id === jobId ? { ...j, progressText: `Đang quét: ${chap.title}...` } : j));
                
                try {
                    const result = await DataProvider.getProxiedHtml(chap.url);
                    let images = genericParseChapterImagesHtml(result, {...selectedConfig, baseUrl: chap.url});
                    
                    if (images.length > 0) {
                        if (leechStorageMode === 'upload') {
                            const uploadedUrls = [];
                            for (let i = 0; i < images.length; i++) {
                                setLeechJobs(prev => prev.map(j => j.id === jobId ? { ...j, progressText: `Đang tải & nén ảnh ${i+1}/${images.length} của ${chap.title}` } : j));
                                try {
                                    const comicSlug = comicForm.slug || slugify(comicForm.title);
                                    const upData = await uploadCompressedImageFromUrl(images[i], comicSlug, chap.number, i + 1);
                                    if (upData) uploadedUrls.push(upData);
                                    else uploadedUrls.push(images[i]); // Fallback
                                } catch (e) { 
                                    console.error("Upload error:", e);
                                    uploadedUrls.push(images[i]);
                                }
                            }
                            images = uploadedUrls;
                        }

                        if (images.length > 0) {
                            await DataProvider.saveChapter({ id: `${currentComicId}-chap-${chap.number}-${Date.now()}`, comicId: currentComicId, number: chap.number, title: chap.title, updatedAt: new Date().toISOString() }, images.map((url, idx) => ({ imageUrl: url, pageNumber: idx + 1 })));
                            successCount++;
                            setLeechJobs(prev => prev.map(j => j.id === jobId ? { ...j, completedChapters: successCount } : j));
                        }
                    }
                } catch (e) {
                    console.error(`Failed to leech ${chap.title}:`, e);
                }
                await new Promise(r => setTimeout(r, 200)); // Small delay
            }

            setLeechJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'completed', progressText: `Hoàn tất! Thành công: ${successCount}/${chaptersToLeech.length}` } : j));
        } catch (error: any) {
            setLeechJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'failed', progressText: `Lỗi: ${error.message}` } : j));
        } finally {
             if (currentComicId) { 
                const updated = await DataProvider.getComicById(currentComicId); 
                if (updated) setComicForm(updated); 
             }
        }
    };

    const handleStartEdit = async (id: string) => { setLoading(true); setComicForm({ id: '', title: '', coverImage: '', author: '', status: 'Đang tiến hành', genres: [], description: '', views: 0, chapters: [], isRecommended: false, slug: '', metaTitle: '', metaDescription: '', metaKeywords: '' }); setLeechSourceChapters([]); const f = await DataProvider.getComicById(id); if (f) { setComicForm(f); setIsEditing(true); } setLoading(false); };
    
    const handleSaveComic = async () => {
        const id = comicForm.id || `comic-${Date.now()}`;
        const slug = comicForm.slug || slugify(comicForm.title);
        await DataProvider.saveComic({ ...comicForm, id, slug });
        showConfirm("Đã lưu truyện thành công!", () => { setIsEditing(false); loadData(); }, 'Thành công', 'alert', 'OK');
    };

    const handleDeleteComic = async (id: string) => { showConfirm('Bạn có chắc muốn xóa truyện này? Hành động không thể hoàn tác.', async () => { await DataProvider.deleteComic(id); loadData(); }, 'Xóa Truyện', 'danger'); };
    const handleEditChapter = async (c: Chapter) => { setLoading(true); const p = await DataProvider.getChapterPages(c.id); setChapterForm({ id: c.id, title: c.title, number: c.number, pagesContent: p.map(x => x.imageUrl).join('\n') }); setIsEditingChapter(true); setLoading(false); };
    const handleAddChapter = () => { const n = comicForm.chapters.length > 0 ? Math.max(...comicForm.chapters.map(c => c.number)) + 1 : 1; setChapterForm({ id: '', title: `Chapter ${n}`, number: n, pagesContent: '' }); setIsEditingChapter(true); };
    const handleQuickAddChapter = async (id: string) => { await handleStartEdit(id); handleAddChapter(); };
    const handleSaveChapter = async () => { if (!comicForm.id) return showAlert("Lưu truyện trước!"); setIsUploadingFile(true); const cid = chapterForm.id || `${comicForm.id}-chap-${chapterForm.number}-${Date.now()}`; await DataProvider.saveChapter({ id: cid, comicId: comicForm.id, number: chapterForm.number, title: chapterForm.title, updatedAt: new Date().toISOString() }, chapterForm.pagesContent.split('\n').map(x => x.trim()).filter(Boolean).map((u, i) => ({ imageUrl: u, pageNumber: i + 1 }))); const updated = await DataProvider.getComicById(comicForm.id); if (updated) setComicForm(updated); setIsUploadingFile(false); setIsEditingChapter(false); };
    const handleDeleteChapter = async (id: string) => { showConfirm('Xóa chapter này?', async () => { await DataProvider.deleteChapter(id, comicForm.id); const u = await DataProvider.getComicById(comicForm.id); if (u) setComicForm(u); }, 'Xóa Chapter', 'danger'); };
    const handleSaveGenre = async () => { await DataProvider.saveGenre({ ...genreForm, id: genreForm.id || `g-${Date.now()}`, slug: genreForm.slug || slugify(genreForm.name) }); setGenreForm({ id: '', name: '', slug: '', isShowHome: false }); loadData(); showAlert("Đã lưu thể loại!"); };
    const handleDeleteGenre = async (id: string) => { showConfirm('Xóa thể loại này?', async () => { await DataProvider.deleteGenre(id); loadData(); }, 'Xóa Thể loại', 'danger'); };
    const handleSaveAd = async () => { await DataProvider.saveAd({ ...adForm, id: adForm.id || `ad-${Date.now()}` }); setAdForm({ id: '', position: 'home_middle', imageUrl: '', linkUrl: '', isActive: true, title: '' }); loadData(); showAlert("Đã lưu quảng cáo!"); };
    const handleDeleteAd = async (id: string) => { showConfirm('Xóa quảng cáo này?', async () => { await DataProvider.deleteAd(id); loadData(); }, 'Xóa Quảng cáo', 'danger'); };
    
    const handleSaveUser = async () => { 
        const isUpdating = !!userForm.id;
        await DataProvider.saveUser(userForm);
        showAlert(isUpdating ? "Đã cập nhật thông tin người dùng!" : "Đã tạo người dùng mới thành công!");
        setUserForm(initialUserForm); 
        loadData(); 
    };

    const handleDeleteUser = async (id: string | number) => { showConfirm('Xóa người dùng này?', async () => { await DataProvider.deleteUser(id); loadData(); }, 'Xóa User', 'danger'); };
    const handleSaveTheme = async () => { await DataProvider.saveTheme(themeConfig); showAlert("Đã lưu cấu hình thành công!"); window.location.reload(); };
    
    const handleSaveStatic = async () => {
        const formWithSlug = { ...staticForm, slug: staticForm.slug || slugify(staticForm.title) };
        if (!formWithSlug.title || !formWithSlug.slug) { showAlert("Tiêu đề và Slug không được để trống.", "Lỗi"); return; }
        const success = await DataProvider.saveStaticPage(formWithSlug);
        if (success) showConfirm("Đã lưu trang tĩnh!", () => { setStaticForm({ slug: '', title: '', content: '' }); loadData(); }, 'Thành công', 'alert');
        else showAlert("Lưu thất bại. Vui lòng kiểm tra kết nối server.", "Lỗi");
    };
    
    const handleSeedStaticPages = async () => { showConfirm('Tạo lại các trang tĩnh mẫu?', async () => { for (const p of SEED_STATIC_PAGES) await DataProvider.saveStaticPage(p); loadData(); showAlert("Đã tạo xong!") }); };
    const handleDeleteReport = async (id: string) => { showConfirm('Xóa báo cáo này?', async () => { await DataProvider.deleteReport(id); loadData(); }, 'Xóa Báo cáo', 'danger'); };
    const handleDeleteStaticPage = async (slug: string, title: string) => {
        showConfirm(`Bạn có chắc muốn xóa trang "${title}"?`, async () => {
            const success = await DataProvider.deleteStaticPage(slug);
            if (success) { showConfirm("Đã xóa trang tĩnh.", () => { if (staticForm.slug === slug) setStaticForm({ slug: '', title: '', content: '' }); loadData(); }, 'Thành công', 'alert'); }
            else { showAlert("Xóa trang thất bại.", "Lỗi"); }
        }, 'Xóa Trang Tĩnh', 'danger');
    };
    
    const handleMediaFolderClick = (folderName: string) => setMediaPath(prev => [...prev, folderName]);
    const handleMediaBreadcrumbClick = (index: number) => setMediaPath(prev => prev.slice(0, index + 1));
    const handleMediaRootClick = () => setMediaPath([]);
    
    const handleDeleteMedia = async (name: string, isDir: boolean) => {
        if (isDir) { showAlert("Không thể xóa thư mục từ giao diện này.", "Thao tác bị chặn"); return; }
        const currentPath = mediaPath.join('/');
        const fullPath = currentPath ? `${currentPath}/${name}` : name;
        showConfirm(`Xóa file ${name}? Hành động này không thể hoàn tác.`, async () => { 
            const success = await DataProvider.deleteMedia(fullPath); 
            if (success) { showAlert("Đã xóa file."); loadData(); } 
            else { showAlert("Xóa file thất bại.", "Lỗi"); }
        }, 'Xóa Ảnh', 'danger'); 
    };

    const handleCompressImage = async (filePath: string) => {
        setCompressingFile(filePath);
        try {
            const blob = await DataProvider.getImageBlob(filePath);
            if (!blob) throw new Error('Không thể tải dữ liệu ảnh.');
            
            const originalFile = new File([blob], filePath.split('/').pop()!, { type: blob.type });

            const compressedFile = await compressImage(originalFile);

            const pathParts = new URL(filePath, window.location.origin).pathname.replace('/uploads/', '').split('/');
            pathParts.pop(); // remove filename
            const folder = pathParts.join('/');

            await DataProvider.uploadImage(compressedFile, folder, undefined, undefined, true);
            
            showAlert('Nén ảnh thành công!');
            loadData();
        } catch (error: any) {
            showAlert('Lỗi khi nén ảnh: ' + error.message, 'Lỗi');
        } finally {
            setCompressingFile(null);
        }
    };

    const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text.startsWith('/') ? `${window.location.origin}${text}` : text).then(() => showAlert("Đã copy vào clipboard!")); };
    const handleApproveComment = async (id: string) => { await DataProvider.approveComment(id); loadData(); };
    const handleDeleteComment = async (id: string) => { showConfirm('Xóa bình luận này?', async () => { await DataProvider.deleteComment(id); loadData(); }, 'Xóa Bình luận', 'danger'); };
    
    const handleSaveLeechConfig = async () => {
        const id = leechConfigForm.id || `leech-${Date.now()}`;
        await DataProvider.saveLeechConfig({ ...leechConfigForm, id });
        setLeechConfigForm(initialLeechConfigForm);
        loadData();
        showAlert("Đã lưu cấu hình leech!");
    };
    const handleDeleteLeechConfig = async (id: string) => { showConfirm('Xóa cấu hình này?', async () => { await DataProvider.deleteLeechConfig(id); loadData(); }, 'Xóa Cấu hình', 'danger'); };

    const handleAddHomeGenre = () => {
        if (genreSelectRef.current) {
            const selectedSlug = genreSelectRef.current.value;
            if (selectedSlug) {
                const selectedGenre = genres.find(g => g.slug === selectedSlug);
                if (selectedGenre && !(themeConfig.homeLayout?.homeGenres || []).some(g => g.slug === selectedSlug)) {
                    setThemeConfig(prev => ({ ...prev, homeLayout: { ...(prev.homeLayout || DEFAULT_THEME.homeLayout), homeGenres: [...(prev.homeLayout?.homeGenres || []), { name: selectedGenre.name, slug: selectedGenre.slug }] } }));
                }
            }
        }
    };
    
    const handleRemoveHomeGenre = (slug: string) => setThemeConfig(prev => ({ ...prev, homeLayout: { ...(prev.homeLayout || DEFAULT_THEME.homeLayout), homeGenres: (prev.homeLayout?.homeGenres || []).filter(g => g.slug !== slug) } }));
    const handleDragStart = (genre: { name: string; slug: string }) => setDraggedGenre(genre);

    const handleDrop = (targetIndex: number) => {
        if (!draggedGenre) return;
        const currentGenres = [...(themeConfig.homeLayout?.homeGenres || [])];
        const draggedIndex = currentGenres.findIndex(g => g.slug === draggedGenre.slug);

        if (draggedIndex !== -1) {
            const [removed] = currentGenres.splice(draggedIndex, 1);
            currentGenres.splice(targetIndex, 0, removed);
            setThemeConfig(prev => ({ ...prev, homeLayout: { ...(prev.homeLayout || DEFAULT_THEME.homeLayout), homeGenres: currentGenres } }));
        }
        setDraggedGenre(null);
    };

    const handleEditorPasswordChange = async () => {
        const currentUser = AuthService.getUser();
        if (!currentUser || !editorPasswordForm.password) { showAlert("Vui lòng nhập mật khẩu mới."); return; }
        await DataProvider.saveUser({ ...currentUser, password: editorPasswordForm.password });
        setEditorPasswordForm({ password: '' });
        showAlert("Đổi mật khẩu thành công!");
    };
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                switch (activeTab) {
                    case 'comics': if (isEditingChapter) handleSaveChapter(); else if (isEditing) handleSaveComic(); break;
                    case 'genres': if (genreForm.name.trim()) handleSaveGenre(); break;
                    case 'ads': if (adForm.imageUrl.trim()) handleSaveAd(); break;
                    case 'users': if (userForm.username.trim() && (userForm.id || userForm.password)) handleSaveUser(); break;
                    case 'static': if (staticForm.title.trim()) handleSaveStatic(); break;
                    case 'settings': handleSaveTheme(); break;
                    case 'leech_configs': if (leechConfigForm.name.trim()) handleSaveLeechConfig(); break;
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [ activeTab, isEditing, isEditingChapter, comicForm, chapterForm, genreForm, adForm, userForm, staticForm, themeConfig, leechConfigForm ]);


    // --- Renderers ---
    const renderMenuEditor = (items: any[], onChange: any, title: string) => (
        <div className="bg-dark/50 border border-white/10 p-3 rounded-lg mb-4">
            <h4 className="text-sm font-bold text-slate-300 mb-2 flex justify-between">{title}<button onClick={() => onChange([...items, { label: 'New', url: '/' }])} className="text-xs bg-primary px-2 py-1 rounded text-white flex gap-1"><Plus size={12}/> Thêm</button></h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">{items.map((item, idx) => (<div key={idx} className="flex gap-2 items-center"><GripVertical size={16} className="text-slate-600"/><input value={item.label} onChange={e => { const n = [...items]; n[idx].label = e.target.value; onChange(n); }} className="flex-1 bg-dark border border-white/10 rounded px-2 py-1 text-xs text-white"/><input value={item.url} onChange={e => { const n = [...items]; n[idx].url = e.target.value; onChange(n); }} className="flex-1 bg-dark border border-white/10 rounded px-2 py-1 text-xs text-white"/><button onClick={() => onChange(items.filter((_, i) => i !== idx))} className="text-red-400"><Trash2 size={14}/></button></div>))}</div>
        </div>
    );

    const renderComicsTab = () => {
        const filteredComics = comics.filter(c => c.title.toLowerCase().includes(comicSearchQuery.toLowerCase()));
        return (
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
                        <div className="mb-4">
                            {/* FIX: Add AI summarization button for comic description */}
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs text-slate-400">Mô tả</label>
                                <button
                                    type="button"
                                    onClick={handleSummarizeDescription}
                                    disabled={summarizing || !comicForm.title}
                                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!comicForm.title ? "Nhập tên truyện để dùng AI" : "Tạo mô tả ngắn gọn bằng AI"}
                                >
                                    {summarizing ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    {summarizing ? 'Đang tạo...' : 'Tạo với AI'}
                                </button>
                            </div>
                            <SimpleEditor value={comicForm.description} onChange={val => setComicForm({...comicForm, description: val})} height="150px"/>
                        </div>
                        <div className="bg-dark/50 p-4 rounded-lg border border-white/5 space-y-3 mt-4 mb-6"><h5 className="text-sm font-bold text-primary flex items-center gap-2"><Globe size={16}/> SEO</h5><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="md:col-span-2"><label className="text-xs text-slate-400 mb-1 block">URL Slug</label><input type="text" value={comicForm.slug || ''} onChange={e => setComicForm({...comicForm, slug: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div><div><label className="text-xs text-slate-400 mb-1 block">Meta Title</label><input type="text" value={comicForm.metaTitle || ''} onChange={e => setComicForm({...comicForm, metaTitle: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div><div><label className="text-xs text-slate-400 mb-1 block">Meta Keywords</label><input type="text" value={comicForm.metaKeywords || ''} onChange={e => setComicForm({...comicForm, metaKeywords: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div><div className="md:col-span-2"><label className="text-xs text-slate-400 mb-1 block">Meta Description</label><textarea value={comicForm.metaDescription || ''} onChange={e => setComicForm({...comicForm, metaDescription: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white h-20"/></div></div></div>
                        <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-500/20 p-4 rounded-lg mb-6">
                            <h3 className="font-bold text-white flex items-center gap-2 mb-2"><Download size={18}/> Leech Truyện</h3>
                            {leechError && <div className="mb-3 p-3 bg-red-500/20 text-red-300 text-sm">{leechError}</div>}
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                                 <select value={selectedLeechConfigId} onChange={e => setSelectedLeechConfigId(e.target.value)} className="md:col-span-1 bg-dark border border-white/10 rounded px-3 py-2 text-sm text-white"><option value="">-- Chọn Server Leech --</option>{leechConfigs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                 <input type="text" placeholder="Link truyện..." value={leechUrl} onChange={e => setLeechUrl(e.target.value)} className="md:col-span-2 bg-dark border border-white/10 rounded px-3 py-2 text-sm text-white"/>
                             </div>
                             <button onClick={handleScanLeech} disabled={isScanning} className="w-full bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold min-w-[80px]">{isScanning ? (leechProgress || '...') : 'Quét'}</button>
                            
                            {leechSourceChapters.length > 0 && (<div className="space-y-3 pt-3 mt-3 border-t border-white/10"><div className="max-h-40 overflow-y-auto bg-dark border border-white/10 rounded p-2"><div className="flex justify-between items-center mb-2 px-1"><label className="text-xs text-slate-400 flex items-center gap-2"><input type="checkbox" onChange={e => setLeechSelectedChapters(e.target.checked ? leechSourceChapters.map(c => c.url) : [])} checked={leechSelectedChapters.length === leechSourceChapters.length && leechSourceChapters.length > 0}/> Tất cả</label><span className="text-xs text-indigo-400 font-bold">{leechSelectedChapters.length} chọn</span></div><div className="grid grid-cols-3 gap-1">{leechSourceChapters.map((c, idx) => (<label key={idx} className="flex items-center gap-2 text-xs p-1 hover:bg-white/5 rounded truncate"><input type="checkbox" checked={leechSelectedChapters.includes(c.url)} onChange={e => { if (e.target.checked) setLeechSelectedChapters(prev => [...prev, c.url]); else setLeechSelectedChapters(prev => prev.filter(u => u !== c.url)); }}/> {c.title}</label>))}</div></div>
                        <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
                            <label className="text-xs text-slate-400 block mb-1">Chế độ lưu ảnh:</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                    <input type="radio" name="leech_mode" checked={leechStorageMode === 'url'} onChange={() => setLeechStorageMode('url')} className="accent-primary"/> 
                                    Chỉ lưu URL hình ảnh
                                </label>
                                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                    <input type="radio" name="leech_mode" checked={leechStorageMode === 'upload'} onChange={() => setLeechStorageMode('upload')} className="accent-primary"/> 
                                    Upload & nén ảnh lên host
                                </label>
                            </div>
                        </div>
                        <button onClick={handleRunLeech} disabled={leechSelectedChapters.length === 0} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"><Download size={18}/> Leech Ngay</button></div>)}</div>
                        <div className="flex justify-end gap-3 border-b border-white/10 pb-6 mb-6"><button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded bg-white/5 text-slate-300">Đóng</button><button onClick={handleSaveComic} className="px-4 py-2 rounded bg-primary text-white font-bold flex items-center gap-2"><Save size={18} /> Lưu</button></div>
                        <div className="space-y-4"><div className="flex justify-between items-center"><h3 className="text-lg font-bold text-white flex items-center gap-2"><List size={18}/> Chapters</h3><button onClick={handleAddChapter} disabled={!comicForm.id} className="text-sm bg-white/10 text-white px-3 py-1.5 rounded flex items-center gap-2"><Plus size={16}/> Thêm</button></div><div className="bg-dark border border-white/10 rounded max-h-[400px] overflow-y-auto"><table className="w-full text-sm text-left"><thead className="bg-white/5 text-xs text-slate-400 uppercase sticky top-0"><tr><th className="p-3">Tên</th><th className="p-3">Số</th><th className="p-3">Ngày</th><th className="p-3 text-right">#</th></tr></thead><tbody>{(comicForm.chapters || []).map(chap => (<tr key={chap.id} className="hover:bg-white/5 text-slate-300"><td className="p-3">{chap.title}</td><td className="p-3">{chap.number}</td><td className="p-3 text-xs">{new Date(chap.updatedAt).toLocaleDateString()}</td><td className="p-3 text-right"><div className="flex justify-end gap-2"><button onClick={() => handleEditChapter(chap)} className="text-blue-400"><Edit size={14}/></button><button onClick={() => handleDeleteChapter(chap.id)} className="text-red-400"><Trash2 size={14}/></button></div></td></tr>))}</tbody></table></div></div>
                    </div>
                ) : (
                    <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
                        <div className="p-3 bg-white/5 border-b border-white/10">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="text" placeholder="Tìm truyện..." value={comicSearchQuery} onChange={e => setComicSearchQuery(e.target.value)} className="w-full bg-dark border border-white/10 rounded-lg py-1.5 px-4 pl-10 text-sm focus:outline-none focus:border-primary placeholder-slate-500" />
                            </div>
                        </div>
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-white/5 text-xs uppercase text-slate-400">
                                <tr>
                                    <th className="p-3">Truyện</th>
                                    <th className="p-3">Thể loại</th>
                                    <th className="p-3">Trạng thái</th>
                                    <th className="p-3">Views</th>
                                    <th className="p-3 text-right">#</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredComics.map(c => (
                                    <tr key={c.id} className="hover:bg-white/5">
                                        <td className="p-3 font-medium text-white flex items-center gap-3">
                                            <img src={c.coverImage} className="w-8 h-12 object-cover rounded" alt=""/>
                                            <div>
                                                <div className="line-clamp-1">{c.title}</div>
                                                <div className="text-xs text-slate-500">{c.chapterCount || 0} chap</div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-xs max-w-48 truncate">{c.genres.join(', ')}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-xs ${c.status === 'Hoàn thành' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="p-3">{c.views.toLocaleString()}</td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => handleQuickAddChapter(c.id)} className="text-green-400"><Plus size={16}/></button>
                                                <button onClick={() => handleStartEdit(c.id)} className="text-blue-400"><Edit size={16}/></button>
                                                <button onClick={() => handleDeleteComic(c.id)} className="text-red-400"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {isEditingChapter && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"><div className="bg-card border border-white/10 w-full max-w-2xl rounded-xl shadow-2xl"><div className="flex justify-between items-center p-4 border-b border-white/10"><h3 className="text-lg font-bold text-white">{chapterForm.id ? 'Sửa Chapter' : 'Thêm Mới'}</h3><button onClick={() => setIsEditingChapter(false)} className="text-slate-400 hover:text-white"><X size={20}/></button></div><div className="p-6 space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-xs text-slate-400 mb-1 block">Số (Order)</label><input type="number" value={chapterForm.number} onChange={e => setChapterForm({...chapterForm, number: parseFloat(e.target.value)})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div><div><label className="text-xs text-slate-400 mb-1 block">Tên hiển thị</label><input type="text" value={chapterForm.title} onChange={e => setChapterForm({...chapterForm, title: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div></div><div><div className="flex justify-between items-center mb-1"><label className="text-xs text-slate-400">Link ảnh (Mỗi dòng 1 link)</label><label className="text-xs bg-blue-600 px-3 py-1 rounded cursor-pointer flex items-center gap-1 text-white"><input type="file" multiple accept="image/*" className="hidden" ref={chapterInputRef} onChange={handleChapterImagesUpload}/>{isUploadingFile ? <RefreshCw size={12} className="animate-spin"/> : <Upload size={12}/>} Upload</label></div><textarea value={chapterForm.pagesContent} onChange={e => setChapterForm({...chapterForm, pagesContent: e.target.value})} className="w-full h-64 bg-dark border border-white/10 rounded p-2 text-white text-sm font-mono whitespace-pre"></textarea></div><div className="flex justify-end gap-2 pt-2"><button onClick={() => setIsEditingChapter(false)} className="px-4 py-2 rounded bg-white/5 text-slate-300">Hủy</button><button onClick={handleSaveChapter} disabled={isUploadingFile} className="px-4 py-2 rounded bg-primary text-white font-bold flex items-center gap-2">{isUploadingFile ? 'Đang tải...' : <><Save size={18}/> Lưu</>}</button></div></div></div></div>)}
            </div>
        );
    }

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

    const renderUsersTab = () => {
        const handlePermissionChange = (permId: string, checked: boolean) => {
            const currentPerms = userForm.permissions || [];
            if (checked) {
                if (!currentPerms.includes(permId)) {
                    setUserForm(prev => ({ ...prev, permissions: [...currentPerms, permId] }));
                }
            } else {
                setUserForm(prev => ({ ...prev, permissions: currentPerms.filter(p => p !== permId) }));
            }
        };
        const currentUser = AuthService.getUser();

        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Quản lý Thành viên</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {AuthService.isAdmin() ? (
                        <div className="lg:col-span-1 bg-card border border-white/10 p-6 rounded-xl h-fit">
                            <h3 className="font-bold text-white mb-4 border-b border-white/10 pb-3">{userForm.id ? `Sửa User: ${userForm.username}` : 'Thêm User Mới'}</h3>
                            <div className="space-y-4">
                                <div><label className="text-xs text-slate-400 block mb-1">Username</label><input type="text" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div>
                                <div><label className="text-xs text-slate-400 block mb-1">Password</label><input type="password" placeholder={userForm.id ? 'Để trống nếu không đổi' : ''} value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/></div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Quyền</label>
                                    <select 
                                        value={userForm.role} 
                                        onChange={e => setUserForm({...userForm, role: e.target.value as any, permissions: []})} 
                                        disabled={userForm.id === currentUser?.id}
                                        className="w-full bg-dark border border-white/10 rounded p-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="editor">Editor</option>
                                    </select>
                                </div>
                                
                                {userForm.role === 'editor' && (
                                    <div className="space-y-3 pt-3 border-t border-white/10">
                                        <h4 className="font-bold text-primary flex items-center gap-2 text-sm"><ShieldCheck size={16}/> Phân quyền Tabs</h4>
                                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto bg-dark/50 p-3 rounded-lg border border-white/5">
                                            {ALL_PERMISSIONS.map(p => (
                                                <label key={p.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                                                    <input type="checkbox" checked={userForm.permissions?.includes(p.id)} onChange={e => handlePermissionChange(p.id, e.target.checked)} className="accent-primary"/>
                                                    {p.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 pt-2">
                                    <button onClick={() => setUserForm(initialUserForm)} className="px-4 py-2 bg-white/5 rounded-lg text-slate-300 text-sm">Reset</button>
                                    <button onClick={handleSaveUser} className="px-5 py-2 bg-primary text-white rounded-lg font-bold text-sm">Lưu</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="lg:col-span-1 bg-card border border-white/10 p-6 rounded-xl h-fit">
                            <h3 className="font-bold text-white mb-4 border-b border-white/10 pb-3 flex items-center gap-2"><KeyRound size={18}/> Đổi Mật khẩu</h3>
                             <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Mật khẩu mới</label>
                                    <input 
                                        type="password" 
                                        placeholder="Nhập mật khẩu mới..."
                                        value={editorPasswordForm.password} 
                                        onChange={e => setEditorPasswordForm({ password: e.target.value })} 
                                        className="w-full bg-dark border border-white/10 rounded p-2 text-white"
                                    />
                                </div>
                                 <div className="flex justify-end gap-2 pt-2">
                                     <button onClick={handleEditorPasswordChange} className="w-full px-5 py-2 bg-primary text-white rounded-lg font-bold text-sm">Lưu Mật khẩu</button>
                                </div>
                             </div>
                        </div>
                    )}
                    <div className={AuthService.isAdmin() ? "lg:col-span-2" : "lg:col-span-3"}>
                        <div className="bg-card border border-white/10 rounded-xl overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-white/5 uppercase text-xs"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3 text-right">#</th></tr></thead>
                                <tbody className="divide-y divide-white/5">
                                    {users.length > 0 ? (
                                        users.map(u => (
                                            <tr key={u.id} className="hover:bg-white/5">
                                                <td className="p-3 font-bold text-white">{u.username}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>{u.role}</span>
                                                </td>
                                                <td className="p-3 text-right">
                                                    {AuthService.isAdmin() && (
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setUserForm({...u, password: ''})} className="text-blue-400 hover:text-blue-300 transition-colors"><Edit size={16}/></button>
                                                            <button 
                                                                onClick={() => handleDeleteUser(u.id)} 
                                                                disabled={u.id === currentUser?.id}
                                                                className="text-red-400 hover:text-red-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
                                                                title={u.id === currentUser?.id ? "Không thể xóa tài khoản của chính bạn" : "Xóa"}
                                                            >
                                                                <Trash2 size={16}/>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="p-4 text-center text-slate-500 italic">
                                                {loading ? 'Đang tải...' : 'Không có người dùng nào.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderReportsTab = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Báo cáo lỗi</h2>
                <button onClick={loadData} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all">
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
                    <button onClick={loadData} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all">
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Làm mới
                    </button>
                </div>
                
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

    const renderSettingsTab = () => {
        const availableGenres = genres.filter(g => !(themeConfig.homeLayout?.homeGenres || []).some(hg => hg.slug === g.slug));
        
        return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-white">Cấu hình Giao diện & SEO</h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="bg-card border border-white/10 p-6 rounded-xl space-y-5">
                        <h3 className="font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2"><Palette size={18}/> Giao diện & Bố cục</h3>
                        <div className="space-y-5">
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
                                <div><label className="text-xs text-slate-400 block mb-1">Logo URL</label><div className="flex gap-2"><input type="text" value={themeConfig.logoUrl || ''} onChange={e => setThemeConfig({...themeConfig, logoUrl: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white"/><label className="cursor-pointer bg-blue-600 px-3 py-2 rounded text-white"><input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'theme-logo')} /><Upload size={16}/></label></div></div>
                                <div><label className="text-xs text-slate-400 block mb-1">Favicon URL</label><div className="flex gap-2"><input type="text" value={themeConfig.favicon || ''} onChange={e => setThemeConfig({...themeConfig, favicon: e.target.value})} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white"/><label className="cursor-pointer bg-blue-600 px-3 py-2 rounded text-white"><input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'theme-favicon')} /><Upload size={16}/></label></div></div>
                                {AuthService.isAdmin() && ( <div> <label className="text-xs text-slate-400 block mb-1">URL Đăng nhập Admin</label> <input type="text" value={themeConfig.loginUrl || ''} onChange={e => setThemeConfig({...themeConfig, loginUrl: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white" placeholder="/login" /> </div> )}
                            </div>

                             <div className="border-t border-white/5 pt-4">
                                <label className="text-xs text-slate-400 block mb-1 font-bold">Bố cục Website</label>
                                <select value={themeConfig.siteLayout || 'classic'} onChange={e => setThemeConfig({...themeConfig, siteLayout: e.target.value as any})} className="w-full bg-dark border border-white/10 rounded p-2 text-white">
                                    <option value="classic">Cổ điển (Mặc định)</option>
                                    <option value="modern">Hiện đại (Cinematic)</option>
                                    <option value="minimalist">Tối giản (Danh sách)</option>
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1">Thay đổi giao diện tổng thể của trang web.</p>
                            </div>
                            
                            <div className="border-t border-white/5 pt-4 space-y-3">
                                <label className="text-xs text-slate-400 block mb-1 font-bold">Bố cục Trang chủ</label>
                                <div className="bg-dark/30 border border-white/5 rounded-lg p-3 space-y-2">
                                    <label className="flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer select-none"><input type="checkbox" checked={themeConfig.homeLayout?.showSlider ?? true} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...(themeConfig.homeLayout || DEFAULT_THEME.homeLayout), showSlider: e.target.checked}})} className="w-4 h-4 accent-primary rounded bg-dark border-white/20"/><span>Hiển thị Slider Banner</span></label>
                                    <label className="flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer select-none"><input type="checkbox" checked={themeConfig.homeLayout?.showHot ?? true} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...(themeConfig.homeLayout || DEFAULT_THEME.homeLayout), showHot: e.target.checked}})} className="w-4 h-4 accent-primary rounded bg-dark border-white/20"/><span>Hiển thị Truyện Hot</span></label>
                                    <label className="flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer select-none"><input type="checkbox" checked={themeConfig.homeLayout?.showNew ?? true} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...(themeConfig.homeLayout || DEFAULT_THEME.homeLayout), showNew: e.target.checked}})} className="w-4 h-4 accent-primary rounded bg-dark border-white/20"/><span>Hiển thị Truyện Mới</span></label>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
                                    <div> <label className="text-xs text-slate-400 block mb-1">SL Truyện Hot</label> <input type="number" value={themeConfig.homeLayout?.hotComicsCount || 6} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...(themeConfig.homeLayout || DEFAULT_THEME.homeLayout), hotComicsCount: parseInt(e.target.value) || 6}})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/> </div>
                                    <div> <label className="text-xs text-slate-400 block mb-1">SL Truyện Mới</label> <input type="number" value={themeConfig.homeLayout?.newComicsCount || 12} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...(themeConfig.homeLayout || DEFAULT_THEME.homeLayout), newComicsCount: parseInt(e.target.value) || 12}})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/> </div>
                                    <div> <label className="text-xs text-slate-400 block mb-1">SL/Thể loại</label> <input type="number" value={themeConfig.homeLayout?.genreComicsCount || 6} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...(themeConfig.homeLayout || DEFAULT_THEME.homeLayout), genreComicsCount: parseInt(e.target.value) || 6}})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/> </div>
                                </div>

                                <div className="border-t border-white/5 pt-4 mt-4">
                                    <label className="text-xs text-slate-400 block mb-2 font-bold">Các Thể Loại Hiển Thị Ngoài Trang Chủ</label>
                                    <div className="flex gap-2 mb-3">
                                        <select ref={genreSelectRef} className="flex-1 bg-dark border border-white/10 rounded p-2 text-white text-sm">
                                            {availableGenres.length > 0 ? availableGenres.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>) : <option disabled>Đã thêm hết</option>}
                                        </select>
                                        <button onClick={handleAddHomeGenre} disabled={availableGenres.length === 0} className="bg-primary text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50">Thêm</button>
                                    </div>
                                    <div className="bg-dark/50 border border-white/10 rounded-lg p-2 space-y-1 min-h-[100px]">
                                        {(themeConfig.homeLayout?.homeGenres || []).map((genre, index) => (
                                            <div key={genre.slug} draggable onDragStart={() => handleDragStart(genre)} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(index)} onDragEnd={() => setDraggedGenre(null)} className={`flex items-center gap-2 p-2 bg-dark rounded cursor-grab transition-opacity ${draggedGenre?.slug === genre.slug ? 'opacity-50' : ''}`}>
                                                <GripVertical size={16} className="text-slate-500 flex-shrink-0" />
                                                <span className="flex-1 text-sm text-slate-300">{genre.name}</span>
                                                <button onClick={() => handleRemoveHomeGenre(genre.slug)} className="text-red-500 hover:text-red-400"> <Trash2 size={14} /> </button>
                                            </div>
                                        ))}
                                        {(!themeConfig.homeLayout?.homeGenres || themeConfig.homeLayout.homeGenres.length === 0) && ( <p className="text-xs text-slate-500 text-center p-4">Chưa có thể loại nào được thêm.</p> )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 flex flex-col">
                        <div className="bg-card border border-white/10 p-6 rounded-xl">
                            <h3 className="font-bold text-white border-b border-white/10 pb-2 mb-4 flex items-center gap-2"><Menu size={18}/> Cấu hình Menu</h3>
                            {renderMenuEditor(themeConfig.headerMenu || [], (items) => setThemeConfig({ ...themeConfig, headerMenu: items }), "Menu Header (Trên cùng)")}
                            {renderMenuEditor(themeConfig.footerMenu || [], (items) => setThemeConfig({ ...themeConfig, footerMenu: items }), "Menu Footer (Chân trang)")}
                        </div>
                        <div className="bg-card border border-white/10 p-6 rounded-xl space-y-4">
                           <h3 className="font-bold text-white border-b border-white/10 pb-2 flex items-center gap-2"><Globe size={18}/> Cấu hình SEO</h3>
                           <div><h4 className="text-xs font-bold text-primary uppercase mb-2">Trang Chủ</h4><div className="space-y-2"><input type="text" placeholder="Meta Title" value={themeConfig.homeMetaTitle || ''} onChange={e => setThemeConfig({...themeConfig, homeMetaTitle: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm"/><textarea placeholder="Meta Description" value={themeConfig.homeMetaDescription || ''} onChange={e => setThemeConfig({...themeConfig, homeMetaDescription: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm h-16"/></div></div>
                           <div className="border-t border-white/5 pt-3"><h4 className="text-xs font-bold text-primary uppercase mb-2">Trang Danh Sách Thể Loại</h4><div className="space-y-2"><input type="text" placeholder="Meta Title" value={themeConfig.categoriesMetaTitle || ''} onChange={e => setThemeConfig({...themeConfig, categoriesMetaTitle: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm"/><textarea placeholder="Meta Description" value={themeConfig.categoriesMetaDescription || ''} onChange={e => setThemeConfig({...themeConfig, categoriesMetaDescription: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm h-16"/></div></div>
                       </div>
                        <div className="bg-card border border-white/10 p-6 rounded-xl flex-1">
                            <h3 className="font-bold text-white border-b border-white/10 pb-2 mb-4">Footer Content (HTML/Text)</h3>
                            <SimpleEditor value={themeConfig.footerContent || ''} onChange={val => setThemeConfig({...themeConfig, footerContent: val})} height="150px" />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end mt-6">
                    <button onClick={handleSaveTheme} className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-6 rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5">
                        <Save size={18}/> Lưu Cấu Hình
                    </button>
                </div>
            </div>
        );
    }
    
    const renderStaticTab = () => (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Trang tĩnh</h2>
                <div className="flex gap-2">
                    <button onClick={() => setStaticForm({ slug: '', title: '', content: '' })} className="text-sm bg-primary text-white px-3 py-1.5 rounded flex items-center gap-2"> <Plus size={16}/> Thêm Mới </button>
                    <button onClick={handleSeedStaticPages} className="text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded flex items-center gap-2"> <RefreshCw size={14}/> Reset Mẫu </button>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-card border border-white/10 p-4 rounded-xl h-fit space-y-3">
                    <h3 className="font-bold text-white">{staticForm.slug ? 'Sửa trang' : 'Thêm trang mới'}</h3>
                    <input type="text" placeholder="Tiêu đề" value={staticForm.title} onChange={e => setStaticForm({...staticForm, title: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/>
                    <input type="text" placeholder="Slug (URL)" value={staticForm.slug} onChange={e => setStaticForm({...staticForm, slug: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white"/>
                    <SimpleEditor value={staticForm.content} onChange={val => setStaticForm({...staticForm, content: val})} height="300px"/>
                    <button onClick={handleSaveStatic} className="w-full bg-primary text-white py-2 rounded font-bold">Lưu Trang</button>
                </div>
                <div className="lg:col-span-2 bg-card border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-white/5 uppercase text-xs"><tr><th className="p-3">Tiêu đề</th><th className="p-3">Slug</th><th className="p-3 text-right">Thao tác</th></tr></thead>
                        <tbody>
                            {staticPages.map(p => (
                                <tr key={p.slug} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="p-3 text-white font-medium hover:text-primary cursor-pointer" onClick={() => setStaticForm(p)}>{p.title}</td>
                                    <td className="p-3 text-slate-500 cursor-pointer" onClick={() => setStaticForm(p)}>{p.slug}</td>
                                    <td className="p-3 text-right">
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteStaticPage(p.slug, p.title); }} className="text-red-400 hover:text-red-300" title={`Xóa trang ${p.title}`}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
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
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Thư viện ảnh</h2>
                <div className="flex items-center gap-4">
                    <div className="flex items-center p-1 bg-card rounded-lg border border-white/10">
                        <button title="Lưới lớn" onClick={() => setMediaViewMode('grid')} className={`p-1.5 rounded ${mediaViewMode === 'grid' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10'}`}><LayoutGrid size={18}/></button>
                        <button title="Lưới nhỏ" onClick={() => setMediaViewMode('tiles')} className={`p-1.5 rounded ${mediaViewMode === 'tiles' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10'}`}><LayoutDashboard size={18}/></button>
                        <button title="Danh sách" onClick={() => setMediaViewMode('list')} className={`p-1.5 rounded ${mediaViewMode === 'list' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10'}`}><List size={18}/></button>
                    </div>
                    <label className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded font-bold cursor-pointer flex items-center gap-2">
                        <input type="file" multiple accept="image/*" className="hidden" ref={mediaInputRef} onChange={handleMediaUpload}/>
                        {isUploadingFile ? <RefreshCw size={18} className="animate-spin"/> : <Upload size={18}/>} Upload Ảnh
                    </label>
                </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-card p-2 rounded-lg border border-white/10 flex-wrap">
                <button onClick={handleMediaRootClick} className="hover:text-primary font-medium">Thư viện</button>
                {mediaPath.map((segment, index) => (
                    <React.Fragment key={index}>
                        <span className="text-slate-600">/</span>
                        <button onClick={() => handleMediaBreadcrumbClick(index)} className={`hover:text-primary ${index === mediaPath.length - 1 ? 'text-white font-semibold' : ''}`}>
                            {segment}
                        </button>
                    </React.Fragment>
                ))}
            </div>

            {(mediaViewMode === 'grid' || mediaViewMode === 'tiles') && (
                <div className={`grid ${mediaViewMode === 'grid' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6' : 'grid-cols-3 md:grid-cols-5 lg:grid-cols-8'} gap-4`}>
                    {mediaFiles.map((file, idx) => (
                        <div key={idx} className="bg-card border border-white/10 rounded-lg overflow-hidden group relative">
                            {file.isDir ? (
                                <div onClick={() => handleMediaFolderClick(file.name)} className="aspect-square bg-yellow-900/20 flex flex-col items-center justify-center text-yellow-500 p-2 cursor-pointer hover:bg-yellow-900/30 transition-colors">
                                    <Folder size="40%" strokeWidth={1.5} />
                                </div>
                            ) : (
                                <div className="aspect-square bg-black/50 flex items-center justify-center overflow-hidden">
                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover transition-transform group-hover:scale-110"/>
                                </div>
                            )}
                            <div className="p-2 bg-dark border-t border-white/5">
                                <div className="text-xs text-white truncate font-medium mb-1" title={file.name}>{file.name}</div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-500">{file.isDir ? 'Thư mục' : formatFileSize(file.size)}</span>
                                    <div className="flex gap-1">
                                        {!file.isDir && <button onClick={() => handleCompressImage(file.url)} disabled={compressingFile === file.url} className="p-1 hover:bg-white/10 rounded text-green-400" title="Nén ảnh">{compressingFile === file.url ? <RefreshCw size={12} className="animate-spin"/> : <Shrink size={12}/>}</button>}
                                        {!file.isDir && <button onClick={() => copyToClipboard(file.url)} className="p-1 hover:bg-white/10 rounded text-blue-400" title="Copy Link"><Copy size={12}/></button>}
                                        <button onClick={() => handleDeleteMedia(file.name, file.isDir)} className="p-1 hover:bg-white/10 rounded text-red-400" title="Xóa"><Trash2 size={12}/></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {mediaViewMode === 'list' && (
                <div className="bg-card border border-white/10 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-xs uppercase text-slate-400">
                            <tr>
                                <th className="p-3 w-16"></th>
                                <th className="p-3">Tên</th>
                                <th className="p-3">Kích thước</th>
                                <th className="p-3">Ngày tạo</th>
                                <th className="p-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {mediaFiles.map(file => (
                                <tr key={file.name} className="hover:bg-white/5 transition-colors">
                                    <td className="p-2">
                                        {file.isDir ? (
                                            <div onClick={() => handleMediaFolderClick(file.name)} className="w-10 h-10 flex items-center justify-center cursor-pointer">
                                                <Folder size={28} className="text-yellow-500"/>
                                            </div>
                                        ) : (
                                            <img src={file.url} className="w-10 h-10 object-cover rounded bg-dark"/>
                                        )}
                                    </td>
                                    <td className="p-3 text-white font-medium break-all">{file.name}</td>
                                    <td className="p-3 text-slate-400">{!file.isDir ? formatFileSize(file.size) : '—'}</td>
                                    <td className="p-3 text-slate-400 text-xs">{new Date(file.created).toLocaleDateString()}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex gap-2 justify-end">
                                            {!file.isDir && <button onClick={() => handleCompressImage(file.url)} disabled={compressingFile === file.url} className="p-2 hover:bg-white/10 rounded text-green-400" title="Nén ảnh">{compressingFile === file.url ? <RefreshCw size={16} className="animate-spin"/> : <Shrink size={16}/>}</button>}
                                            {!file.isDir && <button onClick={() => copyToClipboard(file.url)} className="p-2 hover:bg-white/10 rounded text-blue-400" title="Copy Link"><Copy size={16}/></button>}
                                            <button onClick={() => handleDeleteMedia(file.name, file.isDir)} className="p-2 hover:bg-white/10 rounded text-red-400" title="Xóa"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const renderLeechConfigsTab = () => (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Cấu hình Server Leech</h2>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="lg:col-span-1 bg-card border border-white/10 p-6 rounded-xl h-fit">
                    <h3 className="font-bold text-white mb-4 border-b border-white/10 pb-3">{leechConfigForm.id ? 'Sửa Cấu hình' : 'Thêm Cấu hình Mới'}</h3>
                     <div className="space-y-3">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1 font-medium">Tên Server (VD: Dilid, Nettruyen)</label>
                            <input type="text" value={leechConfigForm.name} onChange={e => setLeechConfigForm({...leechConfigForm, name: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1 font-medium">Base URL (VD: https://dilib.vn)</label>
                            <input type="text" value={leechConfigForm.baseUrl} onChange={e => setLeechConfigForm({...leechConfigForm, baseUrl: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm" />
                        </div>

                        <div className="space-y-3 pt-4 border-t border-white/10">
                            <h4 className="text-sm font-bold text-primary">Cấu hình trang thông tin truyện</h4>
                            <input type="text" placeholder="Selector Tên truyện (VD: h1)" value={leechConfigForm.comicTitleSelector} onChange={e => setLeechConfigForm({...leechConfigForm, comicTitleSelector: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm" />
                            <input type="text" placeholder="Selector Ảnh bìa (VD: img.book_avatar)" value={leechConfigForm.comicCoverSelector} onChange={e => setLeechConfigForm({...leechConfigForm, comicCoverSelector: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm" />
                            <input type="text" placeholder="Selector Tác giả" value={leechConfigForm.comicAuthorSelector || ''} onChange={e => setLeechConfigForm({...leechConfigForm, comicAuthorSelector: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm" />
                            <input type="text" placeholder="Selector Mô tả (VD: .detail-content)" value={leechConfigForm.comicDescriptionSelector} onChange={e => setLeechConfigForm({...leechConfigForm, comicDescriptionSelector: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm" />
                            <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none text-sm pt-2">
                                <input type="checkbox" checked={leechConfigForm.uploadCoverImage || false} onChange={e => setLeechConfigForm({...leechConfigForm, uploadCoverImage: e.target.checked})} className="w-4 h-4 accent-primary"/> 
                                Upload ảnh bìa lên host
                            </label>
                        </div>
                        
                        <div className="space-y-3 pt-4 border-t border-white/10">
                             <h4 className="text-sm font-bold text-primary">Cấu hình trang đọc truyện</h4>
                            <input type="text" placeholder="Selector Link Chapter (VD: .list-chapter a)" value={leechConfigForm.chapterLinkSelector} onChange={e => setLeechConfigForm({...leechConfigForm, chapterLinkSelector: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm" />
                            <input type="text" placeholder="Selector Ảnh Chapter (VD: .page-chapter img)" value={leechConfigForm.chapterImageSelector} onChange={e => setLeechConfigForm({...leechConfigForm, chapterImageSelector: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm" />
                            <input type="text" placeholder="Thuộc tính ảnh (VD: src,data-src)" value={leechConfigForm.imageSrcAttribute} onChange={e => setLeechConfigForm({...leechConfigForm, imageSrcAttribute: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm" />
                        </div>

                         <div className="flex justify-end gap-2 pt-4">
                            <button onClick={() => setLeechConfigForm(initialLeechConfigForm)} className="px-4 py-2 bg-white/5 rounded-lg text-slate-300 text-sm font-medium">Reset</button>
                            <button onClick={handleSaveLeechConfig} className="px-5 py-2 bg-primary text-white rounded-lg font-bold text-sm">Lưu</button>
                        </div>
                     </div>
                 </div>
                 <div className="lg:col-span-2 bg-card border border-white/10 rounded-xl overflow-x-auto">
                     <table className="w-full text-left text-sm text-slate-300">
                         <thead className="bg-white/5 uppercase text-xs"><tr><th className="p-3">Tên</th><th className="p-3">Base URL</th><th className="p-3 text-right">#</th></tr></thead>
                         <tbody>
                             {leechConfigs.map(c => (
                                 <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                                     <td className="p-3 font-bold text-white">{c.name}</td>
                                     <td className="p-3">{c.baseUrl}</td>
                                     <td className="p-3 text-right">
                                         <div className="flex justify-end gap-2">
                                             <button onClick={() => setLeechConfigForm(c)} className="text-blue-400"><Edit size={16}/></button>
                                             <button onClick={() => handleDeleteLeechConfig(c.id)} className="text-red-400"><Trash2 size={16}/></button>
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

    const renderDashboard = () => {
        const topComics = [...comics].sort((a, b) => b.views - a.views).slice(0, 5);
        const latestComics = [...comics].sort((a, b) => new Date(b.chapters[0]?.updatedAt || 0).getTime() - new Date(a.chapters[0]?.updatedAt || 0).getTime()).slice(0, 5);
        const imageStorageUsedBytes = systemStats?.imageStorageUsed || 0;
    
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-card p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group hover:border-blue-500/30 transition-colors"> <div className="absolute right-0 top-0 w-24 h-24 bg-blue-500/5 rounded-bl-full group-hover:bg-blue-500/10 transition-colors"></div> <div className="flex justify-between items-start mb-4 relative z-10"> <div className="p-3 bg-blue-500/20 text-blue-500 rounded-lg"><BookOpen size={24}/></div> </div> <h3 className="text-3xl font-bold text-white mb-1 relative z-10">{comics.length}</h3> <p className="text-slate-400 text-sm relative z-10">Đầu truyện</p> </div>
                    <div className="bg-card p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group hover:border-green-500/30 transition-colors"> <div className="absolute right-0 top-0 w-24 h-24 bg-green-500/5 rounded-bl-full group-hover:bg-green-500/10 transition-colors"></div> <div className="flex justify-between items-start mb-4 relative z-10"> <div className="p-3 bg-green-500/20 text-green-400 rounded-lg"><Users size={24}/></div> </div> <h3 className="text-3xl font-bold text-white mb-1 relative z-10">{users.length}</h3> <p className="text-slate-400 text-sm relative z-10">Thành viên</p> </div>
                    <div className="bg-card p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group hover:border-orange-500/30 transition-colors"> <div className="absolute right-0 top-0 w-24 h-24 bg-orange-500/5 rounded-bl-full group-hover:bg-orange-500/10 transition-colors"></div> <div className="flex justify-between items-start mb-4 relative z-10"> <div className="p-3 bg-orange-500/20 text-orange-500 rounded-lg"><Flag size={24}/></div> </div> <h3 className="text-3xl font-bold text-white mb-1 relative z-10">{reports.length}</h3> <p className="text-slate-400 text-sm relative z-10">Báo cáo lỗi</p> </div>
                    <div className="bg-card p-6 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group hover:border-purple-500/30 transition-colors"> <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-bl-full group-hover:bg-purple-500/10 transition-colors"></div> <div className="flex justify-between items-start mb-4 relative z-10"> <div className="p-3 bg-purple-500/20 text-purple-500 rounded-lg"><List size={24}/></div> </div> <h3 className="text-3xl font-bold text-white mb-1 relative z-10">{genres.length}</h3> <p className="text-slate-400 text-sm relative z-10">Thể loại</p> </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="lg:col-span-1 bg-card border border-white/10 rounded-xl shadow-lg p-6 flex flex-col gap-6">
                         <div className="flex items-center gap-2 mb-2"> <div className="p-2 bg-primary/20 rounded-lg text-primary"><Activity size={20} /></div> <h3 className="text-lg font-bold text-white">Tổng quan lượt xem</h3> </div>
                         <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 rounded-xl p-6 text-center"> <span className="text-slate-400 text-sm uppercase tracking-wider">Tổng lượt xem trang web</span> <div className="text-4xl lg:text-5xl font-extrabold text-white mt-2 mb-1 drop-shadow-lg"> {analytics.totalViews.toLocaleString()} </div> <div className="text-green-400 text-xs font-medium flex items-center justify-center gap-1"> <TrendingUp size={12}/> +5.2% so với tháng trước </div> </div>
                         <div className="space-y-4">
                             <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg"> <div className="flex items-center gap-3"> <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500"><Calendar size={16}/></div> <div className="flex flex-col"> <span className="text-sm font-medium text-slate-300">Hôm nay</span> <span className="text-xs text-slate-500">Thống kê</span> </div> </div> <span className="font-bold text-white">{analytics.todayViews.toLocaleString()}</span> </div>
                             <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg"> <div className="flex items-center gap-3"> <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500"><BarChart3 size={16}/></div> <div className="flex flex-col"> <span className="text-sm font-medium text-slate-300">Tháng này</span> <span className="text-xs text-slate-500">Thống kê</span> </div> </div> <span className="font-bold text-white">{analytics.monthViews.toLocaleString()}</span> </div>
                             <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg"> <div className="flex items-center gap-3"> <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500"><MousePointerClick size={16}/></div> <div className="flex flex-col"> <span className="text-sm font-medium text-slate-300">Trung bình / Truyện</span> <span className="text-xs text-slate-500">Hiệu suất</span> </div> </div> <span className="font-bold text-white">{comics.length > 0 ? (analytics.totalViews / comics.length).toFixed(0) : 0}</span> </div>
                         </div>
                    </div>
                    <div className="lg:col-span-2 bg-card border border-white/10 rounded-xl shadow-lg flex flex-col">
                        <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-2"> <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500"><TrendingUp size={20} /></div> <div> <h3 className="text-lg font-bold text-white">Top Truyện Xem Nhiều</h3> <p className="text-xs text-slate-500">Thống kê theo lượt xem thực tế</p> </div> </div>
                            <div className="flex bg-dark p-1 rounded-lg border border-white/10"> {['day', 'week', 'month'].map(tf => ( <button key={tf} onClick={() => setTopComicsTimeframe(tf as any)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${topComicsTimeframe === tf ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}> {tf === 'day' ? 'Hôm nay' : (tf === 'week' ? 'Tuần này' : 'Tháng này')} </button> ))} </div>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto">
                            <div className="space-y-6">
                                {topComics.map((c, idx) => {
                                    const topView = topComics[0]?.views || 1;
                                    const percentage = (c.views / topView) * 100;
                                    return (
                                        <div key={c.id} className="relative group">
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${idx === 0 ? 'bg-yellow-500 text-black' : (idx === 1 ? 'bg-slate-300 text-black' : (idx === 2 ? 'bg-orange-700 text-white' : 'bg-white/10 text-slate-400'))}`}> {idx + 1} </div>
                                                <img src={c.coverImage} className="w-10 h-14 object-cover rounded bg-dark border border-white/10" alt={c.title} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between mb-1"> <span className="text-sm font-bold text-white truncate pr-2 group-hover:text-primary transition-colors cursor-pointer" onClick={() => handleStartEdit(c.id)}> {c.title} </span> <span className="text-xs font-bold text-slate-300">{c.views.toLocaleString()}</span> </div>
                                                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden"> <div className={`h-full rounded-full ${idx === 0 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-primary'}`} style={{ width: `${percentage}%` }} ></div> </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-6 pt-4 border-t border-white/5 text-center"> <p className="text-[10px] text-slate-500 italic">* Dữ liệu hiển thị dựa trên tổng lượt xem tích lũy.</p> </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-card border border-white/10 rounded-xl p-6">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2"> <HardDrive size={18} className="text-slate-400" /> Trạng thái hệ thống </h3>
                         {systemStats ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Dung lượng ảnh</span>
                                    <span className="text-white font-semibold">{formatFileSize(imageStorageUsedBytes)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Database Records</span>
                                    <span className="text-white font-semibold">{systemStats.databaseRows.toLocaleString()} rows</span>
                                </div>
                                <div className="pt-3 border-t border-white/10 mt-3 flex flex-wrap gap-2">
                                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/20">Server: Online</span>
                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/20">Database: Connected</span>
                                    <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded border border-gray-500/20">Node: {systemStats.nodeVersion}</span>
                                    <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded border border-gray-500/20">React: {systemStats.reactVersion}</span>
                                    <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded border border-gray-500/20">Vite: {systemStats.viteVersion}</span>
                                    <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded border border-gray-500/20">OS: {systemStats.platform}</span>
                                </div>
                            </div>
                        ) : ( <p className="text-sm text-slate-500">Đang tải thông số...</p> )}
                    </div>
                    <div className="bg-card border border-white/10 rounded-xl p-6">
                         <h3 className="font-bold text-white mb-4 flex items-center gap-2"> <Clock size={18} className="text-slate-400" /> Vừa cập nhật </h3>
                        <div className="space-y-3">
                            {latestComics.slice(0, 3).map(c => (
                                <div key={c.id} className="flex gap-3 items-center p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer" onClick={() => handleStartEdit(c.id)}>
                                    <img src={c.coverImage} className="w-10 h-10 object-cover rounded" alt=""/>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-white truncate">{c.title}</div>
                                        <div className="text-xs text-slate-500">{c.chapters[0] ? `Đã đăng ${c.chapters[0].title}` : 'Chưa có chương'}</div>
                                    </div>
                                    <div className="text-[10px] text-slate-500 whitespace-nowrap"> {c.chapters[0]?.updatedAt ? new Date(c.chapters[0].updatedAt).toLocaleDateString() : 'N/A'} </div>
                                </div>
                            ))}
                            <button onClick={() => setActiveTab('comics')} className="w-full text-center text-xs text-primary hover:underline pt-2">Xem tất cả truyện</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const allTabs = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'comics', label: 'Truyện tranh', icon: BookOpen },
        { id: 'comments', label: 'Bình luận', icon: MessageSquare },
        { id: 'genres', label: 'Thể loại', icon: List },
        { id: 'media', label: 'Thư viện ảnh', icon: ImageIcon },
        { id: 'ads', label: 'Quảng cáo', icon: LayoutDashboard },
        { id: 'users', label: 'Thành viên', icon: Users },
        { id: 'reports', label: 'Báo lỗi', icon: Flag },
        { id: 'static', label: 'Trang tĩnh', icon: FileText },
        { id: 'settings', label: 'Cấu hình', icon: Settings },
        { id: 'leech_configs', label: 'Cấu hình Leech', icon: Download }
    ];

    return (
        <div className="min-h-screen bg-darker flex text-slate-200">
            <AppModal isOpen={modal.isOpen} type={modal.type} title={modal.title} message={modal.message} confirmText={modal.confirmText} defaultValue={modal.defaultValue} onConfirm={modal.onConfirm} onClose={closeModal}/>
            <div className="w-64 bg-card border-r border-white/10 hidden md:flex flex-col flex-shrink-0">
                <div className="h-16 flex items-center px-6 border-b border-white/10"> <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Admin Panel</span> </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {allTabs.filter(item => AuthService.hasPermission(item.id)).map(item => (
                        <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                            <item.icon size={18} /> {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-white/10"> <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-sm px-2"><ArrowLeft size={16}/> Về trang chủ</Link> <button onClick={AuthService.logout} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm px-2 font-medium w-full"><LogOut size={16}/> Đăng xuất</button> </div>
            </div>
             <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-white/10 flex items-center justify-between px-4 z-50"> <span className="font-bold text-white">Admin Panel</span> <button onClick={AuthService.logout}><LogOut size={20} className="text-red-400"/></button> </div>
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
                    {activeTab === 'leech_configs' && renderLeechConfigsTab()}
                </div>
            </div>
        </div>
    );
};

export default Admin;
