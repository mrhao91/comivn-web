
import { Comic, Genre, Chapter, Page, AdConfig, Comment, StaticPage, ThemeConfig, User, Report, MediaFile } from '../types';
import { StorageService } from './storage';
import { API_BASE_URL, USE_MOCK_DATA } from './config';
import { AuthService } from './auth';

// Helper for API calls
const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
    const token = AuthService.getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...((options.headers as Record<string, string>) || {}),
    };

    // Auto append timestamp to GET requests to prevent caching
    let url = `${API_BASE_URL}${endpoint}`;
    if (!options.method || options.method === 'GET') {
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}_t=${Date.now()}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });
        if (!response.ok) {
            return null;
        }
        if (response.status === 204) return true;
        return await response.json();
    } catch (error) {
        console.error("API Error:", error);
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
    deleteChapter: async (id: string, token?: string): Promise<boolean> => !!(await fetchApi(`/chapters/${id}`, { method: 'DELETE' })),
    getChapterPages: async (chapterId: string): Promise<Page[]> => {
        const res = await fetchApi(`/chapters/${chapterId}/pages`);
        return Array.isArray(res) ? res : [];
    },
    
    getAds: async (): Promise<AdConfig[]> => (await fetchApi('/ads')) || [],
    saveAd: async (ad: AdConfig, token?: string): Promise<boolean> => !!(await fetchApi('/ads', { method: 'POST', body: JSON.stringify(ad) })),
    deleteAd: async (id: string, token?: string): Promise<boolean> => !!(await fetchApi(`/ads/${id}`, { method: 'DELETE' })),
    
    getTheme: async (): Promise<ThemeConfig> => (await fetchApi('/theme')) || {} as ThemeConfig,
    saveTheme: async (theme: ThemeConfig, token?: string): Promise<boolean> => !!(await fetchApi('/theme', { method: 'POST', body: JSON.stringify(theme) })),
    
    getStaticPages: async (): Promise<StaticPage[]> => (await fetchApi('/static-pages')) || [],
    getStaticPageBySlug: async (slug: string): Promise<StaticPage | undefined> => (await fetchApi(`/static-pages/${slug}`)) || undefined,
    saveStaticPage: async (page: StaticPage, token?: string): Promise<boolean> => !!(await fetchApi('/static-pages', { method: 'POST', body: JSON.stringify(page) })),
    
    getComments: async (): Promise<Comment[]> => (await fetchApi('/comments')) || [],
    saveComment: async (comment: Comment): Promise<boolean> => !!(await fetchApi('/comments', { method: 'POST', body: JSON.stringify(comment) })),
    deleteComment: async (id: string): Promise<boolean> => !!(await fetchApi(`/comments/${id}`, { method: 'DELETE' })),

    uploadImage: async (file: File, token?: string): Promise<string> => {
        const formData = new FormData();
        formData.append('image', file);
        const tokenStr = AuthService.getToken();
        try {
            const res = await fetch(`${API_BASE_URL}/upload`, {
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

    login: async (username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
        const res = await fetchApi('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        return res || { success: false, error: 'Lỗi kết nối' };
    },
    getUsers: async (token?: string): Promise<User[]> => (await fetchApi('/users')) || [],
    saveUser: async (user: User, token?: string): Promise<boolean> => !!(await fetchApi('/users', { method: 'POST', body: JSON.stringify(user) })),
    deleteUser: async (id: string | number, token?: string): Promise<boolean> => !!(await fetchApi(`/users/${id}`, { method: 'DELETE' })),

    getReports: async (token?: string): Promise<Report[]> => (await fetchApi('/reports')) || [],
    sendReport: async (comicId: string, chapterId: string, message: string): Promise<boolean> => !!(await fetchApi('/reports', { method: 'POST', body: JSON.stringify({comicId, chapterId, message}) })),
    deleteReport: async (id: string, token?: string): Promise<boolean> => !!(await fetchApi(`/reports/${id}`, { method: 'DELETE' })),

    getMedia: async (): Promise<MediaFile[]> => (await fetchApi('/media')) || [],
    deleteMedia: async (name: string): Promise<boolean> => !!(await fetchApi(`/media/${name}`, { method: 'DELETE' })),

    incrementView: async (id: string): Promise<boolean> => {
        await fetchApi(`/comics/${id}/view`, { method: 'POST' });
        return true; 
    },

    // LEECH METHODS (Updated for Robust Error Handling)
    leechScan: async (url: string): Promise<{success: boolean, data?: any, error?: string}> => {
        const token = AuthService.getToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };
        try {
            const res = await fetch(`${API_BASE_URL}/leech/scan`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ url })
            });
            
            // QUAN TRỌNG: Kiểm tra xem server có trả về JSON không
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await res.text();
                // Nếu trả về HTML (thường là trang index.html của Vite khi 404), nghĩa là API Backend chưa chạy
                if (text.includes("<!DOCTYPE html>")) {
                    return { success: false, error: "LỖI KẾT NỐI: Server chưa có API Leech. Hãy Restart lại file server.js!" };
                }
                return { success: false, error: `Lỗi Server (${res.status}): ${res.statusText}` };
            }

            const data = await res.json();
            if (!res.ok) return { success: false, error: data.error || res.statusText };
            return data;
        } catch(e: any) {
            return { success: false, error: "Lỗi mạng hoặc Server không phản hồi: " + e.message };
        }
    },
    leechChapterContent: async (url: string): Promise<{success: boolean, images?: string[], error?: string}> => {
        const token = AuthService.getToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        };
        try {
            const res = await fetch(`${API_BASE_URL}/leech/chapter`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ url })
            });

            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                return { success: false, error: "LỖI: API không trả về JSON (Có thể bị chặn hoặc lỗi Server)" };
            }

            const data = await res.json();
            if (!res.ok) return { success: false, error: data.error || res.statusText };
            return data;
        } catch(e: any) {
            return { success: false, error: "Lỗi mạng: " + e.message };
        }
    }
};

