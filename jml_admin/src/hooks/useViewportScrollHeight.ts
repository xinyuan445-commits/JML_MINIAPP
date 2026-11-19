import { useLayoutEffect, useRef, useState } from 'react';

export function useViewportScrollHeight(
  bottomOffset = 96,
  measureFrom: 'table' | 'container' = 'table',
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollHeight, setScrollHeight] = useState(300);

  useLayoutEffect(() => {
    const updateScrollHeight = () => {
      const container = scrollRef.current;
      const tableHeader = container?.querySelector('.ant-table-thead');
      const top =
        measureFrom === 'container'
          ? container?.getBoundingClientRect().top
          : tableHeader?.getBoundingClientRect().bottom;
      if (top == null) return;

      const availableHeight = Math.max(
        120,
        Math.floor(window.innerHeight - top - bottomOffset),
      );
      setScrollHeight((current) =>
        current === availableHeight ? current : availableHeight,
      );
    };

    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(updateScrollHeight);
    if (scrollRef.current) {
      observer?.observe(scrollRef.current);
      if (scrollRef.current.parentElement) {
        observer?.observe(scrollRef.current.parentElement);
      }
    }
    window.addEventListener('resize', updateScrollHeight);
    updateScrollHeight();

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateScrollHeight);
    };
  }, [bottomOffset, measureFrom]);

  return { scrollRef, scrollHeight };
}
