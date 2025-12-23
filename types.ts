export interface Chapter {
  id: string;
  comicId: string;
  number: number;
  title: string;
  updatedAt: string;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  isShowHome?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
}

export interface Comic {
  id: string;
  title: string;
  coverImage: string;
  author: string;
  status: 'Đang tiến hành' | 'Hoàn thành';
  genres: string[];
  description: string;
  views: number;
  rating?: number; // Added to fix build error
  chapters: Chapter[];
  chapterCount?: number;
  isRecommended?: boolean;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
}

export interface Page {
  id?: string;
  imageUrl: string;
  pageNumber: number;
}

export interface AdConfig {
  id: string;
  position: 'home_header' | 'home_middle' | 'home_bottom' | 'detail_sidebar' | 'detail_bottom' | 'reader_top' | 'reader_bottom' | 'reader_middle' | 'reader_float_left' | 'reader_float_right';
  imageUrl: string;
  linkUrl: string;
  isActive: boolean;
  title?: string;
}

export interface Comment {
    id: string;
    comicId: string;
    userName: string;
    content: string;
    rating?: number; // Added to fix build error
    date: string;
    isApproved: boolean;
    comicTitle?: string;
}

export interface StaticPage {
    slug: string;
    title: string;
    content: string;
    metaTitle?: string;
    metaDescription?: string;
    metaKeywords?: string;
}

export interface ThemeConfig {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    cardColor: string;
    
    // Font Configuration
    fontFamily: string; // Changed from enum to string to support Google Fonts

    // Header Styling
    headerBg?: string;
    headerText?: string;

    // Footer Styling
    footerBg?: string;
    footerText?: string;
    
    // NEW: Site Layout configuration
    siteLayout?: 'classic' | 'modern' | 'minimalist';

    homeLayout: {
        showSlider: boolean;
        showHot: boolean;
        showNew: boolean;
        // NEW: Sortable list of genres for homepage
        homeGenres?: { name: string; slug: string }[];
        hotComicsCount?: number;
        newComicsCount?: number;
        genreComicsCount?: number;
    };
    headerMenu?: { label: string; url: string }[];
    footerMenu?: { label: string; url: string }[];
    footerContent?: string;
    
    // General Info
    siteName?: string;
    logoUrl?: string; // New: Logo
    favicon?: string; // New: Favicon
    loginUrl?: string; // New: Admin Login URL

    // Home Page SEO
    homeMetaTitle?: string;
    homeMetaDescription?: string;
    homeMetaKeywords?: string;

    // Categories Page SEO
    categoriesMetaTitle?: string;
    categoriesMetaDescription?: string;
    // FIX: Renamed property to categoriesMetaKeywords to match its usage in seedData.ts and Categories.tsx.
    categoriesMetaKeywords?: string;
}

export interface User {
    id: string | number;
    username: string;
    password?: string;
    role: 'admin' | 'editor';
    permissions?: string[];
}

export interface Report {
    id: string;
    comicId: string;
    chapterId: string;
    message: string;
    created_at: string;
    comicTitle?: string; // Optional for UI display
    chapterTitle?: string; // Optional for UI display
}

export interface MediaFile {
    name: string;
    url: string;
    size: number;
    created: string;
    isDir: boolean;
}

export interface Analytics {
    totalViews: number;
    todayViews: number;
    monthViews: number;
}
// FIX: Add DailyView interface
export interface DailyView {
    date: string;
    views: number;
}

// NEW: System Stats type
export interface SystemStats {
    imageStorageUsed: number;
    databaseRows: number;
    nodeVersion: string;
    reactVersion: string;
    viteVersion: string;
    platform: string;
    arch: string;
}


// NEW: Leech Configuration type
export interface LeechConfig {
  id: string;
  name: string;
  baseUrl: string;
  // Selectors for Comic page
  comicTitleSelector: string;
  comicCoverSelector: string;
  comicAuthorSelector?: string;
  uploadCoverImage?: boolean;
  comicDescriptionSelector: string;
  chapterLinkSelector: string;
  // Selectors for Chapter page
  chapterImageSelector: string;
  imageSrcAttribute: string; // e.g., 'src,data-src'
}

export interface LeechJob {
  id: string;
  comicId: string;
  comicTitle: string;
  status: 'running' | 'completed' | 'failed';
  progressText: string;
  totalChapters: number;
  completedChapters: number;
}