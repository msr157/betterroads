import { useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

type Props = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  strength?: number;
  'aria-label'?: string;
  type?: 'button' | 'submit';
};

/**
 * Button that drifts gently toward the cursor while hovered — the tactile
 * "expensive" feel used on hype / launch pages. On touch devices the effect
 * never fires, so it degrades cleanly to a normal button.
 */
export default function MagneticButton({
  children,
  onClick,
  className = '',
  strength = 0.4,
  type = 'button',
  style,
  ...rest
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 180, damping: 14, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 180, damping: 14, mass: 0.4 });

  function handleMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }

  function reset() { x.set(0); y.set(0); }

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ ...style, x: springX, y: springY }}
      whileTap={{ scale: 0.96 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
