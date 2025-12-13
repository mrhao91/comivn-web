
import { Comic, Chapter, Genre, Page, AdConfig, Comment, StaticPage, ThemeConfig, User, Report } from '../types';
import { 
    SEED_COMICS, 
    SEED_GENRES, 
    SEED_ADS, 
    SEED_COMMENTS, 
    SEED_STATIC_PAGES, 
    SEED_USERS, 
    DEFAULT_THEME 
} from './seedData';

const STORAGE_KEY = 'comivn_data';
const GENRE_KEY = 'comivn_genres';
const PAGES_KEY = 'comivn_pages';
const ADS_KEY = 'comivn_ads';
const COMMENTS_KEY = 'comivn_comments';
const STATIC_PAGES_KEY = 'comivn_static_pages';
const THEME_KEY = 'comivn_theme';
const USERS_KEY = 'comivn_users';
const REPORTS_KEY = 'comivn_reports';

// Define the interface to help TypeScript inference
export interface IStorageService {
    getComics: () => Comic[];
    saveComic: (comic: Comic) => void;
    deleteComic: (id: string) => void;
    getComicById: (id: string) => Comic | undefined;
    saveChapter: (chapter: Chapter) => void;
    deleteChapter: (chapterId: string, comicId: string) => void;
    getChapterPages: (chapterId: string) => Page[];
    saveChapterPages: (chapterId: string, pages: Page[]) => void;
    getGenres: () => Genre[];
    saveGenre: (genre: Genre) => void;
    deleteGenre: (id: string) => void;
    getAds: () => AdConfig[];
    saveAd: (ad: AdConfig) => void;
    deleteAd: (id: string) => void;
    getComments: () => Comment[];
    saveComment: (comment: Comment) => void;
    deleteComment: (id: string) => void;
    getStaticPages: () => StaticPage[];
    getStaticPageBySlug: (slug: string) => StaticPage | undefined;
    saveStaticPage: (page: StaticPage) => void;
    getTheme: () => ThemeConfig;
    saveTheme: (theme: ThemeConfig) => void;
    getUsers: () => User[];
    saveUser: (user: User) => void;
    deleteUser: (id: string | number) => void;
    getReports: () => Report[];
    saveReport: (report: Report) => void;
    deleteReport: (id: string) => void;
}

