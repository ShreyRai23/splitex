// src/store/auth.store.js
import { create } from 'zustand';

const useAuthStore = create((set) => ({
  token: localStorage.getItem('spiltex_token') || null,
  user:  JSON.parse(localStorage.getItem('spiltex_user') || 'null'),

  setAuth: (token, user) => {
    localStorage.setItem('spiltex_token', token);
    localStorage.setItem('spiltex_user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('spiltex_token');
    localStorage.removeItem('spiltex_user');
    set({ token: null, user: null });
  },

  isLoggedIn: () => !!localStorage.getItem('spiltex_token'),
}));

export default useAuthStore;
