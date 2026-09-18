'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Landmark, Plus, Wallet, CreditCard, Clock, CheckCircle2, XCircle,
  AlertTriangle, ArrowDownToLine, ShieldCheck, Percent, TrendingUp,
  History, Gauge,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatTaka } from '@/lib/game-data';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api-error';

const DURATION_OPTIONS = [
  { days: 10, label: '10 days', desc: 'Short term' },
  { days: 20, label: '20 days', desc: 'Medium term' },
  { days: 30, label: '30 days', desc: 'Long term' },
];

const INTEREST_RATE = 0.05;
const MIN_LOAN = 50000;
const MAX_ACTIVE_LOANS = 3;

const ease = [0.16, 1, 0.3, 1] as const;

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

/* Gauge geometry — a 270° arc reads as a dial rather than a pie. */
const GAUGE_R = 34;
const GAUGE_C = 2 * Math.PI * GAUGE_R;
const GAUGE_ARC = GAUGE_C * 0.75;

function CreditGauge({ score, tone }: { score: number; tone: string }) {
  return (
    <div className={cn('relative h-20 w-20 shrink-0 sm:h-24 sm:w-24', tone)}>
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-[135deg] sm:h-24 sm:w-24" aria-hidden="true">
        <circle
          cx="40" cy="40" r={GAUGE_R}
          fill="none"
          stroke="color-mix(in oklch, var(--_t) 20%, var(--bt-surface-3))"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${GAUGE_ARC} ${GAUGE_C}`}
        />
        <circle
          cx="40" cy="40" r={GAUGE_R}
          fill="none"
          stroke="var(--_t)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * GAUGE_ARC} ${GAUGE_C}`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="bt-figure bt-tone-text text-2xl">{score}</span>
        <span className="bt-label mt-0.5 text-[9px]">score</span>
      </div>
    </div>
  );
}

/** Pure loader — no state, so the mount effect and the post-action refresh
 *  each own their own transition instead of sharing one setState path. */
