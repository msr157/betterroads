import '@/index.css';
import WaitlistProvider from '@/components/providers/WaitlistProvider';
import { UnveilProvider } from '@/components/providers/UnveilProvider';
import Veil from '@/components/ui/Veil';
import Hero from '@/components/hero/Hero';

export default function App() {
  return (
    <UnveilProvider>
      <Veil />
      <WaitlistProvider>
        <main id="top">
          <Hero />
        </main>
      </WaitlistProvider>
    </UnveilProvider>
  );
}
