'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Landmark, Plus, Wallet, CreditCard, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DURATION_OPTIONS = [
  { days: 10, label: '10 Days', desc: 'Short-term' },
  { days: 20, label: '20 Days', desc: 'Medium-term' },
  { days: 30, label: '30 Days', desc: 'Long-term' },
];

const INTEREST_RATE = 0.05;
const MIN_LOAN = 50000;
const MAX_ACTIVE_LOANS = 3;

function formatTaka(amount: number): string {
  return `৳${Math.round(amount).toLocaleString()}`;
}

interface Loan {
  id: string;
  amount: number;
  interestRate: number;
  remainingDebt: number;
  dailyPayment: number;
  daysRemaining: number;
  totalInterest: number;
  status: string;
  takenAt: string;
}

export default function BankView() {
  const { player, setPlayer } = useGameStore();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [takingLoan, setTakingLoan] = useState(false);

  // New loan form
  const [loanAmount, setLoanAmount] = useState(MIN_LOAN);
  const [loanDays, setLoanDays] = useState(10);
  const [showNewLoan, setShowNewLoan] = useState(false);

  // Repay dialog
  const [repayLoan, setRepayLoan] = useState<Loan | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repaying, setRepaying] = useState(false);

  const fetchLoans = useCallback(async () => {
    try {
      const res = await fetch('/api/loans');
      if (res.ok) {
        setLoans(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlayer = useCallback(async () => {
    try {
      const res = await fetch('/api/player');
      if (res.ok) {
        setPlayer(await res.json());
      }
    } catch {
      // silent
    }
  }, [setPlayer]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const activeLoans = loans.filter((l) => l.status === 'ACTIVE');
  const historyLoans = loans.filter((l) => l.status !== 'ACTIVE');
  const totalDebt = activeLoans.reduce((sum, l) => sum + l.remainingDebt, 0);
  const totalDailyPayment = activeLoans.reduce((sum, l) => sum + l.dailyPayment, 0);
  const maxLoan = player ? player.level * 200000 : 200000;

  // Calculated loan preview
  const previewInterest = loanAmount * INTEREST_RATE;
  const previewTotal = loanAmount + previewInterest;
  const previewDaily = previewTotal / loanDays;

  const handleTakeLoan = async () => {
    if (!showNewLoan) return;
    setTakingLoan(true);
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: loanAmount, days: loanDays }),
      });
      if (res.ok) {
        toast.success(`Loan of ${formatTaka(loanAmount)} approved!`);
        setShowNewLoan(false);
        setLoanAmount(MIN_LOAN);
        setLoanDays(10);
        await Promise.all([fetchLoans(), fetchPlayer()]);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to take loan');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setTakingLoan(false);
    }
  };

  const handleRepay = async () => {
    if (!repayLoan) return;
    const amount = parseFloat(repayAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setRepaying(true);
    try {
      const res = await fetch(`/api/loans/${repayLoan.id}/repay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (res.ok) {
        toast.success(`Repaid ${formatTaka(amount)}!`);
        setRepayLoan(null);
        setRepayAmount('');
        await Promise.all([fetchLoans(), fetchPlayer()]);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Repayment failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setRepaying(false);
    }
  };

  const canTakeLoan = activeLoans.length < MAX_ACTIVE_LOANS && player && player.cash > 0;

  return (
    <div className="p-3 md:p-4 space-y-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Landmark className="h-5 w-5" style={{ color: '#006a4e' }} /> Bank
        </h2>
        {canTakeLoan && (
          <Button
            size="sm"
            className="text-white text-xs"
            style={{ background: '#006a4e' }}
            onClick={() => setShowNewLoan(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New Loan
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase">Cash</span>
              </div>
              <p className="text-sm font-bold" style={{ color: '#006a4e' }}>
                {player ? formatTaka(player.cash) : '...'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase">Total Debt</span>
              </div>
              <p className="text-sm font-bold text-red-600">
                {formatTaka(totalDebt)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase">Daily Payment</span>
              </div>
              <p className="text-sm font-bold text-orange-600">
                {formatTaka(totalDailyPayment)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase">Active Loans</span>
              </div>
              <p className="text-sm font-bold">
                {activeLoans.length}/{MAX_ACTIVE_LOANS}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Active Loans */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full" style={{ background: '#006a4e' }} />
          Active Loans
        </h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : activeLoans.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <div className="text-3xl mb-2">🏦</div>
              <p className="text-sm text-muted-foreground">No active loans</p>
              <p className="text-xs text-muted-foreground mt-1">Take a loan to expand your business empire!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeLoans.map((loan, i) => {
              const originalDebt = loan.amount + loan.totalInterest;
              const paidOff = originalDebt - loan.remainingDebt;
              const progressPercent = originalDebt > 0 ? (paidOff / originalDebt) * 100 : 0;

              return (
                <motion.div
                  key={loan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="overflow-hidden">
                    <div
                      className="h-0.5"
                      style={{
                        background: 'linear-gradient(90deg, #006a4e, #16a34a)',
                      }}
                    />
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">{formatTaka(loan.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            Taken {new Date(loan.takenAt).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <Badge className="text-[10px] font-medium text-white" style={{ background: '#006a4e' }}>
                          Active
                        </Badge>
                      </div>

                      {/* Progress */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-muted-foreground">Repayment Progress</span>
                          <span className="text-xs font-medium" style={{ color: '#006a4e' }}>
                            {Math.round(progressPercent)}%
                          </span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            Remaining: {formatTaka(loan.remainingDebt)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {loan.daysRemaining} days left
                          </span>
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Daily Payment</p>
                          <p className="text-xs font-semibold text-orange-600">{formatTaka(loan.dailyPayment)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Interest</p>
                          <p className="text-xs font-semibold">{(loan.interestRate * 100).toFixed(0)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Total Interest</p>
                          <p className="text-xs font-semibold">{formatTaka(loan.totalInterest)}</p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => {
                          setRepayLoan(loan);
                          setRepayAmount('');
                        }}
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5 mr-1" />
                        Repay Early
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Loan History */}
      {historyLoans.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <div className="w-1.5 h-4 rounded-full bg-gray-400" />
            History
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {historyLoans.map((loan, i) => (
              <motion.div
                key={loan.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="opacity-70">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center',
                          loan.status === 'PAID_OFF' ? 'bg-green-50' : 'bg-red-50'
                        )}
                      >
                        {loan.status === 'PAID_OFF' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{formatTaka(loan.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(loan.takenAt).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] font-medium',
                        loan.status === 'PAID_OFF' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      )}
                    >
                      {loan.status === 'PAID_OFF' ? 'Paid Off' : 'Defaulted'}
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* New Loan Info Card */}
      {!showNewLoan && activeLoans.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card className="border-dashed">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold">Loan Information</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>&#8226; Flat interest rate: 5% on the loan amount</li>
                    <li>&#8226; Maximum {MAX_ACTIVE_LOANS} active loans at a time</li>
                    <li>&#8226; Max loan: {formatTaka(maxLoan)} (based on level {player?.level || 1})</li>
                    <li>&#8226; Daily payments are automatically deducted</li>
                    <li>&#8226; You can repay early at any time!</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* New Loan Dialog */}
      <Dialog open={showNewLoan} onOpenChange={setShowNewLoan}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" style={{ color: '#006a4e' }} />
              Take New Loan
            </DialogTitle>
            <DialogDescription>
              Borrow money to grow your business. Daily payments will be deducted automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Loan Amount Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Loan Amount</label>
                <span className="text-sm font-bold" style={{ color: '#006a4e' }}>
                  {formatTaka(loanAmount)}
                </span>
              </div>
              <Slider
                value={[loanAmount]}
                onValueChange={(v) => setLoanAmount(v[0])}
                min={MIN_LOAN}
                max={maxLoan}
                step={10000}
                className="w-full"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{formatTaka(MIN_LOAN)}</span>
                <span>{formatTaka(maxLoan)}</span>
              </div>
            </div>

            {/* Duration Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => setLoanDays(opt.days)}
                    className={cn(
                      'p-2.5 rounded-lg border text-center transition-all',
                      loanDays === opt.days
                        ? 'text-white border-transparent shadow-sm'
                        : 'bg-white text-muted-foreground border-border hover:border-green-300'
                    )}
                    style={loanDays === opt.days ? { background: '#006a4e' } : {}}
                  >
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className="text-[10px] opacity-80">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Loan Summary */}
            <Card className="bg-muted/50">
              <CardContent className="p-3 space-y-2">
                <p className="text-xs font-semibold text-center mb-1">Loan Summary</p>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Principal</span>
                  <span className="font-medium">{formatTaka(loanAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Interest (5%)</span>
                  <span className="font-medium text-orange-600">+{formatTaka(previewInterest)}</span>
                </div>
                <div className="border-t my-1" />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Repayment</span>
                  <span className="font-bold">{formatTaka(previewTotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Daily Payment</span>
                  <span className="font-bold" style={{ color: '#006a4e' }}>{formatTaka(previewDaily)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewLoan(false)}
              disabled={takingLoan}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              className="text-white text-xs"
              style={{ background: '#006a4e' }}
              onClick={handleTakeLoan}
              disabled={takingLoan}
            >
              {takingLoan ? 'Processing...' : `Take ${formatTaka(loanAmount)} Loan`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repay Dialog */}
      <Dialog open={!!repayLoan} onOpenChange={(open) => { if (!open) setRepayLoan(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5" style={{ color: '#006a4e' }} />
              Repay Loan
            </DialogTitle>
            <DialogDescription>
              Make an early repayment to reduce your debt faster.
            </DialogDescription>
          </DialogHeader>

          {repayLoan && (
            <div className="space-y-4 py-2">
              <Card className="bg-muted/50">
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Original Loan</span>
                    <span className="font-medium">{formatTaka(repayLoan.amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Remaining Debt</span>
                    <span className="font-bold text-red-600">{formatTaka(repayLoan.remainingDebt)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Your Cash</span>
                    <span className="font-medium" style={{ color: '#006a4e' }}>
                      {player ? formatTaka(player.cash) : '...'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <label className="text-sm font-medium">Repayment Amount</label>
                <Input
                  type="number"
                  placeholder="Enter amount..."
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  min={1}
                  max={Math.min(repayLoan.remainingDebt, player?.cash || 0)}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px]"
                    onClick={() => setRepayAmount(String(Math.round(repayLoan.dailyPayment)))}
                  >
                    1 Day ({formatTaka(repayLoan.dailyPayment)})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px]"
                    onClick={() => setRepayAmount(String(Math.round(repayLoan.remainingDebt / 2)))}
                  >
                    Half ({formatTaka(repayLoan.remainingDebt / 2)})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px]"
                    onClick={() => setRepayAmount(String(Math.round(repayLoan.remainingDebt)))}
                  >
                    Full ({formatTaka(repayLoan.remainingDebt)})
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRepayLoan(null)}
              disabled={repaying}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              className="text-white text-xs"
              style={{ background: '#006a4e' }}
              onClick={handleRepay}
              disabled={repaying || !repayAmount || parseFloat(repayAmount) <= 0}
            >
              {repaying ? 'Processing...' : `Repay ${repayAmount ? formatTaka(parseFloat(repayAmount)) : '...'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