async function loadLoans(): Promise<Loan[] | null> {
  try {
    const res = await fetch('/api/loans');
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
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
    const data = await loadLoans();
    if (data) setLoans(data);
    setLoading(false);
  }, []);

  const fetchPlayer = useCallback(async () => {
    try {
      const res = await fetch('/api/player');
      if (res.ok) setPlayer(await res.json());
    } catch {
      // silent
    }
  }, [setPlayer]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const data = await loadLoans();
      if (cancelled) return;
      if (data) setLoans(data);
      setLoading(false);
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const activeLoans = useMemo(() => loans.filter((l) => l.status === 'ACTIVE'), [loans]);
  const historyLoans = useMemo(() => loans.filter((l) => l.status !== 'ACTIVE'), [loans]);

  const totalDebt = activeLoans.reduce((sum, l) => sum + l.remainingDebt, 0);
  const totalDailyPayment = activeLoans.reduce((sum, l) => sum + l.dailyPayment, 0);
  const maxLoan = player ? player.level * 200000 : 200000;
  const availableCredit = Math.max(0, maxLoan - totalDebt);
  const creditUsed = maxLoan > 0 ? (totalDebt / maxLoan) * 100 : 0;

  const totalPaidActive = activeLoans.reduce(
    (sum, l) => sum + (l.amount + l.totalInterest - l.remainingDebt), 0,
  );
  const totalPaidHistory = historyLoans
    .filter((l) => l.status === 'PAID_OFF')
    .reduce((sum, l) => sum + l.amount + l.totalInterest, 0);
  const totalPaid = totalPaidActive + totalPaidHistory;

  // Base 70, +10 per loan cleared, -15 per default.
  const paidOffCount = historyLoans.filter((l) => l.status === 'PAID_OFF').length;
  const defaultedCount = historyLoans.filter((l) => l.status === 'DEFAULTED').length;
  const creditScore = Math.min(100, Math.max(0, 70 + paidOffCount * 10 - defaultedCount * 15));
  const creditTone = creditScore >= 80 ? 'bt-tone-emerald' : creditScore >= 50 ? 'bt-tone-amber' : 'bt-tone-crimson';
  const creditLabel = creditScore >= 80 ? 'Excellent' : creditScore >= 50 ? 'Fair' : 'Poor';

  const previewInterest = loanAmount * INTEREST_RATE;
  const previewTotal = loanAmount + previewInterest;
  const previewDaily = previewTotal / loanDays;
  const sliderMax = Math.max(availableCredit, MIN_LOAN);

  const canTakeLoan = activeLoans.length < MAX_ACTIVE_LOANS && availableCredit >= MIN_LOAN;

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
        toast.error(apiErrorMessage(err, 'Failed to take loan'));
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
        toast.error(apiErrorMessage(err, 'Repayment failed'));
      }
    } catch {
      toast.error('Network error');
    } finally {
      setRepaying(false);
    }
  };

  return (
    <div className="bt-page bt-page-narrow bt-stack-lg">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bt-chip h-10 w-10" aria-hidden="true">
            <Landmark className="h-5 w-5" />
          </span>
          <div>
            <h2 className="bt-gradient-text text-xl font-bold leading-tight">Central Bank</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Borrow against your level, repay early whenever you like
            </p>
          </div>
        </div>
        {canTakeLoan && (
          <button
            type="button"
            onClick={() => setShowNewLoan(true)}
            className="bt-btn-primary bt-tap gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> New loan
          </button>
        )}
      </header>

      {/* ── Credit standing ──────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="bt-surface-raised bt-edge bt-ambient overflow-hidden p-4 sm:p-5"
        aria-label="Credit standing"
      >
        <div className="flex items-center gap-4">
          <CreditGauge score={creditScore} tone={creditTone} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bt-label">Credit rating</span>
              <Badge className={cn('bt-tone rounded-full border px-2 py-0 text-[10px] font-bold', creditTone)}>
                {creditLabel}
              </Badge>
            </div>

            <p className="bt-figure bt-gradient-text mt-1.5 text-2xl sm:text-3xl">
              {formatTaka(availableCredit)}
            </p>
            <p className="bt-numeric mt-0.5 text-xs text-muted-foreground">
              available of {formatTaka(maxLoan)} limit · level {player?.level ?? 1}
            </p>

            {/* Utilisation: how much of the limit is already committed. */}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="bt-label">Credit used</span>
                <span className="bt-numeric text-[11px] font-semibold text-muted-foreground">
                  {creditUsed.toFixed(0)}%
                </span>
              </div>
              <div className={cn('bt-meter', creditUsed > 75 ? 'bt-tone-crimson' : creditUsed > 40 ? 'bt-tone-amber' : 'bt-tone-emerald')}>
                <span style={{ width: `${Math.min(100, creditUsed)}%`, background: 'var(--_t)' }} />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Position ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Debt position">
        {[
          { label: 'Cash', value: player ? formatTaka(player.cash) : '—', Icon: Wallet, tone: 'bt-tone-emerald' },
          { label: 'Total debt', value: formatTaka(totalDebt), Icon: CreditCard, tone: 'bt-tone-crimson' },
          { label: 'Per day', value: formatTaka(totalDailyPayment), Icon: Clock, tone: 'bt-tone-amber' },
          { label: 'Repaid', value: formatTaka(totalPaid), Icon: TrendingUp, tone: 'bt-tone-gold' },
        ].map(({ label, value, Icon, tone }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 + i * 0.05, ease }}
            className={cn('bt-tile p-3.5', tone)}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="bt-tone-text h-3.5 w-3.5" aria-hidden="true" />
              <span className="bt-label">{label}</span>
            </div>
            <p className="bt-figure bt-tone-text mt-1.5 text-base">{value}</p>
          </motion.div>
        ))}
      </section>

      {/* ── Active loans ─────────────────────────────────────────── */}
      <section aria-label="Active loans">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="bt-section-title text-sm">
            <span className="bt-gradient-text">Active loans</span>
            <span className="bt-numeric rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {activeLoans.length}/{MAX_ACTIVE_LOANS}
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2].map((i) => (
              <div key={i} className="bt-surface p-4">
                <div className="bt-skeleton h-28 w-full" />
              </div>
            ))}
          </div>
        ) : activeLoans.length === 0 ? (
          <div className="bt-surface bt-empty">
            <span className="bt-chip bt-tone-emerald mb-3 h-14 w-14" aria-hidden="true">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h4 className="text-sm font-semibold">Debt free</h4>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
              No active loans. Borrow when you need capital to expand faster than cash flow allows.
            </p>
            {canTakeLoan && (
              <button
                type="button"
                onClick={() => setShowNewLoan(true)}
                className="bt-btn-primary bt-tap mt-4 gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Take a loan
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {activeLoans.map((loan, i) => {
              const originalDebt = loan.amount + loan.totalInterest;
              const paidOff = originalDebt - loan.remainingDebt;
              const progress = originalDebt > 0 ? (paidOff / originalDebt) * 100 : 0;
              // Urgency drives the rail: a loan due in days should look different.
              const tone = loan.daysRemaining <= 3
                ? 'bt-tone-crimson'
                : loan.daysRemaining <= 7 ? 'bt-tone-amber' : 'bt-tone-emerald';

              return (
                <motion.article
                  key={loan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06, ease }}
                  className={cn('bt-surface bt-rail overflow-hidden p-4 pl-5', tone)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="bt-chip h-10 w-10" aria-hidden="true">
                        <CreditCard className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="bt-figure text-lg">{formatTaka(loan.amount)}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Taken{' '}
                          {new Date(loan.takenAt).toLocaleDateString('en-BD', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Badge className={cn('bt-tone gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold', tone)}>
                        <span className="game-pulse-soft inline-block h-1.5 w-1.5 rounded-full bg-current" />
                        {loan.daysRemaining}d left
                      </Badge>
                      <Badge variant="outline" className="bt-numeric gap-0.5 rounded-full px-2 py-0 text-[9px] font-semibold">
                        <Percent className="h-2.5 w-2.5" aria-hidden="true" />
                        {(loan.interestRate * 100).toFixed(0)}% APR
                      </Badge>
                    </div>
                  </div>

                  {/* Repayment progress */}
                  <div className={cn('bt-well-tone mt-3.5 p-3', tone)}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="bt-label">Repayment progress</span>
                      <span className="bt-figure bt-tone-text text-sm">{Math.round(progress)}%</span>
                    </div>
                    <div className={cn('bt-meter h-2.5', tone)}>
                      <span
                        style={{
                          width: `${progress}%`,
                          background: 'linear-gradient(90deg,color-mix(in oklch,var(--_t) 65%,transparent),var(--_t))',
                        }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="bt-numeric">
                        Paid <span className="font-semibold text-foreground">{formatTaka(paidOff)}</span>
                      </span>
                      <span className="bt-numeric">
                        Left <span className="font-semibold text-foreground">{formatTaka(loan.remainingDebt)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Daily', value: formatTaka(loan.dailyPayment) },
                      { label: 'Interest', value: `${(loan.interestRate * 100).toFixed(0)}%` },
                      { label: 'Total int.', value: formatTaka(loan.totalInterest) },
                    ].map((cell) => (
                      <div key={cell.label} className="bt-well p-2 text-center">
                        <p className="bt-label">{cell.label}</p>
                        <p className="bt-figure mt-1 text-xs">{cell.value}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => { setRepayLoan(loan); setRepayAmount(''); }}
                    className="bt-tap bt-surface bt-interactive mt-3 w-full gap-1.5 rounded-lg py-2.5 text-xs font-semibold"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
                    Repay early
                  </button>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── How loans work ───────────────────────────────────────── */}
      {!loading && activeLoans.length === 0 && (
        <section className="bt-surface p-4" aria-label="Loan terms">
          <h3 className="bt-label mb-2.5 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Loan terms
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              { Icon: Percent, text: `Flat ${(INTEREST_RATE * 100).toFixed(0)}% interest on the principal` },
              { Icon: ShieldCheck, text: `Up to ${MAX_ACTIVE_LOANS} loans running at once` },
              { Icon: Landmark, text: `Your limit is ${formatTaka(maxLoan)} at level ${player?.level ?? 1}` },
              { Icon: Clock, text: 'Daily payments are deducted automatically' },
              { Icon: CheckCircle2, text: 'Repay early any time, no penalty' },
              { Icon: Gauge, text: 'Clearing loans raises your credit score' },
            ].map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--bt-emerald)]" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── History ──────────────────────────────────────────────── */}
      {historyLoans.length > 0 && (
        <section aria-label="Loan history">
          <h3 className="bt-section-title mb-3 text-sm">
            <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="bt-gradient-text">History</span>
          </h3>
          <div className="game-scrollbar max-h-72 space-y-2 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {historyLoans.map((loan, i) => {
                const cleared = loan.status === 'PAID_OFF';
                return (
                  <motion.div
                    key={loan.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.03, ease }}
                    className={cn(
                      'bt-surface bt-rail flex items-center justify-between gap-3 p-3 pl-4',
                      cleared ? 'bt-tone-emerald' : 'bt-tone-crimson',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="bt-chip h-9 w-9" aria-hidden="true">
                        {cleared ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="bt-figure text-xs">{formatTaka(loan.amount)}</p>
                        <p className="bt-numeric mt-0.5 text-[10px] text-muted-foreground">
                          {new Date(loan.takenAt).toLocaleDateString('en-BD', {
                            month: 'short', day: 'numeric',
                          })}{' '}
                          · {(loan.interestRate * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <Badge className={cn('bt-tone shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold', cleared ? 'bt-tone-emerald' : 'bt-tone-crimson')}>
                      {cleared ? 'Paid off' : 'Defaulted'}
                    </Badge>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* ── New loan dialog ──────────────────────────────────────── */}
      <Dialog open={showNewLoan} onOpenChange={setShowNewLoan}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="bt-chip h-9 w-9" aria-hidden="true">
                <Landmark className="h-4 w-4" />
              </span>
              Take a new loan
            </DialogTitle>
            <DialogDescription>
              Daily payments are deducted automatically until the balance clears.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Amount */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Amount</span>
                <span className="bt-figure bt-gradient-text text-base">{formatTaka(loanAmount)}</span>
              </div>
              <Slider

                value={[loanAmount]}
                onValueChange={(v) => setLoanAmount(v[0])}
                min={MIN_LOAN}
                max={sliderMax}
                step={10000}
                className="w-full"
                aria-label="Loan amount"
              />
              <div className="flex items-center justify-between">
                <span className="bt-numeric text-[10px] text-muted-foreground">{formatTaka(MIN_LOAN)}</span>
                <div className="bt-seg" role="group" aria-label="Quick amounts">
                  {[
                    { label: '25%', value: Math.max(MIN_LOAN, Math.round(sliderMax * 0.25 / 10000) * 10000) },
                    { label: '50%', value: Math.max(MIN_LOAN, Math.round(sliderMax * 0.5 / 10000) * 10000) },
                    { label: 'Max', value: sliderMax },
                  ].map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      className="bt-seg-item"
                      data-active={loanAmount === q.value}
                      onClick={() => setLoanAmount(q.value)}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2.5">
              <span className="text-sm font-medium">Duration</span>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Loan duration">
                {DURATION_OPTIONS.map((opt) => {
                  const active = loanDays === opt.days;
                  return (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => setLoanDays(opt.days)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-xl p-3 text-center transition-all duration-200',
                        active
                          ? 'bt-btn-primary'
                          : 'bt-surface bt-interactive text-muted-foreground',
                      )}
                    >
                      <p className="text-xs font-bold">{opt.label}</p>
                      <p className="text-[10px] font-medium opacity-80">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="bt-well-tone bt-tone-emerald space-y-2.5 p-4">
              <p className="bt-label text-center">Loan summary</p>
              <hr className="bt-divider" />
              {[
                { label: 'Principal', value: formatTaka(loanAmount) },
                { label: `Interest (${(INTEREST_RATE * 100).toFixed(0)}%)`, value: `+${formatTaka(previewInterest)}`, tone: 'bt-text-loss' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-xs">
                  <span className="font-medium text-muted-foreground">{row.label}</span>
                  <span className={cn('bt-numeric font-semibold', row.tone)}>{row.value}</span>
                </div>
              ))}
              <hr className="bt-divider" />
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Total repayment</span>
                <span className="bt-figure">{formatTaka(previewTotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Daily payment</span>
                <span className="bt-figure bt-text-profit">{formatTaka(previewDaily)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewLoan(false)} disabled={takingLoan} className="rounded-lg text-xs">
              Cancel
            </Button>
            <button
              type="button"
              className="bt-btn-primary bt-tap rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-60"
              onClick={handleTakeLoan}
              disabled={takingLoan}
            >
              {takingLoan ? 'Processing…' : `Borrow ${formatTaka(loanAmount)}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Repay dialog ─────────────────────────────────────────── */}
      <Dialog open={!!repayLoan} onOpenChange={(open) => { if (!open) setRepayLoan(null); }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span className="bt-chip h-9 w-9" aria-hidden="true">
                <ArrowDownToLine className="h-4 w-4" />
              </span>
              Repay early
            </DialogTitle>
            <DialogDescription>
              Pay down the balance ahead of schedule to cut the debt faster.
            </DialogDescription>
          </DialogHeader>

          {repayLoan && (
            <div className="space-y-4 py-2">
              <div className="bt-well space-y-2 p-4">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Original loan</span>
                  <span className="bt-numeric font-semibold">{formatTaka(repayLoan.amount)}</span>
                </div>
                <hr className="bt-divider" />
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Remaining debt</span>
                  <span className="bt-figure bt-text-loss">{formatTaka(repayLoan.remainingDebt)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Your cash</span>
                  <span className="bt-figure bt-text-profit">
                    {player ? formatTaka(player.cash) : '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <label htmlFor="repay-amount" className="text-sm font-medium">Repayment amount</label>
                <Input
                  id="repay-amount"
                  type="number"
                  inputMode="numeric"
                  placeholder="Enter amount…"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  min={1}
                  max={Math.min(repayLoan.remainingDebt, player?.cash || 0)}
                  className="bt-numeric h-11 rounded-lg"
                />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'One day', value: Math.round(repayLoan.dailyPayment) },
                    { label: 'Half', value: Math.round(repayLoan.remainingDebt / 2) },
                    { label: 'Full', value: Math.round(repayLoan.remainingDebt) },
                  ].map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setRepayAmount(String(q.value))}
                      className="bt-surface bt-interactive bt-tap rounded-lg py-2 text-[11px] font-semibold"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                {repayAmount && parseFloat(repayAmount) > (player?.cash ?? 0) && (
                  <p className="bt-text-loss flex items-center gap-1.5 text-[11px] font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    That is more than your available cash.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRepayLoan(null)} disabled={repaying} className="rounded-lg text-xs">
              Cancel
            </Button>
            <button
              type="button"
              className="bt-btn-primary bt-tap rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-60"
              onClick={handleRepay}
              disabled={repaying || !repayAmount || parseFloat(repayAmount) <= 0}
            >
              {repaying ? 'Processing…' : `Repay ${repayAmount ? formatTaka(parseFloat(repayAmount)) : '…'}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
