import { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import SpaceBackground from './SpaceBackground';
import CustomCursor from './CustomCursor';
import EasterEgg from './EasterEgg';
import EggMascot from './EggMascot';

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
      <EasterEgg />
      <EggMascot />
      <main className={`flex-1 relative ${className}`}>{children}</main>
      <Footer />
    </div>
  );
}
