import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface Size {
  width: number;
  height: number;
}

/**
 * Tamanho do elemento em pixels CSS. Mede de três formas porque o canvas
 * é inutilizável enquanto o tamanho for zero: medição síncrona no layout,
 * ResizeObserver e o resize da janela. Só atualiza o estado quando muda.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.clientWidth;
    const height = el.clientHeight;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return { ref, size, measure };
}
