
import { Comic, Page, Genre, Chapter, AdConfig, Comment, StaticPage, ThemeConfig, User } from '../types';
import { StorageService } from './storage';
import { USE_MOCK_DATA, API_BASE_URL } from './config';

// Helper to handle fetch errors safely
const fetchApi = async (url: string, options?: RequestInit) => {
    try {
        const fullUrl = `${API_BASE_URL}${url}`;
        const res = await fetch(fullUrl, options);
        
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") === -1) {
            console.warn(`API Non-JSON response from ${url}:`, await res.text());
            return null; // Trả về null nếu server lỗi (500, 503) trả về HTML
        }

        if (!res.ok) {
            console.warn(`API Error ${res.status} from ${url}`);
            return null;
        }

        return await res.json();
    } catch (error) {
        console.error(`Network Error for ${url}:`, error);
        return null;
    }
};

// Default theme to fallback if API fails
const DEFAULT_THEME_CONFIG: ThemeConfig = {
    primaryColor: '#d97706',
    secondaryColor: '#78350f',
    backgroundColor: '#1c1917',
    cardColor: '#292524',
    fontFamily: 'sans',
    homeLayout: { showSlider: true, showHot: true, showNew: true },
    siteName: 'ComiVN'
};

// === REAL API IMPLEMENTATION ===
const ApiService = {
    login: async (u: string, p: string): Promise<{success: boolean, user?: User, error?: string}> => {
        const result = await fetchApi('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        if (result && result.success) return result;
        return { success: false, error: result?.error || 'Đăng nhập thất bại' };
    },

    getUsers: async (token?: string): Promise<User[]> => {
        const res = await fetchApi('/users', { headers: { 'Authorization': `Bearer ${token}` } });
        return Array.isArray(res) ? res : [];
    },

    saveUser: async (user: User, token?: string): Promise<boolean> => {
        const res = await fetchApi('/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(user)
        });
        return !!res;
    },

    deleteUser: async (id: string | number, token?: string): Promise<boolean> => {
        const res = await fetchApi(`/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return !!res;
    },

    getComics: async (): Promise<Comic[]> => {
        const res = await fetchApi('/comics');
        return Array.isArray(res) ? res : [];
    },

    getComicById: async (id: string): Promise<Comic | undefined> => {
        const res = await fetchApi(`/comics/${id}`);
        if (res && (res.id || res.slug)) return res;
        return undefined;
    },
    
    saveComic: async (comic: Comic, token?: string): Promise<boolean> => {
        const res = await fetchApi('/comics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(comic)
        });
        return !!res;
    },

    deleteComic: async (id: string, token?: string): Promise<boolean> => {
        const res = await fetchApi(`/comics/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return !!res;
    },

    saveChapter: async (chapter: Chapter, pages: Page[], token?: string): Promise<boolean> => {
        const res = await fetchApi('/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ ...chapter, pages })
        });
        return !!res;
    },

    deleteChapter: async (id: string, token?: string): Promise<boolean> => {
        const res = await fetchApi(`/chapters/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return !!res;
    },

    getChapterPages: async (chapterId: string): Promise<Page[]> => {
        const res = await fetchApi(`/chapters/${chapterId}/pages`);
        return Array.isArray(res) ? res : [];
    },

    uploadImage: async (file: File): Promise<string> => {
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const res = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer fake-jwt-token-xyz` },
                body: formData
            });

            if (!res.ok) {
                const text = await res.text();
                try {
                    const jsonErr = JSON.parse(text);
                    throw new Error(jsonErr.error || text);
                } catch (e) {
                    throw new Error(`Lỗi Server (${res.status})`);
                }
            }
            
            const data = await res.json();
            return data.url;
        } catch (error: any) { 
            console.error("Upload exception:", error);
            throw error; 
        }
    },

    getGenres: async (): Promise<Genre[]> => {
        const res = await fetchApi('/genres');
        return Array.isArray(res) ? res : [];
    },
    saveGenre: async (genre: Genre, token?: string): Promise<boolean> => {
        const res = await fetchApi('/genres', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(genre)
        });
        return !!res;
    },
    deleteGenre: async (id: string, token?: string): Promise<boolean> => {
        const res = await fetchApi(`/genres/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return !!res;
    },

    getAds: async (): Promise<AdConfig[]> => {
        const res = await fetchApi('/ads');
        return Array.isArray(res) ? res : [];
    },
    saveAd: async (ad: AdConfig, token?: string): Promise<boolean> => {
        const res = await fetchApi('/ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(ad)
        });
        return !!res;
    },
    deleteAd: async (id: string, token?: string): Promise<boolean> => {
        const res = await fetchApi(`/ads/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return !!res;
    },

    getComments: async (): Promise<Comment[]> => { 
        const res = await fetchApi('/comments');
        return Array.isArray(res) ? res : [];
    }, 
    saveComment: async (comment: Comment): Promise<boolean> => { return false },
    deleteComment: async (id: string): Promise<boolean> => { return false },
    
    getStaticPages: async (): Promise<StaticPage[]> => {
        const res = await fetchApi('/static-pages');
        return Array.isArray(res) ? res : [];
    },
    saveStaticPage: async (page: StaticPage): Promise<boolean> => {
        const res = await fetchApi('/static-pages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer fake-jwt-token-xyz` },
            body: JSON.stringify(page)
        });
        return !!res;
    },
    getStaticPageBySlug: async (slug: string): Promise<StaticPage | undefined> => {
        const res = await fetchApi(`/static-pages/${slug}`);
        if (res && res.slug) return res;
        return undefined;
    },

    // QUAN TRỌNG: Xử lý lỗi null khi gọi theme để tránh trắng trang
    getTheme: async (): Promise<ThemeConfig> => { 
        const res = await fetchApi('/theme');
        if (res && Object.keys(res).length > 0) {
            return res;
        }
        return DEFAULT_THEME_CONFIG;
    },
    saveTheme: async (theme: ThemeConfig, token?: string): Promise<boolean> => {
        const res = await fetchApi('/theme', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(theme)
        });
        return !!res;
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
            // Explicitly type u parameter
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
        // Explicitly type u parameter
        resolve(users.map((u: User) => ({...u, password: ''}))); 
    }, 200)),
    saveUser: async (user: User, token?: string) => { StorageService.saveUser(user); return true; },
    deleteUser: async (id: string | number, token?: string) => { StorageService.deleteUser(id); return true; }
};

export const DataProvider = USE_MOCK_DATA ? MockProvider : ApiService;
