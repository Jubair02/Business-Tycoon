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
import { Landmark, Plus, Wallet, CreditCard, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowDownToLine, ShieldCheck, Percent } from 'lucide-react';
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
    <div className="p-3 md:p-4 space-y-5 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
            <Landmark className="h-4 w-4 text-white" />
          </div>
          <span className="game-badge-gradient">Bangladesh Central Bank</span>
        </h2>
        {canTakeLoan && (
          <Button
            size="sm"
            className="text-white text-xs rounded-lg shadow-sm hover:shadow-md transition-shadow"
            style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}
            onClick={() => setShowNewLoan(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New Loan
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="game-card-glow-subtle rounded-xl">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center">
                  <Wallet className="h-3 w-3" style={{ color: '#006a4e' }} />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Cash</span>
              </div>
              <p className="text-sm font-bold" style={{ color: '#006a4e' }}>
                {player ? formatTaka(player.cash) : '...'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="game-card-glow-subtle rounded-xl">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center">
                  <CreditCard className="h-3 w-3 text-red-500" />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Debt</span>
              </div>
              <p className="text-sm font-bold text-red-600">
                {formatTaka(totalDebt)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="game-card-glow-subtle rounded-xl">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center">
                  <Clock className="h-3 w-3 text-amber-600" />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Daily Payment</span>
              </div>
              <p className="text-sm font-bold text-orange-600">
                {formatTaka(totalDailyPayment)}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="game-card-glow-subtle rounded-xl">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center">
                  <Landmark className="h-3 w-3" style={{ color: '#006a4e' }} />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Active Loans</span>
              </div>
              <p className="text-sm font-bold">
                <span style={{ color: '#006a4e' }}>{activeLoans.length}</span>
                <span className="text-muted-foreground font-normal">/{MAX_ACTIVE_LOANS}</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Active Loans */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2.5">
          <div className="w-1.5 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, #006a4e, #00a86b)' }} />
          <span>Active Loans</span>
          {activeLoans.length > 0 && (
            <span className="game-pulse-soft w-2 h-2 rounded-full bg-green-500 inline-block" />
          )}
        </h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Card key={i} className="rounded-xl">
                <CardContent className="p-4">
                  <Skeleton className="h-24 w-full rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : activeLoans.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-dashed rounded-xl">
              <CardContent className="py-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <Landmark className="h-7 w-7" style={{ color: '#006a4e', opacity: 0.6 }} />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No active loans</p>
                <p className="text-xs text-muted-foreground font-medium max-w-[200px] mx-auto">Take a loan to expand your business empire!</p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {activeLoans.map((loan, i) => {
              const originalDebt = loan.amount + loan.totalInterest;
              const paidOff = originalDebt - loan.remainingDebt;
              const progressPercent = originalDebt > 0 ? (paidOff / originalDebt) * 100 : 0;

              return (
                <motion.div
                  key={loan.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Card className="rounded-xl overflow-hidden game-card-glow-subtle">
                    <div
                      className="h-1"
                      style={{
                        background: 'linear-gradient(90deg, #006a4e, #00a86b, #006a4e)',
                      }}
                    />
                    <CardContent className="p-4 space-y-3.5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'linear-gradient(135deg, rgba(0,106,78,0.08), rgba(0,168,107,0.12))' }}>
                            <CreditCard className="h-5 w-5" style={{ color: '#006a4e' }} />
                          </div>
                          <div>
                            <p className="text-base font-bold" style={{ color: '#006a4e' }}>{formatTaka(loan.amount)}</p>
                            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                              Taken {new Date(loan.takenAt).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <Badge className="text-[10px] font-semibold text-white rounded-full px-2.5 py-0.5" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-300 mr-1.5 inline-block game-pulse-soft" />
                          Active
                        </Badge>
                      </div>

                      {/* Progress */}
                      <div className="bg-muted/40 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-muted-foreground font-medium">Repayment Progress</span>
                          <span className="text-xs font-bold" style={{ color: '#006a4e' }}>
                            {Math.round(progressPercent)}%
                          </span>
                        </div>
                        <Progress value={progressPercent} className="h-2 rounded-full" />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            Remaining: <span className="text-foreground font-semibold">{formatTaka(loan.remainingDebt)}</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {loan.daysRemaining} days left
                          </span>
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 rounded-lg bg-amber-50/60">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Daily Pay</p>
                          <p className="text-xs font-bold text-orange-600 mt-0.5">{formatTaka(loan.dailyPayment)}</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-green-50/60">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Interest</p>
                          <p className="text-xs font-bold mt-0.5" style={{ color: '#006a4e' }}>{(loan.interestRate * 100).toFixed(0)}%</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted/40">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Total Int.</p>
                          <p className="text-xs font-bold mt-0.5">{formatTaka(loan.totalInterest)}</p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs rounded-lg font-medium h-9 border-dashed transition-all hover:border-solid hover:shadow-sm"
                        onClick={() => {
                          setRepayLoan(loan);
                          setRepayAmount('');
                        }}
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
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
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2.5">
            <div className="w-1.5 h-5 rounded-full bg-gray-300" />
            History
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto game-scrollbar">
            {historyLoans.map((loan, i) => (
              <motion.div
                key={loan.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="rounded-xl opacity-75 hover:opacity-100 transition-opacity">
                  <CardContent className="p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center',
                          loan.status === 'PAID_OFF' ? 'bg-green-50' : 'bg-red-50'
                        )}
                      >
                        {loan.status === 'PAID_OFF' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{formatTaka(loan.amount)}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {new Date(loan.takenAt).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-[10px] font-semibold rounded-full px-2.5',
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
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="rounded-xl border-dashed">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Loan Information</p>
                  <ul className="text-xs text-muted-foreground font-medium space-y-1.5">
                    <li className="flex items-start gap-2">
                      <Percent className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                      Flat interest rate: 5% on the loan amount
                    </li>
                    <li className="flex items-start gap-2">
                      <ShieldCheck className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                      Maximum {MAX_ACTIVE_LOANS} active loans at a time
                    </li>
                    <li className="flex items-start gap-2">
                      <Landmark className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                      Max loan: {formatTaka(maxLoan)} (based on level {player?.level || 1})
                    </li>
                    <li className="flex items-start gap-2">
                      <Clock className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                      Daily payments are automatically deducted
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 shrink-0" />
                      You can repay early at any time!
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* New Loan Dialog */}
      <Dialog open={showNewLoan} onOpenChange={setShowNewLoan}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
                <Landmark className="h-4 w-4 text-white" />
              </div>
              Take New Loan
            </DialogTitle>
            <DialogDescription>
              Borrow money to grow your business. Daily payments will be deducted automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Loan Amount Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Loan Amount</label>
                <span className="text-sm font-bold game-badge-gradient">
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
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                <span>{formatTaka(MIN_LOAN)}</span>
                <span>{formatTaka(maxLoan)}</span>
              </div>
            </div>

            {/* Duration Selection */}
            <div className="space-y-2.5">
              <label className="text-sm font-medium">Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.days}
                    onClick={() => setLoanDays(opt.days)}
                    className={cn(
                      'p-3 rounded-xl border text-center transition-all duration-200',
                      loanDays === opt.days
                        ? 'text-white border-transparent shadow-md'
                        : 'bg-white text-muted-foreground border-border hover:border-green-300 hover:shadow-sm'
                    )}
                    style={loanDays === opt.days ? { background: 'linear-gradient(135deg, #006a4e, #00895e)' } : {}}
                  >
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-[10px] opacity-80 font-medium">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Loan Summary */}
            <Card className="rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(0,106,78,0.04), rgba(0,168,107,0.06))' }}>
              <CardContent className="p-4 space-y-2.5">
                <p className="text-xs font-bold text-center uppercase tracking-wider text-muted-foreground">Loan Summary</p>
                <hr className="game-divider-gradient" />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Principal</span>
                  <span className="font-semibold">{formatTaka(loanAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Interest (5%)</span>
                  <span className="font-semibold text-orange-600">+{formatTaka(previewInterest)}</span>
                </div>
                <hr className="game-divider-gradient" />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Total Repayment</span>
                  <span className="font-bold">{formatTaka(previewTotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Daily Payment</span>
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
              className="text-xs rounded-lg"
            >
              Cancel
            </Button>
            <Button
              className="text-white text-xs rounded-lg shadow-sm hover:shadow-md transition-shadow"
              style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}
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
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
                <ArrowDownToLine className="h-4 w-4 text-white" />
              </div>
              Repay Loan
            </DialogTitle>
            <DialogDescription>
              Make an early repayment to reduce your debt faster.
            </DialogDescription>
          </DialogHeader>

          {repayLoan && (
            <div className="space-y-4 py-2">
              <Card className="rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(0,106,78,0.04), rgba(0,168,107,0.06))' }}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Original Loan</span>
                    <span className="font-semibold">{formatTaka(repayLoan.amount)}</span>
                  </div>
                  <hr className="game-divider-gradient" />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Remaining Debt</span>
                    <span className="font-bold text-red-600">{formatTaka(repayLoan.remainingDebt)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Your Cash</span>
                    <span className="font-bold" style={{ color: '#006a4e' }}>
                      {player ? formatTaka(player.cash) : '...'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2.5">
                <label className="text-sm font-medium">Repayment Amount</label>
                <Input
                  type="number"
                  placeholder="Enter amount..."
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  min={1}
                  max={Math.min(repayLoan.remainingDebt, player?.cash || 0)}
                  className="rounded-lg"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] rounded-lg flex-1 font-medium"
                    onClick={() => setRepayAmount(String(Math.round(repayLoan.dailyPayment)))}
                  >
                    1 Day
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] rounded-lg flex-1 font-medium"
                    onClick={() => setRepayAmount(String(Math.round(repayLoan.remainingDebt / 2)))}
                  >
                    Half
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] rounded-lg flex-1 font-medium"
                    onClick={() => setRepayAmount(String(Math.round(repayLoan.remainingDebt)))}
                  >
                    Full
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
              className="text-xs rounded-lg"
            >
              Cancel
            </Button>
            <Button
              className="text-white text-xs rounded-lg shadow-sm hover:shadow-md transition-shadow"
              style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}
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
