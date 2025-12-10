import { DataProvider } from './dataProvider';

// Re-export methods from DataProvider so we don't break existing imports in components
export const getComics = DataProvider.getComics;
export const getComicById = DataProvider.getComicById;
export const getChapterPages = DataProvider.getChapterPages;
