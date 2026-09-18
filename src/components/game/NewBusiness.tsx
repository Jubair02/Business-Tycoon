'use client';

import { useState, useMemo } from 'react';
import { ROUTES, businessRoute } from '@/lib/game-routes';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { formatTaka, formatTakaShort, BUSINESS_TYPES, CITIES, PRODUCTS, getRiskColor, getProfitColor, getDifficultyColor } from '@/lib/game-data';
import {
  getLocationsForCity, isBusinessTypeSuitable,
  calculateExpansionCost, calculateSetupDays, EXPANSION_CONFIG, getLocation,
} from '@/lib/game/expansion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowLeft, ArrowRight, Check, Wallet, MapPin, Type, CreditCard,
  Users, Zap, Package, TrendingUp, ShieldAlert, Building2, Sparkles,
  Navigation, Star, AlertTriangle, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api-error';

const STEPS = [
  { title: 'Type', icon: Zap },
  { title: 'City', icon: MapPin },
  { title: 'Location', icon: Navigation },
  { title: 'Name', icon: Type },
  { title: 'Pay', icon: CreditCard },
];

/** Shared shell for every selectable card in the wizard. Selection is
 *  signalled by border + edge + a check mark, never colour alone. */
function SelectCard({
  selected, onClick, children, ariaLabel,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={ariaLabel}
      className={cn(
        'bt-surface bt-interactive relative w-full overflow-hidden text-left',
        selected && 'bt-edge !border-[var(--bt-emerald)]',
      )}
      style={selected ? { boxShadow: 'var(--bt-shadow-glow)' } : undefined}
    >
      {selected && (
        <span
          className="absolute right-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-full text-white"
          style={{ background: 'linear-gradient(135deg, var(--bt-emerald-deep), var(--bt-emerald-bright))' }}
          aria-hidden="true"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  );
}

function StatChip({
  icon: Icon, label, tone,
}: {
  icon: React.ElementType;
  label: string;
  tone: 'emerald' | 'gold' | 'sky' | 'amber';
}) {
  return (
    <span className={cn('bt-tone bt-numeric inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold', `bt-tone-${tone}`)}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="space-y-2">
      {warnings.map((w, i) => (
        <li key={i} className="bt-tone bt-tone-amber flex items-start gap-2 rounded-xl p-3 text-xs font-medium">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {w}
        </li>
      ))}
    </ul>
  );
}

/** Step footer. Deliberately NOT sticky: the app's mobile nav is
 *  `fixed bottom-0 z-50`, so a sticky bar would sit underneath it.
 *  bt-page already reserves bottom padding to clear that nav. */
function StepNav({
  onBack, onNext, nextLabel, nextDisabled, nextNode,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextNode?: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--bt-hairline)] pt-4">
      {onBack ? (
        <Button variant="outline" className="bt-tap h-11 rounded-xl px-4" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
      ) : <span />}
      {nextNode ?? (
        <Button
          onClick={onNext}
          disabled={nextDisabled}
          className="bt-btn-primary bt-tap h-11 gap-1.5 rounded-xl px-5 font-semibold disabled:opacity-50"
        >
          {nextLabel || 'Next'} <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default function NewBusiness() {
  const router = useRouter();
  const { player, businesses, setBusinesses } = useGameStore();
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [creating, setCreating] = useState(false);

  const bt = BUSINESS_TYPES.find(b => b.id === selectedType);
  const city = CITIES.find(c => c.id === selectedCity);
  const loc = selectedLocation ? getLocation(selectedLocation) : null;

  const cityLocations = useMemo(() => {
    if (!selectedCity) return [];
    return getLocationsForCity(selectedCity);
  }, [selectedCity]);

  const costInfo = useMemo(() => {
    if (!bt) return null;
    return calculateExpansionCost(
      bt.investment,
      businesses.length,
      selectedLocation || '',
      selectedType || '',
    );
  }, [bt, businesses.length, selectedLocation, selectedType]);

  const totalCost = costInfo?.totalCost || bt?.investment || 0;
  const canAfford = (player?.cash || 0) >= totalCost;

  const setupDays = useMemo(() => {
    if (!bt) return 0;
    if (businesses.length === 0) return 0;
    return calculateSetupDays(bt.investment);
  }, [bt, businesses.length]);

  const autoSelectBestLocation = () => {
    if (!selectedType || cityLocations.length === 0) return;
    const scored = cityLocations.map(l => {
      const suitability = isBusinessTypeSuitable(l.id, selectedType);
      const suitScore = suitability === 'suitable' ? 3 : suitability === 'neutral' ? 2 : 1;
      return { id: l.id, score: suitScore + l.growthPotential + l.customerModifier - (l.rentModifier * 0.3) };
    });
    scored.sort((a, b) => b.score - a.score);
    setSelectedLocation(scored[0]?.id || null);
    toast.success('Picked the strongest location for this business type');
  };

  const expansionWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (businesses.length > 0) {
      const scalePercent = Math.round(businesses.length * EXPANSION_CONFIG.expansionCostScaleFactor * 100);
      warnings.push(`Expansion cost is ${scalePercent}% higher because you already own ${businesses.length} business${businesses.length > 1 ? 'es' : ''}`);
    }
    if (player && businesses.length >= EXPANSION_CONFIG.maxBusinessesPerPlayer) {
      warnings.push(`Maximum of ${EXPANSION_CONFIG.maxBusinessesPerPlayer} businesses reached`);
    }
    if (player && player.lastExpansionAt > 0) {
      warnings.push(`Expansion cooldown: ${EXPANSION_CONFIG.expansionCooldownDays} days between expansions`);
    }
    if (player && businesses.length >= 1) {
      const reqLevel = businesses.length === 1
        ? EXPANSION_CONFIG.minLevelForSecondBusiness
        : EXPANSION_CONFIG.minLevelForSecondBusiness + (businesses.length - 1) * EXPANSION_CONFIG.minLevelPerAdditionalBusiness;
      if (player.level < reqLevel) {
        warnings.push(`Level ${reqLevel} required for business #${businesses.length + 1}`);
      }
    }
    return warnings;
  }, [businesses.length, player]);

  const handleCreate = async () => {
    if (!selectedType || !selectedCity || !businessName.trim()) {
      toast.error('Please complete all steps');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          city: selectedCity,
          name: businessName.trim(),
          location: selectedLocation || undefined,
        }),
      });
      if (res.ok) {
        const business = await res.json();
        toast.success(`${businessName.trim()} created successfully!`);
        const busRes = await fetch('/api/businesses');
        if (busRes.ok) setBusinesses(await busRes.json());
        const pRes = await fetch('/api/player');
        if (pRes.ok) useGameStore.getState().setPlayer(await pRes.json());
        router.push(businessRoute(business.id));
      } else {
        const err = await res.json();
        toast.error(apiErrorMessage(err, 'Failed to create business'));
      }
    } catch {
      toast.error('Failed to create business');
    } finally {
      setCreating(false);
    }
  };

  const slide = {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
    transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
  };


  return (
    <div className="bt-page bt-page-narrow">
      {/* ─── Header ────────────────────────────────────────────── */}
      <header className="mb-5 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="bt-tap h-10 w-10 shrink-0 rounded-xl"
          onClick={() => (step === 0 ? router.push(ROUTES.dashboard) : setStep(step - 1))}
          aria-label={step === 0 ? 'Back to dashboard' : 'Previous step'}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 items-center gap-3">
          <span className="bt-tone bt-tone-emerald grid h-10 w-10 shrink-0 place-items-center rounded-xl">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">New Business</h1>
            <p className="text-xs text-muted-foreground">
              Step {step + 1} of {STEPS.length} · {STEPS[step].title}
            </p>
          </div>
        </div>
      </header>

      {/* ─── Step indicator ────────────────────────────────────── */}
      <nav aria-label="Progress" className="mb-6">
        <ol className="flex items-center gap-1.5 sm:gap-2">
          {STEPS.map((s, i) => {
            const StepIcon = s.icon;
            const isDone = i < step;
            const isCurrent = i === step;
            return (
              <li key={s.title} className="flex flex-1 items-center gap-1.5 sm:gap-2">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold transition-all duration-300',
                      !isDone && !isCurrent && 'bg-[var(--bt-surface-3)] text-muted-foreground',
                    )}
                    style={isDone || isCurrent ? {
                      background: 'linear-gradient(135deg, var(--bt-emerald-deep), var(--bt-emerald-bright))',
                      color: 'white',
                      boxShadow: isCurrent ? 'var(--bt-shadow-glow)' : 'var(--bt-shadow-sm)',
                    } : undefined}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : <StepIcon className="h-4 w-4" />}
                  </span>
                  <span
                    className={cn(
                      'hidden text-xs font-semibold tracking-wide sm:block',
                      isDone || isCurrent ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <span
                    className={cn('h-0.5 flex-1 rounded-full transition-all duration-300 sm:-mt-6', !isDone && 'bg-[var(--bt-surface-3)]')}
                    style={isDone ? { background: 'linear-gradient(90deg, var(--bt-emerald), var(--bt-emerald-bright))' } : undefined}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <AnimatePresence mode="wait">
        {/* ═══ Step 0 — Business type ═══════════════════════════ */}
        {step === 0 && (
          <motion.div key="step0" {...slide}>
            <h2 className="bt-section-title mb-3.5 text-sm">
              <Zap className="h-4 w-4 text-[var(--bt-emerald)]" aria-hidden="true" />
              Choose Business Type
            </h2>

            <div className="grid gap-3 md:grid-cols-2">
              {BUSINESS_TYPES.map((b) => {
                const products = PRODUCTS[b.id] || [];
                const isSelected = selectedType === b.id;
                return (
                  <SelectCard
                    key={b.id}
                    selected={isSelected}
                    onClick={() => setSelectedType(b.id)}
                    ariaLabel={`${b.name}, ${formatTaka(b.investment)} investment`}
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="bt-medallion bt-medallion-lg" aria-hidden="true">{b.icon}</span>
                        <div className="min-w-0 flex-1">
                          <h3 className={cn('text-sm font-bold sm:text-base', isSelected && 'pr-8')}>{b.name}</h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {b.description}
                          </p>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            <Badge variant="outline" className={cn('rounded-full px-2 text-xs font-semibold', getRiskColor(b.risk))}>
                              {b.risk} risk
                            </Badge>
                            <Badge variant="outline" className={cn('rounded-full px-2 text-xs font-semibold', getProfitColor(b.profit))}>
                              {b.profit} profit
                            </Badge>
                            <Badge variant="outline" className={cn('rounded-full px-2 text-xs font-semibold', getDifficultyColor(b.difficulty))}>
                              {b.difficulty}
                            </Badge>
                          </div>
                          <p className="bt-figure bt-text-gold mt-2.5 text-lg">{formatTaka(b.investment)}</p>
                        </div>
                      </div>

                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <hr className="my-3.5 border-[var(--bt-hairline)]" />
                          <p className="bt-label mb-2 flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-[var(--bt-emerald)]" aria-hidden="true" />
                            Available products ({products.length})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {products.slice(0, 8).map((p) => (
                              <Badge key={p.name} variant="secondary" className="rounded-full px-2 text-xs font-medium">
                                <span aria-hidden="true" className="mr-1">{p.icon}</span>{p.name}
                              </Badge>
                            ))}
                            {products.length > 8 && (
                              <Badge variant="outline" className="bt-tone bt-tone-emerald rounded-full px-2 text-xs font-bold">
                                +{products.length - 8} more
                              </Badge>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </SelectCard>
                );
              })}
            </div>

            <StepNav
              onNext={() => (selectedType ? setStep(1) : toast.error('Select a business type'))}
              nextDisabled={!selectedType}
            />
          </motion.div>
        )}

        {/* ═══ Step 1 — City ════════════════════════════════════ */}
        {step === 1 && (
          <motion.div key="step1" {...slide}>
            <h2 className="bt-section-title mb-3.5 text-sm">
              <MapPin className="h-4 w-4 text-[var(--bt-emerald)]" aria-hidden="true" />
              Choose City
            </h2>

            <div className="grid gap-3 md:grid-cols-2">
              {CITIES.map((c) => {
                const isSelected = selectedCity === c.id;
                return (
                  <SelectCard
                    key={c.id}
                    selected={isSelected}
                    onClick={() => { setSelectedCity(c.id); setSelectedLocation(null); }}
                    ariaLabel={c.name}
                  >
                    <div className="flex items-start gap-3.5 p-4">
                      <span className="bt-medallion bt-medallion-lg" aria-hidden="true">{c.icon}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className={cn('text-sm font-bold sm:text-base', isSelected && 'pr-8')}>
                          {c.name}{' '}
                          <span className="text-xs font-normal text-muted-foreground">{c.nameBn}</span>
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          <StatChip icon={Users} label={`Customers ×${c.customerMultiplier}`} tone="emerald" />
                          <StatChip icon={Wallet} label={`Rent ×${c.rentMultiplier}`} tone="amber" />
                        </div>
                      </div>
                    </div>
                  </SelectCard>
                );
              })}
            </div>

            <StepNav
              onBack={() => setStep(0)}
              onNext={() => (selectedCity ? setStep(2) : toast.error('Select a city'))}
              nextDisabled={!selectedCity}
            />
          </motion.div>
        )}

        {/* ═══ Step 2 — Location ════════════════════════════════ */}
        {step === 2 && (
          <motion.div key="step2" {...slide}>
            <h2 className="bt-section-title mb-1.5 text-sm">
              <Navigation className="h-4 w-4 text-[var(--bt-emerald)]" aria-hidden="true" />
              Choose Location
            </h2>
            <p className="mb-3.5 text-xs leading-relaxed text-muted-foreground">
              Pick an area in {city?.name || 'the city'}. Location changes your rent, footfall and
              growth ceiling — or let us pick the strongest fit.
            </p>

            <Button
              variant="outline"
              className="bt-tap mb-3.5 h-10 gap-1.5 rounded-xl border-dashed px-4 text-xs font-semibold"
              onClick={autoSelectBestLocation}
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--bt-gold-deep)] dark:text-[var(--bt-gold-bright)]" />
              Auto-select best location
            </Button>

            <div className="grid gap-3 md:grid-cols-2">
              {cityLocations.map((locItem) => {
                const isSelected = selectedLocation === locItem.id;
                const suitability = selectedType ? isBusinessTypeSuitable(locItem.id, selectedType) : 'neutral';
                return (
                  <SelectCard
                    key={locItem.id}
                    selected={isSelected}
                    onClick={() => setSelectedLocation(isSelected ? null : locItem.id)}
                    ariaLabel={`${locItem.name}, ${suitability} fit`}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <span className="bt-medallion bt-medallion-md" aria-hidden="true">{locItem.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', isSelected && 'pr-8')}>
                          <h3 className="text-sm font-bold">{locItem.name}</h3>
                          <span className="text-xs text-muted-foreground">{locItem.nameBn}</span>
                          {selectedType && suitability === 'suitable' && (
                            <Badge variant="outline" className="bt-tone bt-tone-emerald gap-0.5 rounded-full px-1.5 text-xs font-bold">
                              <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" /> Ideal
                            </Badge>
                          )}
                          {selectedType && suitability === 'unsuitable' && (
                            <Badge variant="outline" className="bt-tone bt-tone-crimson gap-0.5 rounded-full px-1.5 text-xs font-bold">
                              <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" /> Poor fit
                            </Badge>
                          )}
                          {selectedType && suitability === 'neutral' && (
                            <Badge variant="outline" className="rounded-full px-1.5 text-xs font-semibold text-muted-foreground">
                              OK
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {locItem.description}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <StatChip icon={Wallet} label={`Rent ×${locItem.rentModifier}`} tone="amber" />
                          <StatChip icon={Users} label={`Customers ×${locItem.customerModifier}`} tone="emerald" />
                          <StatChip icon={TrendingUp} label={`Growth ${Math.round(locItem.growthPotential * 100)}%`} tone="sky" />
                        </div>
                      </div>
                    </div>
                  </SelectCard>
                );
              })}
            </div>

            {expansionWarnings.length > 0 && (
              <div className="mt-4">
                <WarningList warnings={expansionWarnings} />
              </div>
            )}

            <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </motion.div>
        )}

        {/* ═══ Step 3 — Name ════════════════════════════════════ */}
        {step === 3 && (
          <motion.div key="step3" {...slide}>
            <h2 className="bt-section-title mb-3.5 text-sm">
              <Type className="h-4 w-4 text-[var(--bt-emerald)]" aria-hidden="true" />
              Name Your Business
            </h2>

            <div className="bt-surface-raised p-5">
              <div className="space-y-2">
                <Label htmlFor="biz-name" className="text-sm font-semibold">Business name</Label>
                <Input
                  id="biz-name"
                  placeholder="e.g. Rahim's Tea Corner"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  maxLength={50}
                  onKeyDown={(e) => e.key === 'Enter' && businessName.trim() && setStep(4)}
                  className="h-12 rounded-xl text-base"
                  aria-describedby="name-counter"
                  autoFocus
                />
                <p id="name-counter" className="bt-numeric text-xs text-muted-foreground">
                  {businessName.length}/50 characters
                </p>
              </div>

              <hr className="my-4 border-[var(--bt-hairline)]" />

              <div className="bt-surface flex items-center gap-3.5 p-3.5">
                <span className="bt-medallion bt-medallion-md" aria-hidden="true">{bt?.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{bt?.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {city?.name}{loc && ` · ${loc.name}`}
                  </p>
                </div>
              </div>
            </div>

            <StepNav
              onBack={() => setStep(2)}
              onNext={() => (businessName.trim() ? setStep(4) : toast.error('Enter a business name'))}
              nextDisabled={!businessName.trim()}
            />
          </motion.div>
        )}

        {/* ═══ Step 4 — Confirm & pay ═══════════════════════════ */}
        {step === 4 && (
          <motion.div key="step4" {...slide}>
            <h2 className="bt-section-title mb-3.5 text-sm">
              <CreditCard className="h-4 w-4 text-[var(--bt-emerald)]" aria-hidden="true" />
              Confirm &amp; Pay
            </h2>

            <div className="bt-surface-raised bt-edge bt-edge-gold overflow-hidden">
              <div className="p-5">
                {/* Summary */}
                <div className="bt-surface flex items-center gap-3.5 p-4">
                  <span className="bt-medallion bt-medallion-lg" aria-hidden="true">{bt?.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold">{businessName}</p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {bt?.name} · {city?.name}{loc && ` · ${loc.name}`}
                    </p>
                  </div>
                </div>

                {/* Location detail */}
                {loc && (
                  <>
                    <hr className="my-4 border-[var(--bt-hairline)]" />
                    <p className="bt-label mb-2 flex items-center gap-1.5">
                      <Navigation className="h-3.5 w-3.5 text-[var(--bt-emerald)]" aria-hidden="true" />
                      Location details
                    </p>
                    <div className="bt-surface p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden="true">{loc.icon}</span>
                        <span className="text-sm font-bold">{loc.name}</span>
                        <span className="text-xs text-muted-foreground">{loc.nameBn}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{loc.description}</p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <StatChip icon={Wallet} label={`Rent ×${loc.rentModifier}`} tone="amber" />
                        <StatChip icon={Users} label={`Customers ×${loc.customerModifier}`} tone="emerald" />
                        <StatChip icon={TrendingUp} label={`Growth ${Math.round(loc.growthPotential * 100)}%`} tone="sky" />
                      </div>
                      {selectedType && (() => {
                        const suit = isBusinessTypeSuitable(loc.id, selectedType);
                        if (suit === 'suitable') return (
                          <p className="bt-text-profit mt-2.5 flex items-center gap-1.5 text-xs font-semibold">
                            <Star className="h-3 w-3 fill-current" aria-hidden="true" /> Great fit for {bt?.name}
                          </p>
                        );
                        if (suit === 'unsuitable') return (
                          <p className="bt-text-loss mt-2.5 flex items-start gap-1.5 text-xs font-semibold">
                            <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                            Poor fit for {bt?.name} — expect higher costs
                          </p>
                        );
                        return null;
                      })()}
                    </div>
                  </>
                )}

                <hr className="my-4 border-[var(--bt-hairline)]" />

                {/* Cost breakdown */}
                <p className="bt-label mb-2.5 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-[var(--bt-emerald)]" aria-hidden="true" />
                  Cost breakdown
                </p>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Base investment</dt>
                    <dd className="bt-numeric font-semibold">{formatTaka(bt?.investment || 0)}</dd>
                  </div>
                  {costInfo && costInfo.expansionPremium > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">
                        Expansion premium{' '}
                        <span className="bt-numeric text-xs">
                          (+{Math.round(businesses.length * EXPANSION_CONFIG.expansionCostScaleFactor * 100)}%)
                        </span>
                      </dt>
                      <dd className="bt-numeric bt-text-gold font-semibold">
                        +{formatTaka(costInfo.expansionPremium)}
                      </dd>
                    </div>
                  )}
                  {costInfo && costInfo.locationModifier !== 1.0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Location modifier</dt>
                      <dd className={cn('bt-numeric font-semibold', costInfo.locationModifier > 1 ? 'bt-text-gold' : 'bt-text-profit')}>
                        ×{costInfo.locationModifier.toFixed(2)}
                      </dd>
                    </div>
                  )}
                  {costInfo && costInfo.setupCost > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Setup cost</dt>
                      <dd className="bt-numeric font-semibold">+{formatTaka(costInfo.setupCost)}</dd>
                    </div>
                  )}
                  {costInfo && costInfo.startingInventoryCost > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">
                        Opening stock{' '}
                        <span className="bt-numeric text-xs">
                          ({Math.round(EXPANSION_CONFIG.startingStockRatio * 100)}% of shelf space)
                        </span>
                      </dt>
                      <dd className="bt-numeric font-semibold">
                        +{formatTaka(costInfo.startingInventoryCost)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Monthly rent</dt>
                    <dd className="bt-numeric font-semibold">
                      ~৳{Math.round((bt?.rent || 0) * (loc?.rentModifier || city?.rentMultiplier || 1)).toLocaleString()}
                    </dd>
                  </div>
                  {/* Rent and utilities are both monthly, divided by 30 at tick
                      time. This line used to read "Est. daily rent" while
                      showing the monthly figure, overstating the daily cost of
                      a shop thirtyfold. Utilities were not shown at all. */}
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Monthly utilities</dt>
                    <dd className="bt-numeric font-semibold">
                      ~৳{(bt?.utilities || 0).toLocaleString()}
                    </dd>
                  </div>
                </dl>

                {setupDays > 0 && (
                  <div className="bt-tone bt-tone-sky mt-4 flex items-start gap-2.5 rounded-xl p-3.5">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-bold">Setup period: {setupDays} day{setupDays > 1 ? 's' : ''}</p>
                      <p className="mt-0.5 text-xs opacity-90">
                        Operates at {Math.round(EXPANSION_CONFIG.setupRevenueMultiplier * 100)}% capacity while setting up.
                      </p>
                    </div>
                  </div>
                )}

                {expansionWarnings.length > 0 && (
                  <div className="mt-4">
                    <WarningList warnings={expansionWarnings} />
                  </div>
                )}

                <hr className="my-4 border-[var(--bt-hairline)]" />

                {/* Total */}
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-bold">Total cost</span>
                  <span className={cn('bt-figure text-2xl', canAfford ? 'bt-text-gold' : 'bt-text-loss')}>
                    {formatTaka(totalCost)}
                  </span>
                </div>

                <div className="bt-surface mt-3 flex items-center justify-between gap-3 p-3">
                  <span className="text-xs text-muted-foreground">Your cash</span>
                  <span className={cn('bt-numeric text-sm font-bold', canAfford ? 'bt-text-profit' : 'bt-text-loss')}>
                    {formatTaka(player?.cash || 0)}
                  </span>
                </div>

                {!canAfford && (
                  <p role="alert" className="bt-tone bt-tone-crimson mt-3 flex items-start gap-2 rounded-xl p-3 text-xs font-semibold">
                    <ShieldAlert className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                    Not enough cash — you need {formatTaka(totalCost - (player?.cash || 0))} more.
                  </p>
                )}
              </div>
            </div>

            <StepNav
              onBack={() => setStep(3)}
              nextNode={
                <Button
                  onClick={handleCreate}
                  disabled={creating || !canAfford}
                  className="bt-btn-gold bt-tap h-11 gap-1.5 rounded-xl px-5 font-bold disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-spin" /> Creating…
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" /> Pay {formatTakaShort(totalCost)}
                    </>
                  )}
                </Button>
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
