
import { Comic, Chapter, Genre, Page, AdConfig, Comment, StaticPage, ThemeConfig } from '../types';

const STORAGE_KEY = 'comivn_data';
const GENRE_KEY = 'comivn_genres';
const PAGES_KEY = 'comivn_pages';
const ADS_KEY = 'comivn_ads';
const COMMENTS_KEY = 'comivn_comments';
const STATIC_PAGES_KEY = 'comivn_static_pages';
const THEME_KEY = 'comivn_theme';

// Default Theme (Mệnh Thổ - Earth)
const DEFAULT_THEME: ThemeConfig = {
    primaryColor: '#d97706', // Amber 600
    secondaryColor: '#78350f', // Amber 900
    backgroundColor: '#1c1917', // Stone 900
    cardColor: '#292524', // Stone 800
    fontFamily: 'sans',
    homeLayout: {
        showSlider: true,
        showHot: true,
        showNew: true
    }
};

// ... (Existing SEED Data - Kept for integrity)
const SEED_GENRES: Genre[] = [
    { id: 'g1', name: 'Hành Động', slug: 'hanh-dong', isShowHome: true },
    { id: 'g2', name: 'Phiêu Lưu', slug: 'phieu-luu', isShowHome: false },
    { id: 'g3', name: 'Giả Tưởng', slug: 'gia-tuong', isShowHome: true },
    { id: 'g4', name: 'Chuyển Sinh', slug: 'chuyen-sinh', isShowHome: true },
    { id: 'g5', name: 'Cổ Đại', slug: 'co-dai', isShowHome: false },
    { id: 'g6', name: 'Kinh Dị', slug: 'kinh-di', isShowHome: false },
    { id: 'g7', name: 'Hài Hước', slug: 'hai-huoc', isShowHome: false },
    { id: 'g8', name: 'Đời Thường', slug: 'doi-thuong', isShowHome: false },
];

const SEED_ADS: AdConfig[] = [
    {
        id: 'ad-1',
        position: 'home_middle',
        imageUrl: 'https://picsum.photos/1200/200?random=ad1',
        linkUrl: '#',
        isActive: true,
        title: 'Quảng cáo Banner Giữa Trang'
    },
    {
        id: 'ad-2',
        position: 'detail_sidebar',
        imageUrl: 'https://picsum.photos/300/600?random=ad2',
        linkUrl: '#',
        isActive: true,
        title: 'Quảng cáo Sidebar'
    }
];

const SEED_COMICS: Comic[] = Array.from({ length: 12 }).map((_, index) => {
  const id = `comic-${index + 1}`;
  const chapterCount = Math.floor(Math.random() * 50) + 10;
  
  const chapters: Chapter[] = Array.from({ length: chapterCount }).map((__, cIndex) => ({
    id: `${id}-chapter-${chapterCount - cIndex}`,
    comicId: id,
    number: chapterCount - cIndex,
    title: `Chương ${chapterCount - cIndex}`,
    updatedAt: new Date(Date.now() - cIndex * 86400000).toISOString().split('T')[0],
  }));

  const titles = [
      "Thợ Săn Hầm Ngục", "Đại Pháp Sư Trở Lại", "Kiếm Vương Bất Tử", "Cô Gái Đến Từ Hư Vô",
      "Học Viện Siêu Nhiên", "Sát Thủ Về Hưu", "Vị Vua Cuối Cùng", "Thế Giới Hoàn Mỹ",
      "Đấu Phá Thương Khung", "Toàn Chức Pháp Sư", "Võ Luyện Đỉnh Phong", "Yêu Thần Ký"
  ];

  return {
    id,
    title: titles[index] || `Truyện Tranh #${index + 1}`,
    coverImage: `https://picsum.photos/300/450?random=${index + 100}`,
    author: `Tác giả ${index + 1}`,
    status: Math.random() > 0.3 ? 'Đang tiến hành' : 'Hoàn thành',
    genres: ['Hành Động', 'Phiêu Lưu', 'Giả Tưởng'].sort(() => 0.5 - Math.random()).slice(0, 3),
    description: `Mô tả mặc định cho truyện ${titles[index] || index}. Nhân vật chính bắt đầu hành trình đầy gian nan...`,
    rating: parseFloat((3 + Math.random() * 2).toFixed(1)),
    views: Math.floor(Math.random() * 1000000),
    chapters,
    isRecommended: Math.random() > 0.5,
  };
});

const SEED_COMMENTS: Comment[] = [
    { id: 'cmt-1', comicId: 'comic-1', userName: 'Độc giả ẩn danh', content: 'Truyện hay quá, hóng chap mới!', rating: 5, date: new Date().toISOString(), isApproved: true },
    { id: 'cmt-2', comicId: 'comic-1', userName: 'Fan Cứng', content: 'Dịch hơi chậm nhỉ admin ơi.', rating: 4, date: new Date(Date.now() - 86400000).toISOString(), isApproved: true },
    { id: 'cmt-3', comicId: 'comic-1', userName: 'Hater', content: 'Truyện dở tệ.', rating: 1, date: new Date().toISOString(), isApproved: false },
];

const SEED_STATIC_PAGES: StaticPage[] = [
    { slug: 'dieu-khoan', title: 'Điều Khoản Sử Dụng', content: '<p>Chào mừng bạn đến với ComiVN. Khi sử dụng website này, bạn đồng ý với các điều khoản sau...</p><ul><li>Không spam.</li><li>Tôn trọng bản quyền.</li></ul>' },
    { slug: 'chinh-sach-rieng-tu', title: 'Chính Sách Riêng Tư', content: '<p>Chúng tôi cam kết bảo mật thông tin cá nhân của bạn. Chúng tôi không chia sẻ dữ liệu với bên thứ ba...</p>' },
    { slug: 'lien-he', title: 'Liên Hệ', content: '<p>Mọi thắc mắc xin vui lòng liên hệ email: <strong>admin@comivn.com</strong></p><p>Hoặc số điện thoại: 0123.456.789</p>' }
];

export const StorageService = {
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

  // --- Theme Methods ---
  getTheme: (): ThemeConfig => {
      const data = localStorage.getItem(THEME_KEY);
      if (!data) {
          return DEFAULT_THEME;
      }
      return JSON.parse(data);
  },

  saveTheme: (theme: ThemeConfig) => {
      localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  }
};
