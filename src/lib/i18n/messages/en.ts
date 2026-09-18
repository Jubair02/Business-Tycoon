// ============================================
// Bangladesh Business Tycoon - English messages
// ============================================
//
// This file is the source of truth for the message catalogue: its shape defines
// `MessageKey`, and every other locale is type-checked against it, so a missing
// or misspelled translation fails the build rather than silently rendering a
// key at a player.
//
// A value is either a plain string or a plural set. Plural sets are selected
// with `Intl.PluralRules`, so each locale gets the categories it actually
// has — English and Bangla both use `one`/`other`, but the mechanism does not
// assume that.
//
// Placeholders are `{name}`.

export const en = {
  // ---- Navigation ----
  'nav.dashboard': 'Dashboard',
  'nav.dashboard.short': 'Home',
  'nav.businesses': 'Businesses',
  'nav.businesses.short': 'Shops',
  'nav.market': 'Market',
  'nav.market.short': 'Market',
  'nav.bank': 'Bank',
  'nav.bank.short': 'Bank',
  'nav.ranks': 'Ranks',
  'nav.ranks.short': 'Ranks',
  'nav.more': 'More',
  'nav.more.short': 'More',
  'nav.tab.myShops': 'My shops',
  'nav.tab.portfolio': 'Portfolio',
  'nav.tab.prices': 'Prices',
  'nav.tab.competition': 'Competition',
  'nav.tab.loans': 'Loans',
  'nav.tab.leaderboard': 'Leaderboard',
  'nav.tab.achievements': 'Achievements',
  'nav.tab.news': 'News',
  'nav.tab.store': 'Store',
  'nav.tab.classroom': 'Classroom',
  'nav.tab.settings': 'Settings',
  'nav.sectionLabel': 'Section',
  'nav.brand': 'BD Tycoon',
  'nav.menu': 'Game Menu',

  // ---- Common actions ----
  'action.save': 'Save',
  'action.saving': 'Saving...',
  'action.cancel': 'Cancel',
  'action.close': 'Close',
  'action.confirm': 'Confirm',
  'action.back': 'Back',
  'action.next': 'Next',
  'action.skip': 'Skip',
  'action.retry': 'Try again',
  'action.dismiss': 'Dismiss',
  'action.go': 'Go',
  'action.loading': 'Loading…',

  // ---- Money and time ----
  'money.crore': '{value} Cr',
  'money.lakh': '{value} Lakh',
  'time.day': { one: '{count} day', other: '{count} days' },
  'time.dayShort': 'Day {count}',
  'time.justNow': 'Just now',
  'time.minutesAgo': { one: '{count}m ago', other: '{count}m ago' },
  'time.hoursAgo': { one: '{count}h ago', other: '{count}h ago' },

  // ---- Dashboard ----
  'dashboard.cash': 'Cash',
  'dashboard.netWorth': 'Net worth',
  'dashboard.dailyProfit': 'Daily profit',
  'dashboard.businesses': { one: '{count} business', other: '{count} businesses' },
  'dashboard.level': 'Level {level}',
  'dashboard.noBusinesses': 'You have no businesses yet.',
  'dashboard.openFirst': 'Open your first shop',

  // ---- Seasons ----
  'season.title': 'Season {number}',
  'season.daysLeft': { one: '{count} day left', other: '{count} days left' },
  'season.ended': 'Season ended',
  'season.progress': 'Day {day} of {total}',
  'season.hallOfFame': 'Hall of fame',
  'season.prestige': 'Prestige',
  'season.badges': 'Badges',
  'season.seasonsPlayed': { one: '{count} season played', other: '{count} seasons played' },
  'season.bestFinish': 'Best finish',
  'season.rank': 'Rank {rank}',
  'season.noHistory': 'You have not finished a season yet.',
  'season.resetNotice':
    'When the season ends your empire is archived and everyone starts again with {cash}. Prestige and badges are yours for good — they unlock cosmetics, never an advantage.',

  // ---- Businesses ----
  'business.overview': 'Overview',
  'business.inventory': 'Inventory',
  'business.analytics': 'Analytics',
  'business.cx': 'CX',
  'business.marketing': 'Marketing',
  'business.staff': 'Staff',
  'business.log': 'Log',
  'business.settings': 'Settings',
  'business.dailyRevenue': 'Daily revenue',
  'business.dailyExpenses': 'Daily expenses',
  'business.reputation': 'Reputation',
  'business.health': 'Health',
  'business.monthlyRent': 'Monthly rent',
  'business.monthlyUtilities': 'Monthly utilities',
  'business.buyStock': 'Buy stock',
  'business.restockAll': 'Restock all',
  'business.shopManager': 'Shop manager',
  'business.shopManagerHelp':
    "Keep this shop's shelves stocked automatically, out of your cash, before it opens each day.",
  'business.restockTrigger': 'Top up when stock falls below',
  'business.restockTarget': 'Refill to',
  'business.restockBudget': 'Daily spending cap (optional)',
  'business.restockNoCap': 'No cap',
  'business.soldOut': 'Sold out',

  // ---- Offline ----
  'offline.title': 'While you were away',
  'offline.daysPassed': { one: '{count} day passed in Bangladesh.', other: '{count} days passed in Bangladesh.' },
  'offline.takings': 'Takings',
  'offline.profit': 'Profit',
  'offline.byShop': 'By shop',
  'offline.tradedThenClosed': 'Your shops traded for {traded} days, then closed for {dormant}.',
  'offline.capExplained':
    'A shop runs unattended for up to eight hours. After that it shutters until you are back — it earns nothing, but it pays no rent either. They are open again now.',
  'offline.soldOutCount': { one: '{count} shop sold out', other: '{count} shops sold out' },
  'offline.nothingTrading': 'You had no shops trading while you were away.',

  // ---- First week ----
  'firstWeek.title': 'Your first week',
  'firstWeek.next': 'Next: {step}',
  'firstWeek.expand': 'Expand the first-week guide',
  'firstWeek.collapse': 'Collapse the first-week guide',
  'firstWeek.dismiss': 'Dismiss the first-week guide',

  // ---- Settings ----
  'settings.language': 'Language',
  'settings.languageHelp': 'The whole interface, including numbers and dates.',
  'settings.theme': 'Theme',
  'settings.account': 'Account',

  // ---- Errors ----
  'error.network': 'Network error. Check your connection and try again.',
  'error.generic': 'Something went wrong.',
  'error.notFound': 'Not found.',
  'error.insufficientFunds': 'Not enough cash.',
} as const;

/** Every message key in the catalogue. */
export type MessageKey = keyof typeof en;

/** A message is either a plain string or a set of plural forms. */
export type MessageValue = string | Partial<Record<Intl.LDMLPluralRule, string>>;

/**
 * The shape every locale has to satisfy.
 *
 * Written as a mapped type over `en`'s keys, so adding a message to English
 * breaks every other locale until it is translated. That is the point — the
 * previous state of affairs was untranslated strings shipping unnoticed.
 */
export type Catalogue = Record<MessageKey, MessageValue>;
