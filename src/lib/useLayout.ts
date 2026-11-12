import { useEffect, useState } from 'react';

function useMedia(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [q]);
  return m;
}

export const useIsTablet = () => useMedia('(min-width: 600px)');
export const useIsLandscapeTablet = () => useMedia('(min-width: 600px) and (orientation: landscape)');
export const useIsWide = () => useMedia('(min-width: 1100px)');
