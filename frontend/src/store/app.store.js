// src/store/app.store.js
import { create } from 'zustand';

const useAppStore = create((set) => ({
  selectedGroupId: null,  // null until groups are fetched
  setSelectedGroupId: (id) => set({ selectedGroupId: id }),

  groups: [],
  setGroups: (groups) => set({ groups }),
}));

export default useAppStore;
