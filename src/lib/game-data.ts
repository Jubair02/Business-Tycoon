// ============================================
// Bangladesh Business Tycoon - Game Constants & Data
// ============================================

export interface City {
  id: string;
  name: string;
  nameBn: string;
  description: string;
  rentMultiplier: number;
  customerMultiplier: number;
  advantages: string;
  icon: string;
}

export const CITIES: City[] = [
  {
    id: 'DHAKA',
    name: 'Dhaka',
    nameBn: 'ঢাকা',
    description: 'The capital and largest city. Highest customer traffic but highest rent costs.',
    rentMultiplier: 1.5,
    customerMultiplier: 1.4,
    advantages: 'High customers, high rent',
    icon: '🏙️',
  },
  {
    id: 'CHITTAGONG',
    name: 'Chattogram',
    nameBn: 'চট্টগ্রাম',
    description: 'The port city with strong trade and business advantages.',
    rentMultiplier: 1.1,
    customerMultiplier: 1.2,
    advantages: 'Trade/business advantage',
    icon: '🏙️',
  },
  {
    id: 'SYLHET',
    name: 'Sylhet',
    nameBn: 'সিলেট',
    description: 'Known for tourism and natural beauty. Great for restaurants and hospitality.',
    rentMultiplier: 0.9,
    customerMultiplier: 1.1,
    advantages: 'Tourism & restaurants',
    icon: '🏙️',
  },
  {
    id: 'RAJSHAHI',
    name: 'Rajshahi',
    nameBn: 'রাজশাহী',
    description: 'Known for lower costs. Great for startups and manufacturing.',
    rentMultiplier: 0.7,
    customerMultiplier: 0.9,
    advantages: 'Lower rent',
    icon: '🏙️',
  },
  {
    id: 'KHULNA',
    name: 'Khulna',
    nameBn: 'খুলনা',
    description: 'Industrial city with manufacturing opportunities.',
    rentMultiplier: 0.8,
    customerMultiplier: 0.95,
    advantages: 'Manufacturing opportunities',
    icon: '🏙️',
  },
];

