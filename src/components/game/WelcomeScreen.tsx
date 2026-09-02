'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface WelcomeScreenProps {
  onRegister: (name: string) => Promise<void>;
  isLoading: boolean;
}

export default function WelcomeScreen({ onRegister, isLoading }: WelcomeScreenProps) {
  const [name, setName] = useState('');

  const handleStart = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Please enter your name!');
      return;
    }
    if (trimmed.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    if (trimmed.length > 30) {
      toast.error('Name must be 30 characters or less');
      return;
    }
    await onRegister(trimmed);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-green-50 via-white to-red-50 game-pattern-bg relative overflow-hidden">
      {/* Floating particles using pseudo-elements via wrapper divs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <span className="absolute top-[15%] left-[10%] w-2 h-2 rounded-full bg-green-400/20" style={{ animation: 'particle-float-1 8s ease-in-out infinite' }} />
        <span className="absolute top-[25%] right-[15%] w-3 h-3 rounded-full bg-red-400/15" style={{ animation: 'particle-float-2 10s ease-in-out infinite 1s' }} />
        <span className="absolute top-[60%] left-[20%] w-2.5 h-2.5 rounded-full bg-green-500/15" style={{ animation: 'particle-float-3 9s ease-in-out infinite 2s' }} />
        <span className="absolute top-[40%] right-[25%] w-1.5 h-1.5 rounded-full bg-red-300/20" style={{ animation: 'particle-float-1 11s ease-in-out infinite 0.5s' }} />
        <span className="absolute top-[70%] right-[10%] w-2 h-2 rounded-full bg-green-300/18" style={{ animation: 'particle-float-2 7s ease-in-out infinite 3s' }} />
        <span className="absolute top-[10%] left-[50%] w-1.5 h-1.5 rounded-full bg-red-400/12" style={{ animation: 'particle-float-3 12s ease-in-out infinite 1.5s' }} />
        <span className="absolute top-[80%] left-[45%] w-2 h-2 rounded-full bg-green-400/12" style={{ animation: 'particle-float-1 9s ease-in-out infinite 4s' }} />
        <span className="absolute top-[50%] left-[70%] w-3 h-3 rounded-full bg-red-300/10" style={{ animation: 'particle-float-2 8s ease-in-out infinite 2.5s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="text-6xl mb-4 inline-block relative"
          >
            {/* Pulsing glow behind the flag emoji */}
            <span className="absolute inset-0 rounded-full blur-xl opacity-40" style={{ background: 'radial-gradient(circle, rgba(0,106,78,0.6) 0%, rgba(244,42,65,0.3) 50%, transparent 70%)', animation: 'pulse 2.5s ease-in-out infinite' }} />
            <span className="relative game-flag-glow">🇧🇩</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl md:text-4xl font-bold mb-2 game-gradient-text relative"
          >
            Bangladesh
            {/* Thin animated gradient line below main title */}
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, #006a4e, #00a86b, #f42a41, transparent)', backgroundSize: '200% 100%', animation: 'shimmer 3s linear infinite' }} />
          </motion.h1>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-2xl md:text-3xl font-bold mb-3"
            style={{ color: '#f42a41' }}
          >
            Business Tycoon
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="text-sm font-semibold tracking-[0.25em] uppercase"
            style={{ color: '#006a4e' }}
          >
            Build. Expand. Dominate.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-muted-foreground text-sm md:text-base max-w-xs mx-auto mt-2"
          >
            Build your empire from a humble tea stall to a business conglomerate across Bangladesh!
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="game-glass game-shine border-2 shadow-xl game-glow">
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <label htmlFor="player-name" className="text-sm font-medium">
                  Enter Your Name
                </label>
                <Input
                  id="player-name"
                  placeholder="e.g. Rahim Uddin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                  className="h-12 text-lg game-input-focus-green"
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <Button
                onClick={handleStart}
                disabled={isLoading || !name.trim()}
                className="w-full h-12 text-base font-semibold text-white game-start-btn-glow game-btn-shimmer"
                style={{ background: 'linear-gradient(135deg, #006a4e 0%, #00895e 50%, #00a86b 100%)' }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting...
                  </span>
                ) : (
                  'Start Your Empire'
                )}
              </Button>

              <div className="text-center text-xs text-muted-foreground">
                You&apos;ll start with ৳5,00,000 to begin your journey
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 grid grid-cols-2 gap-3"
        >
          {[
            { icon: '☕', label: 'Tea Stall', desc: 'Low risk entry' },
            { icon: '🛒', label: 'Grocery', desc: 'Daily essentials' },
            { icon: '👕', label: 'Clothing', desc: 'Fashion retail' },
            { icon: '🍛', label: 'Restaurant', desc: 'Bangladeshi cuisine' },
          ].map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + idx * 0.08 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-white/50 backdrop-blur-sm border border-white/40 game-shine game-shimmer-overlay game-card-interactive cursor-default hover:scale-[1.03] transition-transform duration-200"
            >
              <span className="text-2xl game-float" style={{ animationDelay: `${idx * 0.5}s` }}>{item.icon}</span>
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom wave divider SVG */}
        <div className="mt-8 -mx-4">
          <svg viewBox="0 0 400 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" aria-hidden="true">
            <path d="M0 20 Q50 5 100 20 T200 20 T300 20 T400 20 V40 H0 Z" fill="rgba(0,106,78,0.05)" />
            <path d="M0 25 Q50 12 100 25 T200 25 T300 25 T400 25 V40 H0 Z" fill="rgba(0,106,78,0.03)" />
          </svg>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="mt-2 text-center text-xs text-muted-foreground"
        >
          A Bangladesh Business Simulation Game
        </motion.div>
      </motion.div>
    </div>
  );
}
