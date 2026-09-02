// ============================================
// Bangladesh Business Tycoon - Game Engine (Optimized)
// Server-authoritative economy simulation
// ============================================

import { db } from './db';
import {
  GAME_CONFIG, EVENT_TEMPLATES, PRODUCTS, CITIES, BUSINESS_TYPES, EMPLOYEE_ROLES,
  getRandomName, getCity, getBusinessType
} from './game-data';
import type { EventTemplate } from './game-data';

// ---- Event Generation ----

export async function generateEvent(): Promise<void> {
  const totalWeight = EVENT_TEMPLATES.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;

  let selected: EventTemplate | null = null;
  for (const event of EVENT_TEMPLATES) {
    random -= event.weight;
    if (random <= 0) {
      selected = event;
      break;
    }
  }

  if (!selected) selected = EVENT_TEMPLATES[0];

  const now = new Date();
  // 1 game day = 1 real minute, so durationDays * 60 * 1000 ms
  const endAt = new Date(now.getTime() + selected.durationDays * 60 * 1000);

  await db.gameEvent.create({
    data: {
      title: selected.title,
      description: selected.description,
      type: selected.type,
      effects: JSON.stringify(selected.effects),
      active: true,
      startsAt: now,
      endsAt: endAt,
    },
  });
}

// ---- Market Price Updates (Batch) ----

export async function updateMarketPrices(): Promise<void> {
  const allProducts = Object.values(PRODUCTS).flat();
  const cities = CITIES.map(c => c.id);

  // Generate all updates in memory
  const updates: { productName: string; city: string; priceMultiplier: number; demandMultiplier: number }[] = [];

  for (const city of cities) {
    for (const product of allProducts) {
      const priceFluctuation = 1 + (Math.random() - 0.5) * 0.1;
      const demandFluctuation = 1 + (Math.random() - 0.5) * 0.1;
      updates.push({
        productName: product.name,
        city,
        priceMultiplier: priceFluctuation,
        demandMultiplier: demandFluctuation,
      });
    }
  }

  // Batch update in a transaction
  await db.$transaction(async (tx) => {
    for (const upd of updates) {
      await tx.marketPrice.upsert({
        where: { productName_city: { productName: upd.productName, city: upd.city } },
        create: upd,
        update: { priceMultiplier: upd.priceMultiplier, demandMultiplier: upd.demandMultiplier, updatedAt: new Date() },
      });
    }
  });
}

// ---- Apply Event Effects to Market (Simplified) ----

export async function applyEventEffects(): Promise<void> {
  const activeEvents = await db.gameEvent.findMany({ where: { active: true } });
  if (activeEvents.length === 0) return;

  // Collect all effect modifiers per category
  const categoryPriceMod: Record<string, number> = {};
  const categoryDemandMod: Record<string, number> = {};
  let allPriceMod = 0;
  let allDemandMod = 0;

  for (const event of activeEvents) {
    const effects = JSON.parse(event.effects) as Record<string, number>;
    for (const [key, value] of Object.entries(effects)) {
      if (key === 'all_price' || key === 'all_imported') allPriceMod += value;
      if (key === 'all_demand') allDemandMod += value;
      if (key.endsWith('_price')) {
        const cat = key.replace('_price', '');
        categoryPriceMod[cat] = (categoryPriceMod[cat] || 0) + value;
      }
      if (key.endsWith('_demand')) {
        const cat = key.replace('_demand', '');
        categoryDemandMod[cat] = (categoryDemandMod[cat] || 0) + value;
      }
    }

    // Check if event has ended
    if (new Date() > event.endsAt) {
      await db.gameEvent.update({ where: { id: event.id }, data: { active: false } });
    }
  }

  // Apply modifiers to market prices in batch
  const allProducts = Object.values(PRODUCTS).flat();
  const cities = CITIES.map(c => c.id);

  await db.$transaction(async (tx) => {
    for (const city of cities) {
      for (const product of allProducts) {
        let priceMod = allPriceMod + (categoryPriceMod[product.category] || 0);
        let demandMod = allDemandMod + (categoryDemandMod[product.category] || 0);

        // Product-specific effects
        if (categoryDemandMod['COLD_DRINKS'] && (product.name.includes('Cold') || product.name.includes('Drink') || product.name.includes('Soft'))) {
          demandMod += categoryDemandMod['COLD_DRINKS'];
        }
        if (categoryDemandMod['WINTER_CLOTHING'] && product.name.includes('Winter')) {
          demandMod += categoryDemandMod['WINTER_CLOTHING'];
        }
        if (categoryDemandMod['PREMIUM_MOBILE'] && product.name.includes('Premium')) {
          demandMod += categoryDemandMod['PREMIUM_MOBILE'];
        }

        if (priceMod !== 0 || demandMod !== 0) {
          await tx.marketPrice.upsert({
            where: { productName_city: { productName: product.name, city } },
            create: { productName: product.name, city, priceMultiplier: 1 + priceMod, demandMultiplier: 1 + demandMod },
            update: { priceMultiplier: { increment: priceMod * 0.05 }, demandMultiplier: { increment: demandMod * 0.05 }, updatedAt: new Date() },
          });
        }
      }
    }
  });
}

