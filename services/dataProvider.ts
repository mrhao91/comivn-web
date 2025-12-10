
import { Comic, Page, Genre, Chapter, AdConfig, Comment, StaticPage, ThemeConfig } from '../types';
import { StorageService } from './storage';
import { USE_MOCK_DATA, API_BASE_URL } from './config';

// === REAL API IMPLEMENTATION ===
const ApiService = {
    getComics: async (): Promise<Comic[]> => {
        try {
            const res = await fetch(`${API_BASE_URL}/comics`);
            if (!res.ok) throw new Error('Network response was not ok');
            return await res.json();
        } catch (error) {
            console.error("API Error:", error);
            return [];
        }
    },

    getComicById: async (id: string): Promise<Comic | undefined> => {
        try {
            const res = await fetch(`${API_BASE_URL}/comics/${id}`);
            if (!res.ok) return undefined;
            return await res.json();
        } catch (error) {
            console.error("API Error:", error);
            return undefined;
        }
    },
    
    saveComic: async (comic: Comic, token: string): Promise<boolean> => {
        try {
            const res = await fetch(`${API_BASE_URL}/comics`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(comic)
            });
            return res.ok;
        } catch (error) {
            console.error("API Save Error:", error);
            return false;
        }
    },

    deleteComic: async (id: string, token: string): Promise<boolean> => {
         try {
            const res = await fetch(`${API_BASE_URL}/comics/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.ok;
        } catch (error) {
             return false;
        }
    },

    // Chapter API
    saveChapter: async (chapter: Chapter, pages: Page[], token: string): Promise<boolean> => {
        try {
            // Save metadata
            const res = await fetch(`${API_BASE_URL}/chapters`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ...chapter, pages })
            });
            return res.ok;
        } catch (error) {
             return false;
        }
    },

    deleteChapter: async (id: string, token: string): Promise<boolean> => {
        try {
            const res = await fetch(`${API_BASE_URL}/chapters/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.ok;
        } catch (error) {
             return false;
        }
    },

    getChapterPages: async (chapterId: string): Promise<Page[]> => {
        try {
             const res = await fetch(`${API_BASE_URL}/chapters/${chapterId}/pages`);
             if (!res.ok) return [];
             return await res.json();
        } catch(e) {
            return [];
        }
    },

    // File Upload
    uploadImage: async (file: File): Promise<string> => {
        try {
            const formData = new FormData();
            formData.append('image', file);
            const res = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            return data.url;
        } catch (error) {
            console.error("Upload failed", error);
            return "";
        }
    },

    // Genre API
    getGenres: async (): Promise<Genre[]> => {
        try {
            const res = await fetch(`${API_BASE_URL}/genres`);
            if (!res.ok) throw new Error('Network response was not ok');
            return await res.json();
        } catch (error) {
            return [];
        }
    },
    saveGenre: async (genre: Genre, token: string): Promise<boolean> => {
         try {
            const res = await fetch(`${API_BASE_URL}/genres`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(genre)
            });
            return res.ok;
        } catch (error) {
            return false;
        }
    },
    deleteGenre: async (id: string, token: string): Promise<boolean> => {
        try {
            const res = await fetch(`${API_BASE_URL}/genres/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.ok;
        } catch (error) {
             return false;
        }
    },

    // Ads API
    getAds: async (): Promise<AdConfig[]> => {
        try {
            const res = await fetch(`${API_BASE_URL}/ads`);
            if (!res.ok) throw new Error('Network response was not ok');
            return await res.json();
        } catch (error) {
            return [];
        }
    },
    saveAd: async (ad: AdConfig, token: string): Promise<boolean> => {
         try {
            const res = await fetch(`${API_BASE_URL}/ads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(ad)
            });
            return res.ok;
        } catch (error) {
            return false;
        }
    },
    deleteAd: async (id: string, token: string): Promise<boolean> => {
        try {
            const res = await fetch(`${API_BASE_URL}/ads/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.ok;
        } catch (error) {
             return false;
        }
    },

    // Comments API 
    getComments: async (): Promise<Comment[]> => { return [] }, 
    saveComment: async (comment: Comment): Promise<boolean> => { return false },
    deleteComment: async (id: string): Promise<boolean> => { return false },
    
    // Static Pages API
    getStaticPages: async (): Promise<StaticPage[]> => { return [] },
    saveStaticPage: async (page: StaticPage): Promise<boolean> => { return false },
    getStaticPageBySlug: async (slug: string): Promise<StaticPage | undefined> => { return undefined },

    // Theme API
    getTheme: async (): Promise<ThemeConfig> => { 
        // Mock default for now in API mode
        return {
            primaryColor: '#d97706',
            secondaryColor: '#78350f',
            backgroundColor: '#1c1917',
            cardColor: '#292524',
            fontFamily: 'sans',
            homeLayout: { showSlider: true, showHot: true, showNew: true }
        } 
    },
    saveTheme: async (theme: ThemeConfig, token: string): Promise<boolean> => { return false }
};

// === MOCK IMPLEMENTATION ===
const MockProvider = {
    getComics: async () => {
        return new Promise<Comic[]>(resolve => {
            setTimeout(() => resolve(StorageService.getComics()), 300);
        });
    },
    getComicById: async (id: string) => {
        return new Promise<Comic | undefined>(resolve => {
            setTimeout(() => resolve(StorageService.getComicById(id)), 200);
        });
    },
    saveComic: async (comic: Comic) => {
        StorageService.saveComic(comic);
        return true;
    },
    deleteComic: async (id: string) => {
        StorageService.deleteComic(id);
        return true;
    },
    getGenres: async () => {
        return new Promise<Genre[]>(resolve => {
            setTimeout(() => resolve(StorageService.getGenres()), 200);
        });
    },
    saveGenre: async (genre: Genre) => {
        StorageService.saveGenre(genre);
        return true;
    },
    deleteGenre: async (id: string) => {
        StorageService.deleteGenre(id);
        return true;
    },
    
    // Mock Chapter Logic
    saveChapter: async (chapter: Chapter, pages: Page[]) => {
        StorageService.saveChapter(chapter);
        StorageService.saveChapterPages(chapter.id, pages);
        return true;
    },
    deleteChapter: async (id: string) => {
        const comics = StorageService.getComics();
        const comic = comics.find(c => c.chapters.some(ch => ch.id === id));
        if (comic) {
            StorageService.deleteChapter(id, comic.id);
        }
        return true;
    },
    getChapterPages: async (chapterId: string) => {
        return new Promise<Page[]>(resolve => {
             setTimeout(() => resolve(StorageService.getChapterPages(chapterId)), 200);
        });
    },

    // Mock Ads
    getAds: async () => {
        return new Promise<AdConfig[]>(resolve => {
            setTimeout(() => resolve(StorageService.getAds()), 200);
        });
    },
    saveAd: async (ad: AdConfig) => {
        StorageService.saveAd(ad);
        return true;
    },
    deleteAd: async (id: string) => {
        StorageService.deleteAd(id);
        return true;
    },

    // Mock Upload
    uploadImage: async (file: File) => {
        return new Promise<string>((resolve) => {
            setTimeout(() => {
                const url = URL.createObjectURL(file);
                resolve(url);
            }, 500);
        });
    },

    // Mock Comments
    getComments: async () => {
        return new Promise<Comment[]>(resolve => {
            setTimeout(() => resolve(StorageService.getComments()), 200);
        });
    },
    saveComment: async (comment: Comment) => {
        StorageService.saveComment(comment);
        return true;
    },
    deleteComment: async (id: string) => {
        StorageService.deleteComment(id);
        return true;
    },

    // Mock Static Pages
    getStaticPages: async () => {
         return new Promise<StaticPage[]>(resolve => {
            setTimeout(() => resolve(StorageService.getStaticPages()), 200);
        });
    },
    getStaticPageBySlug: async (slug: string) => {
        return new Promise<StaticPage | undefined>(resolve => {
             setTimeout(() => resolve(StorageService.getStaticPageBySlug(slug)), 200);
        });
    },
    saveStaticPage: async (page: StaticPage) => {
        StorageService.saveStaticPage(page);
        return true;
    },

    // Mock Theme
    getTheme: async () => {
        return new Promise<ThemeConfig>(resolve => {
            setTimeout(() => resolve(StorageService.getTheme()), 100);
        });
    },
    saveTheme: async (theme: ThemeConfig) => {
        StorageService.saveTheme(theme);
        return true;
    }
};

// === EXPORTED PROVIDER ===
export const DataProvider = {
    getComics: USE_MOCK_DATA ? MockProvider.getComics : ApiService.getComics,
    getComicById: USE_MOCK_DATA ? MockProvider.getComicById : ApiService.getComicById,
    saveComic: USE_MOCK_DATA ? MockProvider.saveComic : ApiService.saveComic,
    deleteComic: USE_MOCK_DATA ? MockProvider.deleteComic : ApiService.deleteComic,
    
    getGenres: USE_MOCK_DATA ? MockProvider.getGenres : ApiService.getGenres,
    saveGenre: USE_MOCK_DATA ? MockProvider.saveGenre : ApiService.saveGenre,
    deleteGenre: USE_MOCK_DATA ? MockProvider.deleteGenre : ApiService.deleteGenre,

    saveChapter: USE_MOCK_DATA ? MockProvider.saveChapter : ApiService.saveChapter,
    deleteChapter: USE_MOCK_DATA ? MockProvider.deleteChapter : ApiService.deleteChapter,
    getChapterPages: USE_MOCK_DATA ? MockProvider.getChapterPages : ApiService.getChapterPages,
    
    getAds: USE_MOCK_DATA ? MockProvider.getAds : ApiService.getAds,
    saveAd: USE_MOCK_DATA ? MockProvider.saveAd : ApiService.saveAd,
    deleteAd: USE_MOCK_DATA ? MockProvider.deleteAd : ApiService.deleteAd,

    uploadImage: USE_MOCK_DATA ? MockProvider.uploadImage : ApiService.uploadImage,

    getComments: USE_MOCK_DATA ? MockProvider.getComments : ApiService.getComments,
    saveComment: USE_MOCK_DATA ? MockProvider.saveComment : ApiService.saveComment,
    deleteComment: USE_MOCK_DATA ? MockProvider.deleteComment : ApiService.deleteComment,

    getStaticPages: USE_MOCK_DATA ? MockProvider.getStaticPages : ApiService.getStaticPages,
    getStaticPageBySlug: USE_MOCK_DATA ? MockProvider.getStaticPageBySlug : ApiService.getStaticPageBySlug,
    saveStaticPage: USE_MOCK_DATA ? MockProvider.saveStaticPage : ApiService.saveStaticPage,

    getTheme: USE_MOCK_DATA ? MockProvider.getTheme : ApiService.getTheme,
    saveTheme: USE_MOCK_DATA ? MockProvider.saveTheme : ApiService.saveTheme,
};