export const StorageService: IStorageService = {
  getComics: (): Comic[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_COMICS));
      return SEED_COMICS;
    }
    return JSON.parse(data);
  },

  saveComic: (comic: Comic) => {
    const comics = StorageService.getComics();
    const existingIndex = comics.findIndex(c => c.id === comic.id);
    
    if (existingIndex >= 0) {
      comics[existingIndex] = comic;
    } else {
      comics.unshift(comic);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comics));
  },

  deleteComic: (id: string) => {
    const comics = StorageService.getComics();
    const newComics = comics.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newComics));
  },

  getComicById: (id: string): Comic | undefined => {
    const comics = StorageService.getComics();
    return comics.find(c => c.id === id);
  },

  saveChapter: (chapter: Chapter) => {
      const comics = StorageService.getComics();
      const comicIndex = comics.findIndex(c => c.id === chapter.comicId);
      if (comicIndex >= 0) {
          const comic = comics[comicIndex];
          const chapIndex = comic.chapters.findIndex(c => c.id === chapter.id);
          
          if (chapIndex >= 0) {
              comic.chapters[chapIndex] = chapter;
          } else {
              comic.chapters.unshift(chapter);
              comic.chapters.sort((a, b) => b.number - a.number);
          }
          
          comic.chapters[0].updatedAt = new Date().toISOString();
          comics[comicIndex] = comic;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(comics));
      }
  },

  deleteChapter: (chapterId: string, comicId: string) => {
      const comics = StorageService.getComics();
      const comicIndex = comics.findIndex(c => c.id === comicId);
      if (comicIndex >= 0) {
          comics[comicIndex].chapters = comics[comicIndex].chapters.filter(c => c.id !== chapterId);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(comics));
      }
  },

  getChapterPages: (chapterId: string): Page[] => {
      const allPages = JSON.parse(localStorage.getItem(PAGES_KEY) || '{}');
      if (allPages[chapterId]) {
          return allPages[chapterId];
      }
      return Array.from({ length: 10 }).map((_, i) => ({
          id: `page-${i}`,
          imageUrl: `https://picsum.photos/800/1200?random=${chapterId}-${i}`,
          pageNumber: i + 1
      }));
  },

  saveChapterPages: (chapterId: string, pages: Page[]) => {
      const allPages = JSON.parse(localStorage.getItem(PAGES_KEY) || '{}');
      allPages[chapterId] = pages;
      localStorage.setItem(PAGES_KEY, JSON.stringify(allPages));
  },

  getGenres: (): Genre[] => {
      const data = localStorage.getItem(GENRE_KEY);
      if (!data) {
          localStorage.setItem(GENRE_KEY, JSON.stringify(SEED_GENRES));
          return SEED_GENRES;
      }
      return JSON.parse(data);
  },

  saveGenre: (genre: Genre) => {
      const genres = StorageService.getGenres();
      const existingIndex = genres.findIndex(g => g.id === genre.id);
      if (existingIndex >= 0) {
          genres[existingIndex] = genre;
      } else {
          genres.push(genre);
      }
      localStorage.setItem(GENRE_KEY, JSON.stringify(genres));
  },

  deleteGenre: (id: string) => {
      const genres = StorageService.getGenres();
      const newGenres = genres.filter(g => g.id !== id);
      localStorage.setItem(GENRE_KEY, JSON.stringify(newGenres));
  },

  getAds: (): AdConfig[] => {
      const data = localStorage.getItem(ADS_KEY);
      if (!data) {
          localStorage.setItem(ADS_KEY, JSON.stringify(SEED_ADS));
          return SEED_ADS;
      }
      return JSON.parse(data);
  },

  saveAd: (ad: AdConfig) => {
      const ads = StorageService.getAds();
      const existingIndex = ads.findIndex(a => a.id === ad.id);
      if (existingIndex >= 0) {
          ads[existingIndex] = ad;
      } else {
          ads.push(ad);
      }
      localStorage.setItem(ADS_KEY, JSON.stringify(ads));
  },

  deleteAd: (id: string) => {
      const ads = StorageService.getAds();
      const newAds = ads.filter(a => a.id !== id);
      localStorage.setItem(ADS_KEY, JSON.stringify(newAds));
  },

  getComments: (): Comment[] => {
      const data = localStorage.getItem(COMMENTS_KEY);
      if (!data) {
          localStorage.setItem(COMMENTS_KEY, JSON.stringify(SEED_COMMENTS));
          return SEED_COMMENTS;
      }
      return JSON.parse(data);
  },

  saveComment: (comment: Comment) => {
      const comments = StorageService.getComments();
      const existingIndex = comments.findIndex(c => c.id === comment.id);
      if (existingIndex >= 0) {
          comments[existingIndex] = comment;
      } else {
          comments.unshift(comment); 
      }
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
  },

  deleteComment: (id: string) => {
      const comments = StorageService.getComments();
      const newComments = comments.filter(c => c.id !== id);
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(newComments));
  },

  getStaticPages: (): StaticPage[] => {
      const data = localStorage.getItem(STATIC_PAGES_KEY);
      if (!data) {
          localStorage.setItem(STATIC_PAGES_KEY, JSON.stringify(SEED_STATIC_PAGES));
          return SEED_STATIC_PAGES;
      }
      return JSON.parse(data);
  },

  getStaticPageBySlug: (slug: string): StaticPage | undefined => {
      const pages = StorageService.getStaticPages();
      return pages.find(p => p.slug === slug);
  },

  saveStaticPage: (page: StaticPage) => {
      const pages = StorageService.getStaticPages();
      const existingIndex = pages.findIndex(p => p.slug === page.slug);
      if (existingIndex >= 0) {
          pages[existingIndex] = page;
      } else {
          pages.push(page);
      }
      localStorage.setItem(STATIC_PAGES_KEY, JSON.stringify(pages));
  },

  getTheme: (): ThemeConfig => {
      const data = localStorage.getItem(THEME_KEY);
      if (!data) {
          return DEFAULT_THEME;
      }
      return JSON.parse(data);
  },

  saveTheme: (theme: ThemeConfig) => {
      localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  },

  getUsers: (): User[] => {
      const data = localStorage.getItem(USERS_KEY);
      if (!data) {
          localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
          return SEED_USERS;
      }
      return JSON.parse(data);
  },
  
  saveUser: (user: User) => {
      const users = StorageService.getUsers();
      if (user.id) {
          const idx = users.findIndex(u => u.id === user.id);
          if (idx >= 0) {
              const oldUser = users[idx];
              users[idx] = {
                  ...oldUser,
                  username: user.username,
                  role: user.role,
                  password: user.password ? user.password : oldUser.password
              };
          }
      } else {
          user.id = Date.now();
          users.push(user);
      }
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  deleteUser: (id: string | number) => {
      const users = StorageService.getUsers();
      const newUsers = users.filter(u => u.id !== id);
      localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
  },

  getReports: (): Report[] => {
      const data = localStorage.getItem(REPORTS_KEY);
      return data ? JSON.parse(data) : [];
  },

  saveReport: (report: Report) => {
      const reports = StorageService.getReports();
      reports.unshift(report);
      localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  },

  deleteReport: (id: string) => {
      const reports = StorageService.getReports();
      const newReports = reports.filter(r => r.id !== id);
      localStorage.setItem(REPORTS_KEY, JSON.stringify(newReports));
  }
};