// ---- Customer Calculation ----

function calculateCustomers(
  businessType: NonNullable<ReturnType<typeof getBusinessType>>,
  city: NonNullable<ReturnType<typeof getCity>>,
  business: { reputation: number; level: number },
  inventories: { quantity: number; productName: string; sellPrice: number; purchasePrice: number }[],
  employeeCount: number,
  eventEffects: Record<string, number>
): number {
  let customers = businessType.baseCustomers;

  // City multiplier
  customers *= city.customerMultiplier;

  // Level bonus
  customers *= 1 + (business.level - 1) * 0.15;

  // Reputation multiplier (0-100 → 0.5-1.5)
  const repMultiplier = 0.5 + (business.reputation / 100) * 1.0;
  customers *= repMultiplier;

  // Stock availability multiplier
  const totalStock = inventories.reduce((sum, inv) => sum + inv.quantity, 0);
  const maxPossibleStock = Math.max(inventories.length * 50, 1);
  const stockRatio = Math.min(totalStock / maxPossibleStock, 1);
  customers *= 0.3 + stockRatio * 0.7;

  // Pricing check
  if (inventories.length > 0) {
    let highPriceCount = 0;
    for (const inv of inventories) {
      const markup = (inv.sellPrice - inv.purchasePrice) / Math.max(inv.purchasePrice, 1);
      if (markup > 0.8) highPriceCount++;
    }
    customers *= 1 - (highPriceCount / inventories.length) * 0.2;
  }

  // Employee effect
  customers *= 1 + employeeCount * 0.08;

  // Event effects
  const allCustomersEffect = eventEffects['all_customers'] || 0;
  const businessDemandEffect = eventEffects[`${businessType.id}_demand`] || 0;
  customers *= 1 + allCustomersEffect + businessDemandEffect;

  // Random variation
  customers *= 0.9 + Math.random() * 0.2;

  return Math.max(0, Math.floor(customers));
}

// ---- Business Simulation Tick (Optimized) ----

