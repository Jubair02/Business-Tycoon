'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Coffee, ShoppingBasket, Shirt, UtensilsCrossed } from 'lucide-react';
import AuthPanel from '@/components/game/AuthPanel';

const VENTURES = [
  { icon: Coffee, label: 'Tea Stall', desc: 'Low-risk entry' },
  { icon: ShoppingBasket, label: 'Grocery', desc: 'Daily essentials' },
  { icon: Shirt, label: 'Clothing', desc: 'Fashion retail' },
  { icon: UtensilsCrossed, label: 'Restaurant', desc: 'Bangladeshi cuisine' },
];

interface WelcomeScreenProps {
  /** Whether the server can offer Google sign-in. */
  googleEnabled: boolean;
}

export default function WelcomeScreen({ googleEnabled }: WelcomeScreenProps) {
  const reduceMotion = useReducedMotion();

  // Motion is opt-out aware: everything collapses to a plain fade when
  // the user prefers reduced motion.
  const rise = (delay: number) =>
    reduceMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="bt-ambient relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      {/* Fine grid, barely there — gives the void some structure */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, #000, transparent)',
        }}
      />

      <div className="relative z-10 w-full max-w-[26rem] sm:max-w-md">
        {/* ─── Masthead ─────────────────────────────────────────── */}
        <motion.header {...rise(0)} className="mb-8 text-center sm:mb-10">
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.1 }}
            className="mx-auto mb-5 inline-flex items-center gap-2.5 rounded-full border border-[var(--bt-hairline)] bg-[var(--bt-surface-1)]/70 px-4 py-1.5 backdrop-blur-xl"
          >
            <span className="text-lg leading-none" aria-hidden="true">🇧🇩</span>
            <span className="bt-label !tracking-[0.18em] !text-[0.6875rem]">Bangladesh</span>
          </motion.div>

          <h1 className="bt-gradient-text text-[2.25rem] font-black leading-[1.05] tracking-[-0.035em] sm:text-5xl">
            Business Tycoon
          </h1>

          <div
            aria-hidden="true"
            className="mx-auto mt-4 h-px w-28 bg-gradient-to-r from-transparent via-[var(--bt-gold)] to-transparent"
          />

          <p className="bt-label mt-4 !tracking-[0.3em]">Build · Expand · Dominate</p>

          <p className="mx-auto mt-3 max-w-[22rem] text-sm leading-relaxed text-muted-foreground">
            Grow a humble tea stall into a conglomerate spanning every city in Bangladesh.
          </p>
        </motion.header>

        {/* ─── Sign in / create account ─────────────────────── */}
        <motion.div {...rise(0.18)}>
          <AuthPanel googleEnabled={googleEnabled} />
        </motion.div>

        {/* ─── Venture preview ──────────────────────────────────── */}
        <motion.ul {...rise(0.3)} className="mt-6 grid grid-cols-2 gap-2.5">
          {VENTURES.map((venture, idx) => {
            const Icon = venture.icon;
            return (
              <motion.li
                key={venture.label}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34 + idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
                className="bt-surface flex items-center gap-2.5 p-3"
              >
                <span className="bt-medallion bt-medallion-sm !h-9 !w-9">
                  <Icon className="h-4 w-4 text-[var(--bt-emerald)]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] font-semibold leading-tight">
                    {venture.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{venture.desc}</span>
                </span>
              </motion.li>
            );
          })}
        </motion.ul>

        <motion.p {...rise(0.5)} className="mt-7 text-center text-xs text-muted-foreground">
          A Bangladesh business simulation
        </motion.p>
      </div>
    </div>
  );
}
