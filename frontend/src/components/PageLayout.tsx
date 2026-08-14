import { ReactNode } from 'react';
import Navbar from './Navbar';
import SpaceBackground from './SpaceBackground';
import CustomCursor from './CustomCursor';

interface Props {
  children: ReactNode;
  className?: string;
}

export default function PageLayout({ children, className = '' }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <CustomCursor />
      <SpaceBackground />
      <Navbar />
      <main className={`flex-1 relative ${className}`}>{children}</main>
    </div>
  );
}