export interface BusinessType {
  id: string;
  name: string;
  icon: string;
  investment: number;
  rent: number;
  risk: 'Low' | 'Medium' | 'High';
  profit: 'Low' | 'Medium' | 'High';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  baseCustomers: number;
  color: string;
  bgColor: string;
}

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: 'TEA_STALL',
    name: 'Tea Stall',
    icon: '☕',
    investment: 50000,
    rent: 3000,
    risk: 'Low',
    profit: 'Low',
    difficulty: 'Easy',
    description: 'A cozy tea stall serving cha, biscuits, and snacks. Perfect for beginners.',
    baseCustomers: 80,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
  },
  {
    id: 'GROCERY',
    name: 'Grocery Store',
    icon: '🛒',
    investment: 300000,
    rent: 15000,
    risk: 'Medium',
    profit: 'Medium',
    difficulty: 'Medium',
    description: 'A well-stocked grocery store with daily essentials and household items.',
    baseCustomers: 60,
    color: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  {
    id: 'CLOTHING',
    name: 'Clothing Shop',
    icon: '👕',
    investment: 500000,
    rent: 25000,
    risk: 'Medium',
    profit: 'High',
    difficulty: 'Medium',
    description: 'Fashionable clothing shop with seasonal collections and event-driven sales.',
    baseCustomers: 45,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
  },
  {
    id: 'MOBILE',
    name: 'Mobile & Electronics',
    icon: '📱',
    investment: 1000000,
    rent: 35000,
    risk: 'High',
    profit: 'High',
    difficulty: 'Hard',
    description: 'High-end mobile and electronics shop dealing with smartphones and accessories.',
    baseCustomers: 30,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'RESTAURANT',
    name: 'Restaurant',
    icon: '🍛',
    investment: 800000,
    rent: 30000,
    risk: 'Medium',
    profit: 'High',
    difficulty: 'Medium',
    description: 'A popular restaurant serving authentic Bangladeshi cuisine.',
    baseCustomers: 50,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
];

export interface ProductDef {
  name: string;
  category: string;
  basePrice: number;
  baseDemand: number;
  icon: string;
  maxStock: number;
  suggestedMarkup: number;
}

export const PRODUCTS: Record<string, ProductDef[]> = {
  TEA_STALL: [
    { name: 'Tea (Cha)', category: 'TEA_STALL', basePrice: 8, baseDemand: 1.0, icon: '🫖', maxStock: 500, suggestedMarkup: 0.6 },
    { name: 'Biscuits', category: 'TEA_STALL', basePrice: 5, baseDemand: 0.6, icon: '🍪', maxStock: 300, suggestedMarkup: 0.5 },
    { name: 'Singara', category: 'TEA_STALL', basePrice: 10, baseDemand: 0.7, icon: '🥟', maxStock: 200, suggestedMarkup: 0.7 },
    { name: 'Samosa', category: 'TEA_STALL', basePrice: 12, baseDemand: 0.5, icon: '🔺', maxStock: 200, suggestedMarkup: 0.7 },
    { name: 'Cold Drinks', category: 'TEA_STALL', basePrice: 15, baseDemand: 0.8, icon: '🥤', maxStock: 150, suggestedMarkup: 0.4 },
  ],
  GROCERY: [
    { name: 'Rice (5kg)', category: 'GROCERY', basePrice: 280, baseDemand: 0.9, icon: '🍚', maxStock: 100, suggestedMarkup: 0.15 },
    { name: 'Cooking Oil (1L)', category: 'GROCERY', basePrice: 200, baseDemand: 0.85, icon: '🫗', maxStock: 80, suggestedMarkup: 0.15 },
    { name: 'Eggs (12pc)', category: 'GROCERY', basePrice: 150, baseDemand: 0.95, icon: '🥚', maxStock: 120, suggestedMarkup: 0.2 },
    { name: 'Milk (1L)', category: 'GROCERY', basePrice: 90, baseDemand: 0.8, icon: '🥛', maxStock: 80, suggestedMarkup: 0.18 },
    { name: 'Snacks', category: 'GROCERY', basePrice: 20, baseDemand: 0.7, icon: '🍿', maxStock: 200, suggestedMarkup: 0.35 },
    { name: 'Soft Drinks', category: 'GROCERY', basePrice: 30, baseDemand: 0.75, icon: '🥤', maxStock: 150, suggestedMarkup: 0.25 },
  ],
  CLOTHING: [
    { name: 'Men\'s Shirt', category: 'CLOTHING', basePrice: 500, baseDemand: 0.7, icon: '👔', maxStock: 60, suggestedMarkup: 0.4 },
    { name: 'Men\'s Pants', category: 'CLOTHING', basePrice: 700, baseDemand: 0.6, icon: '👖', maxStock: 50, suggestedMarkup: 0.4 },
    { name: 'Women\'s Saree', category: 'CLOTHING', basePrice: 1500, baseDemand: 0.8, icon: '👗', maxStock: 30, suggestedMarkup: 0.45 },
    { name: 'Women\'s Salwar Kameez', category: 'CLOTHING', basePrice: 800, baseDemand: 0.75, icon: '👗', maxStock: 40, suggestedMarkup: 0.4 },
    { name: 'Kids\' Clothing Set', category: 'CLOTHING', basePrice: 400, baseDemand: 0.65, icon: '👶', maxStock: 50, suggestedMarkup: 0.5 },
    { name: 'Winter Jacket', category: 'CLOTHING', basePrice: 1200, baseDemand: 0.4, icon: '🧥', maxStock: 30, suggestedMarkup: 0.45 },
  ],
  MOBILE: [
    { name: 'Budget Smartphone', category: 'MOBILE', basePrice: 8000, baseDemand: 0.8, icon: '📱', maxStock: 20, suggestedMarkup: 0.12 },
    { name: 'Mid-Range Smartphone', category: 'MOBILE', basePrice: 25000, baseDemand: 0.6, icon: '📱', maxStock: 10, suggestedMarkup: 0.1 },
    { name: 'Premium Smartphone', category: 'MOBILE', basePrice: 120000, baseDemand: 0.3, icon: '📱', maxStock: 5, suggestedMarkup: 0.08 },
    { name: 'Earphones', category: 'MOBILE', basePrice: 500, baseDemand: 0.9, icon: '🎧', maxStock: 50, suggestedMarkup: 0.4 },
    { name: 'Smart Watch', category: 'MOBILE', basePrice: 3000, baseDemand: 0.5, icon: '⌚', maxStock: 20, suggestedMarkup: 0.3 },
    { name: 'Phone Case', category: 'MOBILE', basePrice: 200, baseDemand: 0.85, icon: '📦', maxStock: 80, suggestedMarkup: 0.5 },
  ],
  RESTAURANT: [
    { name: 'Rice Plate (Bhat)', category: 'RESTAURANT', basePrice: 40, baseDemand: 1.0, icon: '🍚', maxStock: 200, suggestedMarkup: 0.6 },
    { name: 'Chicken Curry', category: 'RESTAURANT', basePrice: 120, baseDemand: 0.9, icon: '🍗', maxStock: 100, suggestedMarkup: 0.5 },
    { name: 'Fish Curry', category: 'RESTAURANT', basePrice: 100, baseDemand: 0.7, icon: '🐟', maxStock: 80, suggestedMarkup: 0.5 },
    { name: 'Dal (Lentil)', category: 'RESTAURANT', basePrice: 30, baseDemand: 0.85, icon: '🥘', maxStock: 150, suggestedMarkup: 0.55 },
    { name: 'Kacchi Biryani', category: 'RESTAURANT', basePrice: 200, baseDemand: 0.95, icon: '🍛', maxStock: 60, suggestedMarkup: 0.55 },
    { name: 'Roti/Naan', category: 'RESTAURANT', basePrice: 15, baseDemand: 0.9, icon: '🫓', maxStock: 300, suggestedMarkup: 0.6 },
  ],
};

export interface EventTemplate {
  title: string;
  description: string;
  type: string;
  icon: string;
  effects: Record<string, number>;
  durationDays: number;
  weight: number;
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    title: 'Eid Shopping Season!',
    description: 'Festive mood is high! People are buying new clothes and celebrating with family feasts.',
    type: 'SEASON',
    icon: '🕌',
    effects: { CLOTHING_demand: 0.4, RESTAURANT_demand: 0.2, MOBILE_demand: 0.1 },
    durationDays: 7,
    weight: 8,
  },
  {
    title: 'Heavy Rainfall Warning',
    description: 'Heavy rainfall across the region has reduced street traffic significantly.',
    type: 'WEATHER',
    icon: '🌧️',
    effects: { TEA_STALL_demand: -0.2, RESTAURANT_demand: -0.15, all_customers: -0.1 },
    durationDays: 3,
    weight: 6,
  },
  {
    title: 'Heatwave Alert!',
    description: 'Scorching heat has increased demand for cold drinks and beverages.',
    type: 'WEATHER',
    icon: '🔥',
    effects: { TEA_STALL_demand: -0.1, COLD_DRINKS_demand: 0.4, RESTAURANT_demand: -0.1 },
    durationDays: 4,
    weight: 5,
  },
  {
    title: 'Cricket World Cup Match!',
    description: 'Bangladesh is playing! Restaurants and food stalls see huge demand during match hours.',
    type: 'EVENT',
    icon: '🏏',
    effects: { RESTAURANT_demand: 0.35, TEA_STALL_demand: 0.25, GROCERY_demand: 0.1 },
    durationDays: 2,
    weight: 7,
  },
  {
    title: 'Dollar Rate Increases',
    description: 'The taka has weakened against the dollar. Import costs for electronics are rising.',
    type: 'ECONOMIC',
    icon: '💵',
    effects: { MOBILE_price: 0.2, ELECTRONICS_price: 0.15, all_imported: 0.1 },
    durationDays: 5,
    weight: 6,
  },
  {
    title: 'Supply Chain Disruption',
    description: 'Transport strikes have caused supply shortages across the country.',
    type: 'SUPPLY',
    icon: '🚚',
    effects: { all_price: 0.15, all_demand: 0.1 },
    durationDays: 3,
    weight: 4,
  },
  {
    title: 'Puja Festival',
    description: 'Hindu festival celebrations boost clothing and restaurant demand.',
    type: 'SEASON',
    icon: '🪔',
    effects: { CLOTHING_demand: 0.3, RESTAURANT_demand: 0.25 },
    durationDays: 5,
    weight: 6,
  },
  {
    title: 'Winter Season Arrival',
    description: 'Winter is here! Demand for warm clothing and hot beverages increases.',
    type: 'SEASON',
    icon: '❄️',
    effects: { CLOTHING_demand: 0.2, WINTER_CLOTHING_demand: 0.5, TEA_STALL_demand: 0.15 },
    durationDays: 10,
    weight: 7,
  },
  {
    title: 'Economic Boom',
    description: 'The economy is growing! Consumer spending is up across all sectors.',
    type: 'ECONOMIC',
    icon: '📈',
    effects: { all_demand: 0.15, all_customers: 0.1 },
    durationDays: 7,
    weight: 3,
  },
  {
    title: 'Flood Warning',
    description: 'Flooding in low-lying areas has disrupted business operations.',
    type: 'WEATHER',
    icon: '🌊',
    effects: { all_customers: -0.25, all_price: 0.1, GROCERY_demand: 0.2 },
    durationDays: 4,
    weight: 3,
  },
  {
    title: 'New iPhone Launch',
    description: 'Apple has launched a new iPhone! Demand for premium smartphones is surging.',
    type: 'EVENT',
    icon: '📱',
    effects: { MOBILE_demand: 0.3, PREMIUM_MOBILE_demand: 0.5 },
    durationDays: 5,
    weight: 5,
  },
  {
    title: 'University Admissions Season',
    description: 'Students are flocking to cities for university admissions. Tea stalls and food businesses benefit.',
    type: 'EVENT',
    icon: '🎓',
    effects: { TEA_STALL_demand: 0.3, RESTAURANT_demand: 0.2, GROCERY_demand: 0.1 },
    durationDays: 7,
    weight: 5,
  },
];

