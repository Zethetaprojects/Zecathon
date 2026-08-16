import { useEffect, useRef } from 'react';

const DEFAULT_TITLE = 'Zecathon - A Zetheta Hackathon Platform';

const MESSAGES = [
  { icon: '👋', text: 'Come back, the arena misses you!' },
  { icon: '🏆', text: 'See the leaderboard and win!' },
  { icon: '🚀', text: 'Jump in and start building!' },
  { icon: '🎯', text: 'Submit your project now!' },
  { icon: '💡', text: 'New hackathons are waiting!' },
  { icon: '🔥', text: 'Don’t miss the deadline!' },
  { icon: '⭐', text: 'Code, create, conquer!' },
  { icon: '🎮', text: 'The leaderboard is updating!' },
  { icon: '🛠️', text: 'Your team needs you!' },
];

export default function TabAttention() {
  const indexRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    document.title = DEFAULT_TITLE;

    const rotate = () => {
      const msg = MESSAGES[indexRef.current % MESSAGES.length];
      document.title = `${msg.icon} ${msg.text}`;
      indexRef.current = (indexRef.current + 1) % MESSAGES.length;
    };

    const handleVisibility = () => {
      if (document.hidden) {
        rotate();
        intervalRef.current = window.setInterval(rotate, 2200);
      } else {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        document.title = DEFAULT_TITLE;
        indexRef.current = 0;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      document.title = DEFAULT_TITLE;
    };
  }, []);

  return null;
}
