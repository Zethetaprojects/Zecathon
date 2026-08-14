import { useEffect, useRef, useState } from 'react';

export function useInView<T extends HTMLElement = HTMLDivElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, ...options }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return { ref, inView };
}

export function ScrollReveal({
  children,
  className = '',
  zoom = false,
}: {
  children: React.ReactNode;
  className?: string;
  zoom?: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const base = zoom ? 'reveal-zoom' : 'reveal';
  return (
    <div ref={ref} className={`${base} ${inView ? 'is-visible' : ''} ${className}`}>
      {children}
    </div>
  );
}
