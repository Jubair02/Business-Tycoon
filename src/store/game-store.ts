import { create } from 'zustand';

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
  /** True once the owner has set this shelf price rather than taking the default. */
  priceEdited?: boolean;
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
  healthScore: number;
  satisfactionScore: number;
  loyaltyScore: number;
  brandAwareness: number;
  location: string | null;
  setupDaysRemaining: number;
  /** Standing restock order — the tick tops the shelves up on the owner's behalf. */
  autoRestock?: boolean;
  autoRestockThreshold?: number;
  autoRestockTarget?: number;
  autoRestockBudget?: number | null;
  inventories?: Inventory[];
  employees?: Employee[];
}

interface Player {
  id: string;
  name: string;
  createdAt?: string;
  cash: number;
  netWorth: number;
  level: number;
  experience: number;
  expansionCount: number;
  lastExpansionAt: number;
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
  /** Opaque public reference, not the player's real id. */
  playerId: string;
  /** True for the viewing player's own row. */
  isYou?: boolean;
  name: string;
  netWorth: number;
  totalProfit: number;
  totalRevenue?: number;
  businessCount: number;
  maxReputation: number;
  isAI?: boolean;
  personality?: string;
}

// Phase 2: Competition data
interface CompetitionMarket {
  city: string;
  cityName: string;
  businessType: string;
  businessTypeName: string;
  totalDemand: number;
  totalBusinesses: number;
  aiBusinesses: number;
  playerBusinesses: number;
  playerMarketShare: number;
  playerRank: number;
  averageRevenue: number;
  topCompetitor: {
    name: string;
    share: number;
    isAI: boolean;
  } | null;
  shares: {
    businessName: string;
    playerName: string;
    isAI: boolean;
    share: number;
    revenue: number;
  }[];
}

// Phase 5: Portfolio data
interface PortfolioData {
  totalDailyRevenue: number;
  totalDailyExpense: number;
  totalDailyProfit: number;
  totalRevenue: number;
  totalProfit: number;
  totalCash: number;
  totalEmployees: number;
  totalBusinesses: number;
  avgHealthScore: number;
  avgSatisfaction: number;
  avgLoyalty: number;
  bestPerforming: { id: string; name: string; profit: number } | null;
  worstPerforming: { id: string; name: string; profit: number } | null;
  citySpread: Record<string, number>;
  typeSpread: Record<string, number>;
}

interface GameState {
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
  competition: CompetitionMarket[];
  // Phase 5: Portfolio
  portfolio: PortfolioData | null;
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
  setCompetition: (competition: CompetitionMarket[]) => void;
  setPortfolio: (portfolio: PortfolioData | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
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
  competition: [],
  portfolio: null,
  selectBusiness: (id) => set({ selectedBusinessId: id }),
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
  setCompetition: (competition) => set({ competition }),
  setPortfolio: (portfolio) => set({ portfolio }),
}));
