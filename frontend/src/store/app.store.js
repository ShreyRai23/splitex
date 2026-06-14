// src/store/app.store.js
import { create } from 'zustand';

const useAppStore = create((set) => ({
  selectedGroupId: 1,   // default to first group
  setSelectedGroupId: (id) => set({ selectedGroupId: id }),

  groups: [],
  setGroups: (groups) => set({ groups }),
}));

export default useAppStore;
