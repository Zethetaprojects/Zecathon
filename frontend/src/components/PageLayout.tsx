import { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import EasterEgg from './EasterEgg';
import EggMascot from './EggMascot';

interface Props {
  children: ReactNode;
  className?: string;
}

export default function PageLayout({ children, className = '' }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <EasterEgg />
      <EggMascot />
      <main className={`flex-1 relative ${className}`}>{children}</main>
      <Footer />
    </div>
  );
}
