import React, { useEffect, useState, useRef } from 'react';
import { 
    LayoutDashboard, BookOpen, List, Users, Settings, Image as ImageIcon, 
    Plus, Edit, Trash2, Save, X, ChevronRight, ChevronDown, 
    Search, Upload, Palette, Globe, Menu, MessageSquare, Flag,
    FileText, Link as LinkIcon, Download, Code, GripVertical, HelpCircle, AlertTriangle, RefreshCw, Copy, LogOut, ArrowLeft, Check, CheckCircle,
    TrendingUp, BarChart3, Calendar, Activity, HardDrive, Clock, MousePointerClick, Star, ShieldCheck, KeyRound, Folder, LayoutGrid, Shrink, Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DataProvider } from '../services/dataProvider';
import { AuthService } from '../services/auth';
import { Comic, Genre, AdConfig, User, StaticPage, ThemeConfig, Report, Chapter, MediaFile, Analytics, Comment, LeechConfig, LeechJob, SystemStats, DailyView } from '../types';
import SimpleEditor from '../components/SimpleEditor';
import { DEFAULT_THEME, SEED_STATIC_PAGES } from '../services/seedData';
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

// FIX: Cải thiện logic nén ảnh để ghi đè file gốc
export const compressImage = (file: File, quality = 0.85, maxDimensions = 1200): Promise<{ file: File; compressed: boolean }> => {
  return new Promise((resolve, reject) => {
    const isResizable = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);

    if (!isResizable) {
      return resolve({ file, compressed: false });
    }
    
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
        
        // Giữ nguyên định dạng file gốc
        const outputMimeType = file.type;
        
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Canvas toBlob failed'));
            
            // Giữ nguyên tên file gốc
            const newFile = new File([blob], file.name, {
              type: outputMimeType,
              lastModified: Date.now(),
            });

            if (newFile.size >= file.size) {
              return resolve({ file, compressed: false });
            }
            
            resolve({ file: newFile, compressed: true });
          },
          outputMimeType,
          // Chỉ áp dụng quality cho các định dạng hỗ trợ
          (outputMimeType === 'image/jpeg' || outputMimeType === 'image/webp') ? quality : undefined
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

const MEDIA_PAGE_SIZE = 48; // NEW: Phân trang thư viện ảnh

const isCompressibleImage = (fileName: string) => {
    return /\.(jpe?g|png|webp)$/i.test(fileName);
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
    const [dailyViews, setDailyViews] = useState<DailyView[]>([]);
    const [leechConfigs, setLeechConfigs] = useState<LeechConfig[]>([]);
    const [leechJobs, setLeechJobs] = useState<LeechJob[]>([]); 
    const [mediaViewMode, setMediaViewMode] = useState<'grid' | 'tiles' | 'list'>('grid');
    const [mediaPath, setMediaPath] = useState<string[]>([]);
    const [comicSearchQuery, setComicSearchQuery] = useState(''); 
    const [systemStats, setSystemStats] = useState<SystemStats | null>(null); 
    const [compressingFile, setCompressingFile] = useState<string | null>(null);
    const [fileBeingCompressed, setFileBeingCompressed] = useState<string | null>(null);
    const [isCompressingAll, setIsCompressingAll] = useState(false);
    const [compressionProgress, setCompressionProgress] = useState<string | null>(null);


    // NEW: State for media pagination
    const [visibleMediaCount, setVisibleMediaCount] = useState(MEDIA_PAGE_SIZE);

    // Dashboard Filter State
    const [topComicsTimeframe, setTopComicsTimeframe] = useState<'Hôm nay' | 'Tuần này' | 'Tháng này'>('Hôm nay');

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
        
        // NEW: Reset media pagination when path changes
        if(activeTab === 'media') {
            setVisibleMediaCount(MEDIA_PAGE_SIZE);
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
                        DataProvider.getDailyViewsAnalytics().then(setDailyViews),
                        DataProvider.getSystemStats().then(setSystemStats),
                        DataProvider.getComments().then(setComments)
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
            showConfirm(`Không thể tải dữ liệu cho mục này. Vui lòng kiểm tra kết nối Server Backend và thử lại. Lỗi: ${e.message}`, () => {}, 'Lỗi Tải Dữ Liệu', 'alert');
        } finally {
            setLoading(false);
        }
    };


    // --- Actions ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: 'comic' | 'ad' | 'theme-favicon' | 'theme-logo') => {
        if (e.target.files?.[0]) {
            setIsUploadingFile(true);
            try {
                const { file: compressedFile } = await compressImage(e.target.files[0]);
                const url = await DataProvider.uploadImage(compressedFile, "theme");
                if (url) {
                    if (targetField === 'comic') setComicForm(prev => ({ ...prev, coverImage: url }));
                    else if (targetField === 'ad') setAdForm(prev => ({ ...prev, imageUrl: url }));
                    else if (targetField === 'theme-favicon') setThemeConfig(prev => ({...prev, favicon: url}));
                    else if (targetField === 'theme-logo') setThemeConfig(prev => ({...prev, logoUrl: url}));
                }
            } catch {
                showAlert('Lỗi upload.');
            } finally {
                setIsUploadingFile(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };
    
    // NEW: Nén ảnh trước khi upload chapter
    const handleChapterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            setIsUploadingFile(true);
            try {
                const urls: string[] = [];
                for (let i = 0; i < e.target.files.length; i++) {
                    const originalFile = e.target.files[i];
                    setCompressingFile(`Nén ảnh ${i + 1}/${e.target.files.length}: ${originalFile.name}`);

                    const { file: compressedFile } = await compressImage(originalFile);
                    
                    setCompressingFile(`Tải lên ${i + 1}/${e.target.files.length}: ${compressedFile.name}`);
                    const url = await DataProvider.uploadImage(compressedFile, slugify(comicForm.slug || comicForm.title), chapterForm.number, i + 1, true);
                    if (url) urls.push(url);
                }
                setChapterForm(prev => ({ ...prev, pagesContent: prev.pagesContent + (prev.pagesContent ? '\n' : '') + urls.join('\n') }));
            } catch(e: any) {
                showAlert('Lỗi upload: ' + e.message);
            } finally {
                setIsUploadingFile(false);
                setCompressingFile(null);
                if (chapterInputRef.current) chapterInputRef.current.value = '';
            }
        }
    };

    const handleMediaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            setIsUploadingFile(true);
            try {
                const pathString = mediaPath.join('/');
                for (let i = 0; i < e.target.files.length; i++) {
                    await DataProvider.uploadImage(e.target.files[i], pathString);
                }
                loadData();
            } catch {
                showAlert("Lỗi upload.");
            } finally {
                setIsUploadingFile(false);
                if (mediaInputRef.current) mediaInputRef.current.value = '';
            }
        }
    };
    
    // Comic Actions
    const handleEditComic = async (id: string) => {
        setLoading(true);
        setComicForm({ id: '', title: '', coverImage: '', author: '', status: 'Đang tiến hành', genres: [], description: '', views: 0, chapters: [], isRecommended: false, slug: '', metaTitle: '', metaDescription: '', metaKeywords: '' });
        setLeechSourceChapters([]);
        const comic = await DataProvider.getComicById(id);
        if (comic) {
            setComicForm(comic);
            setIsEditing(true);
        }
        setLoading(false);
    };

    const handleSaveComic = async () => {
        const id = comicForm.id || `comic-${Date.now()}`;
        const slug = comicForm.slug || slugify(comicForm.title);
        await DataProvider.saveComic({ ...comicForm, id, slug });
        showConfirm('Đã lưu truyện thành công!', () => {
            setIsEditing(false);
            loadData();
        }, 'Thành công', 'alert', 'OK');
    };
    
    const handleDeleteComic = (id: string) => {
        showConfirm('Bạn có chắc muốn xóa truyện này? Hành động không thể hoàn tác.', async () => {
            await DataProvider.deleteComic(id);
            loadData();
        }, 'Xóa Truyện', 'danger');
    };

    // Chapter Actions
    const handleEditChapter = async (chapter: Chapter) => {
        setLoading(true);
        const pages = await DataProvider.getChapterPages(chapter.id);
        setChapterForm({ id: chapter.id, title: chapter.title, number: chapter.number, pagesContent: pages.map(p => p.imageUrl).join('\n') });
        setIsEditingChapter(true);
        setLoading(false);
    };

    const handleAddNewChapter = () => {
        const newNumber = comicForm.chapters.length > 0 ? Math.max(...comicForm.chapters.map(c => c.number)) + 1 : 1;
        setChapterForm({ id: '', title: `Chapter ${newNumber}`, number: newNumber, pagesContent: '' });
        setIsEditingChapter(true);
    };

    const handleAddNewChapterFromExisting = async (comicId: string) => {
        await handleEditComic(comicId);
        handleAddNewChapter();
    }

    const handleSaveChapter = async () => {
        if (!comicForm.id) { showAlert('Lưu truyện trước!'); return; }
        setIsUploadingFile(true);
        const chapterId = chapterForm.id || `${comicForm.id}-chap-${chapterForm.number}-${Date.now()}`;
        
        await DataProvider.saveChapter(
            { id: chapterId, comicId: comicForm.id, number: chapterForm.number, title: chapterForm.title, updatedAt: new Date().toISOString() },
            chapterForm.pagesContent.split('\n').map(l => l.trim()).filter(Boolean).map((url, i) => ({ imageUrl: url, pageNumber: i + 1 }))
        );
        
        const updatedComic = await DataProvider.getComicById(comicForm.id);
        if (updatedComic) setComicForm(updatedComic);

        setIsUploadingFile(false);
        setIsEditingChapter(false);
    };

    const handleDeleteChapter = (chapterId: string) => {
        showConfirm('Xóa chapter này?', async () => {
            await DataProvider.deleteChapter(chapterId, comicForm.id);
            const updatedComic = await DataProvider.getComicById(comicForm.id);
            if (updatedComic) setComicForm(updatedComic);
        }, 'Xóa Chapter', 'danger');
    };

    // Genre Actions
    const handleSaveGenre = async () => {
        await DataProvider.saveGenre({ ...genreForm, id: genreForm.id || `g-${Date.now()}`, slug: genreForm.slug || slugify(genreForm.name) });
        setGenreForm({ id: '', name: '', slug: '', isShowHome: false });
        loadData();
        showAlert('Đã lưu thể loại!');
    };
    
    const handleDeleteGenre = (id: string) => {
        showConfirm('Xóa thể loại này?', async () => {
            await DataProvider.deleteGenre(id);
            loadData();
        }, 'Xóa Thể loại', 'danger');
    };
    
    // Ad Actions
    const handleSaveAd = async () => {
        await DataProvider.saveAd({ ...adForm, id: adForm.id || `ad-${Date.now()}` });
        setAdForm({ id: '', position: 'home_middle', imageUrl: '', linkUrl: '', isActive: true, title: '' });
        loadData();
        showAlert('Đã lưu quảng cáo!');
    };

    const handleDeleteAd = (id: string) => {
        showConfirm('Xóa quảng cáo này?', async () => {
            await DataProvider.deleteAd(id);
            loadData();
        }, 'Xóa Quảng cáo', 'danger');
    };
    
    // User Actions
    const handleSaveUser = async () => {
        const isNew = !userForm.id;
        await DataProvider.saveUser(userForm);
        showAlert(isNew ? 'Đã tạo người dùng mới thành công!' : 'Đã cập nhật thông tin người dùng!');
        setUserForm(initialUserForm);
        loadData();
    };

    const handleDeleteUser = (id: string | number) => {
        showConfirm('Xóa người dùng này?', async () => {
            await DataProvider.deleteUser(id);
            loadData();
        }, 'Xóa User', 'danger');
    };
    
    // Settings Actions
    const handleSaveSettings = async () => {
        await DataProvider.saveTheme(themeConfig);
        showAlert('Đã lưu cấu hình thành công!');
        window.location.reload();
    };

    // Static Page Actions
    const handleSaveStatic = async () => {
        const page = { ...staticForm, slug: staticForm.slug || slugify(staticForm.title) };
        if (!page.title || !page.slug) {
            showAlert("Tiêu đề và Slug không được để trống.", "Lỗi");
            return;
        }

        const success = await DataProvider.saveStaticPage(page);
        if (success) {
            showConfirm('Đã lưu trang tĩnh!', () => {
                setStaticForm({ slug: '', title: '', content: '' });
                loadData();
            }, 'Thành công', 'alert');
        } else {
            showAlert('Lưu thất bại. Vui lòng kiểm tra kết nối server.', 'Lỗi');
        }
    };
    
    const handleResetStatic = () => {
        showConfirm('Tạo lại các trang tĩnh mẫu?', async () => {
            for (const page of SEED_STATIC_PAGES) {
                await DataProvider.saveStaticPage(page);
            }
            loadData();
            showAlert('Đã tạo xong!');
        });
    };
    
    const handleDeleteReport = (id: string) => {
        showConfirm('Xóa báo cáo này?', async () => {
            await DataProvider.deleteReport(id);
            loadData();
        }, 'Xóa Báo cáo', 'danger');
    };
    
    const handleDeleteStatic = (slug: string, title: string) => {
        showConfirm(`Bạn có chắc muốn xóa trang "${title}"?`, async () => {
            const success = await DataProvider.deleteStaticPage(slug);
            if (success) {
                showConfirm('Đã xóa trang tĩnh.', () => {
                    if (staticForm.slug === slug) setStaticForm({ slug: '', title: '', content: '' });
                    loadData();
                }, 'Thành công', 'alert');
            } else {
                showAlert('Xóa trang thất bại. Trang có thể không tồn tại hoặc đã có lỗi xảy ra.', 'Lỗi');
            }
        }, 'Xóa Trang Tĩnh', 'danger');
    };
    
    // Media Actions
    const handleGoToFolder = (folder: string) => { setMediaPath(prev => [...prev, folder]); };
    const handleGoUp = (index: number) => { setMediaPath(prev => prev.slice(0, index + 1)); };
    const handleGoToRoot = () => { setMediaPath([]); };
    const handleDeleteMedia = async (name: string, isDir: boolean) => {
        if (isDir) {
            showAlert("Không thể xóa thư mục từ giao diện này. Vui lòng sử dụng FTP hoặc trình quản lý file trên host của bạn.", "Thao tác bị chặn");
            return;
        }
        const pathString = mediaPath.join('/');
        const fullPath = pathString ? `${pathString}/${name}` : name;
        showConfirm(`Xóa file ${name}? Hành động này không thể hoàn tác.`, async () => {
            const success = await DataProvider.deleteMedia(fullPath);
            if (success) {
                showAlert("Đã xóa file thành công.");
                loadData();
            } else {
                showAlert("Xóa file thất bại. Có thể file không tồn tại hoặc do lỗi server.", "Lỗi");
            }
        }, 'Xóa Ảnh', 'danger');
    };
    const handleCopyUrl = (url: string) => {
        const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
        navigator.clipboard.writeText(fullUrl).then(() => showAlert("Đã copy vào clipboard!"));
    };

    const handleCompressMedia = async (file: MediaFile) => {
        if (!file || file.isDir || isUploadingFile || isCompressingAll) return;
        
        setFileBeingCompressed(file.name);
        setIsUploadingFile(true);

        try {
            const blob = await DataProvider.getImageBlob(file.url);
            if (!blob) throw new Error("Không thể tải ảnh về để nén.");
            
            const originalFile = new File([blob], file.name, { type: blob.type });
            const originalSize = originalFile.size;

            const { file: compressedFile, compressed } = await compressImage(originalFile);

            if (!compressed) {
                showAlert('Ảnh đã được tối ưu, không cần nén thêm.', 'Đã Tối Ưu');
                return;
            }

            const pathString = mediaPath.join('/');
            const newUrl = await DataProvider.uploadImage(compressedFile, pathString, undefined, undefined, true);
            if (!newUrl) throw new Error("Tải lên ảnh đã nén thất bại.");

            const newSize = compressedFile.size;
            const reduction = originalSize - newSize;
            const percent = ((reduction / originalSize) * 100).toFixed(1);
            
            showConfirm(
                `Nén thành công! Kích thước giảm từ ${formatFileSize(originalSize)} xuống ${formatFileSize(newSize)} (giảm ${percent}%).`,
                () => { loadData(); },
                'Thành Công',
                'alert'
            );

        } catch (e: any) {
            showAlert(`Nén thất bại: ${e.message}`, 'Lỗi');
        } finally {
            setIsUploadingFile(false);
            setFileBeingCompressed(null);
        }
    };

    const handleCompressAll = async () => {
        const compressibleFiles = mediaFiles.filter(f => !f.isDir && isCompressibleImage(f.name));
        if (compressibleFiles.length === 0) {
            showAlert("Không có ảnh nào để nén trong thư mục này.", "Thông báo");
            return;
        }

        showConfirm(`Bạn có chắc muốn nén ${compressibleFiles.length} ảnh trong thư mục này? Quá trình này sẽ ghi đè lên ảnh gốc và không thể hoàn tác.`, async () => {
            setIsCompressingAll(true);
            setCompressionProgress(`Bắt đầu...`);
            let successCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            
            for (const [index, file] of compressibleFiles.entries()) {
                setCompressionProgress(`Nén ${index + 1}/${compressibleFiles.length}: ${file.name}`);
                setFileBeingCompressed(file.name);
                try {
                    const blob = await DataProvider.getImageBlob(file.url);
                    if (!blob) throw new Error("Không thể tải ảnh về.");

                    const originalFile = new File([blob], file.name, { type: blob.type });
                    const { file: compressedFile, compressed } = await compressImage(originalFile);

                    if (!compressed) {
                        skippedCount++;
                        continue;
                    }

                    const pathString = mediaPath.join('/');
                    const newUrl = await DataProvider.uploadImage(compressedFile, pathString, undefined, undefined, true);
                    if (!newUrl) throw new Error("Tải lên thất bại.");
                    
                    successCount++;
                } catch (e: any) {
                    console.error(`Lỗi nén ${file.name}:`, e.message);
                    errorCount++;
                }
            }

            setFileBeingCompressed(null);
            setIsCompressingAll(false);
            setCompressionProgress(null);
            
            showAlert(`Hoàn tất!
            - Thành công: ${successCount} ảnh
            - Đã tối ưu: ${skippedCount} ảnh
            - Thất bại: ${errorCount} ảnh`, 'Kết Quả Nén Ảnh');
            
            loadData();
        }, "Xác Nhận Nén Hàng Loạt", "danger", "Nén tất cả");
    };
    
    // Comments
    const handleApproveComment = async (id: string) => { await DataProvider.approveComment(id); loadData(); };
    const handleDeleteComment = (id: string) => { showConfirm('Xóa bình luận này?', async () => { await DataProvider.deleteComment(id); loadData(); }, 'Xóa Bình luận', 'danger'); };
    
    // Leech Configs
    const handleSaveLeechConfig = async () => {
        const id = leechConfigForm.id || `leech-${Date.now()}`;
        await DataProvider.saveLeechConfig({ ...leechConfigForm, id });
        setLeechConfigForm(initialLeechConfigForm);
        loadData();
        showAlert("Đã lưu cấu hình leech!");
    };
    
    const handleDeleteLeechConfig = (id: string) => {
        showConfirm("Xóa cấu hình này?", async () => {
            await DataProvider.deleteLeechConfig(id);
            loadData();
        }, "Xóa Cấu hình", "danger");
    };

    // --- LEECH ACTIONS (RESTORED) ---
    const handleScanComic = async () => {
        setLeechError(null);
        setLeechSourceChapters([]);
        const config = leechConfigs.find(c => c.id === selectedLeechConfigId);

        if (!config || !leechUrl) {
            setLeechError("Vui lòng chọn Server Leech và nhập Link truyện.");
            return;
        }
        
        setIsScanning(true);
        setLeechProgress('Đang quét...');

        try {
            const html = await DataProvider.getProxiedHtml(leechUrl);
            const data = genericParseComicHtml(html, { ...config, baseUrl: leechUrl });
            
            setComicForm(prev => ({
                ...prev,
                title: prev.title || data.title,
                author: prev.author || data.author,
                description: prev.description || data.description,
                coverImage: prev.coverImage || data.coverImage,
                slug: prev.slug || slugify(data.title)
            }));
            
            setLeechSourceChapters(data.chapters || []);
            if ((data.chapters || []).length === 0) {
                 setLeechError("Không tìm thấy chapter nào. Vui lòng kiểm tra lại Selector trong Cấu hình Leech.");
            }
        } catch (e: any) {
            setLeechError(e.message);
        } finally {
            setIsScanning(false);
            setLeechProgress('');
        }
    };

    const handleLeechChapters = async () => {
        let comicId = comicForm.id;
        if (!comicId) {
            showAlert("Vui lòng lưu truyện trước khi leech chapter.", "Lỗi");
            return;
        }

        const config = leechConfigs.find(c => c.id === selectedLeechConfigId);
        if (!config) {
            showAlert("Không tìm thấy cấu hình leech.", "Lỗi");
            return;
        }

        const chaptersToLeech = leechSourceChapters.filter(c => leechSelectedChapters.includes(c.url));
        if (chaptersToLeech.length === 0) {
            showAlert("Vui lòng chọn ít nhất một chapter để leech.", "Lỗi");
            return;
        }

        setIsScanning(true);
        setLeechError(null);
        let successCount = 0;

        try {
            for (const [index, chapter] of chaptersToLeech.entries()) {
                setLeechProgress(`Đang leech: ${chapter.title} (${index + 1}/${chaptersToLeech.length})`);
                
                try {
                    const html = await DataProvider.getProxiedHtml(chapter.url);
                    let imageUrls = genericParseChapterImagesHtml(html, { ...config, baseUrl: chapter.url });

                    if (imageUrls.length > 0) {
                        if (leechStorageMode === 'upload') {
                            const uploadedUrls = [];
                            for (let i = 0; i < imageUrls.length; i++) {
                                setLeechProgress(`Tải ảnh ${i + 1}/${imageUrls.length} của ${chapter.title}`);
                                try {
                                    const slug = comicForm.slug || slugify(comicForm.title);
                                    const newUrl = await DataProvider.uploadImageFromUrl(imageUrls[i], slug, chapter.number, i + 1);
                                    uploadedUrls.push(newUrl || imageUrls[i]);
                                } catch (uploadError) {
                                    console.error("Upload error:", uploadError);
                                    uploadedUrls.push(imageUrls[i]); // Fallback to original URL
                                }
                            }
                            imageUrls = uploadedUrls;
                        }
                        
                        if (imageUrls.length > 0) {
                            const chapterId = `${comicId}-chap-${chapter.number}-${Date.now()}`;
                            await DataProvider.saveChapter(
                                { id: chapterId, comicId: comicId, number: chapter.number, title: chapter.title, updatedAt: new Date().toISOString() },
                                imageUrls.map((url, i) => ({ imageUrl: url, pageNumber: i + 1 }))
                            );
                            successCount++;
                        }
                    }
                } catch (chapterError: any) {
                    console.error(`Failed to leech ${chapter.title}:`, chapterError);
                    setLeechError(prev => (prev ? prev + '\n' : '') + `Lỗi khi leech ${chapter.title}: ${chapterError.message}`);
                }
                await new Promise(res => setTimeout(res, 300));
            }

            showAlert(`Hoàn tất! Leech thành công: ${successCount}/${chaptersToLeech.length} chapter.`, 'Thành công');

        } catch (e: any) {
            setLeechError(e.message);
        } finally {
            setIsScanning(false);
            setLeechProgress('');
            setLeechSelectedChapters([]);
            if (comicId) {
                const updatedComic = await DataProvider.getComicById(comicId);
                if (updatedComic) setComicForm(updatedComic);
            }
        }
    };

    // Theme Config Helpers
    const handleAddHomeGenre = () => {
        if (genreSelectRef.current) {
            const slug = genreSelectRef.current.value;
            if (slug) {
                const genre = genres.find(g => g.slug === slug);
                if (genre) {
                    const currentHomeGenres = themeConfig.homeLayout?.homeGenres || [];
                    if (!currentHomeGenres.some(g => g.slug === slug)) {
                        setThemeConfig(prev => ({
                            ...prev,
                            homeLayout: {
                                ...prev.homeLayout || DEFAULT_THEME.homeLayout,
                                homeGenres: [...currentHomeGenres, { name: genre.name, slug: genre.slug }]
                            }
                        }));
                    }
                }
            }
        }
    };

    const handleRemoveHomeGenre = (slug: string) => {
        setThemeConfig(prev => ({
            ...prev,
            homeLayout: {
                ...prev.homeLayout || DEFAULT_THEME.homeLayout,
                homeGenres: (prev.homeLayout?.homeGenres || []).filter(g => g.slug !== slug)
            }
        }));
    };

    const handleDragStart = (genre: {name: string, slug: string}) => { setDraggedGenre(genre); };
    const handleDrop = (targetIndex: number) => {
        if (!draggedGenre) return;
        const currentHomeGenres = [...themeConfig.homeLayout?.homeGenres || []];
        const draggedIndex = currentHomeGenres.findIndex(g => g.slug === draggedGenre.slug);
        if (draggedIndex !== -1) {
            const [item] = currentHomeGenres.splice(draggedIndex, 1);
            currentHomeGenres.splice(targetIndex, 0, item);
            setThemeConfig(prev => ({
                ...prev,
                homeLayout: {
                    ...prev.homeLayout || DEFAULT_THEME.homeLayout,
                    homeGenres: currentHomeGenres
                }
            }));
        }
        setDraggedGenre(null);
    };

    // Editor Actions
    const handleUpdatePassword = async () => {
        const user = AuthService.getUser();
        if (!user || !editorPasswordForm.password) {
            showAlert("Vui lòng nhập mật khẩu mới.");
            return;
        }
        const updatedUser = { ...user, password: editorPasswordForm.password };
        await DataProvider.saveUser(updatedUser);
        setEditorPasswordForm({ password: '' });
        showAlert("Đổi mật khẩu thành công!");
    };

    // Keyboard shortcut for saving forms
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                switch(activeTab) {
                    case 'comics':
                        if (isEditingChapter) {
                            if (chapterForm.pagesContent.trim()) handleSaveChapter();
                            else showAlert("Không thể lưu chapter rỗng.", "Lỗi");
                        } else if (isEditing) {
                            if (comicForm.title.trim()) handleSaveComic();
                            else showAlert("Tên truyện không được để trống.", "Lỗi");
                        }
                        break;
                    case 'genres': if (genreForm.name.trim()) handleSaveGenre(); break;
                    case 'ads': if (adForm.imageUrl.trim()) handleSaveAd(); break;
                    case 'users': if (userForm.username.trim() && (userForm.id || userForm.password)) handleSaveUser(); break;
                    case 'static': if (staticForm.title.trim()) handleSaveStatic(); break;
                    case 'settings': handleSaveSettings(); break;
                    case 'leech_configs': if (leechConfigForm.name.trim()) handleSaveLeechConfig(); break;
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeTab, isEditing, isEditingChapter, comicForm, chapterForm, genreForm, adForm, userForm, staticForm, themeConfig, leechConfigForm]);
    
    // Menu item component for reusability
    const MenuItem = ({ id, label, icon: Icon }: { id: string, label: string, icon: React.ElementType }) => (
        <button
            onClick={() => setActiveTab(id as any)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
        >
            <Icon size={18} /> {label}
        </button>
    );

    const MenuLink = ({ to, label, icon: Icon }: { to: string, label: string, icon: React.ElementType }) => (
         <Link to={to} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 text-sm px-2">
            <Icon size={16} /> {label}
        </Link>
    );

    const MenuSection = ({ children }: {children: React.ReactNode}) => <div className="p-4 border-t border-white/10">{children}</div>;
    
    const renderMenu = () => {
        const menuItems = [
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
            { id: 'leech_configs', label: 'Cấu hình Leech', icon: Download },
        ];
        return menuItems.filter(item => AuthService.hasPermission(item.id)).map(item => <MenuItem key={item.id} {...item} />);
    };

    const DynamicHeader = ({ title, children }: {title: string, children?: React.ReactNode}) => (
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <div className="flex items-center gap-2">
                {children}
            </div>
        </div>
    );
    
    const SubHeader = ({ title, icon: Icon, children }: {title: string, icon: React.ElementType, children?: React.ReactNode}) => (
        <h3 className="font-bold text-white mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
                <Icon size={20} className="text-primary"/>
                {title}
            </span>
            {children}
        </h3>
    );
    
    const Card = ({ children, className = '' }: {children: React.ReactNode, className?: string}) => (
        <div className={`bg-card border border-white/10 rounded-xl ${className}`}>
            {children}
        </div>
    );

    const InputGroup = ({ label, children }: {label: string, children: React.ReactNode}) => (
        <div>
            <label className="text-xs text-slate-400 block mb-1">{label}</label>
            {children}
        </div>
    );

    const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
        <input {...props} className={`w-full bg-dark border border-white/10 rounded p-2 text-white ${props.className || ''}`} />
    );
    
    // FIX: Forward ref to the underlying select element to allow using refs on this component.
    const SelectInput = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => (
        <select {...props} ref={ref} className={`w-full bg-dark border border-white/10 rounded p-2 text-white ${props.className || ''}`} />
    ));

    // FIX: Add className prop to allow custom styling and update onClick type to be more flexible.
    const Button = ({ children, onClick, disabled = false, icon: Icon, variant = 'primary', className }: {children: React.ReactNode, onClick: (e?: React.MouseEvent) => void, disabled?: boolean, icon?: React.ElementType, variant?: 'primary'|'secondary'|'danger'|'ghost', className?: string}) => {
        const baseClass = "px-4 py-2 rounded font-bold flex items-center gap-2 transition-all";
        const variantClasses = {
            'primary': 'bg-primary text-white hover:bg-primary/90',
            'secondary': 'bg-white/10 text-slate-200 hover:bg-white/20',
            'danger': 'bg-red-600 text-white hover:bg-red-700',
            'ghost': 'text-slate-400 hover:text-white'
        };
        const disabledClass = 'disabled:opacity-50 disabled:cursor-not-allowed';
        return (
            <button onClick={onClick} disabled={disabled} className={`${baseClass} ${variantClasses[variant]} ${disabledClass} ${className || ''}`}>
                {Icon && <Icon size={16} />}
                {children}
            </button>
        );
    };

    const renderDashboard = () => {
        const top5Comics = [...comics].sort((a,b) => b.views - a.views).slice(0, 5);
        const latest5Comics = [...comics].sort((a,b) => new Date(b.chapters[0]?.updatedAt || 0).getTime() - new Date(a.chapters[0]?.updatedAt || 0).getTime()).slice(0, 5);
        const storageUsage = systemStats?.imageStorageUsed || 0;

        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div onClick={() => setActiveTab('comics')} className="cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 rounded-xl">
                        <Card className="p-4 relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
                            <div className="absolute right-0 top-0 w-20 h-20 bg-blue-500/5 rounded-bl-full group-hover:bg-blue-500/10 transition-colors"></div>
                            <div className="flex justify-between items-start mb-2 relative z-10">
                                <div className="p-2 bg-blue-500/20 text-blue-500 rounded-lg"><BookOpen size={20} /></div>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1 relative z-10">{comics.length}</h3>
                            <p className="text-slate-400 text-sm relative z-10">Đầu truyện</p>
                        </Card>
                    </div>
                     <div onClick={() => setActiveTab('users')} className="cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 rounded-xl">
                        <Card className="p-4 relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
                            <div className="absolute right-0 top-0 w-20 h-20 bg-green-500/5 rounded-bl-full group-hover:bg-green-500/10 transition-colors"></div>
                            <div className="flex justify-between items-start mb-2 relative z-10">
                                <div className="p-2 bg-green-500/20 text-green-400 rounded-lg"><Users size={20} /></div>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1 relative z-10">{users.length}</h3>
                            <p className="text-slate-400 text-sm relative z-10">Thành viên</p>
                        </Card>
                    </div>
                    <div onClick={() => setActiveTab('reports')} className="cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 rounded-xl">
                        <Card className="p-4 relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
                            <div className="absolute right-0 top-0 w-20 h-20 bg-orange-500/5 rounded-bl-full group-hover:bg-orange-500/10 transition-colors"></div>
                            <div className="flex justify-between items-start mb-2 relative z-10">
                                <div className="p-2 bg-orange-500/20 text-orange-500 rounded-lg"><Flag size={20} /></div>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1 relative z-10">{reports.length}</h3>
                            <p className="text-slate-400 text-sm relative z-10">Báo cáo lỗi</p>
                        </Card>
                    </div>
                    <div onClick={() => setActiveTab('genres')} className="cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20 rounded-xl">
                        <Card className="p-4 relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
                            <div className="absolute right-0 top-0 w-20 h-20 bg-purple-500/5 rounded-bl-full group-hover:bg-purple-500/10 transition-colors"></div>
                            <div className="flex justify-between items-start mb-2 relative z-10">
                                <div className="p-2 bg-purple-500/20 text-purple-500 rounded-lg"><List size={20} /></div>
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-1 relative z-10">{genres.length}</h3>
                            <p className="text-slate-400 text-sm relative z-10">Thể loại</p>
                        </Card>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Lượt xem */}
                    <Card className="lg:col-span-1 p-6 flex flex-col gap-6">
                        <SubHeader title="Tổng quan lượt xem" icon={Activity}/>
                        <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/20 rounded-xl p-6 text-center">
                            <span className="text-slate-400 text-sm uppercase tracking-wider">Tổng lượt xem trang web</span>
                            <div className="text-4xl lg:text-5xl font-extrabold text-white mt-2 mb-1 drop-shadow-lg">{analytics.totalViews.toLocaleString()}</div>
                            <div className="text-green-400 text-xs font-medium flex items-center justify-center gap-1"><TrendingUp size={12}/> +5.2% so với tháng trước</div>
                        </div>
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
                    </Card>

                    {/* Top truyện */}
                    <Card className="lg:col-span-2 flex flex-col">
                        <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500"><TrendingUp size={20}/></div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Top Truyện Xem Nhiều</h3>
                                    <p className="text-xs text-slate-500">Thống kê theo lượt xem thực tế</p>
                                </div>
                            </div>
                             <div className="flex bg-dark p-1 rounded-lg border border-white/10">
                                {['Hôm nay', 'Tuần này', 'Tháng này'].map(tf => (
                                    <button
                                        key={tf}
                                        onClick={() => setTopComicsTimeframe(tf as any)}
                                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${topComicsTimeframe === tf ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto">
                           <div className="space-y-6">
                                {top5Comics.map((comic, index) => {
                                    const topView = top5Comics[0]?.views || 1;
                                    const percentage = (comic.views / topView) * 100;
                                    return (
                                        <div key={comic.id} className="relative group">
                                            <div className="flex items-center gap-4 relative z-10">
                                                <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${index === 0 ? 'bg-yellow-500 text-black' : index === 1 ? 'bg-slate-300 text-black' : index === 2 ? 'bg-orange-700 text-white' : 'bg-white/10 text-slate-400'}`}>
                                                    {index + 1}
                                                </div>
                                                <img src={comic.coverImage} className="w-10 h-14 object-cover rounded bg-dark border border-white/10" alt={comic.title}/>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-sm font-bold text-white truncate pr-2 group-hover:text-primary transition-colors cursor-pointer" onClick={() => handleEditComic(comic.id)}>{comic.title}</span>
                                                        <span className="text-xs font-bold text-slate-300">{comic.views.toLocaleString()}</span>
                                                    </div>
                                                    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                        <div className={`h-full rounded-full ${index === 0 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-primary'}`} style={{ width: `${percentage}%`}}></div>
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
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-6">
                        <SubHeader title="Trạng thái hệ thống" icon={HardDrive} />
                        {systemStats ? (
                             <div className="space-y-3">
                                 <div className="flex justify-between items-center text-sm">
                                     <span className="text-slate-400">Dung lượng ảnh</span>
                                     <span className="text-white font-semibold">{formatFileSize(storageUsage)}</span>
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
                        ) : (
                             <p className="text-sm text-slate-500">Đang tải thông số...</p>
                        )}
                    </Card>
                    <Card className="p-6">
                         <SubHeader title="Vừa cập nhật" icon={Clock} />
                         <div className="space-y-3">
                             {latest5Comics.slice(0, 3).map(c => (
                                 <div key={c.id} className="flex gap-3 items-center p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer" onClick={() => handleEditComic(c.id)}>
                                     <img src={c.coverImage} className="w-10 h-10 object-cover rounded" alt=""/>
                                     <div className="flex-1 min-w-0">
                                         <div className="text-sm font-medium text-white truncate">{c.title}</div>
                                         <div className="text-xs text-slate-500">{c.chapters[0] ? `Đã đăng ${c.chapters[0].title}` : 'Chưa có chương'}</div>
                                     </div>
                                     <div className="text-[10px] text-slate-500 whitespace-nowrap">{c.chapters[0]?.updatedAt ? new Date(c.chapters[0].updatedAt).toLocaleDateString() : 'N/A'}</div>
                                 </div>
                             ))}
                             <button onClick={() => setActiveTab('comics')} className="w-full text-center text-xs text-primary hover:underline pt-2">Xem tất cả truyện</button>
                         </div>
                    </Card>
                </div>
            </div>
        )
    };
    
    // --- Render functions for each tab ---
    const renderComics = () => {
        const filteredComics = comics.filter(c => c.title.toLowerCase().includes(comicSearchQuery.toLowerCase()));

        return (
            <div className="space-y-6">
                <DynamicHeader title="Quản lý Truyện">
                    {!isEditing && 
                        <Button onClick={() => {
                            setComicForm({ id: '', title: '', coverImage: '', author: '', status: 'Đang tiến hành', genres: [], description: '', views: 0, chapters: [], isRecommended: false, slug: '', metaTitle: '', metaDescription: '', metaKeywords: '' });
                            setLeechSourceChapters([]);
                            setIsEditing(true);
                        }} icon={Plus}>
                            Thêm Truyện
                        </Button>
                    }
                </DynamicHeader>
                
                {isEditing ? (
                    // FORM SỬA/THÊM TRUYỆN
                    <div className="bg-card border border-white/10 p-6 rounded-xl animate-in fade-in">
                        {/* Comic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                           <InputGroup label="Tên truyện"><TextInput type="text" value={comicForm.title} onChange={e => setComicForm({...comicForm, title: e.target.value})} /></InputGroup>
                           <InputGroup label="Tác giả"><TextInput type="text" value={comicForm.author} onChange={e => setComicForm({...comicForm, author: e.target.value})} /></InputGroup>
                            <InputGroup label="Ảnh bìa">
                                <div className="flex gap-2">
                                    <TextInput type="text" value={comicForm.coverImage} onChange={e => setComicForm({...comicForm, coverImage: e.target.value})} />
                                    <label className="cursor-pointer bg-blue-600 px-3 py-2 rounded text-white"><input type="file" className="hidden" accept="image/*" ref={fileInputRef} onChange={e => handleFileUpload(e, 'comic')} /><Upload size={16}/></label>
                                </div>
                            </InputGroup>
                           <div className="grid grid-cols-2 gap-2">
                               <InputGroup label="Trạng thái">
                                   <SelectInput value={comicForm.status} onChange={e => setComicForm({...comicForm, status: e.target.value as any})}>
                                       <option value="Đang tiến hành">Đang tiến hành</option>
                                       <option value="Hoàn thành">Hoàn thành</option>
                                   </SelectInput>
                               </InputGroup>
                               <InputGroup label="Views"><TextInput type="number" value={comicForm.views} onChange={e => setComicForm({...comicForm, views: parseInt(e.target.value) || 0})} /></InputGroup>
                           </div>
                        </div>
                        
                        <InputGroup label="Thể loại">
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-dark rounded border border-white/10">
                                {genres.map(g => (
                                    <label key={g.id} className="flex items-center gap-2 text-sm text-slate-300">
                                        <input type="checkbox" checked={comicForm.genres.includes(g.name)} onChange={e => {
                                            const newGenres = e.target.checked ? [...comicForm.genres, g.name] : comicForm.genres.filter(genre => genre !== g.name);
                                            setComicForm({ ...comicForm, genres: newGenres });
                                        }} className="accent-primary"/>
                                        {g.name}
                                    </label>
                                ))}
                            </div>
                        </InputGroup>
                        
                        <div className="my-4">
                           <SimpleEditor label="Mô tả" value={comicForm.description} onChange={val => setComicForm({...comicForm, description: val})} />
                        </div>
                        
                        {/* SEO */}
                        <div className="bg-dark/50 p-4 rounded-lg border border-white/5 space-y-3 mt-4 mb-6">
                            <SubHeader title="SEO" icon={Globe} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div className="md:col-span-2">
                                  <InputGroup label="URL Slug"><TextInput type="text" value={comicForm.slug || ''} onChange={e => setComicForm({...comicForm, slug: e.target.value})} /></InputGroup>
                               </div>
                                <InputGroup label="Meta Title"><TextInput type="text" value={comicForm.metaTitle || ''} onChange={e => setComicForm({...comicForm, metaTitle: e.target.value})} /></InputGroup>
                                <InputGroup label="Meta Keywords"><TextInput type="text" value={comicForm.metaKeywords || ''} onChange={e => setComicForm({...comicForm, metaKeywords: e.target.value})} /></InputGroup>
                                <div className="md:col-span-2">
                                  <InputGroup label="Meta Description"><textarea value={comicForm.metaDescription || ''} onChange={e => setComicForm({...comicForm, metaDescription: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white h-20" /></InputGroup>
                               </div>
                            </div>
                        </div>

                        {/* LEECH */}
                        <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-500/20 p-4 rounded-lg mb-6">
                            <SubHeader title="Leech Truyện" icon={Download}/>

                            {leechError && <div className="mb-3 p-3 bg-red-500/20 text-red-300 text-sm">{leechError}</div>}
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                                <select value={selectedLeechConfigId} onChange={e => setSelectedLeechConfigId(e.target.value)} className="md:col-span-1 bg-dark border border-white/10 rounded px-3 py-2 text-sm text-white">
                                    <option value="">-- Chọn Server Leech --</option>
                                    {leechConfigs.map(cfg => <option key={cfg.id} value={cfg.id}>{cfg.name}</option>)}
                                </select>
                                <input type="text" placeholder="Link truyện..." value={leechUrl} onChange={e => setLeechUrl(e.target.value)} className="md:col-span-2 bg-dark border border-white/10 rounded px-3 py-2 text-sm text-white" />
                            </div>
                           
                            <button onClick={handleScanComic} disabled={isScanning} className="w-full bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold min-w-[80px]">
                                {isScanning ? leechProgress || '...' : 'Quét'}
                            </button>
                            
                             {leechSourceChapters.length > 0 && (
                                 <div className="space-y-3 pt-3 mt-3 border-t border-white/10">
                                    <div className="max-h-40 overflow-y-auto bg-dark border border-white/10 rounded p-2">
                                        <div className="flex justify-between items-center mb-2 px-1">
                                            <label className="text-xs text-slate-400 flex items-center gap-2">
                                                <input type="checkbox" onChange={e => setLeechSelectedChapters(e.target.checked ? leechSourceChapters.map(c => c.url) : [])} checked={leechSelectedChapters.length === leechSourceChapters.length && leechSourceChapters.length > 0} /> Tất cả
                                            </label>
                                            <span className="text-xs text-indigo-400 font-bold">{leechSelectedChapters.length} chọn</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1">
                                            {leechSourceChapters.map((c, i) => (
                                                <label key={i} className="flex items-center gap-2 text-xs p-1 hover:bg-white/5 rounded truncate">
                                                    <input type="checkbox" checked={leechSelectedChapters.includes(c.url)} onChange={e => {
                                                        if (e.target.checked) setLeechSelectedChapters(prev => [...prev, c.url]);
                                                        else setLeechSelectedChapters(prev => prev.filter(url => url !== c.url));
                                                    }} /> {c.title}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-2">
                                        <label className="text-xs text-slate-400 block mb-1">Chế độ lưu ảnh:</label>
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
                                    <button onClick={handleLeechChapters} disabled={isScanning || leechSelectedChapters.length === 0} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors">
                                        <Download size={18}/> {isScanning ? leechProgress : 'Leech Ngay'}
                                    </button>
                                 </div>
                             )}
                        </div>

                        <div className="flex justify-end gap-3 border-b border-white/10 pb-6 mb-6">
                            <Button onClick={() => setIsEditing(false)} variant="secondary">Đóng</Button>
                            <Button onClick={handleSaveComic} icon={Save}>Lưu</Button>
                        </div>
                        
                        {/* Chapters */}
                        <div className="space-y-4">
                            <DynamicHeader title="Chapters">
                                <Button onClick={handleAddNewChapter} disabled={!comicForm.id} icon={Plus}>Thêm</Button>
                            </DynamicHeader>
                            <Card className="bg-dark max-h-[400px] overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white/5 text-xs text-slate-400 uppercase sticky top-0">
                                        <tr><th className="p-3">Tên</th><th className="p-3">Số</th><th className="p-3">Ngày</th><th className="p-3 text-right">#</th></tr>
                                    </thead>
                                    <tbody>
                                        {(comicForm.chapters || []).map(c => (
                                            <tr key={c.id} className="hover:bg-white/5 text-slate-300">
                                                <td className="p-3">{c.title}</td>
                                                <td className="p-3">{c.number}</td>
                                                <td className="p-3 text-xs">{new Date(c.updatedAt).toLocaleDateString()}</td>
                                                <td className="p-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleEditChapter(c)} className="text-blue-400"><Edit size={14}/></button>
                                                        <button onClick={() => handleDeleteChapter(c.id)} className="text-red-400"><Trash2 size={14}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Card>
                        </div>
                    </div>
                ) : (
                    // BẢNG DANH SÁCH TRUYỆN
                    <Card className="overflow-hidden">
                        <div className="p-3 bg-white/5 border-b border-white/10">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <TextInput type="text" placeholder="Tìm truyện..." value={comicSearchQuery} onChange={e => setComicSearchQuery(e.target.value)} className="py-1.5 px-4 pl-10" />
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
                                                <button onClick={() => handleAddNewChapterFromExisting(c.id)} className="text-green-400" title="Thêm chapter mới"><Plus size={16}/></button>
                                                <button onClick={() => handleEditComic(c.id)} className="text-blue-400" title="Sửa"><Edit size={16}/></button>
                                                <button onClick={() => handleDeleteComic(c.id)} className="text-red-400" title="Xóa"><Trash2 size={16}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                )}

                {isEditingChapter && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <Card className="w-full max-w-2xl">
                           <div className="flex justify-between items-center p-4 border-b border-white/10">
                               <h3 className="text-lg font-bold text-white">{chapterForm.id ? "Sửa Chapter" : "Thêm Mới"}</h3>
                               <button onClick={() => setIsEditingChapter(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                           </div>
                           <div className="p-6 space-y-4">
                               <div className="grid grid-cols-2 gap-4">
                                   <InputGroup label="Số (Order)"><TextInput type="number" value={chapterForm.number} onChange={e => setChapterForm({...chapterForm, number: parseFloat(e.target.value)})} /></InputGroup>
                                   <InputGroup label="Tên hiển thị"><TextInput type="text" value={chapterForm.title} onChange={e => setChapterForm({...chapterForm, title: e.target.value})} /></InputGroup>
                               </div>
                               <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs text-slate-400">Link ảnh (Mỗi dòng 1 link)</label>
                                        <label className="text-xs bg-blue-600 px-3 py-1 rounded cursor-pointer flex items-center gap-1 text-white">
                                            <input type="file" multiple accept="image/*" className="hidden" ref={chapterInputRef} onChange={handleChapterFileUpload} />
                                            {isUploadingFile ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                                            Upload
                                        </label>
                                    </div>
                                    <textarea
                                        value={chapterForm.pagesContent}
                                        onChange={e => setChapterForm({...chapterForm, pagesContent: e.target.value})}
                                        className="w-full h-64 bg-dark border border-white/10 rounded p-2 text-white text-sm font-mono whitespace-pre"
                                    ></textarea>
                                    {isUploadingFile && <p className="text-xs text-primary mt-1">{compressingFile || 'Đang tải lên...'}</p>}
                               </div>
                               <div className="flex justify-end gap-2 pt-2">
                                    <Button onClick={() => setIsEditingChapter(false)} variant="secondary">Hủy</Button>
                                    <Button onClick={handleSaveChapter} disabled={isUploadingFile} icon={Save}>{isUploadingFile ? "Đang tải..." : "Lưu"}</Button>
                               </div>
                           </div>
                        </Card>
                    </div>
                )}
            </div>
        )
    };
    
    // ... other render functions ...
    const renderGenres = () => { /* ... */ return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Quản lý Thể loại</h2>
            <Card className="p-4">
                <div className="flex gap-2 mb-4">
                    <TextInput placeholder="Tên thể loại" value={genreForm.name} onChange={e => setGenreForm({ ...genreForm, name: e.target.value })} className="flex-1" />
                    <TextInput placeholder="Slug (tùy chọn)" value={genreForm.slug} onChange={e => setGenreForm({ ...genreForm, slug: e.target.value })} className="flex-1" />
                    <label className="flex items-center gap-2 text-slate-300 px-2 cursor-pointer select-none">
                        <input type="checkbox" checked={genreForm.isShowHome || false} onChange={e => setGenreForm({...genreForm, isShowHome: e.target.checked})} />
                        Hiện trang chủ
                    </label>
                    <Button onClick={handleSaveGenre} icon={Save}>Lưu</Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-white/5 uppercase text-xs">
                            <tr>
                                <th className="p-3">Tên</th>
                                <th className="p-3">Slug</th>
                                <th className="p-3">Trang chủ</th>
                                <th className="p-3 text-right">Xóa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {genres.map(g => (
                                <tr key={g.id} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="p-3 cursor-pointer hover:text-primary" onClick={() => setGenreForm(g)}>{g.name}</td>
                                    <td className="p-3">{g.slug}</td>
                                    <td className="p-3">{g.isShowHome ? <Check size={16} className="text-green-500" /> : <X size={16} className="text-slate-500"/>}</td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => handleDeleteGenre(g.id)} className="text-red-400 hover:text-red-300">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )};
    const renderAds = () => { /* ... */ return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Quản lý Quảng cáo</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 p-4 h-fit">
                    <h3 className="font-bold text-white mb-4">{adForm.id ? "Sửa" : "Thêm"} Quảng Cáo</h3>
                    <div className="space-y-3">
                        <InputGroup label="Tiêu đề (Ghi chú)">
                            <TextInput type="text" value={adForm.title || ''} onChange={e => setAdForm({...adForm, title: e.target.value})} />
                        </InputGroup>
                         <InputGroup label="Vị trí">
                            <SelectInput value={adForm.position} onChange={e => setAdForm({...adForm, position: e.target.value as any})}>
                                {Object.keys(AD_DIMENSIONS).map(pos => <option key={pos} value={pos}>{pos}</option>)}
                            </SelectInput>
                            <p className="text-[10px] text-primary mt-1">{AD_DIMENSIONS[adForm.position]}</p>
                        </InputGroup>
                        <InputGroup label="Ảnh Banner">
                             <div className="flex gap-2">
                                <TextInput type="text" value={adForm.imageUrl} onChange={e => setAdForm({...adForm, imageUrl: e.target.value})} placeholder="URL ảnh" className="flex-1"/>
                                <label className="bg-blue-600 hover:bg-blue-700 p-2 rounded text-white cursor-pointer"><input type="file" className="hidden" onChange={e => handleFileUpload(e, 'ad')} /><Upload size={16} /></label>
                            </div>
                        </InputGroup>
                        <InputGroup label="Link Đích"><TextInput type="text" value={adForm.linkUrl} onChange={e => setAdForm({...adForm, linkUrl: e.target.value})} /></InputGroup>
                        <label className="flex items-center gap-2 text-slate-300">
                            <input type="checkbox" checked={adForm.isActive} onChange={e => setAdForm({...adForm, isActive: e.target.checked})}/>
                            Kích hoạt
                        </label>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button onClick={() => setAdForm({ id: '', position: 'home_middle', imageUrl: '', linkUrl: '', isActive: true, title: '' })} variant="secondary">Reset</Button>
                            <Button onClick={handleSaveAd}>Lưu Ad</Button>
                        </div>
                    </div>
                </Card>
                <div className="lg:col-span-2 space-y-4">
                    {ads.map(ad => (
                         <Card key={ad.id} className="p-3 flex gap-4 items-center">
                            <img src={ad.imageUrl} alt="" className="w-24 h-16 object-cover rounded bg-black" />
                            <div className="flex-1">
                                <div className="font-bold text-white text-sm">{ad.title || 'No Title'} <span className="text-xs font-normal text-slate-400">({ad.position})</span></div>
                                <div className="text-xs text-slate-500 truncate">{ad.linkUrl}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setAdForm(ad)} className="p-2 hover:bg-white/10 rounded text-blue-400"><Edit size={16} /></button>
                                <button onClick={() => handleDeleteAd(ad.id)} className="p-2 hover:bg-white/10 rounded text-red-400"><Trash2 size={16} /></button>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )};
    const renderUsers = () => {
        const handlePermissionChange = (permissionId: string, checked: boolean) => {
            const currentPerms = userForm.permissions || [];
            if (checked) {
                if (!currentPerms.includes(permissionId)) {
                    setUserForm(prev => ({ ...prev, permissions: [...currentPerms, permissionId] }));
                }
            } else {
                setUserForm(prev => ({ ...prev, permissions: currentPerms.filter(p => p !== permissionId) }));
            }
        };

        const currentUser = AuthService.getUser();

        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Quản lý Thành viên</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {AuthService.isAdmin() ? (
                        <Card className="lg:col-span-1 p-6 h-fit">
                            <h3 className="font-bold text-white mb-4 border-b border-white/10 pb-3">{userForm.id ? `Sửa User: ${userForm.username}` : 'Thêm User Mới'}</h3>
                            <div className="space-y-4">
                                <InputGroup label="Username"><TextInput type="text" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} /></InputGroup>
                                <InputGroup label="Password"><TextInput type="password" placeholder={userForm.id ? "Để trống nếu không đổi" : ""} value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} /></InputGroup>
                                <InputGroup label="Quyền">
                                    <SelectInput value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value as any, permissions: [] })} disabled={userForm.id === currentUser?.id}>
                                        <option value="admin">Admin</option>
                                        <option value="editor">Editor</option>
                                    </SelectInput>
                                </InputGroup>
                                
                                {userForm.role === 'editor' && (
                                    <div className="space-y-3 pt-3 border-t border-white/10">
                                        <SubHeader title="Phân quyền Tabs" icon={ShieldCheck}/>
                                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto bg-dark/50 p-3 rounded-lg border border-white/5">
                                            {ALL_PERMISSIONS.map(p => (
                                                <label key={p.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                                                    <input type="checkbox" checked={userForm.permissions?.includes(p.id)} onChange={(e) => handlePermissionChange(p.id, e.target.checked)} className="accent-primary"/>
                                                    {p.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button onClick={() => setUserForm(initialUserForm)} variant="secondary">Reset</Button>
                                    <Button onClick={handleSaveUser}>Lưu</Button>
                                </div>
                            </div>
                        </Card>
                    ) : (
                         <Card className="lg:col-span-1 p-6 h-fit">
                            <SubHeader title="Đổi Mật khẩu" icon={KeyRound} />
                            <div className="space-y-4">
                                <InputGroup label="Mật khẩu mới">
                                    <TextInput type="password" placeholder="Nhập mật khẩu mới..." value={editorPasswordForm.password} onChange={e => setEditorPasswordForm({ password: e.target.value})} />
                                </InputGroup>
                                <div className="flex justify-end gap-2 pt-2">
                                     <Button onClick={handleUpdatePassword} className="w-full">Lưu Mật khẩu</Button>
                                </div>
                            </div>
                        </Card>
                    )}
                    <div className={AuthService.isAdmin() ? "lg:col-span-2" : "lg:col-span-3"}>
                        <Card className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-white/5 uppercase text-xs"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3 text-right">#</th></tr></thead>
                                <tbody className="divide-y divide-white/5">
                                    {users.length > 0 ? users.map(u => (
                                        <tr key={u.id} className="hover:bg-white/5">
                                            <td className="p-3 font-bold text-white">{u.username}</td>
                                            <td className="p-3"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>{u.role}</span></td>
                                            <td className="p-3 text-right">
                                                {AuthService.isAdmin() && (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => setUserForm({...u, password: ''})} className="text-blue-400 hover:text-blue-300 transition-colors"><Edit size={16}/></button>
                                                        <button onClick={() => handleDeleteUser(u.id)} disabled={u.id === currentUser?.id} className="text-red-400 hover:text-red-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors" title={u.id === currentUser?.id ? "Không thể xóa tài khoản của chính bạn" : "Xóa"}><Trash2 size={16}/></button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={3} className="p-4 text-center text-slate-500 italic">{loading ? 'Đang tải...' : 'Không có người dùng nào.'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </Card>
                    </div>
                </div>
            </div>
        )
    };
    const renderReports = () => { /* ... */ return (
         <div className="space-y-6">
            <DynamicHeader title="Báo cáo lỗi">
                <Button onClick={loadData} icon={RefreshCw} variant="secondary">
                    Làm mới
                </Button>
            </DynamicHeader>
            <Card className="overflow-hidden">
                <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-white/5 uppercase text-xs">
                        <tr>
                            <th className="p-3">Truyện</th><th className="p-3">Chapter</th>
                            <th className="p-3">Nội dung</th><th className="p-3">Thời gian</th><th className="p-3 text-right">#</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.length === 0 ? (
                             <tr><td colSpan={5} className="p-4 text-center text-slate-500">Không có báo cáo nào.</td></tr>
                        ) : reports.map(r => (
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
            </Card>
        </div>
    )};
    const renderComments = () => {
        const approved = comments.filter(c => c.isApproved);
        const pending = comments.filter(c => !c.isApproved);
        return (
            <div className="space-y-8">
                <DynamicHeader title="Quản lý Bình luận">
                    <Button onClick={loadData} icon={RefreshCw} variant="secondary">Làm mới</Button>
                </DynamicHeader>

                <Card className="p-6">
                    <SubHeader title={`Chờ duyệt (${pending.length})`} icon={Clock}/>
                    <div className="space-y-4">
                        {pending.map(c => (
                            <div key={c.id} className="bg-dark border border-white/10 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start">
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-white">{c.userName} <span className="text-slate-500 font-normal">đã bình luận về</span> <span className="text-primary">{c.comicTitle || c.comicId}</span></span>
                                        <span className="text-xs text-slate-500">{new Date(c.date).toLocaleString()}</span>
                                    </div>
                                    <p className="text-sm text-slate-300">{c.content}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => handleApproveComment(c.id)} icon={Check} variant="secondary">Duyệt</Button>
                                    <Button onClick={() => handleDeleteComment(c.id)} icon={Trash2} variant="danger">Xóa</Button>
                                </div>
                            </div>
                        ))}
                        {pending.length === 0 && <div className="text-center text-slate-500 italic">Không có bình luận chờ duyệt.</div>}
                    </div>
                </Card>

                <Card className="p-6">
                    <SubHeader title={`Đã duyệt (${approved.length})`} icon={CheckCircle}/>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                         {approved.map(c => (
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
                </Card>
            </div>
        )
    };
    const renderSettings = () => {
        const availableGenres = genres.filter(g => !(themeConfig.homeLayout?.homeGenres || []).some(hg => hg.slug === g.slug));
        
        return (
            <div className="w-full space-y-6">
                <h2 className="text-2xl font-bold text-white">Cấu hình Giao diện & SEO</h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <Card className="p-6 space-y-5">
                        <SubHeader title="Giao diện & Bố cục" icon={Palette} />
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                               <InputGroup label="Màu Chủ Đạo">
                                   <div className="flex items-center gap-2">
                                       <input type="color" value={themeConfig.primaryColor} onChange={e => setThemeConfig({...themeConfig, primaryColor: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/>
                                       <span className="text-xs text-slate-500">{themeConfig.primaryColor}</span>
                                   </div>
                               </InputGroup>
                                <InputGroup label="Màu Phụ">
                                   <div className="flex items-center gap-2">
                                       <input type="color" value={themeConfig.secondaryColor} onChange={e => setThemeConfig({...themeConfig, secondaryColor: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/>
                                       <span className="text-xs text-slate-500">{themeConfig.secondaryColor}</span>
                                   </div>
                               </InputGroup>
                            </div>
                            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                                <InputGroup label="Màu Nền Header">
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={themeConfig.headerBg || '#1c1917'} onChange={e => setThemeConfig({...themeConfig, headerBg: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/>
                                        <span className="text-xs text-slate-500">{themeConfig.headerBg}</span>
                                    </div>
                                </InputGroup>
                                 <InputGroup label="Màu Chữ Header">
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={themeConfig.headerText || '#e2e8f0'} onChange={e => setThemeConfig({...themeConfig, headerText: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/>
                                        <span className="text-xs text-slate-500">{themeConfig.headerText}</span>
                                    </div>
                                </InputGroup>
                            </div>
                            <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                                <InputGroup label="Màu Nền Footer">
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={themeConfig.footerBg || '#292524'} onChange={e => setThemeConfig({...themeConfig, footerBg: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/>
                                        <span className="text-xs text-slate-500">{themeConfig.footerBg}</span>
                                    </div>
                                </InputGroup>
                                 <InputGroup label="Màu Chữ Footer">
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={themeConfig.footerText || '#94a3b8'} onChange={e => setThemeConfig({...themeConfig, footerText: e.target.value})} className="h-8 w-8 rounded cursor-pointer bg-transparent border-none p-0"/>
                                        <span className="text-xs text-slate-500">{themeConfig.footerText}</span>
                                    </div>
                                </InputGroup>
                            </div>
                            <div className="border-t border-white/5 pt-4">
                                <InputGroup label="Font chữ Website">
                                    <SelectInput value={themeConfig.fontFamily} onChange={e => setThemeConfig({...themeConfig, fontFamily: e.target.value})}>
                                        {AVAILABLE_FONTS.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
                                    </SelectInput>
                                </InputGroup>
                            </div>
                             <div className="border-t border-white/5 pt-4 space-y-3">
                                <InputGroup label="Tên Website"><TextInput type="text" value={themeConfig.siteName} onChange={e => setThemeConfig({...themeConfig, siteName: e.target.value})} /></InputGroup>
                                <InputGroup label="Logo URL">
                                    <div className="flex gap-2">
                                        <TextInput type="text" value={themeConfig.logoUrl || ''} onChange={e => setThemeConfig({...themeConfig, logoUrl: e.target.value})} className="flex-1" />
                                        <label className="cursor-pointer bg-blue-600 px-3 py-2 rounded text-white"><input type="file" className="hidden" onChange={e => handleFileUpload(e, 'theme-logo')} /><Upload size={16} /></label>
                                    </div>
                                </InputGroup>
                                 <InputGroup label="Favicon URL">
                                    <div className="flex gap-2">
                                        <TextInput type="text" value={themeConfig.favicon || ''} onChange={e => setThemeConfig({...themeConfig, favicon: e.target.value})} className="flex-1" />
                                        <label className="cursor-pointer bg-blue-600 px-3 py-2 rounded text-white"><input type="file" className="hidden" onChange={e => handleFileUpload(e, 'theme-favicon')} /><Upload size={16} /></label>
                                    </div>
                                </InputGroup>
                                {AuthService.isAdmin() && (
                                <InputGroup label="URL Đăng nhập Admin"><TextInput type="text" value={themeConfig.loginUrl || ''} onChange={e => setThemeConfig({...themeConfig, loginUrl: e.target.value})} placeholder="/login" /></InputGroup>
                                )}
                            </div>
                             <div className="border-t border-white/5 pt-4">
                                 <InputGroup label="Bố cục Website">
                                     <SelectInput value={themeConfig.siteLayout || 'classic'} onChange={e => setThemeConfig({...themeConfig, siteLayout: e.target.value as any})}>
                                         <option value="classic">Cổ điển (Mặc định)</option>
                                         <option value="modern">Hiện đại (Cinematic)</option>
                                         <option value="minimalist">Tối giản (Danh sách)</option>
                                     </SelectInput>
                                     <p className="text-[10px] text-slate-500 mt-1">Thay đổi giao diện tổng thể của trang web.</p>
                                 </InputGroup>
                             </div>
                             <div className="border-t border-white/5 pt-4 space-y-3">
                                 <label className="text-xs text-slate-400 block mb-1 font-bold">Bố cục Trang chủ</label>
                                 <div className="bg-dark/30 border border-white/5 rounded-lg p-3 space-y-2">
                                    <label className="flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer select-none">
                                        <input type="checkbox" checked={themeConfig.homeLayout?.showSlider ?? true} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...themeConfig.homeLayout || DEFAULT_THEME.homeLayout, showSlider: e.target.checked}})} className="w-4 h-4 accent-primary rounded bg-dark border-white/20"/>
                                        <span>Hiển thị Slider Banner</span>
                                    </label>
                                    <label className="flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer select-none">
                                        <input type="checkbox" checked={themeConfig.homeLayout?.showHot ?? true} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...themeConfig.homeLayout || DEFAULT_THEME.homeLayout, showHot: e.target.checked}})} className="w-4 h-4 accent-primary rounded bg-dark border-white/20"/>
                                        <span>Hiển thị Truyện Hot</span>
                                    </label>
                                    <label className="flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer select-none">
                                        <input type="checkbox" checked={themeConfig.homeLayout?.showNew ?? true} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...themeConfig.homeLayout || DEFAULT_THEME.homeLayout, showNew: e.target.checked}})} className="w-4 h-4 accent-primary rounded bg-dark border-white/20"/>
                                        <span>Hiển thị Truyện Mới</span>
                                    </label>
                                 </div>
                                 <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/5">
                                     <InputGroup label="SL Truyện Hot"><TextInput type="number" value={themeConfig.homeLayout?.hotComicsCount || 6} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...themeConfig.homeLayout || DEFAULT_THEME.homeLayout, hotComicsCount: parseInt(e.target.value) || 6}})} /></InputGroup>
                                     <InputGroup label="SL Truyện Mới"><TextInput type="number" value={themeConfig.homeLayout?.newComicsCount || 12} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...themeConfig.homeLayout || DEFAULT_THEME.homeLayout, newComicsCount: parseInt(e.target.value) || 12}})} /></InputGroup>
                                     <InputGroup label="SL/Thể loại"><TextInput type="number" value={themeConfig.homeLayout?.genreComicsCount || 6} onChange={e => setThemeConfig({...themeConfig, homeLayout: {...themeConfig.homeLayout || DEFAULT_THEME.homeLayout, genreComicsCount: parseInt(e.target.value) || 6}})} /></InputGroup>
                                 </div>
                             </div>
                             <div className="border-t border-white/5 pt-4 mt-4">
                                <label className="text-xs text-slate-400 block mb-2 font-bold">Các Thể Loại Hiển Thị Ngoài Trang Chủ</label>
                                <div className="flex gap-2 mb-3">
                                    <SelectInput ref={genreSelectRef} className="flex-1 text-sm">
                                        {availableGenres.length > 0 ? availableGenres.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>) : <option disabled>Đã thêm hết</option>}
                                    </SelectInput>
                                    <Button onClick={handleAddHomeGenre} disabled={availableGenres.length === 0}>Thêm</Button>
                                </div>
                                <div className="bg-dark/50 border border-white/10 rounded-lg p-2 space-y-1 min-h-[100px]">
                                    {(themeConfig.homeLayout?.homeGenres || []).map((g, index) => (
                                        <div key={g.slug} draggable onDragStart={() => handleDragStart(g)} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(index)} onDragEnd={() => setDraggedGenre(null)} className={`flex items-center gap-2 p-2 bg-dark rounded cursor-grab transition-opacity ${draggedGenre?.slug === g.slug ? 'opacity-50' : ''}`}>
                                            <GripVertical size={16} className="text-slate-500 flex-shrink-0"/>
                                            <span className="flex-1 text-sm text-slate-300">{g.name}</span>
                                            <button onClick={() => handleRemoveHomeGenre(g.slug)} className="text-red-500 hover:text-red-400"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                    {(!themeConfig.homeLayout?.homeGenres || themeConfig.homeLayout.homeGenres.length === 0) && (
                                        <p className="text-xs text-slate-500 text-center p-4">Chưa có thể loại nào được thêm.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                    
                    {/* Right Column */}
                    <div className="space-y-6 flex flex-col">
                        <Card className="p-6">
                            <SubHeader title="Cấu hình Menu" icon={Menu}/>
                            <div className="bg-dark/50 border border-white/10 p-3 rounded-lg mb-4">
                                <h4 className="text-sm font-bold text-slate-300 mb-2 flex justify-between">Menu Header (Trên cùng) <Button onClick={() => setThemeConfig(prev => ({...prev, headerMenu: [...(prev.headerMenu || []), {label:"New", url:"/"}]}))} icon={Plus} variant="ghost" className="text-xs !p-1">Thêm</Button></h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {(themeConfig.headerMenu || []).map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <GripVertical size={16} className="text-slate-600"/>
                                            <TextInput value={item.label} onChange={e => { const newMenu = [...(themeConfig.headerMenu||[])]; newMenu[idx].label = e.target.value; setThemeConfig(prev => ({...prev, headerMenu: newMenu})) }} className="flex-1 text-xs"/>
                                            <TextInput value={item.url} onChange={e => { const newMenu = [...(themeConfig.headerMenu||[])]; newMenu[idx].url = e.target.value; setThemeConfig(prev => ({...prev, headerMenu: newMenu})) }} className="flex-1 text-xs"/>
                                            <button onClick={() => setThemeConfig(prev => ({...prev, headerMenu: (prev.headerMenu||[]).filter((_,i) => i !== idx)}))} className="text-red-400"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-dark/50 border border-white/10 p-3 rounded-lg">
                                <h4 className="text-sm font-bold text-slate-300 mb-2 flex justify-between">Menu Footer (Chân trang) <Button onClick={() => setThemeConfig(prev => ({...prev, footerMenu: [...(prev.footerMenu || []), {label:"New", url:"/"}]}))} icon={Plus} variant="ghost" className="text-xs !p-1">Thêm</Button></h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {(themeConfig.footerMenu || []).map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <GripVertical size={16} className="text-slate-600"/>
                                            <TextInput value={item.label} onChange={e => { const newMenu = [...(themeConfig.footerMenu||[])]; newMenu[idx].label = e.target.value; setThemeConfig(prev => ({...prev, footerMenu: newMenu})) }} className="flex-1 text-xs"/>
                                            <TextInput value={item.url} onChange={e => { const newMenu = [...(themeConfig.footerMenu||[])]; newMenu[idx].url = e.target.value; setThemeConfig(prev => ({...prev, footerMenu: newMenu})) }} className="flex-1 text-xs"/>
                                            <button onClick={() => setThemeConfig(prev => ({...prev, footerMenu: (prev.footerMenu||[]).filter((_,i) => i !== idx)}))} className="text-red-400"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                        <Card className="p-6 space-y-4">
                            <SubHeader title="Cấu hình SEO" icon={Globe}/>
                            <div>
                                <h4 className="text-xs font-bold text-primary uppercase mb-2">Trang Chủ</h4>
                                <div className="space-y-2">
                                    <TextInput type="text" placeholder="Meta Title" value={themeConfig.homeMetaTitle || ''} onChange={e => setThemeConfig({...themeConfig, homeMetaTitle: e.target.value})} className="text-sm" />
                                    <textarea placeholder="Meta Description" value={themeConfig.homeMetaDescription || ''} onChange={e => setThemeConfig({...themeConfig, homeMetaDescription: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm h-16" />
                                </div>
                            </div>
                            <div className="border-t border-white/5 pt-3">
                                <h4 className="text-xs font-bold text-primary uppercase mb-2">Trang Danh Sách Thể Loại</h4>
                                <div className="space-y-2">
                                    <TextInput type="text" placeholder="Meta Title" value={themeConfig.categoriesMetaTitle || ''} onChange={e => setThemeConfig({...themeConfig, categoriesMetaTitle: e.target.value})} className="text-sm" />
                                    <textarea placeholder="Meta Description" value={themeConfig.categoriesMetaDescription || ''} onChange={e => setThemeConfig({...themeConfig, categoriesMetaDescription: e.target.value})} className="w-full bg-dark border border-white/10 rounded p-2 text-white text-sm h-16" />
                                </div>
                            </div>
                        </Card>
                        <Card className="p-6 flex-1">
                             <SimpleEditor label="Footer Content (HTML/Text)" value={themeConfig.footerContent || ''} onChange={val => setThemeConfig({...themeConfig, footerContent: val})} height="300px" />
                        </Card>
                    </div>
                </div>

                <div className="flex justify-end mt-6">
                    <Button onClick={handleSaveSettings} icon={Save} className="!py-2 !px-6">Lưu Cấu Hình</Button>
                </div>
            </div>
        )
    };
    const renderStatic = () => { /* ... */ return (
        <div className="space-y-6">
            <DynamicHeader title="Trang tĩnh">
                <div className="flex gap-2">
                    <Button onClick={() => setStaticForm({ slug: '', title: '', content: '' })} icon={Plus} variant="primary">Thêm Mới</Button>
                    <Button onClick={handleResetStatic} icon={RefreshCw} variant="secondary">Reset Mẫu</Button>
                </div>
            </DynamicHeader>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 h-fit">
                    <div className="p-4 space-y-3">
                       <h3 className="font-bold text-white">{staticForm.slug ? 'Sửa trang' : 'Thêm trang mới'}</h3>
                       <TextInput type="text" placeholder="Tiêu đề" value={staticForm.title} onChange={e => setStaticForm({...staticForm, title: e.target.value})} />
                       <TextInput type="text" placeholder="Slug (URL)" value={staticForm.slug} onChange={e => setStaticForm({...staticForm, slug: e.target.value})} />
                       <SimpleEditor label="Nội dung" value={staticForm.content} onChange={val => setStaticForm({...staticForm, content: val})} height="300px" />
                       <Button onClick={handleSaveStatic} className="w-full">Lưu Trang</Button>
                    </div>
                </Card>
                <Card className="lg:col-span-2 overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-white/5 uppercase text-xs"><tr><th className="p-3">Tiêu đề</th><th className="p-3">Slug</th><th className="p-3 text-right">Thao tác</th></tr></thead>
                        <tbody>
                            {staticPages.map(p => (
                                <tr key={p.slug} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="p-3 text-white font-medium hover:text-primary cursor-pointer" onClick={() => setStaticForm(p)}>{p.title}</td>
                                    <td className="p-3 text-slate-500 cursor-pointer" onClick={() => setStaticForm(p)}>{p.slug}</td>
                                    <td className="p-3 text-right">
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteStatic(p.slug, p.title) }} className="text-red-400 hover:text-red-300" title={`Xóa trang ${p.title}`}><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            </div>
        </div>
    )};
    const renderMedia = () => { 
        const compressibleFiles = mediaFiles.filter(f => !f.isDir && isCompressibleImage(f.name));
        return (
        <div className="space-y-6">
            <DynamicHeader title="Thư viện ảnh">
                <div className="flex items-center gap-4">
                    <div className="flex items-center p-1 bg-card rounded-lg border border-white/10">
                        <button title="Lưới lớn" onClick={() => setMediaViewMode('grid')} className={`p-1.5 rounded ${mediaViewMode === 'grid' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10'}`}><LayoutGrid size={18}/></button>
                        <button title="Lưới nhỏ" onClick={() => setMediaViewMode('tiles')} className={`p-1.5 rounded ${mediaViewMode === 'tiles' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10'}`}><LayoutDashboard size={18}/></button>
                        <button title="Danh sách" onClick={() => setMediaViewMode('list')} className={`p-1.5 rounded ${mediaViewMode === 'list' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/10'}`}><List size={18}/></button>
                    </div>
                     <Button onClick={handleCompressAll} variant="secondary" disabled={isUploadingFile || isCompressingAll || compressibleFiles.length === 0}>
                        {isCompressingAll ? (
                            <>
                                <RefreshCw size={18} className="animate-spin" />
                                {compressionProgress || 'Đang nén...'}
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                Nén tất cả
                            </>
                        )}
                    </Button>
                    <label className={`bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded font-bold cursor-pointer flex items-center gap-2 ${isCompressingAll ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input type="file" multiple accept="image/*" className="hidden" ref={mediaInputRef} onChange={handleMediaFileUpload} disabled={isUploadingFile || isCompressingAll}/>
                        {isUploadingFile && !isCompressingAll ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
                        Upload Ảnh
                    </label>
                </div>
            </DynamicHeader>
            <div className="flex items-center gap-2 text-sm text-slate-400 bg-card p-2 rounded-lg border border-white/10 flex-wrap">
                <button onClick={handleGoToRoot} className="hover:text-primary font-medium">Thư viện</button>
                {mediaPath.map((folder, index) => (
                    <React.Fragment key={index}>
                        <span className="text-slate-600">/</span>
                        <button onClick={() => handleGoUp(index)} className={`hover:text-primary ${index === mediaPath.length-1 ? 'text-white font-semibold' : ''}`}>{folder}</button>
                    </React.Fragment>
                ))}
            </div>
            
            {(mediaViewMode === 'grid' || mediaViewMode === 'tiles') && (
                <div className={`grid ${mediaViewMode === 'grid' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6' : 'grid-cols-3 md:grid-cols-5 lg:grid-cols-8'} gap-4`}>
                    {mediaFiles.slice(0, visibleMediaCount).map((f, i) => (
                        <Card key={i} className="overflow-hidden group relative">
                            {f.isDir ? (
                                <div onClick={() => handleGoToFolder(f.name)} className="aspect-square bg-yellow-900/20 flex flex-col items-center justify-center text-yellow-500 p-2 cursor-pointer hover:bg-yellow-900/30 transition-colors">
                                    <Folder size="40%" strokeWidth={1.5}/>
                                </div>
                            ) : (
                                <div className="aspect-square bg-black/50 flex items-center justify-center overflow-hidden">
                                    <img src={f.url} alt={f.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                </div>
                            )}
                            <div className="p-2 bg-dark border-t border-white/5">
                                <div className="text-xs text-white truncate font-medium mb-1" title={f.name}>{f.name}</div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-500">{f.isDir ? 'Thư mục' : formatFileSize(f.size)}</span>
                                    <div className="flex gap-1">
                                        {!f.isDir && <button onClick={() => handleCopyUrl(f.url)} className="p-1 hover:bg-white/10 rounded text-blue-400" title="Copy Link"><Copy size={12}/></button>}
                                        {!f.isDir && isCompressibleImage(f.name) && (
                                            <button onClick={() => handleCompressMedia(f)} disabled={isUploadingFile || isCompressingAll} className="p-1 hover:bg-white/10 rounded text-green-400 disabled:text-slate-600 disabled:cursor-wait" title="Nén ảnh">
                                                {fileBeingCompressed === f.name ? <RefreshCw size={12} className="animate-spin"/> : <Shrink size={12}/>}
                                            </button>
                                        )}
                                        <button onClick={() => handleDeleteMedia(f.name, f.isDir)} disabled={isCompressingAll} className="p-1 hover:bg-white/10 rounded text-red-400 disabled:text-slate-600 disabled:cursor-not-allowed" title="Xóa"><Trash2 size={12}/></button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
            
            {mediaViewMode === 'list' && (
                <Card className="overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-xs uppercase text-slate-400">
                            <tr><th className="p-3 w-16"></th><th className="p-3">Tên</th><th className="p-3">Kích thước</th><th className="p-3">Ngày tạo</th><th className="p-3 text-right">Thao tác</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                             {mediaFiles.slice(0, visibleMediaCount).map(f => (
                                <tr key={f.name} className="hover:bg-white/5 transition-colors">
                                    <td className="p-2">{f.isDir ? <div onClick={() => handleGoToFolder(f.name)} className="w-10 h-10 flex items-center justify-center cursor-pointer"><Folder size={28} className="text-yellow-500"/></div> : <img src={f.url} className="w-10 h-10 object-cover rounded bg-dark"/>}</td>
                                    <td className="p-3 text-white font-medium break-all">{f.name}</td>
                                    <td className="p-3 text-slate-400">{f.isDir ? '—' : formatFileSize(f.size)}</td>
                                    <td className="p-3 text-slate-400 text-xs">{new Date(f.created).toLocaleDateString()}</td>
                                    <td className="p-3 text-right">
                                        <div className="flex gap-2 justify-end">
                                            {!f.isDir && <button onClick={() => handleCopyUrl(f.url)} className="p-2 hover:bg-white/10 rounded text-blue-400" title="Copy Link"><Copy size={16}/></button>}
                                            {!f.isDir && isCompressibleImage(f.name) && (
                                                <button onClick={() => handleCompressMedia(f)} disabled={isUploadingFile || isCompressingAll} className="p-2 hover:bg-white/10 rounded text-green-400 disabled:text-slate-600 disabled:cursor-wait" title="Nén ảnh">
                                                    {fileBeingCompressed === f.name ? <RefreshCw size={16} className="animate-spin"/> : <Shrink size={16}/>}
                                                </button>
                                            )}
                                            <button onClick={() => handleDeleteMedia(f.name, f.isDir)} disabled={isCompressingAll} className="p-2 hover:bg-white/10 rounded text-red-400 disabled:text-slate-600 disabled:cursor-not-allowed" title="Xóa"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {visibleMediaCount < mediaFiles.length && (
                <div className="text-center mt-6">
                    <Button onClick={() => setVisibleMediaCount(prev => prev + MEDIA_PAGE_SIZE)} variant="secondary">Xem thêm</Button>
                </div>
            )}

        </div>
    )};
    const renderLeechConfigs = () => { /* ... */ return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Cấu hình Server Leech</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 p-6 h-fit">
                    <h3 className="font-bold text-white mb-4 border-b border-white/10 pb-3">{leechConfigForm.id ? 'Sửa Cấu hình' : 'Thêm Cấu hình Mới'}</h3>
                    <div className="space-y-3">
                        <InputGroup label="Tên Server (VD: Dilid, Nettruyen)"><TextInput type="text" value={leechConfigForm.name} onChange={e => setLeechConfigForm({...leechConfigForm, name: e.target.value})} className="text-sm" /></InputGroup>
                        <InputGroup label="Base URL (VD: https://dilib.vn)"><TextInput type="text" value={leechConfigForm.baseUrl} onChange={e => setLeechConfigForm({...leechConfigForm, baseUrl: e.target.value})} className="text-sm" /></InputGroup>
                        <div className="space-y-3 pt-4 border-t border-white/10">
                            <h4 className="text-sm font-bold text-primary">Cấu hình trang thông tin truyện</h4>
                            <TextInput placeholder="Selector Tên truyện (VD: h1)" value={leechConfigForm.comicTitleSelector} onChange={e => setLeechConfigForm({...leechConfigForm, comicTitleSelector: e.target.value})} className="text-sm" />
                            <TextInput placeholder="Selector Ảnh bìa (VD: img.book_avatar)" value={leechConfigForm.comicCoverSelector} onChange={e => setLeechConfigForm({...leechConfigForm, comicCoverSelector: e.target.value})} className="text-sm" />
                            <TextInput placeholder="Selector Tác giả" value={leechConfigForm.comicAuthorSelector || ''} onChange={e => setLeechConfigForm({...leechConfigForm, comicAuthorSelector: e.target.value})} className="text-sm" />
                            <TextInput placeholder="Selector Mô tả (VD: .detail-content)" value={leechConfigForm.comicDescriptionSelector} onChange={e => setLeechConfigForm({...leechConfigForm, comicDescriptionSelector: e.target.value})} className="text-sm" />
                            <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none text-sm pt-2">
                                <input type="checkbox" checked={leechConfigForm.uploadCoverImage || false} onChange={e => setLeechConfigForm({...leechConfigForm, uploadCoverImage: e.target.checked})} className="w-4 h-4 accent-primary" />
                                Upload ảnh bìa lên host
                            </label>
                        </div>
                        <div className="space-y-3 pt-4 border-t border-white/10">
                            <h4 className="text-sm font-bold text-primary">Cấu hình trang đọc truyện</h4>
                             <TextInput placeholder="Selector Link Chapter (VD: .list-chapter a)" value={leechConfigForm.chapterLinkSelector} onChange={e => setLeechConfigForm({...leechConfigForm, chapterLinkSelector: e.target.value})} className="text-sm" />
                             <TextInput placeholder="Selector Ảnh Chapter (VD: .page-chapter img)" value={leechConfigForm.chapterImageSelector} onChange={e => setLeechConfigForm({...leechConfigForm, chapterImageSelector: e.target.value})} className="text-sm" />
                             <TextInput placeholder="Thuộc tính ảnh (VD: src,data-src)" value={leechConfigForm.imageSrcAttribute} onChange={e => setLeechConfigForm({...leechConfigForm, imageSrcAttribute: e.target.value})} className="text-sm" />
                        </div>
                         <div className="flex justify-end gap-2 pt-4">
                            <Button onClick={() => setLeechConfigForm(initialLeechConfigForm)} variant="secondary">Reset</Button>
                            <Button onClick={handleSaveLeechConfig}>Lưu</Button>
                        </div>
                    </div>
                </Card>
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
    )};
    
    // --- MAIN RENDER ---

    const currentTab = [
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
    ].find(t => t.id === activeTab);

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
                    {renderMenu()}
                </nav>
                <MenuSection>
                    <MenuLink to="/" label="Về trang chủ" icon={ArrowLeft} />
                    <button onClick={AuthService.logout} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm px-2 font-medium w-full">
                        <LogOut size={16} /> Đăng xuất
                    </button>
                </MenuSection>
            </div>
            
             {/* Mobile Header and Menu */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-white/10 flex items-center justify-between px-4 z-50">
                <span className="font-bold text-white">Admin Panel</span>
                <button onClick={AuthService.logout}><LogOut size={20} className="text-red-400" /></button>
            </div>

            <div className="flex-1 overflow-y-auto h-screen relative pt-16 md:pt-0">
                <div className="p-4 md:p-8 max-w-full mx-auto">
                    {activeTab === 'dashboard' && renderDashboard()}
                    {activeTab === 'comics' && renderComics()}
                    {activeTab === 'genres' && renderGenres()}
                    {activeTab === 'ads' && renderAds()}
                    {activeTab === 'users' && renderUsers()}
                    {activeTab === 'reports' && renderReports()}
                    {activeTab === 'comments' && renderComments()}
                    {activeTab === 'settings' && renderSettings()}
                    {activeTab === 'static' && renderStatic()}
                    {activeTab === 'media' && renderMedia()}
                    {activeTab === 'leech_configs' && renderLeechConfigs()}
                </div>
            </div>
        </div>
    );
};

// FIX: Add default export for the Admin component.
export default Admin;