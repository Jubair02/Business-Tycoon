// ============================================
// Bangladesh Business Tycoon - Observances
// ============================================
//
// What happens in a Bangladeshi year, and what each one does to a shop.
//
// ---- Three kinds of date, and why the distinction is load-bearing ----
//
//   FIXED      A Gregorian or Bengali rule. 16 December is Victory Day, now and
//              in 2140. Computed, exact, no maintenance.
//
//   ESTIMATED  Derived from the tabular Hijri calendar. Correct to about a day,
//              because the real date is decided by a moon sighting committee
//              and not by arithmetic. Always rendered as a window.
//
//   CONFIRMED  Someone announced it. Beats the estimate whenever we have it.
//              See `confirmed.ts`.
//
// A calendar that prints an estimated Eid date in the same typeface as Victory
// Day is lying to the player by omission, so `certainty` travels with every
// resolved date and the UI is required to show it.
//
// ---- Names ----
//
// Names live here in both languages rather than in the message catalogue,
// matching how `BENGALI_MONTHS` and the city list already work: these are data
// about Bangladesh, not interface chrome, and a translator should not be able
// to rename Eid.

export type ObservanceKind =
  | 'NATIONAL'
  | 'ISLAMIC'
  | 'HINDU'
  | 'BUDDHIST'
  | 'CHRISTIAN'
  | 'CULTURAL'
  | 'SEASONAL';

export type Certainty = 'FIXED' | 'CONFIRMED' | 'ESTIMATED';

/** Business type ids, mirrored from `game-data.ts`. */
export type TradeId = 'TEA_STALL' | 'GROCERY' | 'CLOTHING' | 'MOBILE' | 'RESTAURANT';

export type ObservanceRule =
  /** A fixed Gregorian day: 16 December. */
  | { kind: 'GREGORIAN'; month: number; day: number }
  /** A fixed Bengali day, which the 2019 revision makes a fixed Gregorian one too. */
  | { kind: 'BENGALI'; month: number; day: number }
  /** A Hijri day. Estimated, unless confirmed. */
  | { kind: 'HIJRI'; month: number; day: number }
  /**
   * Announced, never computed.
   *
   * The Hindu lunisolar calendar needs tithi and solar-month calculations that
   * this module does not implement, and a plausible-looking wrong Durga Puja
   * date is worse than no date. Outside the confirmed table these are simply
   * not shown — see `confirmed.ts`.
   */
  | { kind: 'ANNOUNCED_ONLY' };

/**
 * What an observance does to demand, relative to the day it falls on.
 *
 * Windows are relative day offsets: `from: -25, to: -1` is the twenty-five days
 * before. That is the shape retail actually has here — nobody buys an Eid
 * panjabi *on* Eid, they buy it in the fortnight before, and on the day itself
 * the shutters are down.
 */
export interface DemandWindow {
  trade: TradeId | 'ALL';
  /** Relative day the window opens. Negative is before. */
  from: number;
  /** Relative day it closes, inclusive. */
  to: number;
  /** The multiplier at the strongest point. */
  peak: number;
  /**
   * `ramp` eases from 1.0 at `from` to `peak` at `peakAt`; `flat` holds `peak`
   * across the whole window.
   */
  shape?: 'ramp' | 'flat';
  /** Where the peak sits. Defaults to `to` for a ramp. */
  peakAt?: number;
}

export interface Observance {
  id: string;
  en: string;
  bn: string;
  kind: ObservanceKind;
  rule: ObservanceRule;
  /** A government holiday, as opposed to merely a date people mark. */
  publicHoliday: boolean;
  /** How many days it runs. Eid is three. */
  spanDays?: number;
  /** One line on what it means behind a counter. */
  tradeNote: string;
  tradeNoteBn: string;
  demand: DemandWindow[];
  /**
   * Set where a holiday's date has been changed by gazette rather than by
   * astronomy, so the reason a year differs is recorded rather than guessed at.
   */
  policyNote?: string;
}

// ============================================
// The year
// ============================================

