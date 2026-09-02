import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

type AchievementCategory = 'BUSINESS' | 'WEALTH' | 'SOCIAL' | 'MILESTONE';

interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
}

const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'FIRST_BUSINESS', name: 'First Steps', description: 'Create your first business', icon: '🏢', category: 'BUSINESS' },
  { id: 'FIVE_BUSINESSES', name: 'Business Mogul', description: 'Own 5 businesses', icon: '🏛️', category: 'BUSINESS' },
  { id: 'FIRST_PROFIT', name: 'First Profit', description: 'Earn your first positive profit day', icon: '💰', category: 'WEALTH' },
  { id: 'MILLIONAIRE', name: 'Millionaire', description: 'Reach ৳10 Lakh net worth', icon: '🤑', category: 'WEALTH' },
  { id: 'TEN_LAKH_CRORE', name: 'Crorepati', description: 'Reach ৳1 Crore net worth', icon: '👑', category: 'WEALTH' },
  { id: 'HIRE_STAFF', name: 'Team Builder', description: 'Hire your first employee', icon: '👥', category: 'SOCIAL' },
  { id: 'PERFECT_REP', name: 'Five Star', description: 'Reach 100% reputation on any business', icon: '⭐', category: 'SOCIAL' },
  { id: 'MULTI_CITY', name: 'National Presence', description: 'Own businesses in 3+ cities', icon: '🗺️', category: 'BUSINESS' },
  { id: 'DAY_30', name: 'Month in Business', description: 'Survive 30 game days', icon: '📅', category: 'MILESTONE' },
  { id: 'DAY_100', name: 'Seasoned Tycoon', description: 'Survive 100 game days', icon: '🧓', category: 'MILESTONE' },
  { id: 'PROFIT_50K', name: 'Profit Machine', description: 'Earn ৳50,000 daily profit', icon: '📈', category: 'WEALTH' },
  { id: 'ALL_TYPES', name: 'Diversified', description: 'Own all 5 business types', icon: '🎯', category: 'BUSINESS' },
];

export async function GET() {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const player = await db.player.findUnique({
      where: { id: playerId },
      include: {
        businesses: {
          include: {
            _count: {
              select: { employees: true, inventories: true },
            },
          },
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Fetch game state for current game day
    const gameState = await db.gameState.findUnique({
      where: { key: 'gameDay' },
    });
    const gameDay = gameState ? parseInt(gameState.value, 10) : 1;

    const businesses = player.businesses;
    const businessCount = businesses.length;
    const totalEmployees = businesses.reduce((sum, b) => sum + b._count.employees, 0);
    const uniqueCities = new Set(businesses.map((b) => b.city));
    const uniqueTypes = new Set(businesses.map((b) => b.type));
    const maxDailyProfit = businesses.length > 0
      ? Math.max(...businesses.map((b) => b.dailyProfit))
      : 0;
    const maxReputation = businesses.length > 0
      ? Math.max(...businesses.map((b) => b.reputation))
      : 0;
    const hasAnyProfit = businesses.some((b) => b.totalProfit > 0);

    const unlockedSet = new Set<string>();

    if (businessCount >= 1) unlockedSet.add('FIRST_BUSINESS');
    if (businessCount >= 5) unlockedSet.add('FIVE_BUSINESSES');
    if (hasAnyProfit) unlockedSet.add('FIRST_PROFIT');
    if (player.netWorth >= 1000000) unlockedSet.add('MILLIONAIRE');
    if (player.netWorth >= 10000000) unlockedSet.add('TEN_LAKH_CRORE');
    if (totalEmployees >= 1) unlockedSet.add('HIRE_STAFF');
    if (maxReputation >= 100) unlockedSet.add('PERFECT_REP');
    if (uniqueCities.size >= 3) unlockedSet.add('MULTI_CITY');
    if (gameDay >= 30) unlockedSet.add('DAY_30');
    if (gameDay >= 100) unlockedSet.add('DAY_100');
    if (maxDailyProfit >= 50000) unlockedSet.add('PROFIT_50K');
    if (uniqueTypes.size >= 5) unlockedSet.add('ALL_TYPES');

    const result = ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: unlockedSet.has(a.id),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get achievements error:', error);
    return NextResponse.json(
      { error: 'Failed to get achievements' },
      { status: 500 }
    );
  }
}
