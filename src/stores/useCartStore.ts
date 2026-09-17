import { create } from 'zustand';
import { CartItem, Customer, Product, Transaction } from '../types';

interface CartState {
  cart: CartItem[];
  cartOrderDiscount: number;
  selectedCustomer: Customer | null;
  activeReceiptTransaction: Transaction | null;

  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  updateCartItemDiscount: (productId: string, discount: number, discountType: 'NOMINAL' | 'PERCENT') => void;
  clearCart: () => void;
  setCartOrderDiscount: (discount: number) => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  setActiveReceiptTransaction: (trx: Transaction | null) => void;
  getCartSubtotal: () => number;
  getCartItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: [],
  cartOrderDiscount: 0,
  selectedCustomer: null,
  activeReceiptTransaction: null,

  addToCart: (product: Product, quantity: number = 1) => {
    set((state) => {
      const existingIndex = state.cart.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...state.cart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return { cart: updated };
      }
      return {
        cart: [
          ...state.cart,
          {
            product,
            quantity,
            discount: 0,
            discountType: 'NOMINAL',
          },
        ],
      };
    });
  },

  removeFromCart: (productId: string) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.product.id !== productId),
    }));
  },

  updateCartQuantity: (productId: string, quantity: number) => {
    set((state) => {
      if (quantity <= 0) {
        return { cart: state.cart.filter((item) => item.product.id !== productId) };
      }
      return {
        cart: state.cart.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        ),
      };
    });
  },

  updateCartItemDiscount: (productId: string, discount: number, discountType: 'NOMINAL' | 'PERCENT') => {
    set((state) => ({
      cart: state.cart.map((item) =>
        item.product.id === productId ? { ...item, discount, discountType } : item
      ),
    }));
  },

  clearCart: () => {
    set({ cart: [], cartOrderDiscount: 0, selectedCustomer: null });
  },

  setCartOrderDiscount: (discount: number) => {
    set({ cartOrderDiscount: Math.max(0, discount) });
  },

  setSelectedCustomer: (customer: Customer | null) => {
    set({ selectedCustomer: customer });
  },

  setActiveReceiptTransaction: (trx: Transaction | null) => {
    set({ activeReceiptTransaction: trx });
  },

  getCartSubtotal: () => {
    const { cart } = get();
    return cart.reduce((total, item) => {
      const original = item.product.sellPrice * item.quantity;
      const discount =
        item.discountType === 'PERCENT'
          ? (original * item.discount) / 100
          : item.discount;
      return total + Math.max(0, original - discount);
    }, 0);
  },

  getCartItemCount: () => {
    return get().cart.reduce((count, item) => count + item.quantity, 0);
  },
}));