export async function simulateBusinessTick(businessId: string): Promise<void> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: {
      inventories: true,
      employees: true,
      player: { select: { id: true, cash: true, netWorth: true } },
    },
  });

  if (!business) return;

  const businessType = getBusinessType(business.type);
  const city = getCity(business.city);
  if (!businessType || !city) return;

  // Get active event effects (combined)
  const activeEvents = await db.gameEvent.findMany({ where: { active: true }, select: { effects: true } });
  const combinedEffects: Record<string, number> = {};
  for (const event of activeEvents) {
    const effects = JSON.parse(event.effects) as Record<string, number>;
    for (const [key, value] of Object.entries(effects)) {
      combinedEffects[key] = (combinedEffects[key] || 0) + value;
    }
  }

  // Calculate customers
  const customers = calculateCustomers(
    businessType,
    city,
    business,
    business.inventories,
    business.employees.length,
    combinedEffects
  );

  // Calculate revenue and consume inventory
  let totalRevenue = 0;
  const inventoryUpdates: { id: string; quantityDecrement: number }[] = [];

  for (const inventory of business.inventories) {
    if (inventory.quantity <= 0) continue;

    const productDef = Object.values(PRODUCTS).flat().find(p => p.name === inventory.productName);
    if (!productDef) continue;

    // Market demand from events
    const eventDemand = combinedEffects[`${productDef.category}_demand`] || 0;
    const itemDemand = customers * productDef.baseDemand * (1 + eventDemand);
    const itemsToSell = Math.min(Math.floor(itemDemand), inventory.quantity);

    if (itemsToSell > 0) {
      totalRevenue += itemsToSell * inventory.sellPrice;
      inventoryUpdates.push({ id: inventory.id, quantityDecrement: itemsToSell });
    }
  }

  // Calculate expenses
  const rent = businessType.rent * Math.pow(GAME_CONFIG.baseRentPerLevel, business.level - 1);
  const totalSalaries = business.employees.reduce((sum, emp) => sum + emp.salary, 0);
  const utilities = GAME_CONFIG.utilityCost * business.level;
  const taxes = totalRevenue * GAME_CONFIG.taxRate;
  const totalExpense = rent + totalSalaries + utilities + taxes;
  const dailyProfit = totalRevenue - totalExpense;

  // Calculate reputation change
  let reputationChange = 0;
  const outOfStockCount = business.inventories.filter(inv => inv.quantity <= 0).length;
  if (outOfStockCount > 0 && business.inventories.length > 0) {
    reputationChange -= GAME_CONFIG.reputationLossStockout * (outOfStockCount / business.inventories.length);
  }
  if (dailyProfit > 0) reputationChange += GAME_CONFIG.reputationGainService * 0.3;
  const managers = business.employees.filter(e => e.role === 'MANAGER');
  const cleaners = business.employees.filter(e => e.role === 'CLEANER');
  reputationChange += managers.reduce((sum, m) => sum + m.skill * 0.1, 0);
  reputationChange += cleaners.reduce((sum, c) => sum + c.skill * 0.05, 0);
  reputationChange -= GAME_CONFIG.reputationDecay * 0.2;

  const newReputation = Math.max(
    GAME_CONFIG.minReputation,
    Math.min(GAME_CONFIG.maxReputation, business.reputation + reputationChange)
  );

  // Execute all updates in a transaction
  await db.$transaction(async (tx) => {
    // Update inventory quantities
    for (const upd of inventoryUpdates) {
      await tx.inventory.update({
        where: { id: upd.id },
        data: { quantity: { decrement: upd.quantityDecrement } },
      });
    }

    // Update business
    await tx.business.update({
      where: { id: business.id },
      data: {
        dailyRevenue: totalRevenue,
        dailyExpense: totalExpense,
        dailyProfit,
        cash: business.cash + dailyProfit,
        totalRevenue: business.totalRevenue + totalRevenue,
        totalProfit: business.totalProfit + dailyProfit,
        reputation: newReputation,
      },
    });

    // Update player cash
    await tx.player.update({
      where: { id: business.playerId },
      data: { cash: { increment: dailyProfit } },
    });

    // Log
    await tx.gameLog.create({
      data: {
        playerId: business.playerId,
        businessId: business.id,
        type: dailyProfit >= 0 ? 'PROFIT' : 'LOSS',
        message: `${business.name}: Rev ৳${totalRevenue.toLocaleString()} | Exp ৳${totalExpense.toLocaleString()} | ${dailyProfit >= 0 ? 'Profit' : 'Loss'} ৳${Math.abs(dailyProfit).toLocaleString()} | ${customers} customers`,
        amount: dailyProfit,
      },
    });
  });

  // Update net worth (separate query, not critical for consistency)
  const allBusinesses = await db.business.findMany({ where: { playerId: business.playerId }, select: { cash: true } });
  const totalBusinessCash = allBusinesses.reduce((sum, b) => sum + b.cash, 0);
  const totalInventoryValue = (await db.inventory.findMany({
    where: { business: { playerId: business.playerId } },
    select: { quantity: true, purchasePrice: true },
  })).reduce((sum, inv) => sum + inv.quantity * inv.purchasePrice, 0);

  const player = await db.player.findUnique({ where: { id: business.playerId } });
  if (player) {
    await db.player.update({
      where: { id: business.playerId },
      data: { netWorth: player.cash + totalBusinessCash + totalInventoryValue },
    });
  }
}