export const OBSERVANCES: readonly Observance[] = [
  // ---- Ramadan and the two Eids: the commercial spine of the year ----
  {
    id: 'RAMADAN',
    // Named for the month, not the first day of it: this entry spans thirty
    // days, and "Ramadan begins x1.5" reads wrong on the twentieth of them.
    en: 'Ramadan',
    bn: 'রমজান',
    kind: 'ISLAMIC',
    rule: { kind: 'HIJRI', month: 9, day: 1 },
    publicHoliday: false,
    spanDays: 30,
    tradeNote: 'Grocery and iftar trade surge for a month; daytime tea falls away.',
    tradeNoteBn: 'এক মাস ধরে মুদি ও ইফতারের বিক্রি বাড়ে; দিনের বেলা চায়ের বিক্রি কমে।',
    demand: [
      { trade: 'GROCERY', from: 0, to: 29, peak: 1.5, shape: 'flat' },
      { trade: 'RESTAURANT', from: 0, to: 29, peak: 1.3, shape: 'flat' },
      // Fasting empties the stall by day and fills it after maghrib. The net is
      // slightly down, which is what stallholders report.
      { trade: 'TEA_STALL', from: 0, to: 29, peak: 0.85, shape: 'flat' },
      { trade: 'MOBILE', from: 0, to: 29, peak: 1.1, shape: 'flat' },
    ],
  },
  {
    id: 'EID_UL_FITR',
    en: 'Eid-ul-Fitr',
    bn: 'ঈদুল ফিতর',
    kind: 'ISLAMIC',
    rule: { kind: 'HIJRI', month: 10, day: 1 },
    publicHoliday: true,
    spanDays: 3,
    tradeNote: 'The biggest retail event of the year. Clothing peaks in the last ten days; shops shut on the day.',
    tradeNoteBn: 'বছরের সবচেয়ে বড় বিক্রির সময়। শেষ দশ দিনে পোশাকের বিক্রি সর্বোচ্চ; ঈদের দিন দোকান বন্ধ।',
    demand: [
      // Nothing else in the Bangladeshi retail year looks like this.
      { trade: 'CLOTHING', from: -25, to: -1, peak: 2.8, shape: 'ramp' },
      { trade: 'MOBILE', from: -12, to: -1, peak: 1.6, shape: 'ramp' },
      { trade: 'GROCERY', from: -7, to: -1, peak: 1.8, shape: 'ramp' },
      // The shutters come down for three days.
      { trade: 'CLOTHING', from: 0, to: 2, peak: 0.25, shape: 'flat' },
      { trade: 'MOBILE', from: 0, to: 2, peak: 0.3, shape: 'flat' },
      { trade: 'GROCERY', from: 0, to: 2, peak: 0.45, shape: 'flat' },
      // Except where people are out visiting.
      { trade: 'RESTAURANT', from: 0, to: 2, peak: 1.6, shape: 'flat' },
      { trade: 'TEA_STALL', from: 0, to: 2, peak: 1.45, shape: 'flat' },
    ],
  },
  {
    id: 'EID_UL_ADHA',
    en: 'Eid-ul-Adha',
    bn: 'ঈদুল আজহা',
    kind: 'ISLAMIC',
    rule: { kind: 'HIJRI', month: 12, day: 10 },
    publicHoliday: true,
    spanDays: 3,
    tradeNote: 'Spices and groceries move before it; restaurants empty while families eat qurbani at home.',
    tradeNoteBn: 'আগে মসলা ও মুদি বিক্রি বাড়ে; কোরবানির মাংস ঘরে খাওয়ায় রেস্তোরাঁ ফাঁকা থাকে।',
    demand: [
      { trade: 'GROCERY', from: -8, to: -1, peak: 1.7, shape: 'ramp' },
      { trade: 'CLOTHING', from: -14, to: -1, peak: 1.7, shape: 'ramp' },
      { trade: 'CLOTHING', from: 0, to: 2, peak: 0.3, shape: 'flat' },
      { trade: 'GROCERY', from: 0, to: 2, peak: 0.5, shape: 'flat' },
      // Everyone is eating at home, for days.
      { trade: 'RESTAURANT', from: 0, to: 3, peak: 0.5, shape: 'flat' },
      { trade: 'TEA_STALL', from: 0, to: 2, peak: 1.3, shape: 'flat' },
    ],
  },
  {
    id: 'SHAB_E_BARAT',
    en: 'Shab-e-Barat',
    bn: 'শবে বরাত',
    kind: 'ISLAMIC',
    rule: { kind: 'HIJRI', month: 8, day: 15 },
    publicHoliday: true,
    tradeNote: 'Flour, sugar and sweets sell for the night’s halwa and ruti.',
    tradeNoteBn: 'রাতের হালুয়া-রুটির জন্য আটা, চিনি ও মিষ্টির বিক্রি বাড়ে।',
    demand: [{ trade: 'GROCERY', from: -2, to: 0, peak: 1.45, shape: 'ramp' }],
  },
  {
    id: 'ASHURA',
    en: 'Ashura',
    bn: 'আশুরা',
    kind: 'ISLAMIC',
    rule: { kind: 'HIJRI', month: 1, day: 10 },
    publicHoliday: true,
    tradeNote: 'A public holiday; trade is quiet and solemn.',
    tradeNoteBn: 'সরকারি ছুটি; বেচাকেনা শান্ত থাকে।',
    demand: [{ trade: 'ALL', from: 0, to: 0, peak: 0.85, shape: 'flat' }],
  },
  {
    id: 'EID_E_MILADUNNABI',
    en: 'Eid-e-Miladunnabi',
    bn: 'ঈদে মিলাদুন্নবী',
    kind: 'ISLAMIC',
    rule: { kind: 'HIJRI', month: 3, day: 12 },
    publicHoliday: true,
    tradeNote: 'A public holiday with processions; food and tea move near them.',
    tradeNoteBn: 'মিছিলসহ সরকারি ছুটি; আশেপাশে খাবার ও চায়ের বিক্রি বাড়ে।',
    demand: [
      { trade: 'TEA_STALL', from: 0, to: 0, peak: 1.2, shape: 'flat' },
      { trade: 'RESTAURANT', from: 0, to: 0, peak: 1.15, shape: 'flat' },
    ],
  },

  // ---- National days ----
  {
    id: 'SHOHID_DIBOSH',
    en: 'Shohid Dibosh & International Mother Language Day',
    bn: 'শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস',
    kind: 'NATIONAL',
    rule: { kind: 'GREGORIAN', month: 2, day: 21 },
    publicHoliday: true,
    tradeNote: 'Crowds walk to the Shaheed Minar from before dawn. Tea and food sell; it is not a shopping day.',
    tradeNoteBn: 'ভোর থেকে শহীদ মিনারে মানুষের ঢল। চা ও খাবার চলে; কেনাকাটার দিন নয়।',
    demand: [
      { trade: 'TEA_STALL', from: 0, to: 0, peak: 1.35, shape: 'flat' },
      { trade: 'RESTAURANT', from: 0, to: 0, peak: 1.2, shape: 'flat' },
      { trade: 'CLOTHING', from: 0, to: 0, peak: 0.8, shape: 'flat' },
    ],
  },
  {
    id: 'INDEPENDENCE_DAY',
    en: 'Independence Day',
    bn: 'স্বাধীনতা দিবস',
    kind: 'NATIONAL',
    rule: { kind: 'GREGORIAN', month: 3, day: 26 },
    publicHoliday: true,
    tradeNote: 'Flags, parades and families out for the day.',
    tradeNoteBn: 'পতাকা, কুচকাওয়াজ আর পরিবার নিয়ে বেড়ানোর দিন।',
    demand: [
      { trade: 'RESTAURANT', from: 0, to: 0, peak: 1.4, shape: 'flat' },
      { trade: 'TEA_STALL', from: 0, to: 0, peak: 1.3, shape: 'flat' },
      { trade: 'CLOTHING', from: -3, to: 0, peak: 1.2, shape: 'ramp' },
    ],
  },
  {
    id: 'VICTORY_DAY',
    en: 'Victory Day',
    bn: 'বিজয় দিবস',
    kind: 'NATIONAL',
    rule: { kind: 'GREGORIAN', month: 12, day: 16 },
    publicHoliday: true,
    tradeNote: 'Winter, parades and a national holiday — strong day for food and tea.',
    tradeNoteBn: 'শীতকাল, কুচকাওয়াজ আর জাতীয় ছুটি — খাবার ও চায়ের ভালো দিন।',
    demand: [
      { trade: 'RESTAURANT', from: 0, to: 0, peak: 1.4, shape: 'flat' },
      { trade: 'TEA_STALL', from: 0, to: 0, peak: 1.35, shape: 'flat' },
      { trade: 'CLOTHING', from: -3, to: 0, peak: 1.2, shape: 'ramp' },
    ],
  },
  {
    id: 'MAY_DAY',
    en: 'May Day',
    bn: 'মে দিবস',
    kind: 'NATIONAL',
    rule: { kind: 'GREGORIAN', month: 5, day: 1 },
    publicHoliday: true,
    tradeNote: 'A public holiday; factories close and the streets are quieter.',
    tradeNoteBn: 'সরকারি ছুটি; কারখানা বন্ধ, রাস্তাঘাট শান্ত।',
    demand: [{ trade: 'ALL', from: 0, to: 0, peak: 0.9, shape: 'flat' }],
  },

  // ---- Bengali calendar ----
  {
    id: 'POHELA_BOISHAKH',
    en: 'Pohela Boishakh (Bengali New Year)',
    bn: 'পহেলা বৈশাখ',
    kind: 'CULTURAL',
    rule: { kind: 'BENGALI', month: 1, day: 1 },
    publicHoliday: true,
    tradeNote: 'Red-and-white everywhere. The year’s second-biggest clothing week, and the best single day for food stalls.',
    tradeNoteBn: 'চারদিকে লাল-সাদা। বছরের দ্বিতীয় বৃহত্তম পোশাক বিক্রির সপ্তাহ, আর খাবারের দোকানের সেরা দিন।',
    demand: [
      { trade: 'CLOTHING', from: -14, to: -1, peak: 2.2, shape: 'ramp' },
      { trade: 'GROCERY', from: -6, to: 0, peak: 1.4, shape: 'ramp' },
      // Panta-ilish and the Boishakhi melas.
      { trade: 'RESTAURANT', from: 0, to: 0, peak: 2.0, shape: 'flat' },
      { trade: 'TEA_STALL', from: 0, to: 0, peak: 1.8, shape: 'flat' },
      { trade: 'CLOTHING', from: 0, to: 0, peak: 1.3, shape: 'flat' },
    ],
  },
  {
    id: 'POHELA_FALGUN',
    en: 'Pohela Falgun (First day of spring)',
    bn: 'পহেলা ফাল্গুন',
    kind: 'CULTURAL',
    rule: { kind: 'BENGALI', month: 11, day: 1 },
    publicHoliday: false,
    tradeNote: 'Yellow saris and flowers. Since the 2019 calendar revision it shares the day with Valentine’s, which doubles the trade.',
    tradeNoteBn: 'হলুদ শাড়ি আর ফুল। ২০১৯ সালের পঞ্জিকা সংস্কারের পর ভ্যালেন্টাইনস ডে-র সঙ্গে একই দিনে পড়ায় বিক্রি দ্বিগুণ।',
    demand: [
      { trade: 'CLOTHING', from: -7, to: 0, peak: 1.6, shape: 'ramp' },
      { trade: 'RESTAURANT', from: 0, to: 0, peak: 1.5, shape: 'flat' },
      { trade: 'TEA_STALL', from: 0, to: 0, peak: 1.2, shape: 'flat' },
    ],
  },
  {
    id: 'NABANNA',
    en: 'Nabanna (Harvest festival)',
    bn: 'নবান্ন',
    kind: 'CULTURAL',
    rule: { kind: 'BENGALI', month: 8, day: 1 },
    publicHoliday: false,
    tradeNote: 'The new rice is in and harvest money reaches the villages.',
    tradeNoteBn: 'নতুন ধান ঘরে ওঠে, গ্রামে ফসলের টাকা আসে।',
    demand: [
      { trade: 'GROCERY', from: -2, to: 4, peak: 1.3, shape: 'flat' },
      { trade: 'RESTAURANT', from: 0, to: 2, peak: 1.2, shape: 'flat' },
    ],
  },

  // ---- Other faiths ----
  {
    id: 'DURGA_PUJA',
    en: 'Durga Puja (Bijoya Dashami)',
    bn: 'দুর্গাপূজা (বিজয়া দশমী)',
    kind: 'HINDU',
    rule: { kind: 'ANNOUNCED_ONLY' },
    publicHoliday: true,
    tradeNote: 'The largest Hindu festival here. Clothing and sweets move for a fortnight beforehand.',
    tradeNoteBn: 'এখানকার সবচেয়ে বড় হিন্দু উৎসব। আগের পক্ষকাল ধরে পোশাক ও মিষ্টি বিক্রি হয়।',
    demand: [
      { trade: 'CLOTHING', from: -15, to: -1, peak: 1.6, shape: 'ramp' },
      { trade: 'GROCERY', from: -7, to: 0, peak: 1.35, shape: 'ramp' },
      { trade: 'RESTAURANT', from: 0, to: 0, peak: 1.3, shape: 'flat' },
    ],
  },
  {
    id: 'JANMASHTAMI',
    en: 'Janmashtami',
    bn: 'জন্মাষ্টমী',
    kind: 'HINDU',
    rule: { kind: 'ANNOUNCED_ONLY' },
    publicHoliday: true,
    tradeNote: 'A public holiday with processions in the old city.',
    tradeNoteBn: 'পুরান ঢাকায় মিছিলসহ সরকারি ছুটি।',
    demand: [{ trade: 'GROCERY', from: -1, to: 0, peak: 1.2, shape: 'flat' }],
  },
  {
    id: 'BUDDHA_PURNIMA',
    en: 'Buddha Purnima',
    bn: 'বুদ্ধ পূর্ণিমা',
    kind: 'BUDDHIST',
    rule: { kind: 'ANNOUNCED_ONLY' },
    publicHoliday: true,
    tradeNote: 'A public holiday, strongest in Chattogram and the hill districts.',
    tradeNoteBn: 'সরকারি ছুটি, চট্টগ্রাম ও পার্বত্য জেলায় সবচেয়ে বেশি পালিত।',
    demand: [{ trade: 'RESTAURANT', from: 0, to: 0, peak: 1.15, shape: 'flat' }],
  },
  {
    id: 'CHRISTMAS',
    en: 'Christmas (Boro Din)',
    bn: 'বড়দিন',
    kind: 'CHRISTIAN',
    rule: { kind: 'GREGORIAN', month: 12, day: 25 },
    publicHoliday: true,
    tradeNote: 'A public holiday. Small congregation, but hotels and bakeries make a week of it.',
    tradeNoteBn: 'সরকারি ছুটি। খ্রিস্টান জনসংখ্যা কম হলেও হোটেল-বেকারিতে সপ্তাহভর বিক্রি চলে।',
    demand: [
      { trade: 'RESTAURANT', from: -2, to: 0, peak: 1.3, shape: 'ramp' },
      { trade: 'CLOTHING', from: -5, to: -1, peak: 1.15, shape: 'ramp' },
    ],
  },
  {
    id: 'ENGLISH_NEW_YEAR',
    en: 'English New Year',
    bn: 'ইংরেজি নববর্ষ',
    kind: 'CULTURAL',
    rule: { kind: 'GREGORIAN', month: 1, day: 1 },
    publicHoliday: false,
    tradeNote: 'Not a holiday here, but city restaurants have their night of the year.',
    tradeNoteBn: 'এখানে ছুটি নয়, তবে শহরের রেস্তোরাঁগুলোর জন্য বছরের সেরা রাত।',
    demand: [{ trade: 'RESTAURANT', from: -1, to: 0, peak: 1.5, shape: 'ramp' }],
  },
];

