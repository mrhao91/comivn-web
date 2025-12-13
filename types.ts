
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
    fontFamily: 'sans' | 'serif' | 'mono';
    homeLayout: {
        showSlider: boolean;
        showHot: boolean;
        showNew: boolean;
    };
    headerMenu?: { label: string; url: string }[];
    footerContent?: string;
    siteName?: string;
    homeMetaTitle?: string;
    homeMetaDescription?: string;
    homeMetaKeywords?: string;
}

export interface User {
    id: string | number;
    username: string;
    password?: string;
    role: 'admin' | 'editor';
}