export interface EmployeeRoleDef {
  role: string;
  label: string;
  baseSalary: number;
  description: string;
  icon: string;
  effect: string;
}

export const EMPLOYEE_ROLES: EmployeeRoleDef[] = [
  { role: 'CASHIER', label: 'Cashier', baseSalary: 8000, description: 'Handles transactions and improves customer service speed.', icon: '💰', effect: 'revenue' },
  { role: 'SALESPERSON', label: 'Salesperson', baseSalary: 10000, description: 'Helps customers and increases sales conversion.', icon: '🤝', effect: 'customers' },
  { role: 'MANAGER', label: 'Manager', baseSalary: 20000, description: 'Improves overall business efficiency and reputation.', icon: '👔', effect: 'reputation' },
  { role: 'CLEANER', label: 'Cleaner', baseSalary: 6000, description: 'Maintains cleanliness and hygiene standards.', icon: '🧹', effect: 'reputation' },
  { role: 'DELIVERY_RIDER', label: 'Delivery Rider', baseSalary: 12000, description: 'Enables delivery service and expands customer reach.', icon: '🏍️', effect: 'customers' },
];

export const STARTING_CASH = 500000;

export const GAME_CONFIG = {
  tickIntervalMinutes: 1,
  baseRentPerLevel: 1.15,
  reputationDecay: 0.5,
  reputationGainService: 2,
  reputationLossStockout: 3,
  reputationLossPrice: 1,
  maxEmployees: 5,
  minReputation: 0,
  maxReputation: 100,
  utilityCost: 2000,
  taxRate: 0.05,
  employeeEfficiencyPerSkill: 0.05,
  reputationCustomerMultiplier: 0.005,
};

