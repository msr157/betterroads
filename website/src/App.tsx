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
      <div className="bg-mesh"></div>
      
      <main className="container">
        <div className="card">
          <div className="badge">Coming Soon</div>
          
          <h1>BetterRoads</h1>
          <p className="subtitle">
            AI-powered road condition monitoring and predictive maintenance for smarter, safer cities.
            We are building the future of infrastructure intelligence.
          </p>

          <form className="notify-form" onSubmit={handleSubmit}>
            <input 
              type="email" 
              className="input-field" 
              placeholder="Enter your email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="submit-btn">
              {submitted ? 'Subscribed!' : 'Notify Me'}
            </button>
          </form>
        </div>

        <p className="footer-text">
          © {new Date().getFullYear()} BetterRoads. All rights reserved.
        </p>
      </main>
    </>
  );
}

export default App;
