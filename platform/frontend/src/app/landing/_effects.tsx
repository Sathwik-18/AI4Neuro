'use client';

/**
 * Landing-page text effects: VariableProximity, GradientText, RotatingText.
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

import React, { useState, useEffect, useRef, useMemo, forwardRef } from 'react';

function useAnimationFrame(callback: () => void) {
  useEffect(() => {
    let frameId: number;
    const loop = () => {
      callback();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [callback]);
}

function useMousePositionRef(containerRef: React.RefObject<HTMLElement | null>) {
  const positionRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const updatePosition = (x: number, y: number) => {
      if (!containerRef?.current) {
        positionRef.current = { x, y };
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      positionRef.current = { x: x - rect.left, y: y - rect.top };
    };

    const handleMouseMove = (event: MouseEvent) => updatePosition(event.clientX, event.clientY);
    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) updatePosition(touch.clientX, touch.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [containerRef]);

  return positionRef;
}

interface VariableProximityProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
  fromFontVariationSettings: string;
  toFontVariationSettings: string;
  containerRef: React.RefObject<HTMLElement | null>;
  radius?: number;
  falloff?: 'linear' | 'exponential' | 'gaussian';
}

export const VariableProximity = forwardRef<HTMLSpanElement, VariableProximityProps>(
  (
    {
      label,
      fromFontVariationSettings,
      toFontVariationSettings,
      containerRef,
      radius = 80,
      falloff = 'linear',
      className = '',
      style,
      ...restProps
    },
    ref
  ) => {
    const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const mousePositionRef = useMousePositionRef(containerRef);
    const lastPositionRef = useRef({ x: null as number | null, y: null as number | null });

    const parsedSettings = useMemo(() => {
      const parseSettings = (settingsString: string) =>
        new Map(
          settingsString
            .split(',')
            .map((setting) => setting.trim())
            .map((setting) => {
              const [name, value] = setting.split(' ');
              return [name.replace(/['"]/g, ''), Number.parseFloat(value)] as [string, number];
            })
        );

      const fromSettings = parseSettings(fromFontVariationSettings);
      const toSettings = parseSettings(toFontVariationSettings);

      return Array.from(fromSettings.entries()).map(([axis, fromValue]) => ({
        axis,
        fromValue,
        toValue: toSettings.get(axis) ?? fromValue,
      }));
    }, [fromFontVariationSettings, toFontVariationSettings]);

    useAnimationFrame(() => {
      if (!containerRef?.current) return;

      const { x, y } = mousePositionRef.current;
      if (lastPositionRef.current.x === x && lastPositionRef.current.y === y) return;
      lastPositionRef.current = { x, y };

      const containerRect = containerRef.current.getBoundingClientRect();

      letterRefs.current.forEach((letterRef) => {
        if (!letterRef) return;

        const rect = letterRef.getBoundingClientRect();
        const letterCenterX = rect.left + rect.width / 2 - containerRect.left;
        const letterCenterY = rect.top + rect.height / 2 - containerRect.top;
        const distance = Math.hypot(x - letterCenterX, y - letterCenterY);

        if (distance >= radius) {
          letterRef.style.fontVariationSettings = fromFontVariationSettings;
          return;
        }

        const normalizedDistance = Math.min(Math.max(1 - distance / radius, 0), 1);
        const falloffValue =
          falloff === 'exponential'
            ? normalizedDistance ** 2
            : falloff === 'gaussian'
              ? Math.exp(-((distance / (radius / 2)) ** 2) / 2)
              : normalizedDistance;

        letterRef.style.fontVariationSettings = parsedSettings
          .map(({ axis, fromValue, toValue }) => {
            const value = fromValue + (toValue - fromValue) * falloffValue;
            return `'${axis}' ${value}`;
          })
          .join(', ');
      });
    });

    // Each letter needs a stable index into `letterRefs` that runs across the
    // whole label (not per word), so the rAF loop can address every glyph.
    // Precomputed rather than incremented mid-render — a counter mutated
    // during render drifts on re-render.
    let runningIndex = 0;
    const lines = label.split('\n').map((line) =>
      line.split(' ').map((word) =>
        word.split('').map((letter) => ({ letter, index: runningIndex++ }))
      )
    );

    return (
      <span
        ref={ref}
        aria-label={label.replace(/\n/g, ' ')}
        className={`${className} variable-proximity`}
        style={{ display: 'inline', ...style }}
        {...restProps}
      >
        {lines.map((words, lineIndex) => (
          <React.Fragment key={lineIndex}>
            {words.map((letters, wordIndex) => (
              <span
                className="variable-word"
                key={wordIndex}
                style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
              >
                {letters.map(({ letter, index }) => (
                  <span
                    aria-hidden="true"
                    className="variable-letter"
                    key={index}
                    ref={(element) => {
                      letterRefs.current[index] = element;
                    }}
                    style={{ fontVariationSettings: fromFontVariationSettings }}
                  >
                    {letter}
                  </span>
                ))}
                {wordIndex < words.length - 1 && <span className="variable-space">&nbsp;</span>}
              </span>
            ))}
            {lineIndex < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    );
  }
);

VariableProximity.displayName = 'VariableProximity';

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

