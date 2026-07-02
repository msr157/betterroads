import React, { useState } from 'react';
import './index.css';

function App() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      setEmail('');
    }
  };

  return (
    <>
      <div className="mesh-graphic"></div>
      
      <nav className="navbar">
        <div className="logo">BetterRoads</div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#technology">Technology</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>

      <main>
        <section className="hero">
          <div className="badge animate-fade-up">Platform Launching Soon</div>
          <h1 className="animate-fade-up delay-100">
            Infrastructure Intelligence for <br/>
            <span className="text-gradient">Smarter, Safer Cities.</span>
          </h1>
          <p className="animate-fade-up delay-200">
            AI-powered road condition monitoring and predictive maintenance. We leverage real-time visual data and machine learning to detect anomalies before they become hazards.
          </p>
          <div className="animate-fade-up delay-300" style={{ display: 'flex', gap: '1rem' }}>
            <button className="cta-button" onClick={() => window.scrollTo(0, document.body.scrollHeight)}>
              Request Early Access
            </button>
          </div>
        </section>

        <section id="features" className="features-grid">
          <div className="glass-card">
            <div className="icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <h3>Predictive Maintenance</h3>
            <p>Our neural networks analyze surface patterns to predict structural degradation months before visible cracks appear.</p>
          </div>

          <div className="glass-card">
            <div className="icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </div>
            <h3>Real-time Analytics</h3>
            <p>Stream HD telemetry directly to our secure dashboards, powered by scalable cloud architecture.</p>
          </div>

          <div className="glass-card">
            <div className="icon-wrapper">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <h3>Automated Dispatch</h3>
            <p>Integrate seamlessly with municipal ticketing systems to instantly route repair crews to critical hazards.</p>
          </div>
        </section>

        <section id="contact" style={{ padding: '5rem 5%', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', fontFamily: 'Outfit' }}>Join the Waitlist</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Be the first to know when we launch in your city.</p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', justifyContent: 'center', maxWidth: '500px', margin: '0 auto' }}>
            <input 
              type="email" 
              placeholder="Enter your email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ flex: 1, padding: '1rem 1.5rem', borderRadius: '2rem', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white', outline: 'none' }}
            />
            <button type="submit" className="cta-button" style={{ animation: 'none' }}>
              {submitted ? 'Subscribed!' : 'Notify Me'}
            </button>
          </form>
        </section>

        <footer className="footer">
          <p>© {new Date().getFullYear()} BetterRoads. Infrastructure Intelligence.</p>
        </footer>
      </main>
    </>
  );
}

export default App;