// ============================================
// Season-long effects
// ============================================
//
// Not events with a date, but the weather a shop trades in. Bangladesh has six
// seasons and a shopkeeper's year genuinely runs on them: Borsha empties the
// streets, Sheet fills them and sells blankets.

export interface SeasonalEffect {
  season: 'GRISHMO' | 'BORSHA' | 'SHARAT' | 'HEMANTA' | 'SHEET' | 'BOSONTO';
  trade: TradeId | 'ALL';
  multiplier: number;
  note: string;
}

export const SEASONAL_EFFECTS: readonly SeasonalEffect[] = [
  { season: 'GRISHMO', trade: 'TEA_STALL', multiplier: 1.1, note: 'Heat sells cold drinks and lemon tea.' },
  { season: 'GRISHMO', trade: 'CLOTHING', multiplier: 0.95, note: 'Light cottons only; a thin season for cloth.' },

  // Two months of rain is the quietest trading weather of the year.
  { season: 'BORSHA', trade: 'ALL', multiplier: 0.88, note: 'Waterlogged streets keep shoppers at home.' },
  { season: 'BORSHA', trade: 'TEA_STALL', multiplier: 1.12, note: 'Rain and tea go together; the stall shelters people.' },

  { season: 'SHARAT', trade: 'CLOTHING', multiplier: 1.08, note: 'Clear skies and the run-up to Puja.' },
  { season: 'HEMANTA', trade: 'GROCERY', multiplier: 1.12, note: 'Harvest money reaches the market.' },

  // Winter is the best quarter: weddings, tourism, comfortable streets.
  { season: 'SHEET', trade: 'CLOTHING', multiplier: 1.3, note: 'Warm clothes and the wedding season.' },
  { season: 'SHEET', trade: 'RESTAURANT', multiplier: 1.15, note: 'Wedding parties and winter picnics.' },
  { season: 'SHEET', trade: 'TEA_STALL', multiplier: 1.2, note: 'Cold mornings; everyone wants tea.' },

  { season: 'BOSONTO', trade: 'CLOTHING', multiplier: 1.1, note: 'Falgun colour and the new-year build-up.' },
];

export function observanceById(id: string): Observance | undefined {
  return OBSERVANCES.find(o => o.id === id);
}

/** The observances whose dates cannot be computed and must be announced. */
export const ANNOUNCED_ONLY_IDS: readonly string[] = OBSERVANCES.filter(
  o => o.rule.kind === 'ANNOUNCED_ONLY',
).map(o => o.id);
