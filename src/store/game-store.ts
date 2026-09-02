import { create } from 'zustand';

type GameView = 'welcome' | 'dashboard' | 'businesses' | 'business-detail' | 'new-business' | 'market' | 'bank' | 'leaderboard' | 'news' | 'achievements' | 'settings';

interface GameState {
  view: GameView;
  selectedBusinessId: string | null;
  selectedCity: string;
  player: any | null;
  businesses: any[];
  currentBusiness: any | null;
  events: any[];
  news: any[];
  leaderboard: any[];
  achievements: any[];
  gameDay: number;
  isLoading: boolean;
  setView: (view: GameView) => void;
  selectBusiness: (id: string) => void;
  setSelectedCity: (city: string) => void;
  setPlayer: (player: any) => void;
  setBusinesses: (businesses: any[]) => void;
  setCurrentBusiness: (business: any) => void;
  setEvents: (events: any[]) => void;
  setNews: (news: any[]) => void;
  setLeaderboard: (leaderboard: any[]) => void;
  setAchievements: (achievements: any[]) => void;
  setGameDay: (day: number) => void;
  setLoading: (loading: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
  view: 'welcome',
  selectedBusinessId: null,
  selectedCity: 'DHAKA',
  player: null,
  businesses: [],
  currentBusiness: null,
  events: [],
  news: [],
  leaderboard: [],
  achievements: [],
  gameDay: 1,
  isLoading: false,
  setView: (view) => set({ view }),
  selectBusiness: (id) => set({ selectedBusinessId: id, view: 'business-detail' }),
  setSelectedCity: (city) => set({ selectedCity: city }),
  setPlayer: (player) => set({ player }),
  setBusinesses: (businesses) => set({ businesses }),
  setCurrentBusiness: (business) => set({ currentBusiness: business }),
  setEvents: (events) => set({ events }),
  setNews: (news) => set({ news }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setAchievements: (achievements) => set({ achievements }),
  setGameDay: (gameDay) => set({ gameDay }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
