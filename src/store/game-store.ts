import { create } from 'zustand';

type GameView = 'welcome' | 'dashboard' | 'businesses' | 'business-detail' | 'new-business' | 'market' | 'bank' | 'leaderboard' | 'news' | 'achievements' | 'settings';

interface Employee {
  id: string;
  role: string;
  name: string;
  salary: number;
  skill: number;
}

interface Inventory {
  id: string;
  productName: string;
  quantity: number;
  purchasePrice: number;
  sellPrice: number;
}

interface Business {
  id: string;
  type: string;
  city: string;
  name: string;
  level: number;
  reputation: number;
  cash: number;
  dailyRevenue: number;
  dailyExpense: number;
  dailyProfit: number;
  totalRevenue: number;
  totalProfit: number;
  inventories?: Inventory[];
  employees?: Employee[];
}

interface Player {
  id: string;
  name: string;
  cash: number;
  netWorth: number;
  level: number;
  experience: number;
  businesses?: Business[];
}

interface GameEvent {
  id: string;
  title: string;
  description: string;
  icon?: string;
  startsAt: string;
  endsAt: string;
}

interface NewsItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
}

interface LeaderboardEntry {
  playerId: string;
  name: string;
  netWorth: number;
  totalProfit: number;
  businessCount: number;
  maxReputation: number;
}

interface GameState {
  view: GameView;
  selectedBusinessId: string | null;
  selectedCity: string;
  player: Player | null;
  businesses: Business[];
  currentBusiness: Business | null;
  events: GameEvent[];
  news: NewsItem[];
  leaderboard: LeaderboardEntry[];
  achievements: Achievement[];
  gameDay: number;
  isLoading: boolean;
  setView: (view: GameView) => void;
  selectBusiness: (id: string) => void;
  setSelectedCity: (city: string) => void;
  setPlayer: (player: Player | null) => void;
  setBusinesses: (businesses: Business[]) => void;
  setCurrentBusiness: (business: Business | null) => void;
  setEvents: (events: GameEvent[]) => void;
  setNews: (news: NewsItem[]) => void;
  setLeaderboard: (leaderboard: LeaderboardEntry[]) => void;
  setAchievements: (achievements: Achievement[]) => void;
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
