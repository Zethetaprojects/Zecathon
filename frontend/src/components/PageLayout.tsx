import { ReactNode } from 'react';
import Navbar from './Navbar';
import SpaceBackground from './SpaceBackground';

interface Props {
  children: ReactNode;
  className?: string;
}

export default function PageLayout({ children, className = '' }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <SpaceBackground />
      <Navbar />
      <main className={`flex-1 relative ${className}`}>{children}</main>
    </div>
  );
}
