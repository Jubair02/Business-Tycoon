// ============================================
// Bangladesh Business Tycoon - Bangla messages
// ============================================
//
// Typed against `Catalogue`, so this file cannot fall behind English without
// failing the build.
//
// Translation notes:
// - Business vocabulary in Bangladesh is heavily code-mixed. Words like দোকান,
//   লাভ and ভাড়া are the natural ones; "reputation", "portfolio" and "prestige"
//   are routinely said in English even in Bangla speech, so they are kept as
//   সুনাম / পোর্টফোলিও / প্রেস্টিজ rather than forced into unfamiliar coinages.
// - Numbers are not written into these strings. `Intl` renders Bengali numerals
//   and the lakh/crore grouping from the locale tag, so {count} arrives already
//   formatted correctly.

import type { Catalogue } from './en';

export const bn: Catalogue = {
  // ---- Navigation ----
  'nav.dashboard': 'ড্যাশবোর্ড',
  'nav.dashboard.short': 'হোম',
  'nav.businesses': 'ব্যবসা',
  'nav.businesses.short': 'দোকান',
  'nav.market': 'বাজার',
  'nav.market.short': 'বাজার',
  'nav.bank': 'ব্যাংক',
  'nav.bank.short': 'ব্যাংক',
  'nav.ranks': 'র‍্যাংক',
  'nav.ranks.short': 'র‍্যাংক',
  'nav.more': 'আরও',
  'nav.more.short': 'আরও',
  'nav.tab.myShops': 'আমার দোকান',
  'nav.tab.portfolio': 'পোর্টফোলিও',
  'nav.tab.prices': 'দাম',
  'nav.tab.competition': 'প্রতিযোগিতা',
  'nav.tab.loans': 'ঋণ',
  'nav.tab.leaderboard': 'লিডারবোর্ড',
  'nav.tab.achievements': 'অর্জন',
  'nav.tab.news': 'খবর',
  'nav.tab.store': 'স্টোর',
  'nav.tab.classroom': 'ক্লাসরুম',
  'nav.tab.settings': 'সেটিংস',
  'nav.sectionLabel': 'বিভাগ',
  'nav.brand': 'বিডি টাইকুন',
  'nav.menu': 'গেম মেনু',

  // ---- Common actions ----
  'action.save': 'সংরক্ষণ',
  'action.saving': 'সংরক্ষণ হচ্ছে...',
  'action.cancel': 'বাতিল',
  'action.close': 'বন্ধ',
  'action.confirm': 'নিশ্চিত করুন',
  'action.back': 'ফিরে যান',
  'action.next': 'পরবর্তী',
  'action.skip': 'এড়িয়ে যান',
  'action.retry': 'আবার চেষ্টা করুন',
  'action.dismiss': 'সরান',
  'action.go': 'যান',
  'action.loading': 'লোড হচ্ছে…',

  // ---- Money and time ----
  'money.crore': '{value} কোটি',
  'money.lakh': '{value} লাখ',
  'time.day': { one: '{count} দিন', other: '{count} দিন' },
  'time.dayShort': 'দিন {count}',
  'time.justNow': 'এইমাত্র',
  'time.minutesAgo': { one: '{count} মিনিট আগে', other: '{count} মিনিট আগে' },
  'time.hoursAgo': { one: '{count} ঘণ্টা আগে', other: '{count} ঘণ্টা আগে' },

  // ---- Dashboard ----
  'dashboard.cash': 'নগদ',
  'dashboard.netWorth': 'মোট সম্পদ',
  'dashboard.dailyProfit': 'দৈনিক লাভ',
  'dashboard.businesses': { one: '{count} ব্যবসা', other: '{count} ব্যবসা' },
  'dashboard.level': 'লেভেল {level}',
  'dashboard.noBusinesses': 'আপনার এখনও কোনো ব্যবসা নেই।',
  'dashboard.openFirst': 'আপনার প্রথম দোকান খুলুন',

  // ---- Seasons ----
  'season.title': 'সিজন {number}',
  'season.daysLeft': { one: '{count} দিন বাকি', other: '{count} দিন বাকি' },
  'season.ended': 'সিজন শেষ',
  'season.progress': '{total} দিনের মধ্যে {day} দিন',
  'season.hallOfFame': 'হল অব ফেম',
  'season.prestige': 'প্রেস্টিজ',
  'season.badges': 'ব্যাজ',
  'season.seasonsPlayed': { one: '{count} সিজন খেলা হয়েছে', other: '{count} সিজন খেলা হয়েছে' },
  'season.bestFinish': 'সেরা ফলাফল',
  'season.rank': 'র‍্যাংক {rank}',
  'season.noHistory': 'আপনি এখনও কোনো সিজন শেষ করেননি।',
  'season.resetNotice':
    'সিজন শেষ হলে আপনার ব্যবসা সংরক্ষণাগারে চলে যায় এবং সবাই আবার {cash} দিয়ে শুরু করে। প্রেস্টিজ ও ব্যাজ চিরকাল আপনার — সেগুলো সাজসজ্জা খোলে, কখনও বাড়তি সুবিধা নয়।',

  // ---- Businesses ----
  'business.overview': 'সারসংক্ষেপ',
  'business.inventory': 'মজুদ',
  'business.analytics': 'বিশ্লেষণ',
  'business.cx': 'গ্রাহক',
  'business.marketing': 'বিপণন',
  'business.staff': 'কর্মী',
  'business.log': 'লগ',
  'business.settings': 'সেটিংস',
  'business.dailyRevenue': 'দৈনিক আয়',
  'business.dailyExpenses': 'দৈনিক খরচ',
  'business.reputation': 'সুনাম',
  'business.health': 'স্বাস্থ্য',
  'business.monthlyRent': 'মাসিক ভাড়া',
  'business.monthlyUtilities': 'মাসিক ইউটিলিটি',
  'business.buyStock': 'মাল কিনুন',
  'business.restockAll': 'সব মাল ভরুন',
  'business.shopManager': 'দোকান ম্যানেজার',
  'business.shopManagerHelp':
    'প্রতিদিন দোকান খোলার আগে আপনার নগদ থেকে আপনাআপনি তাক ভরে রাখবে।',
  'business.restockTrigger': 'মজুদ এর নিচে নামলে ভরুন',
  'business.restockTarget': 'যত পর্যন্ত ভরবে',
  'business.restockBudget': 'দৈনিক খরচের সীমা (ঐচ্ছিক)',
  'business.restockNoCap': 'সীমা নেই',
  'business.soldOut': 'মাল শেষ',

  // ---- Offline ----
  'offline.title': 'আপনি যখন ছিলেন না',
  'offline.daysPassed': {
    one: 'বাংলাদেশে {count} দিন পার হয়েছে।',
    other: 'বাংলাদেশে {count} দিন পার হয়েছে।',
  },
  'offline.takings': 'আয়',
  'offline.profit': 'লাভ',
  'offline.byShop': 'দোকান অনুযায়ী',
  'offline.tradedThenClosed': 'আপনার দোকান {traded} দিন চলেছে, তারপর {dormant} দিন বন্ধ ছিল।',
  'offline.capExplained':
    'একটি দোকান আপনাকে ছাড়া সর্বোচ্চ আট ঘণ্টা চলে। এরপর আপনি ফিরে না আসা পর্যন্ত বন্ধ থাকে — আয়ও হয় না, ভাড়াও লাগে না। এখন আবার খোলা হয়েছে।',
  'offline.soldOutCount': { one: '{count} দোকানের মাল শেষ', other: '{count} দোকানের মাল শেষ' },
  'offline.nothingTrading': 'আপনি না থাকাকালীন আপনার কোনো দোকান চালু ছিল না।',

  // ---- First week ----
  'firstWeek.title': 'আপনার প্রথম সপ্তাহ',
  'firstWeek.next': 'পরবর্তী: {step}',
  'firstWeek.expand': 'প্রথম সপ্তাহের গাইড খুলুন',
  'firstWeek.collapse': 'প্রথম সপ্তাহের গাইড বন্ধ করুন',
  'firstWeek.dismiss': 'প্রথম সপ্তাহের গাইড সরান',

  // ---- Settings ----
  'settings.language': 'ভাষা',
  'settings.languageHelp': 'সংখ্যা ও তারিখসহ পুরো ইন্টারফেস।',
  'settings.theme': 'থিম',
  'settings.account': 'অ্যাকাউন্ট',

  // ---- Errors ----
  'error.network': 'নেটওয়ার্ক সমস্যা। সংযোগ দেখে আবার চেষ্টা করুন।',
  'error.generic': 'কিছু একটা ভুল হয়েছে।',
  'error.notFound': 'পাওয়া যায়নি।',
  'error.insufficientFunds': 'যথেষ্ট নগদ নেই।',
};