const MockProvider = {
    getComics: async () => new Promise<Comic[]>(resolve => setTimeout(() => resolve(StorageService.getComics()), 300)),
    getComicById: async (id: string) => new Promise<Comic | undefined>(resolve => setTimeout(() => resolve(StorageService.getComicById(id)), 200)),
    saveComic: async (comic: Comic, token?: string) => { StorageService.saveComic(comic); return true; },
    deleteComic: async (id: string, token?: string) => { StorageService.deleteComic(id); return true; },
    getGenres: async () => new Promise<Genre[]>(resolve => setTimeout(() => resolve(StorageService.getGenres()), 200)),
    saveGenre: async (genre: Genre, token?: string) => { StorageService.saveGenre(genre); return true; },
    deleteGenre: async (id: string, token?: string) => { StorageService.deleteGenre(id); return true; },
    saveChapter: async (chapter: Chapter, pages: Page[], token?: string) => { StorageService.saveChapter(chapter); StorageService.saveChapterPages(chapter.id, pages); return true; },
    deleteChapter: async (id: string, token?: string) => { const comics = StorageService.getComics(); const comic = comics.find(c => c.chapters.some(ch => ch.id === id)); if (comic) StorageService.deleteChapter(id, comic.id); return true; },
    getChapterPages: async (chapterId: string) => new Promise<Page[]>(resolve => setTimeout(() => resolve(StorageService.getChapterPages(chapterId)), 200)),
    getAds: async () => new Promise<AdConfig[]>(resolve => setTimeout(() => resolve(StorageService.getAds()), 200)),
    saveAd: async (ad: AdConfig, token?: string) => { StorageService.saveAd(ad); return true; },
    deleteAd: async (id: string, token?: string) => { StorageService.deleteAd(id); return true; },
    uploadImage: async (file: File) => new Promise<string>((resolve) => setTimeout(() => { const url = URL.createObjectURL(file); resolve(url); }, 500)),
    getComments: async () => new Promise<Comment[]>(resolve => setTimeout(() => resolve(StorageService.getComments()), 200)),
    saveComment: async (comment: Comment) => { StorageService.saveComment(comment); return true; },
    deleteComment: async (id: string) => { StorageService.deleteComment(id); return true; },
    getStaticPages: async () => new Promise<StaticPage[]>(resolve => setTimeout(() => resolve(StorageService.getStaticPages()), 200)),
    getStaticPageBySlug: async (slug: string) => new Promise<StaticPage | undefined>(resolve => setTimeout(() => resolve(StorageService.getStaticPageBySlug(slug)), 200)),
    saveStaticPage: async (page: StaticPage) => { StorageService.saveStaticPage(page); return true; },
    getTheme: async () => new Promise<ThemeConfig>(resolve => setTimeout(() => resolve(StorageService.getTheme()), 100)),
    saveTheme: async (theme: ThemeConfig, token?: string) => { StorageService.saveTheme(theme); return true; },
    login: async (u: string, p: string) => new Promise<{success: boolean, user?: User, error?: string}>(resolve => {
        setTimeout(() => {
            const users = StorageService.getUsers();
            const user = users.find((x: User) => x.username === u && x.password === p);
            if (user) {
                const { password, ...userWithoutPass } = user;
                resolve({ success: true, user: userWithoutPass as User });
            } else {
                resolve({ success: false, error: 'Sai tài khoản hoặc mật khẩu (Mock)' });
            }
        }, 500);
    }),
    getUsers: async (token?: string) => new Promise<User[]>(resolve => setTimeout(() => { 
        const users = StorageService.getUsers(); 
        resolve(users.map((u: User) => ({...u, password: ''}))); 
    }, 200)),
    saveUser: async (user: User, token?: string) => { StorageService.saveUser(user); return true; },
    deleteUser: async (id: string | number, token?: string) => { StorageService.deleteUser(id); return true; },
    
    sendReport: async (comicId: string, chapterId: string, message: string) => {
        const report: Report = {
            id: `rpt-${Date.now()}`,
            comicId,
            chapterId,
            message,
            created_at: new Date().toISOString()
        };
        StorageService.saveReport(report);
        return true; 
    },
    getReports: async (token?: string) => new Promise<Report[]>(resolve => setTimeout(() => resolve(StorageService.getReports()), 200)),
    deleteReport: async (id: string, token?: string) => { StorageService.deleteReport(id); return true; },
    
    getMedia: async () => [], 
    deleteMedia: async () => true,

    incrementView: async (id: string) => { 
        const comics = StorageService.getComics();
        const comic = comics.find(c => c.id === id);
        if (comic) {
            comic.views = (comic.views || 0) + 1;
            StorageService.saveComic(comic);
        }
        return true; 
    },

    // MOCK LEECH (Does nothing)
    leechScan: async (url: string): Promise<{success: boolean, data?: any, error?: string}> => ({ success: false, error: 'Mock mode: cannot leech' }),
    leechChapterContent: async (url: string): Promise<{success: boolean, images?: string[], error?: string}> => ({ success: false, error: 'Mock mode: cannot leech' })
};

export const DataProvider = USE_MOCK_DATA ? MockProvider : ApiService;