export const BANGLADESI_NAMES_FIRST = [
  'Rahim', 'Karim', 'Jamal', 'Kamal', 'Habib', 'Nasir', 'Shafiq', 'Mizan', 'Faisal', 'Arif',
  'Tanvir', 'Sakib', 'Rakib', 'Nayeem', 'Imran', 'Sohel', 'Jahangir', 'Babul', 'Mamun', 'Ashraf',
  'Fatima', 'Nusrat', 'Taslima', 'Shamima', 'Rabeya', 'Ayesha', 'Nadia', 'Sumaiya', 'Ruma', 'Mitu',
];

export const BANGLADESI_NAMES_LAST = [
  'Khan', 'Hossain', 'Islam', 'Rahman', 'Uddin', 'Mia', 'Ali', 'Begum', 'Akter', 'Sultana',
  'Chowdhury', 'Das', 'Saha', 'Paul', 'Barman', 'Sheikh', 'Talukder', 'Molla', 'Pramanik', 'Mandal',
];

export function getRandomName(): string {
  const first = BANGLADESI_NAMES_FIRST[Math.floor(Math.random() * BANGLADESI_NAMES_FIRST.length)];
  const last = BANGLADESI_NAMES_LAST[Math.floor(Math.random() * BANGLADESI_NAMES_LAST.length)];
  return `${first} ${last}`;
}

export function formatTaka(amount: number): string {
  if (amount >= 10000000) {
    return `৳ ${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `৳ ${(amount / 100000).toFixed(2)} Lakh`;
  }
  return `৳ ${amount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatTakaShort(amount: number): string {
  if (amount >= 10000000) return `৳${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `৳${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `৳${(amount / 1000).toFixed(1)}K`;
  return `৳${amount.toFixed(0)}`;
}

export function getBusinessType(id: string): BusinessType | undefined {
  return BUSINESS_TYPES.find(b => b.id === id);
}

export function getCity(id: string): City | undefined {
  return CITIES.find(c => c.id === id);
}

export function getProductsForBusiness(type: string): ProductDef[] {
  return PRODUCTS[type] || [];
}

export function getAllProducts(): ProductDef[] {
  return Object.values(PRODUCTS).flat();
}

export function getEmployeeRole(role: string): EmployeeRoleDef | undefined {
  return EMPLOYEE_ROLES.find(r => r.role === role);
}

export function getRiskColor(risk: string): string {
  switch (risk) {
    case 'Low': return 'text-green-600 bg-green-50 border-green-200';
    case 'Medium': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'High': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

export function getProfitColor(profit: 'Low' | 'Medium' | 'High'): string {
  switch (profit) {
    case 'Low': return 'text-gray-500';
    case 'Medium': return 'text-green-600';
    case 'High': return 'text-emerald-600';
    default: return 'text-gray-500';
  }
}

export function getDifficultyColor(difficulty: 'Easy' | 'Medium' | 'Hard'): string {
  switch (difficulty) {
    case 'Easy': return 'text-green-600';
    case 'Medium': return 'text-amber-600';
    case 'Hard': return 'text-red-600';
    default: return 'text-gray-600';
  }
}
