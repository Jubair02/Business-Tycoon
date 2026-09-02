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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-green-50 via-white to-red-50">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            className="text-6xl mb-4"
          >
            🇧🇩
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl md:text-4xl font-bold mb-2"
            style={{ color: '#006a4e' }}
          >
            Bangladesh
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
            transition={{ delay: 0.5 }}
            className="text-muted-foreground text-sm md:text-base max-w-xs mx-auto"
          >
            Build your empire from a humble tea stall to a business conglomerate across Bangladesh!
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="border-2 shadow-lg">
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
                  className="h-12 text-lg"
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <Button
                onClick={handleStart}
                disabled={isLoading || !name.trim()}
                className="w-full h-12 text-base font-semibold text-white"
                style={{ background: '#006a4e' }}
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
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 p-3 rounded-lg bg-white/60 border"
            >
              <span className="text-2xl">{item.icon}</span>
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