// ---- Loan Payment Processing ----

async function processLoanPayments(): Promise<void> {
  const activeLoans = await db.loan.findMany({
    where: { status: 'ACTIVE' },
  });

  if (activeLoans.length === 0) return;

  for (const loan of activeLoans) {
    const payment = loan.dailyPayment;

    const isPaidOff = loan.daysRemaining - 1 <= 0;
    const actualPayment = isPaidOff ? loan.remainingDebt : payment;

    await db.$transaction(async (tx) => {
      // Deduct payment from player cash
      const player = await tx.player.findUnique({ where: { id: loan.playerId }, select: { cash: true } });
      if (!player) return;

      const deductAmount = Math.min(actualPayment, player.cash);
      const newRemainingDebt = Math.max(loan.remainingDebt - deductAmount, 0);

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          remainingDebt: newRemainingDebt,
          daysRemaining: Math.max(loan.daysRemaining - 1, 0),
          status: (isPaidOff || newRemainingDebt <= 0) ? 'PAID_OFF' : 'ACTIVE',
        },
      });

      await tx.player.update({
        where: { id: loan.playerId },
        data: { cash: { decrement: deductAmount } },
      });

      await tx.gameLog.create({
        data: {
          playerId: loan.playerId,
          type: (isPaidOff || newRemainingDebt <= 0) ? 'LOAN_PAID' : 'LOAN_PAYMENT',
          message: (isPaidOff || newRemainingDebt <= 0)
            ? `Loan of ৳${loan.amount.toLocaleString()} fully repaid! Final deduction: ৳${Math.round(deductAmount).toLocaleString()}`
            : `Loan payment: ৳${Math.round(deductAmount).toLocaleString()} deducted. Remaining debt: ৳${Math.round(newRemainingDebt).toLocaleString()} (${loan.daysRemaining - 1} days left)`,
          amount: -deductAmount,
        },
      });
    });
  }
}

// ---- Full Game Tick ----

export async function gameTick(): Promise<void> {
  // 0. Expire old events first
  await db.gameEvent.updateMany({
    where: { active: true, endsAt: { lt: new Date() } },
    data: { active: false },
  });

  // 1. Generate new events (20% chance)
  if (Math.random() < 0.2) {
    await generateEvent();
  }

  // 2. Update market prices (only every 3 ticks to save performance)
  const tickState = await db.gameState.findUnique({ where: { key: 'tickCount' } });
  const tickNum = parseInt(tickState?.value || '0');
  if (tickNum % 3 === 0) {
    await updateMarketPrices();
    await applyEventEffects();
  }

  // 3. Simulate all businesses
  const businesses = await db.business.findMany({ select: { id: true } });
  for (const business of businesses) {
    await simulateBusinessTick(business.id);
  }

  // 3.5 Process loan payments (safe - skip if model unavailable)
  try {
    await processLoanPayments();
  } catch {
    // Loan model may not be available yet
  }

  // 4. Simulate AI player activity
  await simulateAITick();

  // 5. Generate news (50% chance)
  if (Math.random() < 0.5) {
    await generateNews();
  }

  // 6. Update game state
  const now = new Date().toISOString();
  await db.gameState.upsert({
    where: { key: 'lastTick' },
    create: { key: 'lastTick', value: now },
    update: { value: now },
  });

  await db.gameState.upsert({
    where: { key: 'tickCount' },
    create: { key: 'tickCount', value: '1' },
    update: { value: String(tickNum + 1) },
  });

  const dayState = await db.gameState.findUnique({ where: { key: 'gameDay' } });
  await db.gameState.upsert({
    where: { key: 'gameDay' },
    create: { key: 'gameDay', value: '1' },
    update: { value: String(parseInt(dayState?.value || '0') + 1) },
  });
}

