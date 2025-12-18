
import { Comic, Chapter, Genre, Page, AdConfig, Comment, StaticPage, ThemeConfig, User } from '../types';

export const DEFAULT_THEME: ThemeConfig = {
    primaryColor: '#d97706',
    secondaryColor: '#78350f',
    backgroundColor: '#1c1917',
    cardColor: '#292524',
    fontFamily: 'Inter', // Default Google Font
    
    headerBg: '#1c1917',
    headerText: '#e2e8f0',
    footerBg: '#292524',
    footerText: '#94a3b8',
    
    siteLayout: 'classic', // NEW: Default layout

    homeLayout: { 
        showSlider: true, 
        showHot: true, 
        showNew: true,
        homeGenres: [] // New: Default empty array for sortable home genres
    },
    headerMenu: [
        { label: 'Trang chủ', url: '/' },
        { label: 'Thể loại', url: '/categories' }
    ],
    footerMenu: [
        { label: 'Điều khoản', url: '/p/dieu-khoan' },
        { label: 'Chính sách riêng tư', url: '/p/chinh-sac-rieng-tu' },
        { label: 'Liên hệ', url: '/p/lien-he' }
    ],
    siteName: 'ComiVN',
    favicon: '',
    homeMetaTitle: 'ComiVN - Đọc Truyện Tranh Online Hay Nhất',
    homeMetaDescription: 'Website đọc truyện tranh online miễn phí chất lượng cao.',
    homeMetaKeywords: 'truyen tranh, manga, ngon tinh',
    categoriesMetaTitle: 'Danh Sách Thể Loại Truyện - ComiVN',
    categoriesMetaDescription: 'Khám phá kho truyện tranh đa dạng thể loại tại ComiVN.',
    categoriesMetaKeywords: 'the loai truyen, truyen hanh dong, truyen ngon tinh'
};

// Dữ liệu User mặc định
export const SEED_USERS: User[] = [
    { id: 1, username: 'admin', password: '123456', role: 'admin' }
];

export const SEED_GENRES: Genre[] = [
    { id: 'g1', name: 'Hành Động', slug: 'hanh-dong', isShowHome: true },
    { id: 'g2', name: 'Phiêu Lưu', slug: 'phieu-luu', isShowHome: false },
    { id: 'g3', name: 'Giả Tưởng', slug: 'gia-tuong', isShowHome: true },
    { id: 'g4', name: 'Chuyển Sinh', slug: 'chuyen-sinh', isShowHome: true },
    { id: 'g5', name: 'Cổ Đại', slug: 'co-dai', isShowHome: false },
    { id: 'g6', name: 'Kinh Dị', slug: 'kinh-di', isShowHome: false },
    { id: 'g7', name: 'Hài Hước', slug: 'hai-huoc', isShowHome: false },
    { id: 'g8', name: 'Đời Thường', slug: 'doi-thuong', isShowHome: false },
];

export const SEED_ADS: AdConfig[] = [
    { id: 'ad-1', position: 'home_middle', imageUrl: 'https://picsum.photos/1200/200?random=ad1', linkUrl: '#', isActive: true, title: 'Quảng cáo Banner Giữa Trang' },
    { id: 'ad-2', position: 'detail_sidebar', imageUrl: 'https://picsum.photos/300/600?random=ad2', linkUrl: '#', isActive: true, title: 'Quảng cáo Sidebar' }
];

export const SEED_COMICS: Comic[] = Array.from({ length: 12 }).map((_, index) => {
  const id = `comic-${index + 1}`;
  const chapterCount = Math.floor(Math.random() * 50) + 10;
  const chapters: Chapter[] = Array.from({ length: chapterCount }).map((__, cIndex) => ({
    id: `${id}-chapter-${chapterCount - cIndex}`,
    comicId: id,
    number: chapterCount - cIndex,
    title: `Chương ${chapterCount - cIndex}`,
    updatedAt: new Date(Date.now() - cIndex * 86400000).toISOString().split('T')[0],
  }));
  const titles = ["Thợ Săn Hầm Ngục", "Đại Pháp Sư Trở Lại", "Kiếm Vương Bất Tử", "Cô Gái Đến Từ Hư Vô", "Học Viện Siêu Nhiên", "Sát Thủ Về Hưu", "Vị Vua Cuối Cùng", "Thế Giới Hoàn Mỹ", "Đấu Phá Thương Khung", "Toàn Chức Pháp Sư", "Võ Luyện Đỉnh Phong", "Yêu Thần Ký"];
  const title = titles[index] || `Truyện Tranh #${index + 1}`;
  
  return {
    id,
    title: title,
    coverImage: `https://picsum.photos/300/450?random=${index + 100}`,
    author: `Tác giả ${index + 1}`,
    status: Math.random() > 0.3 ? 'Đang tiến hành' : 'Hoàn thành',
    genres: ['Hành Động', 'Phiêu Lưu', 'Giả Tưởng'].sort(() => 0.5 - Math.random()).slice(0, 3),
    description: `Mô tả mặc định cho truyện ${title}.`,
    views: Math.floor(Math.random() * 1000000),
    rating: parseFloat((3 + Math.random() * 2).toFixed(1)),
    chapters,
    isRecommended: Math.random() > 0.5,
    metaTitle: `${title} - Đọc Truyện Tranh Online`,
    metaDescription: `Đọc truyện ${title} tiếng Việt nhanh nhất.`,
    metaKeywords: `${title}, truyen tranh`
  };
});

export const SEED_COMMENTS: Comment[] = [
    { id: 'cmt-1', comicId: 'comic-1', userName: 'Độc giả ẩn danh', content: 'Truyện hay quá!', rating: 5, date: new Date().toISOString(), isApproved: true },
];

export const SEED_STATIC_PAGES: StaticPage[] = [
    { slug: 'dieu-khoan', title: 'Điều Khoản Sử Dụng', content: '<h2>1. Giới thiệu</h2><p>Chào mừng bạn đến với ComiVN...</p>' },
    { slug: 'chinh-sach-rieng-tu', title: 'Chính Sách Riêng Tư', content: '<h2>1. Thu thập thông tin</h2><p>Chúng tôi cam kết bảo mật thông tin...</p>' },
    { slug: 'lien-he', title: 'Liên Hệ', content: '<h2>Thông tin liên hệ</h2><p>Email: contact@comivn.com</p>' }
];