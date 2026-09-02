'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '@/store/game-store';
import { formatTaka, formatTakaShort, getBusinessType, getCity, getEmployeeRole, GAME_CONFIG, EMPLOYEE_ROLES } from '@/lib/game-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ArrowLeft, Users, ShoppingCart, Trash2, Check, X, ArrowUp } from 'lucide-react';

export default function BusinessDetail() {
  const { currentBusiness, setView, setCurrentBusiness, setBusinesses, player } = useGameStore();
  const [isEditingPrice, setIsEditingPrice] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [showHireDialog, setShowHireDialog] = useState(false);
  const [hireRole, setHireRole] = useState('');
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [buyProduct, setBuyProduct] = useState<any>(null);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [buying, setBuying] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [firingId, setFiringId] = useState<string | null>(null);
  const [marketProducts, setMarketProducts] = useState<any[]>([]);

  const fetchBusiness = useCallback(async () => {
    if (!currentBusiness?.id) return;
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentBusiness(data);
      }
    } catch {
      toast.error('Failed to load business data');
    }
  }, [currentBusiness?.id, setCurrentBusiness]);

  const fetchMarketProducts = useCallback(async () => {
    if (!currentBusiness) return;
    try {
      const res = await fetch(`/api/market/products?type=${currentBusiness.type}&city=${currentBusiness.city}`);
      if (res.ok) {
        setMarketProducts(await res.json());
      }
    } catch {
      // silent
    }
  }, [currentBusiness]);

  useEffect(() => {
    if (currentBusiness?.id) {
      fetchBusiness();
      fetchMarketProducts();
    }
  }, [currentBusiness?.id, fetchBusiness, fetchMarketProducts]);

  if (!currentBusiness) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">No business selected</p>
        <Button variant="outline" className="mt-2" onClick={() => setView('businesses')}>Back to Businesses</Button>
      </div>
    );
  }

  const bt = getBusinessType(currentBusiness.type);
  const city = getCity(currentBusiness.city);
  const profit = currentBusiness.dailyProfit || 0;
  const inventories = currentBusiness.inventories || [];
  const employees = currentBusiness.employees || [];
  const upgradeCost = Math.round((bt?.investment || 0) * (currentBusiness.level || 1) * 0.5);

  const handleUpdatePrice = async (invId: string) => {
    const price = parseFloat(editPrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Enter a valid price');
      return;
    }
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/inventory/${invId}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellPrice: price }),
      });
      if (res.ok) {
        toast.success('Price updated!');
        setIsEditingPrice(null);
        fetchBusiness();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to update price');
      }
    } catch {
      toast.error('Failed to update price');
    }
  };

  const handleBuy = async () => {
    if (!buyProduct || buyQuantity < 1) return;
    setBuying(true);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/inventory/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: buyProduct.id || buyProduct.productId,
          productName: buyProduct.name,
          category: currentBusiness.type,
          quantity: buyQuantity,
        }),
      });
      if (res.ok) {
        toast.success(`Bought ${buyQuantity}x ${buyProduct.name}`);
        setShowBuyDialog(false);
        setBuyQuantity(1);
        fetchBusiness();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Purchase failed');
      }
    } catch {
      toast.error('Purchase failed');
    } finally {
      setBuying(false);
    }
  };

  const handleHire = async () => {
    if (!hireRole) return;
    setHiring(true);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/employees/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: hireRole }),
      });
      if (res.ok) {
        toast.success('Employee hired!');
        setShowHireDialog(false);
        setHireRole('');
        fetchBusiness();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Hiring failed');
      }
    } catch {
      toast.error('Hiring failed');
    } finally {
      setHiring(false);
    }
  };

  const handleFire = async (empId: string) => {
    setFiringId(empId);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/employees/${empId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Employee fired');
        fetchBusiness();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to fire employee');
      }
    } catch {
      toast.error('Failed to fire employee');
    } finally {
      setFiringId(null);
    }
  };

  const handleUpgrade = async () => {
    if ((player?.cash || 0) < upgradeCost) {
      toast.error('Not enough cash!');
      return;
    }
    setUpgrading(true);
    try {
      const res = await fetch(`/api/businesses/${currentBusiness.id}/upgrade`, { method: 'POST' });
      if (res.ok) {
        toast.success('Business upgraded!');
        fetchBusiness();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Upgrade failed');
      }
    } catch {
      toast.error('Upgrade failed');
    } finally {
      setUpgrading(false);
    }
  };

  const getDemandColor = (demand: number) => {
    if (demand >= 1.2) return 'text-green-600 bg-green-50 border-green-200';
    if (demand >= 0.8) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-500 bg-red-50 border-red-200';
  };

  const getDemandLabel = (demand: number) => {
    if (demand >= 1.2) return 'High';
    if (demand >= 0.8) return 'Medium';
    return 'Low';
  };

  return (
    <div className="pb-24 md:pb-4">
      <div className="sticky top-14 z-40 bg-white/90 backdrop-blur-md border-b">
        <div className="flex items-center gap-2 px-3 md:px-4 py-2.5">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setView('businesses')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{bt?.icon}</span>
              <h2 className="font-bold text-sm truncate">{currentBusiness.name}</h2>
            </div>
            <div className="text-[10px] text-muted-foreground">{bt?.name} · {city?.name}</div>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">Lv.{currentBusiness.level}</Badge>
        </div>
      </div>

      <div className="p-3 md:p-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs">Inventory</TabsTrigger>
            <TabsTrigger value="employees" className="text-xs">Staff</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase">Daily Revenue</div>
                  <div className="text-lg font-bold text-green-600">{formatTakaShort(currentBusiness.dailyRevenue || 0)}</div>
                </CardContent>
              </Card>
              <Card className={profit >= 0 ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}>
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase">Daily Profit</div>
                  <div className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {profit >= 0 ? '+' : ''}{formatTakaShort(profit)}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-amber-500">
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase">Daily Expenses</div>
                  <div className="text-lg font-bold text-amber-600">{formatTakaShort(currentBusiness.dailyExpenses || 0)}</div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase">Reputation</div>
                  <div className="text-lg font-bold">{currentBusiness.reputation || 0}%</div>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-4">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm">Reputation</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <Progress value={currentBusiness.reputation || 0} className="h-3" />
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span>Poor</span><span>Average</span><span>Excellent</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Level</span><span className="font-medium">{currentBusiness.level || 1}</span></div>
                <Separator />
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Inventory Items</span><span className="font-medium">{inventories.length}</span></div>
                <Separator />
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Employees</span><span className="font-medium">{employees.length}/{GAME_CONFIG.maxEmployees}</span></div>
                <Separator />
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Stock</span><span className="font-medium">{inventories.reduce((s: number, i: any) => s + (i.quantity || 0), 0)}</span></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Inventory ({inventories.length})</h3>
                <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
                  <Button size="sm" className="gap-1 text-white text-xs" style={{ background: '#006a4e' }} onClick={() => { if (marketProducts.length === 0) { fetchMarketProducts(); } }} asChild>
                    <DialogTrigger asChild>
                      <button><ShoppingCart className="h-3.5 w-3.5" /> Buy Stock</button>
                    </DialogTrigger>
                  </Button>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Buy Inventory</DialogTitle>
                      <DialogDescription>Choose a product and quantity to buy</DialogDescription>
                    </DialogHeader>
                    {!buyProduct ? (
                      <ScrollArea className="max-h-64">
                        <div className="space-y-2">
                          {marketProducts.map((p: any) => (
                            <button key={p.productId || p.name} onClick={() => setBuyProduct(p)} className="w-full text-left p-3 rounded-lg border hover:border-green-400 transition-colors">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{p.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium">{p.name}</div>
                                  <div className="text-xs text-muted-foreground">Market: ৳{p.marketPrice?.toLocaleString() || p.basePrice?.toLocaleString()}</div>
                                </div>
                                <Badge className={`text-[10px] border ${getDemandColor(p.demand || 1)}`} variant="outline">
                                  {getDemandLabel(p.demand || 1)}
                                </Badge>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                          <span className="text-2xl">{buyProduct.icon}</span>
                          <div>
                            <div className="font-medium">{buyProduct.name}</div>
                            <div className="text-sm text-muted-foreground">Unit price: ৳{(buyProduct.marketPrice || buyProduct.basePrice || 0).toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input type="number" min={1} max={buyProduct.maxStock || 100} value={buyQuantity} onChange={(e) => setBuyQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                          <div className="text-sm text-muted-foreground">
                            Total cost: <span className="font-bold text-foreground">{formatTaka((buyProduct.marketPrice || buyProduct.basePrice || 0) * buyQuantity)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <DialogFooter className="gap-2">
                      {buyProduct && (
                        <Button variant="outline" onClick={() => { setBuyProduct(null); setBuyQuantity(1); }}>Back</Button>
                      )}
                      <Button onClick={buyProduct ? handleBuy : () => setShowBuyDialog(false)} disabled={buying || (!buyProduct)} className="text-white" style={{ background: '#006a4e' }}>
                        {buying ? 'Buying...' : buyProduct ? `Buy for ${formatTaka((buyProduct.marketPrice || buyProduct.basePrice || 0) * buyQuantity)}` : 'Close'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {inventories.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <div className="text-4xl mb-2">📦</div>
                    <p className="text-sm text-muted-foreground">No inventory. Buy stock to start selling!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {inventories.map((inv: any) => {
                    const mp = marketProducts.find((p: any) => p.productId === inv.productId || p.name === inv.productName);
                    return (
                      <Card key={inv.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{mp?.icon || inv.productName?.charAt(0)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{inv.productName}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getDemandColor(mp?.demand || 1)}`}>
                                  {getDemandLabel(mp?.demand || 1)} demand
                                </span>
                                <span className="text-[10px] text-muted-foreground">Stock: {inv.quantity || 0}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {isEditingPrice === inv.id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={editPrice}
                                    onChange={(e) => setEditPrice(e.target.value)}
                                    className="w-20 h-7 text-xs"
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdatePrice(inv.id); if (e.key === 'Escape') setIsEditingPrice(null); }}
                                  />
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdatePrice(inv.id)}><Check className="h-3 w-3 text-green-600" /></Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsEditingPrice(null)}><X className="h-3 w-3" /></Button>
                                </div>
                              ) : (
                                <button onClick={() => { setIsEditingPrice(inv.id); setEditPrice(String(inv.sellPrice || 0)); }} className="text-sm font-bold hover:underline" style={{ color: '#006a4e' }}>
                                  ৳{(inv.sellPrice || 0).toLocaleString()}
                                </button>
                              )}
                              <div className="text-[10px] text-muted-foreground">sell price</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="employees">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Staff ({employees.length}/{GAME_CONFIG.maxEmployees})</h3>
                <Button size="sm" className="gap-1 text-white text-xs" style={{ background: '#006a4e' }} onClick={() => setShowHireDialog(true)} disabled={employees.length >= GAME_CONFIG.maxEmployees}>
                  <Users className="h-3.5 w-3.5" /> Hire
                </Button>
              </div>

              <Dialog open={showHireDialog} onOpenChange={setShowHireDialog}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Hire Employee</DialogTitle>
                    <DialogDescription>Choose a role for your new employee</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    {EMPLOYEE_ROLES.map((role) => (
                      <button
                        key={role.role}
                        onClick={() => setHireRole(role.role)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${hireRole === role.role ? 'border-green-500 bg-green-50' : 'hover:border-green-300'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{role.icon}</span>
                          <div className="flex-1">
                            <div className="text-sm font-medium">{role.label}</div>
                            <div className="text-xs text-muted-foreground">{role.description}</div>
                            <div className="text-xs mt-0.5">Salary: ~৳{role.baseSalary.toLocaleString()}/day</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowHireDialog(false)}>Cancel</Button>
                    <Button onClick={handleHire} disabled={!hireRole || hiring} className="text-white" style={{ background: '#006a4e' }}>
                      {hiring ? 'Hiring...' : 'Hire'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {employees.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <div className="text-4xl mb-2">👥</div>
                    <p className="text-sm text-muted-foreground">No employees. Hire staff to boost your business!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {employees.map((emp: any) => {
                    const role = getEmployeeRole(emp.role);
                    return (
                      <Card key={emp.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl p-1.5 rounded-lg bg-muted">{role?.icon || '👤'}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{emp.name}</div>
                              <div className="text-xs text-muted-foreground">{role?.label || emp.role}</div>
                              <div className="flex gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px]">Skill: {emp.skill}/10</Badge>
                                <Badge variant="outline" className="text-[10px]">Eff: {emp.efficiency || 0}%</Badge>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-medium">৳{(emp.salary || 0).toLocaleString()}</div>
                              <div className="text-[10px] text-muted-foreground">salary/day</div>
                              <Button size="icon" variant="ghost" className="h-7 w-7 mt-1 text-red-400 hover:text-red-600" onClick={() => handleFire(emp.id)} disabled={firingId === emp.id}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm">Business Info</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Name</span><span className="font-medium">{currentBusiness.name}</span></div>
                  <Separator />
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Type</span><span className="font-medium">{bt?.icon} {bt?.name}</span></div>
                  <Separator />
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">City</span><span className="font-medium">{city?.name}</span></div>
                  <Separator />
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Level</span><span className="font-medium">{currentBusiness.level || 1}</span></div>
                  <Separator />
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Reputation</span><span className="font-medium">{currentBusiness.reputation || 0}%</span></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><ArrowUp className="h-4 w-4" /> Upgrade Business</CardTitle>
                  <CardDescription>Upgrade to level {(currentBusiness.level || 1) + 1}. Increases capacity and +5 reputation.</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">Upgrade Cost</div>
                      <div className="text-lg font-bold">{formatTaka(upgradeCost)}</div>
                      <div className="text-[10px] text-muted-foreground">Your cash: {formatTaka(player?.cash || 0)}</div>
                    </div>
                    <Button onClick={handleUpgrade} disabled={upgrading || (player?.cash || 0) < upgradeCost} className="text-white" style={{ background: '#006a4e' }}>
                      {upgrading ? 'Upgrading...' : 'Upgrade'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