// ---- News Generation ----

async function generateNews(): Promise<void> {
  const newsTemplates = [
    { title: 'Market Update: Rice prices {direction} in {city}', category: 'MARKET' },
    { title: 'Business Report: {business_type} sector showing {trend}', category: 'BUSINESS' },
    { title: 'Economic Outlook: Consumer confidence {direction}', category: 'ECONOMY' },
    { title: 'Weather Update: {weather} expected in {city} region', category: 'WEATHER' },
    { title: 'Trade News: Import costs for electronics {direction}', category: 'TRADE' },
  ];

  const randomCity = CITIES[Math.floor(Math.random() * CITIES.length)].name;
  const randomBusiness = BUSINESS_TYPES[Math.floor(Math.random() * BUSINESS_TYPES.length)].name;
  const direction = Math.random() > 0.5 ? 'increased' : 'decreased';
  const trend = Math.random() > 0.5 ? 'strong growth' : 'slight decline';
  const weatherOptions = ['heavy rain', 'clear skies', 'heatwave', 'mild weather', 'thunderstorms'];
  const weather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];

  const template = newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
  const title = template.title
    .replace('{city}', randomCity)
    .replace('{business_type}', randomBusiness)
    .replace('{direction}', direction)
    .replace('{trend}', trend)
    .replace('{weather}', weather);

  const contents: Record<string, string> = {
    MARKET: `Sources report that commodity prices have ${direction} in ${randomCity}. Traders are advising businesses to adjust their inventory strategies accordingly.`,
    BUSINESS: `The ${randomBusiness} sector is currently showing ${trend} according to industry analysts. Business owners should monitor market trends closely.`,
    ECONOMY: `Consumer confidence has ${direction} this quarter. Economic indicators suggest that spending patterns may shift in the coming days.`,
    WEATHER: `${weather.charAt(0).toUpperCase() + weather.slice(1)} conditions are expected in the ${randomCity} region. Businesses should prepare for potential changes in customer footfall.`,
    TRADE: `International trade reports indicate that import costs have ${direction}. This may affect pricing strategies for businesses dealing with imported goods.`,
  };

  await db.newsArticle.create({
    data: {
      title,
      content: contents[template.category] || contents['ECONOMY'],
      category: template.category,
    },
  });

  // Keep only last 50 news articles
  const totalNews = await db.newsArticle.count();
  if (totalNews > 50) {
    const oldNews = await db.newsArticle.findMany({ orderBy: { createdAt: 'asc' }, take: totalNews - 50, select: { id: true } });
    const ids = oldNews.map(n => n.id);
    await db.newsArticle.deleteMany({ where: { id: { in: ids } } });
  }
}

// ---- Seed Data ----

