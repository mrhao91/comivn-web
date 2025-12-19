import { Comic, Genre, Chapter, Page, AdConfig, Comment, StaticPage, ThemeConfig, User, Report, MediaFile, Analytics, LeechConfig, SystemStats } from '../types';
import { StorageService } from './storage';
import { API_BASE_URL, USE_MOCK_DATA } from './config';

const AUTH_KEY = 'comivn_auth_token';

// Helper for API calls
// Added options.suppressError to hide console.error when needed
const fetchApi = async (endpoint: string, options: RequestInit & { suppressError?: boolean } = {}) => {
    const token = localStorage.getItem(AUTH_KEY);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...((options.headers as Record<string, string>) || {}),
    };

    let url = `${API_BASE_URL}${endpoint}`;
    if (!options.method || options.method === 'GET') {
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}_t=${Date.now()}`;
    }

    try {
        const response = await fetch(url, { ...options, headers });
        
        if (!response.ok) {
            if (!options.suppressError) {
                console.error(`API Error ${response.status} at ${endpoint}`);
            }
            return null;
        }
        
        if (response.status === 204) return true;
        return await response.json();
    } catch (error) {
        if (!options.suppressError) {
            console.error("API Network Error:", error);
        }
        return null;
    }
};

const ApiService = {
    getComics: async (): Promise<Comic[]> => (await fetchApi('/comics')) || [],
    getComicById: async (id: string): Promise<Comic | undefined> => (await fetchApi(`/comics/${id}`)) || undefined,
    saveComic: async (comic: Comic, token?: string): Promise<boolean> => !!(await fetchApi('/comics', { method: 'POST', body: JSON.stringify(comic) })),
    deleteComic: async (id: string, token?: string): Promise<boolean> => !!(await fetchApi(`/comics/${id}`, { method: 'DELETE' })),
    
    getGenres: async (): Promise<Genre[]> => (await fetchApi('/genres')) || [],
    saveGenre: async (genre: Genre, token?: string): Promise<boolean> => !!(await fetchApi('/genres', { method: 'POST', body: JSON.stringify(genre) })),
    deleteGenre: async (id: string, token?: string): Promise<boolean> => !!(await fetchApi(`/genres/${id}`, { method: 'DELETE' })),
    
    saveChapter: async (chapter: Chapter, pages: Page[], token?: string): Promise<boolean> => !!(await fetchApi('/chapters', { method: 'POST', body: JSON.stringify({ ...chapter, pages }) })),
    deleteChapter: async (id: string, comicId: string, token?: string): Promise<boolean> => !!(await fetchApi(`/chapters/${id}`, { method: 'DELETE' })),
    getChapterPages: async (chapterId: string): Promise<Page[]> => {
        const res = await fetchApi(`/chapters/${chapterId}/pages`);
        return Array.isArray(res) ? res : [];
    },
    
    getAds: async (): Promise<AdConfig[]> => (await fetchApi('/ads')) || [],
    saveAd: async (ad: AdConfig, token?: string): Promise<boolean> => !!(await fetchApi('/ads', { method: 'POST', body: JSON.stringify(ad) })),
    deleteAd: async (id: string, token?: string): Promise<boolean> => !!(await fetchApi(`/ads/${id}`, { method: 'DELETE' })),
    
    // Suppress error for theme to gracefully fallback to default if DB not ready
    getTheme: async (): Promise<ThemeConfig> => (await fetchApi('/theme', { suppressError: true } as any)) || {} as ThemeConfig,
    saveTheme: async (theme: ThemeConfig, token?: string): Promise<boolean> => !!(await fetchApi('/theme', { method: 'POST', body: JSON.stringify(theme) })),
    
    getStaticPages: async (): Promise<StaticPage[]> => (await fetchApi('/static-pages')) || [],
    getStaticPageBySlug: async (slug: string): Promise<StaticPage | undefined> => (await fetchApi(`/static-pages/${slug}`)) || undefined,
    saveStaticPage: async (page: StaticPage, token?: string): Promise<boolean> => !!(await fetchApi('/static-pages', { method: 'POST', body: JSON.stringify(page) })),
    deleteStaticPage: async (slug: string): Promise<boolean> => !!(await fetchApi(`/static-pages/${slug}`, { method: 'DELETE' })),

    getComments: async (): Promise<Comment[]> => (await fetchApi('/comments')) || [],
    saveComment: async (comment: Comment): Promise<boolean> => !!(await fetchApi('/comments', { method: 'POST', body: JSON.stringify(comment) })),
    approveComment: async (id: string): Promise<boolean> => !!(await fetchApi(`/comments/${id}/approve`, { method: 'PUT' })),
    deleteComment: async (id: string): Promise<boolean> => !!(await fetchApi(`/comments/${id}`, { method: 'DELETE' })),

    uploadImage: async (file: File, folder?: string, chapterNumber?: number, index?: number): Promise<string> => {
        const formData = new FormData();
        formData.append('image', file);
        const tokenStr = localStorage.getItem(AUTH_KEY);
    
        const params = new URLSearchParams();
        if (folder) params.set('folder', folder);
        if (chapterNumber !== undefined) params.set('chapterNumber', String(chapterNumber));
        if (index !== undefined) params.set('index', String(index));
        const queryString = params.toString();
    
        try {
            const res = await fetch(`${API_BASE_URL}/upload${queryString ? `?${queryString}` : ''}`, {
                method: 'POST',
                headers: tokenStr ? { 'Authorization': `Bearer ${tokenStr}` } : {},
                body: formData
            });
            const data = await res.json();
            return data.url || '';
        } catch(e) {
            console.error(e);
            return '';
        }
    },

    uploadImageFromUrl: async (imageUrl: string, folder?: string, chapterNumber?: number, index?: number): Promise<string> => {
        const res = await fetchApi('/upload-url', {
            method: 'POST',
            body: JSON.stringify({ url: imageUrl, folder, chapterNumber, index })
        });
        return res?.success ? res.url : '';
    },

    login: async (username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
        const res = await fetchApi('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        return res || { success: false, error: 'Lỗi kết nối tới Server' };
    },
    getUsers: async (token?: string): Promise<User[]> => (await fetchApi('/users')) || [],
    saveUser: async (user: User, token?: string): Promise<boolean> => !!(await fetchApi('/users', { method: 'POST', body: JSON.stringify(user) })),
    deleteUser: async (id: string | number, token?: string): Promise<boolean> => !!(await fetchApi(`/users/${id}`, { method: 'DELETE' })),

    getReports: async (token?: string): Promise<Report[]> => (await fetchApi('/reports')) || [],
    sendReport: async (comicId: string, chapterId: string, message: string): Promise<boolean> => !!(await fetchApi('/reports', { method: 'POST', body: JSON.stringify({comicId, chapterId, message}) })),
    deleteReport: async (id: string, token?: string): Promise<boolean> => !!(await fetchApi(`/reports/${id}`, { method: 'DELETE' })),

    getMedia: async (path: string = ''): Promise<MediaFile[]> => (await fetchApi(`/media/${path}`)) || [],
    deleteMedia: async (filePath: string): Promise<boolean> => !!(await fetchApi(`/media`, { 
        method: 'DELETE',
        body: JSON.stringify({ filePath })
    })),

    incrementView: async (id: string): Promise<boolean> => {
        await fetchApi(`/comics/${id}/view`, { method: 'POST' });
        return true; 
    },

    getAnalytics: async (): Promise<Analytics> => {
        const res = await fetchApi('/analytics');
        return res || { totalViews: 0, todayViews: 0, monthViews: 0 };
    },
    
    getSystemStats: async (): Promise<SystemStats> => {
        const res = await fetchApi('/system-stats');
        return res || { imageStorageUsed: 0, databaseRows: 0, nodeVersion: 'N/A', reactVersion: 'N/A', viteVersion: 'N/A', platform: 'N/A', arch: 'N/A' };
    },

    getProxiedHtml: async (url: string): Promise<string> => {
        const res = await fetchApi('/leech', { method: 'POST', body: JSON.stringify({ url }) });
        
        if (!res) {
            throw new Error(`Mất kết nối tới Server Backend (${window.location.origin}). Server có thể đang khởi động lại hoặc bị crash.`);
        }

        if (res.success) {
            return res.html;
        } else {
            throw new Error(res.error || "Lỗi không xác định từ Server.");
        }
    },
    
    // NEW: Leech Config API
    getLeechConfigs: async (): Promise<LeechConfig[]> => (await fetchApi('/leech-configs')) || [],
    saveLeechConfig: async (config: LeechConfig): Promise<boolean> => !!(await fetchApi('/leech-configs', { method: 'POST', body: JSON.stringify(config) })),
    deleteLeechConfig: async (id: string): Promise<boolean> => !!(await fetchApi(`/leech-configs/${id}`, { method: 'DELETE' })),
};

export const DataProvider = USE_MOCK_DATA ? ApiService : ApiService;