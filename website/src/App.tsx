import '@/index.css';
import WaitlistProvider from '@/components/providers/WaitlistProvider';
import { UnveilProvider } from '@/components/providers/UnveilProvider';
import Veil from '@/components/ui/Veil';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/hero/Hero';
import TheProblem from '@/components/sections/TheProblem';
import WhyNow from '@/components/sections/WhyNow';
import RoadJourney from '@/components/road/RoadJourney';
import Freedom from '@/components/sections/Freedom';
import JoinSection from '@/components/sections/JoinSection';

export default function App() {
  return (
    <UnveilProvider>
      <Veil />
      <WaitlistProvider>
        <Navbar />
        <main id="top">
          <Hero />
          <TheProblem />
          <WhyNow />
          <RoadJourney />
          <Freedom />
          <JoinSection />
        </main>
        <Footer />
      </WaitlistProvider>
    </UnveilProvider>
  );
}