export async function seedInitialData(): Promise<void> {
  // Seed products
  const allProducts = Object.values(PRODUCTS).flat();
  for (const product of allProducts) {
    await db.product.upsert({
      where: { name: product.name },
      create: { name: product.name, category: product.category, basePrice: product.basePrice, baseDemand: product.baseDemand, icon: product.icon },
      update: {},
    });
  }

  // Seed initial market prices
  const cities = CITIES.map(c => c.id);
  for (const city of cities) {
    for (const product of allProducts) {
      await db.marketPrice.upsert({
        where: { productName_city: { productName: product.name, city } },
        create: { productName: product.name, city, priceMultiplier: 1, demandMultiplier: 1 },
        update: {},
      });
    }
  }

  // Game state
  await db.gameState.upsert({ where: { key: 'lastTick' }, create: { key: 'lastTick', value: new Date().toISOString() }, update: {} });
  await db.gameState.upsert({ where: { key: 'tickCount' }, create: { key: 'tickCount', value: '0' }, update: {} });
  await db.gameState.upsert({ where: { key: 'gameDay' }, create: { key: 'gameDay', value: '1' }, update: {} });

  // Generate initial news
  for (let i = 0; i < 5; i++) {
    await generateNews();
  }

  // Generate initial event
  await generateEvent();
}

// ---- Create AI Players for Leaderboard ----

export async function seedAIPlayers(): Promise<void> {
  const existingPlayers = await db.player.count();
  if (existingPlayers > 1) return;

  const aiNames = [
    { name: 'Rahim Enterprises', email: 'ai-rahim@game.local' },
    { name: 'Fatima Holdings', email: 'ai-fatima@game.local' },
    { name: 'Khan & Sons', email: 'ai-khan@game.local' },
    { name: 'Chowdhury Corp', email: 'ai-chowdhury@game.local' },
    { name: 'Sylhet Trading Co', email: 'ai-sylhet@game.local' },
    { name: 'Dhaka Business Group', email: 'ai-dhaka@game.local' },
    { name: 'Bengal Ventures', email: 'ai-bengal@game.local' },
    { name: 'Padma Industries', email: 'ai-padma@game.local' },
  ];

  for (const ai of aiNames) {
    const netWorth = 500000 + Math.random() * 3000000;
    await db.player.create({
      data: {
        name: ai.name,
        email: ai.email,
        cash: netWorth * 0.6,
        netWorth,
        level: Math.floor(Math.random() * 5) + 1,
      },
    });
  }

  // Create some AI businesses
  const aiPlayers = await db.player.findMany({ where: { email: { contains: 'ai-' } }, select: { id: true } });
  for (const player of aiPlayers) {
    const numBusinesses = Math.floor(Math.random() * 3) + 1;
    const usedTypes = new Set<string>();
    for (let i = 0; i < numBusinesses; i++) {
      let bType = BUSINESS_TYPES[Math.floor(Math.random() * BUSINESS_TYPES.length)];
      while (usedTypes.has(bType.id)) {
        bType = BUSINESS_TYPES[Math.floor(Math.random() * BUSINESS_TYPES.length)];
      }
      usedTypes.add(bType.id);

      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      await db.business.create({
        data: {
          playerId: player.id,
          type: bType.id,
          city: city.id,
          name: `${bType.name} - ${city.name}`,
          level: Math.floor(Math.random() * 3) + 1,
          reputation: 30 + Math.random() * 60,
          cash: Math.random() * 100000,
          dailyRevenue: 10000 + Math.random() * 50000,
          dailyExpense: 5000 + Math.random() * 25000,
          dailyProfit: 5000 + Math.random() * 25000,
          totalRevenue: Math.random() * 500000,
          totalProfit: Math.random() * 200000,
        },
      });
    }
  }
}

// ---- Generate AI Business Activity ----

export async function simulateAITick(): Promise<void> {
  const aiPlayers = await db.player.findMany({
    where: { email: { contains: 'ai-' } },
    select: { id: true },
  });

  if (aiPlayers.length === 0) return;

  await db.$transaction(async (tx) => {
    for (const player of aiPlayers) {
      const profitChange = (Math.random() - 0.4) * 20000;
      await tx.player.update({
        where: { id: player.id },
        data: {
          cash: { increment: profitChange },
          netWorth: { increment: profitChange * 0.8 },
        },
      });
    }
  });
}
