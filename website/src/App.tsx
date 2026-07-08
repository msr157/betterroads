import '@/index.css';
import WaitlistProvider from '@/components/providers/WaitlistProvider';
import Hero from '@/components/hero/Hero';

export default function App() {
  return (
    <WaitlistProvider>
      <main id="top">
        <Hero />
      </main>
    </WaitlistProvider>
  );
}
