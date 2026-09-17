import { create } from 'zustand';
import { Category, Product } from '../types';

interface CatalogState {
  products: Product[];
  categories: Category[];
  searchQuery: string;
  selectedCategory: string;

  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (categoryId: string) => void;
  getFilteredProducts: () => Product[];
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  products: [],
  categories: [],
  searchQuery: '',
  selectedCategory: 'ALL',

  setProducts: (products: Product[]) => set({ products }),
  setCategories: (categories: Category[]) => set({ categories }),
  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  setSelectedCategory: (selectedCategory: string) => set({ selectedCategory }),

  getFilteredProducts: () => {
    const { products, searchQuery, selectedCategory } = get();
    return products.filter((p) => {
      const matchQuery =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory =
        selectedCategory === 'ALL' || p.categoryId === selectedCategory;

      return matchQuery && matchCategory && !p.deletedAt;
    });
  },
}));
