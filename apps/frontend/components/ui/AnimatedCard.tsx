'use client';

import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

export interface AnimatedCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  hoverEffect?: 'lift' | 'glow' | 'scale' | 'border' | 'none';
  clickable?: boolean;
}

const hoverEffects = {
  lift: { y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' },
  glow: { boxShadow: '0 0 20px 5px rgba(139, 92, 246, 0.3)' },
  scale: { scale: 1.02 },
  border: {},
  none: {},
};

/**
 * Animated card with hover effects using spring physics.
 */
export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ children, hoverEffect = 'lift', clickable = false, className = '', ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={hoverEffects[hoverEffect]}
        whileTap={clickable ? { scale: 0.98 } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`
          relative overflow-hidden rounded-xl bg-white dark:bg-gray-800
          shadow-sm transition-shadow duration-300
          ${hoverEffect === 'border' ? 'hover:ring-2 hover:ring-purple-500/50' : ''}
          ${clickable ? 'cursor-pointer' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedCard.displayName = 'AnimatedCard';

export default AnimatedCard;
