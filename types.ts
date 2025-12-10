
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
  slug: string; // url friendly name e.g. "hanh-dong"
  isShowHome?: boolean; // Toggle to show section on Homepage
}

export interface Comic {
  id: string;
  title: string;
  coverImage: string;
  author: string;
  status: 'Đang tiến hành' | 'Hoàn thành';
  genres: string[]; // Stores genre names for simplicity in this architecture
  description: string;
  rating: number;
  views: number;
  chapters: Chapter[];
  isRecommended?: boolean; // Toggle to show in "You might like" section
  
  // SEO Fields
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
    rating: number;
    date: string;
    isApproved: boolean; // Needs admin approval to show
}

export interface StaticPage {
    slug: string; // e.g., 'dieu-khoan', 'chinh-sach', 'lien-he'
    title: string;
    content: string; // HTML content
}

export interface ThemeConfig {
    primaryColor: string; // Hex code
    secondaryColor: string;
    backgroundColor: string; // Hex code for dark background
    cardColor: string;
    fontFamily: 'sans' | 'serif' | 'mono';
    homeLayout: {
        showSlider: boolean;
        showHot: boolean;
        showNew: boolean;
    };
    footerContent?: string; // HTML content for footer info
}
