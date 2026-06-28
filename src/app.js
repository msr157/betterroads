'use strict';

// ── Navbar scroll ────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ── Mobile hamburger ─────────────────────────
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('nav-links');
hamburger.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', String(isOpen));
});
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  navLinks.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
}));

// ── Feature card intersection observer ───────
const cardObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const delay = parseInt(e.target.dataset.delay || '0', 10);
      setTimeout(() => e.target.classList.add('visible'), delay);
      cardObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.feature-card').forEach(c => cardObserver.observe(c));

// ── Step card intersection observer ──────────
const stepObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const delay = parseInt(e.target.dataset.delay || '0', 10);
      setTimeout(() => e.target.classList.add('visible'), delay);
      stepObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.step').forEach(s => stepObserver.observe(s));

// ── Metrics bar animation trigger ────────────
const metricsObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      // bars animate via CSS — just ensure the card is visible
      e.target.style.opacity = '1';
      metricsObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });
const metricsCard = document.querySelector('.metrics-card');
if (metricsCard) metricsObserver.observe(metricsCard);

// ── Smooth scroll ─────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});
