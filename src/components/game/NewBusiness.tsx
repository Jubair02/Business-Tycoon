'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { formatTaka, formatTakaShort, BUSINESS_TYPES, CITIES, PRODUCTS, getRiskColor, getProfitColor, getDifficultyColor } from '@/lib/game-data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Wallet, MapPin, Type, CreditCard, Users, Zap, Package, TrendingUp, ShieldAlert, Building2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NewBusiness() {
  const { player, setView, setBusinesses, selectBusiness } = useGameStore();
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [creating, setCreating] = useState(false);

  const bt = BUSINESS_TYPES.find(b => b.id === selectedType);
  const city = CITIES.find(c => c.id === selectedCity);
  const totalCost = bt ? bt.investment : 0;
  const canAfford = (player?.cash || 0) >= totalCost;
  const availableProducts = selectedType ? (PRODUCTS[selectedType] || []) : [];

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
        }),
      });
      if (res.ok) {
        const business = await res.json();
        toast.success(`${businessName.trim()} created successfully!`);
        const busRes = await fetch('/api/businesses');
        if (busRes.ok) setBusinesses(await busRes.json());
        const pRes = await fetch('/api/player');
        if (pRes.ok) useGameStore.getState().setPlayer(await pRes.json());
        selectBusiness(business.id);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create business');
      }
    } catch {
      toast.error('Failed to create business');
    } finally {
      setCreating(false);
    }
  };

  const steps = [
    { title: 'Type', icon: <Zap className="h-4 w-4" /> },
    { title: 'City', icon: <MapPin className="h-4 w-4" /> },
    { title: 'Name', icon: <Type className="h-4 w-4" /> },
    { title: 'Pay', icon: <CreditCard className="h-4 w-4" /> },
  ];

  return (
    <div className="p-3 md:p-4 pb-24 md:pb-4">
      <div className="flex items-center gap-2 mb-5">
        <Button variant="ghost" size="icon" className="shrink-0 rounded-lg" onClick={() => step === 0 ? setView('dashboard') : setStep(step - 1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-bold flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="game-badge-gradient">New Business</span>
        </h2>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-7 px-2">
        {steps.map((s, i) => (
          <div key={i} className="flex-1 flex items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-xl text-xs font-bold shrink-0 transition-all duration-300',
                  i < step
                    ? 'text-white shadow-md'
                    : i === step
                      ? 'text-white shadow-lg game-pulse-soft'
                      : 'bg-muted text-muted-foreground'
                )}
                style={i <= step ? { background: 'linear-gradient(135deg, #006a4e, #00895e)' } : {}}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn(
                'text-[10px] font-semibold hidden sm:block tracking-wide',
                i <= step ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {s.title}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 mt-[-12px]">
                <div
                  className={cn('h-0.5 rounded-full transition-all duration-300', i < step ? '' : 'bg-muted')}
                  style={i < step ? { background: 'linear-gradient(90deg, #006a4e, #00a86b)' } : {}}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 0: Business Type */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: '#006a4e' }} />
              Choose Business Type
            </h3>
            <div className="space-y-3">
              {BUSINESS_TYPES.map((b) => {
                const products = PRODUCTS[b.id] || [];
                const isSelected = selectedType === b.id;
                return (
                  <motion.div
                    key={b.id}
                    whileHover={{ y: -1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Card
                      className={cn(
                        'cursor-pointer rounded-xl transition-all duration-300',
                        isSelected
                          ? 'ring-2 shadow-lg'
                          : 'hover:shadow-md hover:border-green-200'
                      )}
                      style={isSelected ? {
                        borderColor: '#006a4e',
                        boxShadow: '0 0 0 1px rgba(0,106,78,0.1), 0 8px 24px -4px rgba(0,106,78,0.2)',
                      } : {}}
                      onClick={() => setSelectedType(b.id)}
                    >
                      {isSelected && (
                        <div className="h-1 rounded-t-xl" style={{ background: 'linear-gradient(90deg, #006a4e, #00a86b, #006a4e)' }} />
                      )}
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={cn('text-3xl p-2.5 rounded-xl shrink-0 shadow-sm transition-all duration-300', b.bgColor, isSelected && 'ring-2 ring-green-200')}>
                            {b.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm">{b.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 font-medium line-clamp-2">{b.description}</div>
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                              <Badge className={cn('text-[10px] font-semibold rounded-full px-2 border', getRiskColor(b.risk))} variant="outline">{b.risk} Risk</Badge>
                              <Badge variant="outline" className={cn('text-[10px] font-semibold rounded-full px-2', getProfitColor(b.profit))}>{b.profit} Profit</Badge>
                              <Badge variant="outline" className={cn('text-[10px] font-semibold rounded-full px-2', getDifficultyColor(b.difficulty))}>{b.difficulty}</Badge>
                            </div>
                            <div className="text-base font-bold mt-2.5 game-badge-gradient">{formatTaka(b.investment)}</div>
                          </div>
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            transition={{ duration: 0.2 }}
                            className="mt-3 overflow-hidden"
                          >
                            <hr className="game-divider-gradient mb-3" />
                            <div className="space-y-2.5">
                              <div className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
                                <Package className="h-3.5 w-3.5" style={{ color: '#006a4e' }} />
                                Available Products ({products.length})
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {products.slice(0, 8).map((p) => (
                                  <Badge key={p.name} variant="secondary" className="text-[10px] font-medium rounded-full px-2">
                                    {p.icon} {p.name}
                                  </Badge>
                                ))}
                                {products.length > 8 && (
                                  <Badge variant="secondary" className="text-[10px] font-semibold rounded-full px-2 bg-green-50 text-green-700">
                                    +{products.length - 8} more
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-4 mt-2.5">
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                  <div className="w-5 h-5 rounded-md bg-green-50 flex items-center justify-center">
                                    <TrendingUp className="h-3 w-3 text-green-600" />
                                  </div>
                                  Profit: <span className="font-bold text-foreground">{b.profit}</span>
                                </span>
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                  <div className="w-5 h-5 rounded-md bg-amber-50 flex items-center justify-center">
                                    <ShieldAlert className="h-3 w-3 text-amber-600" />
                                  </div>
                                  Risk: <span className="font-bold text-foreground">{b.risk}</span>
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => { if (selectedType) { setStep(1); } else { toast.error('Select a business type'); } }} className="gap-1.5 text-white rounded-lg shadow-sm hover:shadow-md transition-shadow" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 1: City Selection */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" style={{ color: '#006a4e' }} />
              Choose City
            </h3>
            <div className="space-y-3">
              {CITIES.map((c) => {
                const isSelected = selectedCity === c.id;
                return (
                  <motion.div
                    key={c.id}
                    whileHover={{ y: -1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Card
                      className={cn(
                        'cursor-pointer rounded-xl transition-all duration-300',
                        isSelected
                          ? 'ring-2 shadow-lg'
                          : 'hover:shadow-md hover:border-green-200'
                      )}
                      style={isSelected ? {
                        borderColor: '#006a4e',
                        boxShadow: '0 0 0 1px rgba(0,106,78,0.1), 0 8px 24px -4px rgba(0,106,78,0.2)',
                      } : {}}
                      onClick={() => setSelectedCity(c.id)}
                    >
                      {isSelected && (
                        <div className="h-1 rounded-t-xl" style={{ background: 'linear-gradient(90deg, #006a4e, #00a86b, #006a4e)' }} />
                      )}
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3.5">
                          <div className={cn(
                            'w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0 transition-all duration-300',
                            isSelected
                              ? 'bg-gradient-to-br from-green-50 to-emerald-100 shadow-sm'
                              : 'bg-muted/50'
                          )}>
                            {c.icon}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-sm">{c.name} <span className="text-muted-foreground font-normal text-xs">{c.nameBn}</span></div>
                            <div className="text-xs text-muted-foreground mt-1 font-medium leading-relaxed">{c.description}</div>
                            <div className="flex gap-3 mt-2.5">
                              <span className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg font-semibold">
                                <Users className="h-3 w-3" /> x{c.customerMultiplier}
                              </span>
                              <span className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg font-semibold">
                                <Wallet className="h-3 w-3" /> x{c.rentMultiplier}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-between">
              <Button variant="outline" className="rounded-lg" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={() => { if (selectedCity) setStep(2); else toast.error('Select a city'); }} className="gap-1.5 text-white rounded-lg shadow-sm hover:shadow-md transition-shadow" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Name */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <Type className="h-4 w-4" style={{ color: '#006a4e' }} />
              Name Your Business
            </h3>
            <Card className="rounded-xl">
              <CardContent className="p-5 space-y-4">
                <div className="space-y-2.5">
                  <Label htmlFor="biz-name" className="text-sm font-semibold">Business Name</Label>
                  <Input
                    id="biz-name"
                    placeholder="e.g. Rahim's Tea Corner"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    maxLength={50}
                    onKeyDown={(e) => e.key === 'Enter' && businessName.trim() && setStep(3)}
                    className="rounded-lg h-11"
                  />
                  <div className="text-xs text-muted-foreground font-medium">{businessName.length}/50 characters</div>
                </div>
                <hr className="game-divider-gradient" />
                <div className="flex items-center gap-3.5 p-3.5 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(0,106,78,0.04), rgba(0,168,107,0.06))' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl shrink-0 shadow-sm" style={{ background: bt?.bgColor }}>
                    {bt?.icon}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{bt?.name}</div>
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {city?.name}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="mt-5 flex justify-between">
              <Button variant="outline" className="rounded-lg" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={() => { if (businessName.trim()) setStep(3); else toast.error('Enter a business name'); }} className="gap-1.5 text-white rounded-lg shadow-sm hover:shadow-md transition-shadow" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirm & Pay */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <CreditCard className="h-4 w-4" style={{ color: '#006a4e' }} />
              Confirm & Pay
            </h3>
            <Card className="rounded-xl overflow-hidden">
              <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #006a4e, #00a86b, #f42a41, #006a4e)' }} />
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3.5 p-3.5 rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(0,106,78,0.04), rgba(0,168,107,0.06))' }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl shrink-0 shadow-sm" style={{ background: bt?.bgColor }}>
                    {bt?.icon}
                  </div>
                  <div>
                    <div className="font-bold text-base">{businessName}</div>
                    <div className="text-sm text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3.5 w-3.5" /> {bt?.name} · {city?.name}
                    </div>
                  </div>
                </div>

                <hr className="game-divider-gradient" />

                <div className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Investment</span>
                    <span className="font-semibold">{formatTaka(bt?.investment || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">Est. Daily Rent</span>
                    <span className="font-semibold">~৳{((bt?.rent || 0) * (city?.rentMultiplier || 1)).toLocaleString()}</span>
                  </div>
                </div>

                <hr className="game-divider-gradient" />

                <div className="flex justify-between font-bold text-base">
                  <span>Total Cost</span>
                  <span className={cn(canAfford ? 'game-badge-gradient' : 'text-red-500')}>{formatTaka(totalCost)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <span className="text-xs text-muted-foreground font-medium">Your Cash</span>
                  <span className="text-sm font-bold" style={{ color: canAfford ? '#006a4e' : '#f42a41' }}>{formatTaka(player?.cash || 0)}</span>
                </div>

                {!canAfford && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-semibold">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    You don&apos;t have enough cash! Need {formatTaka(totalCost - (player?.cash || 0))} more.
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="mt-5 flex justify-between">
              <Button variant="outline" className="rounded-lg" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !canAfford}
                className={cn(
                  'gap-1.5 text-white rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50',
                  canAfford && 'game-next-day-glow'
                )}
                style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}
              >
                {creating ? (
                  <span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 animate-spin" /> Creating...</span>
                ) : (
                  <span className="flex items-center gap-1.5"><CreditCard className="h-4 w-4" /> Pay {formatTakaShort(totalCost)} & Create</span>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
