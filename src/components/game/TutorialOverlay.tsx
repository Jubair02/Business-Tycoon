'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  HandCoins, Wallet, Store, ShoppingCart, BarChart3, Sun, ChevronRight, X,
} from 'lucide-react';

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: <HandCoins className='h-6 w-6' />,
    title: 'Welcome to Bangladesh Business Tycoon!',
    description: 'Build your business empire from a humble tea stall to a conglomerate across Bangladesh. You start with ৳5,00,000 — invest wisely!',
  },
  {
    icon: <Wallet className='h-6 w-6' />,
    title: 'Your Cash & Stats',
    description: 'The top bar shows your cash, net worth, and the current game day. Click your name to see your full profile. Every real minute = 1 game day.',
  },
  {
    icon: <Store className='h-6 w-6' />,
    title: 'Create Your First Business',
    description: 'Go to Businesses → New Business. Choose a type, city, and name. Tea Stalls are the cheapest and perfect for beginners!',
  },
  {
    icon: <ShoppingCart className='h-6 w-6' />,
    title: 'Stock Your Inventory',
    description: 'Open your business → Inventory tab → Buy Stock. Customers won\'t buy from empty shelves! Buy at market price and set your selling price.',
  },
  {
    icon: <BarChart3 className='h-6 w-6' />,
    title: 'Watch Market Prices',
    description: 'Market prices fluctuate every 3 days. Events can boost or crash demand. Buy low, sell high! Check the Market tab for current prices.',
  },
  {
    icon: <Sun className='h-6 w-6' />,
    title: 'Advance Each Day',
    description: 'Click "Next Day" to simulate a new day. Your businesses earn revenue, pay expenses, and the market moves. Watch your empire grow!',
  },
];

const STORAGE_KEY = 'bd-tycoon-tutorial-done';

export default function TutorialOverlay() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const isComplete = useCallback(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isComplete()) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  const markComplete = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // silent
    }
  };

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
      markComplete();
    }, 300);
  };

  const handleSkip = () => {
    handleClose();
  };

  if (!isVisible && !isExiting) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  return (
    <AnimatePresence>
      {(isVisible || isExiting) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className='fixed inset-0 z-[60] flex items-end justify-center'
          style={{ pointerEvents: isExiting ? 'none' : 'auto' }}
        >
          {/* Backdrop */}
          <div
            className='absolute inset-0 bg-black/30 backdrop-blur-[2px]'
            onClick={handleSkip}
          />

          {/* Tutorial Card */}
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className='relative w-full max-w-lg mx-4 mb-20 md:mb-6 rounded-2xl shadow-2xl overflow-hidden'
            style={{
              background: 'linear-gradient(135deg, #006a4e 0%, #00895e 50%, #00a86b 100%)',
            }}
          >
            {/* Close button */}
            <button
              onClick={handleSkip}
              className='absolute top-3 right-3 h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white/80 hover:text-white transition-colors z-10'
            >
              <X className='h-3.5 w-3.5' />
            </button>

            <div className='p-5 pb-6'>
              {/* Step indicator + progress */}
              <div className='flex items-center justify-between mb-4'>
                <span className='text-[10px] text-green-200 font-medium uppercase tracking-wider'>
                  Step {currentStep + 1} of {TUTORIAL_STEPS.length}
                </span>
                <div className='flex items-center gap-1.5'>
                  {TUTORIAL_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i <= currentStep ? 'bg-white w-5' : 'bg-white/30 w-3'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <Progress
                value={progress}
                className='h-1 bg-white/20 mb-5'
              />

              {/* Icon */}
              <div className='flex items-center gap-4 mb-4'>
                <div className='h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0'>
                  {step.icon}
                </div>
                <h3 className='text-lg font-bold text-white leading-snug'>
                  {step.title}
                </h3>
              </div>

              {/* Description */}
              <p className='text-sm text-green-100 leading-relaxed mb-6'>
                {step.description}
              </p>

              {/* Actions */}
              <div className='flex items-center gap-3'>
                <Button
                  onClick={handleSkip}
                  variant='ghost'
                  className='text-green-200 hover:text-white hover:bg-white/10 text-sm'
                >
                  Skip
                </Button>
                <Button
                  onClick={handleNext}
                  className='flex-1 gap-1.5 bg-white text-green-800 font-semibold hover:bg-green-50 text-sm'
                >
                  {currentStep < TUTORIAL_STEPS.length - 1 ? (
                    <>
                      Next <ChevronRight className='h-4 w-4' />
                    </>
                  ) : (
                    "Let's Go! 🚀"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
