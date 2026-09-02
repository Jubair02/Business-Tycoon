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
import { ArrowLeft, ArrowRight, Check, Wallet, MapPin, Type, CreditCard, Users, Zap, Package, TrendingUp, ShieldAlert } from 'lucide-react';

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
    { title: 'Business Type', icon: <Zap className="h-4 w-4" /> },
    { title: 'City', icon: <MapPin className="h-4 w-4" /> },
    { title: 'Name', icon: <Type className="h-4 w-4" /> },
    { title: 'Confirm', icon: <CreditCard className="h-4 w-4" /> },
  ];

  return (
    <div className="p-3 md:p-4 pb-24 md:pb-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => step === 0 ? setView('dashboard') : setStep(step - 1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-bold">New Business</h2>
      </div>

      <div className="flex items-center gap-1 mb-6 px-1">
        {steps.map((s, i) => (
          <div key={i} className="flex-1 flex items-center gap-1">
            <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 ${i <= step ? 'text-white' : 'bg-muted text-muted-foreground'}`} style={i <= step ? { background: '#006a4e' } : {}}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-[10px] hidden sm:inline ${i <= step ? 'font-medium' : 'text-muted-foreground'}`}>{s.title}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? '' : 'bg-muted'}`} style={i < step ? { background: '#006a4e' } : {}} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 className="text-sm font-semibold mb-3">Choose Business Type</h3>
            <div className="space-y-3">
              {BUSINESS_TYPES.map((b) => {
                const products = PRODUCTS[b.id] || [];
                const isSelected = selectedType === b.id;
                return (
                  <Card
                    key={b.id}
                    className={`game-card-interactive ${isSelected ? 'ring-2 game-glow' : ''}`}
                    style={isSelected ? { borderColor: '#006a4e' } : {}}
                    onClick={() => setSelectedType(b.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`text-3xl p-2 rounded-xl ${b.bgColor}`}>{b.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{b.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{b.description}</div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <Badge className={`text-[10px] border ${getRiskColor(b.risk)}`} variant="outline">{b.risk} Risk</Badge>
                            <Badge variant="outline" className={`text-[10px] ${getProfitColor(b.profit)}`}>{b.profit} Profit</Badge>
                            <Badge variant="outline" className={`text-[10px] ${getDifficultyColor(b.difficulty)}`}>{b.difficulty}</Badge>
                          </div>
                          <div className="text-sm font-bold mt-2" style={{ color: '#006a4e' }}>{formatTaka(b.investment)}</div>
                        </div>
                      </div>
                      {isSelected && (
                          <div className="mt-3">
                            <Separator className="mb-3" />
                            <div className="space-y-2">
                              <div className="text-xs font-semibold flex items-center gap-1.5">
                                <Package className="h-3.5 w-3.5" style={{ color: '#006a4e' }} />
                                Available Products ({products.length})
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {products.slice(0, 8).map((p) => (
                                  <Badge key={p.name} variant="secondary" className="text-[10px]">
                                    {p.icon} {p.name}
                                  </Badge>
                                ))}
                                {products.length > 8 && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    +{products.length - 8} more
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3 text-green-600" />
                                  Profit potential: <span className="font-medium text-foreground">{b.profit}</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <ShieldAlert className="h-3 w-3" />
                                  Risk level: <span className="font-medium text-foreground">{b.risk}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => { if (selectedType) { setStep(1); } else { toast.error('Select a business type'); } }} className="gap-1 text-white" style={{ background: '#006a4e' }}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 className="text-sm font-semibold mb-3">Choose City</h3>
            <div className="space-y-3">
              {CITIES.map((c) => (
                <Card key={c.id} className={`game-card-interactive ${selectedCity === c.id ? 'ring-2' : ''}`} style={selectedCity === c.id ? { borderColor: '#006a4e' } : {}} onClick={() => setSelectedCity(c.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{c.icon}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{c.name} <span className="text-muted-foreground font-normal">{c.nameBn}</span></div>
                        <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>
                        <div className="flex gap-3 mt-2 text-xs">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Customers: x{c.customerMultiplier}</span>
                          <span className="flex items-center gap-1"><Wallet className="h-3 w-3" /> Rent: x{c.rentMultiplier}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={() => { if (selectedCity) setStep(2); else toast.error('Select a city'); }} className="gap-1 text-white" style={{ background: '#006a4e' }}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 className="text-sm font-semibold mb-3">Name Your Business</h3>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="biz-name">Business Name</Label>
                  <Input
                    id="biz-name"
                    placeholder="e.g. Rahim's Tea Corner"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    maxLength={50}
                    onKeyDown={(e) => e.key === 'Enter' && businessName.trim() && setStep(3)}
                  />
                  <div className="text-xs text-muted-foreground">{businessName.length}/50 characters</div>
                </div>
                <Separator />
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <span className="text-3xl">{bt?.icon}</span>
                  <div>
                    <div className="font-medium">{bt?.name}</div>
                    <div className="text-xs text-muted-foreground">{city?.name}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="mt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={() => { if (businessName.trim()) setStep(3); else toast.error('Enter a business name'); }} className="gap-1 text-white" style={{ background: '#006a4e' }}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 className="text-sm font-semibold mb-3">Confirm & Pay</h3>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <span className="text-3xl">{bt?.icon}</span>
                  <div>
                    <div className="font-bold">{businessName}</div>
                    <div className="text-sm text-muted-foreground">{bt?.name} · {city?.name}</div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Investment</span><span>{formatTaka(bt?.investment || 0)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Daily Rent</span><span>~৳{((bt?.rent || 0) * (city?.rentMultiplier || 1)).toLocaleString()}</span></div>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total Cost</span>
                  <span style={{ color: canAfford ? '#006a4e' : '#f42a41' }}>{formatTaka(totalCost)}</span>
                </div>
                <div className="text-xs text-muted-foreground">Your cash: {formatTaka(player?.cash || 0)}</div>
                {!canAfford && (
                  <div className="text-xs text-red-500 font-medium">You don&apos;t have enough cash!</div>
                )}
              </CardContent>
            </Card>
            <div className="mt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button onClick={handleCreate} disabled={creating || !canAfford} className="gap-1 text-white" style={{ background: '#006a4e' }}>
                {creating ? 'Creating...' : `Pay ${formatTakaShort(totalCost)} & Create`}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
