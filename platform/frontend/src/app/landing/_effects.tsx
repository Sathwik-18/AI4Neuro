'use client';

/**
 * Landing-page text effects: GradientText, RotatingText.
 *
 * Extracted verbatim from page.tsx, which had grown to 828 lines with ~330 of
 * them being these three animation utilities inline.
 *
 * NOTE: these are deliberately NOT merged into `@/components/ui/animated`.
 * That module exports its own `GradientText`, but it is a no-op stub
 * (`<span className="text-primary">`) that ignores colors/animationSpeed —
 * three in-app callers rely on that plain behaviour. The animated versions
 * here are landing-page-only and keep their own CSS in ./landing.css.
 */

import React, { useState, useEffect, useMemo, forwardRef } from 'react';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
  direction?: 'horizontal' | 'vertical' | 'diagonal';
  pauseOnHover?: boolean;
  yoyo?: boolean;
}

export function GradientText({
  children,
  className = '',
  colors = ['#58433B', '#806257', '#C7A79B'],
  animationSpeed = 8,
  showBorder = false,
  direction = 'horizontal',
  pauseOnHover = false,
  yoyo = true,
}: GradientTextProps) {
  const gradientAngle =
    direction === 'horizontal' ? 'to right' : direction === 'vertical' ? 'to bottom' : 'to bottom right';
  const gradientColors = [...colors, colors[0]].join(', ');

  const style = {
    '--gradient-text-colors': `linear-gradient(${gradientAngle}, ${gradientColors})`,
    '--gradient-text-speed': `${animationSpeed}s`,
    '--gradient-text-direction': yoyo ? 'alternate' : 'normal',
  } as React.CSSProperties;

  return (
    <span
      className={`animated-gradient-text ${showBorder ? 'with-border' : ''} ${pauseOnHover ? 'pause-on-hover' : ''} ${className}`}
      style={style}
    >
      {showBorder && <span className="gradient-overlay" aria-hidden="true" />}
      <span className="text-content">{children}</span>
    </span>
  );
}

interface RotatingTextProps {
  texts: string[];
  rotationInterval?: number;
  staggerDuration?: number;
  staggerFrom?: 'first' | 'last' | 'center';
  loop?: boolean;
  auto?: boolean;
  splitBy?: 'characters' | 'words' | 'lines';
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
  onNext?: (index: number) => void;
}

/** Imperative handle exposed by {@link RotatingText} for manual control. */
export interface RotatingTextHandle {
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  reset: () => void;
}

export const RotatingText = forwardRef<RotatingTextHandle, RotatingTextProps>(
  (
    {
      texts,
      rotationInterval = 2000,
      staggerDuration = 0.025,
      staggerFrom = 'first',
      loop = true,
      auto = true,
      splitBy = 'characters',
      mainClassName,
      splitLevelClassName,
      elementLevelClassName,
      onNext,
      ...rest
    },
    ref
  ) => {
    const [currentTextIndex, setCurrentTextIndex] = useState(0);
    const currentText = texts[currentTextIndex] || '';

    const parts = useMemo(() => {
      if (splitBy === 'words') return currentText.split(' ');
      if (splitBy === 'lines') return currentText.split('\n');
      return Array.from(currentText);
    }, [currentText, splitBy]);

    const next = () => {
      setCurrentTextIndex((currentIndex) => {
        const nextIndex = currentIndex === texts.length - 1 ? (loop ? 0 : currentIndex) : currentIndex + 1;
        if (nextIndex !== currentIndex && onNext) onNext(nextIndex);
        return nextIndex;
      });
    };

    const previous = () => {
      setCurrentTextIndex((currentIndex) => {
        const previousIndex = currentIndex === 0 ? (loop ? texts.length - 1 : currentIndex) : currentIndex - 1;
        if (previousIndex !== currentIndex && onNext) onNext(previousIndex);
        return previousIndex;
      });
    };

    const jumpTo = (index: number) => {
      const validIndex = Math.max(0, Math.min(index, texts.length - 1));
      setCurrentTextIndex(validIndex);
      if (onNext) onNext(validIndex);
    };

    const reset = () => jumpTo(0);

    React.useImperativeHandle(ref, () => ({ next, previous, jumpTo, reset }));

    useEffect(() => {
      if (!auto) return undefined;
      const intervalId = window.setInterval(next, rotationInterval);
      return () => window.clearInterval(intervalId);
    });

    const getDelay = (index: number) => {
      if (staggerFrom === 'last') return (parts.length - 1 - index) * staggerDuration;
      if (staggerFrom === 'center') return Math.abs(Math.floor(parts.length / 2) - index) * staggerDuration;
      return index * staggerDuration;
    };

    return (
      <span className={`text-rotate ${mainClassName || ''}`} {...rest}>
        <span className="text-rotate-sr-only">{currentText}</span>
        <span className={`${splitBy === 'lines' ? 'text-rotate-lines' : 'text-rotate-word'} ${splitLevelClassName || ''}`} aria-hidden="true">
          {parts.map((part, index) => (
            <span
              className={`text-rotate-element ${elementLevelClassName || ''}`}
              key={`${currentTextIndex}-${part}-${index}`}
              style={{ animationDelay: `${getDelay(index)}s` }}
            >
              {part === ' ' ? <span className="text-rotate-space"> </span> : part}
            </span>
          ))}
        </span>
      </span>
    );
  }
);

RotatingText.displayName = 'RotatingText';

