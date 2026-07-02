// src/pages/LandingPage.jsx
import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { ArrowRight, Zap, ShieldCheck, SplitSquareHorizontal, Upload, BarChart3, Users, Github, Twitter, Mail } from 'lucide-react';

/* ── Scroll-reveal hook ───────────────────────────────────────────── */
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            observer.unobserve(entry.target); // fire once
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

const FEATURES = [
  { icon: SplitSquareHorizontal, color: 'lime',   title: 'Smart Split Engine',   desc: 'Split expenses equally, by percentage, exact amounts, or custom shares. Handles every edge case.' },
  { icon: Upload,                color: 'purple', title: 'CSV Import Engine',    desc: '2-phase import with AI-powered anomaly detection. 16 anomaly types caught automatically.' },
  { icon: BarChart3,             color: 'black',  title: 'Simplified Debts',     desc: 'Greedy algorithm minimizes the number of transactions needed to settle all group debts.' },
  { icon: ShieldCheck,           color: 'teal',   title: 'Full Audit Trail',     desc: 'Every mutation is logged. Rohan can verify every rupee — who changed what and when.' },
  { icon: Users,                 color: 'amber',  title: 'Member Timelines',     desc: 'Track when each member joined or left. Expenses only split among active members on that date.' },
  { icon: Zap,                   color: 'coral',  title: 'Idempotent API',       desc: 'Double-click Submit? No duplicate expenses. Every write is protected with an idempotency key.' },
];

const STAT_CARDS = [
  { color: 'lime',   label: 'Total Paid',    value: '₹1,24,500', sub: 'Flat 4B • 2026', arrow: 'up' },
  { color: 'purple', label: 'Total Owed',    value: '₹28,200',   sub: 'Across 5 members', arrow: 'down' },
  { color: 'black',  label: 'Net Settled',   value: '₹96,300',   sub: 'After 3 settlements', arrow: 'net' },
  { color: 'coral',  label: 'Pending Debts', value: '4',          sub: 'Simplified from 12' },
];

const FOOTER_LINKS = {
  Product:  ['Features', 'How it works', 'Pricing', 'Changelog'],
  Company:  ['About', 'Blog', 'Careers', 'Press'],
  Legal:    ['Privacy', 'Terms', 'Cookie Policy'],
};

export default function LandingPage() {
  useScrollReveal();

  return (
    <>
      {/* ── Scroll-reveal CSS injected once ────────────────── */}
      <style>{`
        .reveal {
          opacity: 0;
          transform: translateY(36px);
          transition: opacity 0.65s cubic-bezier(.22,1,.36,1), transform 0.65s cubic-bezier(.22,1,.36,1);
        }
        .reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .reveal-delay-1 { transition-delay: 0.08s; }
        .reveal-delay-2 { transition-delay: 0.16s; }
        .reveal-delay-3 { transition-delay: 0.24s; }
        .reveal-delay-4 { transition-delay: 0.32s; }
        .reveal-delay-5 { transition-delay: 0.40s; }

        /* Apple-style glassmorphic nav */
        .glass-nav {
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          background: rgba(255, 255, 255, 0.72);
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }

        /* Footer link hover */
        .footer-link {
          color: var(--text-muted);
          font-size: 0.875rem;
          transition: color 0.2s;
          display: block;
          margin-bottom: 10px;
        }
        .footer-link:hover { color: var(--text-primary); }

        /* Social icon button */
        .social-btn {
          width: 38px; height: 38px; border-radius: 50%;
          border: 1px solid var(--border);
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--text-muted);
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        .social-btn:hover {
          background: var(--text-primary);
          color: #fff;
          border-color: var(--text-primary);
        }
      `}</style>

      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

        {/* ── Apple-style Glass Nav ──────────────────────────── */}
        <nav className="glass-nav" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 48px', height: 64,
          position: 'sticky', top: 0, zIndex: 200,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            SpilTeX
          </span>
          <div className="flex items-center gap-md">
            <Link to="/login"    className="btn btn-ghost" style={{ color: 'var(--text-primary)' }}>Login</Link>
            <Link to="/register" className="btn btn-lime btn-sm">Get Started →</Link>
          </div>
        </nav>

        {/* ── Hero ──────────────────────────────────────────── */}
        <section style={{ padding: '80px 48px 64px', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
            {/* Left: text */}
            <div className="animate-fade-in">
              <div className="badge badge-lime" style={{ marginBottom: 20, fontSize: '0.75rem' }}>
                ✦ Shared expenses, done right
              </div>

              <h1 style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic',
                fontSize: 'clamp(3rem, 5vw, 5.5rem)', lineHeight: 1.05,
                fontWeight: 700, marginBottom: 24,
              }}>
                Split bills.<br />
                Not<br />
                <span style={{
                  display: 'inline-block',
                  background: 'var(--lime)',
                  borderRadius: '16px',
                  padding: '0 20px',
                }}>
                  friendships.
                </span>
              </h1>

              <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 32, maxWidth: 480 }}>
                SpilTeX is the shared expense tracker built for real flat-mates.
                AI-powered CSV import, smart debt simplification, and a full
                audit trail so everyone can verify every rupee.
              </p>

              <div className="flex items-center gap-md">
                <Link to="/register" className="btn btn-black btn-lg">
                  Start tracking <ArrowRight size={18} />
                </Link>
                <Link to="/login" className="btn btn-outline btn-lg">
                  Sign in
                </Link>
              </div>

              <div style={{ marginTop: 40, display: 'flex', gap: 32 }}>
                {[['₹84', 'INR exchange rate'], ['16+', 'Anomaly types caught'], ['2-phase', 'Import engine']].map(([v, l]) => (
                  <div key={l}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{v}</div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: floating stat cards */}
            <div style={{ position: 'relative', height: 480 }}>
              {STAT_CARDS.map((c, i) => (
                <div
                  key={i}
                  className={`stat-card ${c.color}`}
                  style={{
                    position: 'absolute',
                    width: 200,
                    animation: `float ${3 + i * 0.5}s ease-in-out ${i * 0.3}s infinite`,
                    ...[
                      { top: 20,  left: 20  },
                      { top: 20,  right: 0  },
                      { bottom: 80, left: 40 },
                      { bottom: 40, right: 20 },
                    ][i],
                  }}
                >
                  <div className="stat-card-arrow">{c.arrow === 'up' ? '↗' : c.arrow === 'down' ? '↙' : c.arrow === 'net' ? '↔' : ''}</div>
                  <div className="stat-card-label">{c.label}</div>
                  <div className="stat-card-value">{c.value}</div>
                  <div className="stat-card-sub">{c.sub}</div>
                </div>
              ))}
              {/* Centre dark chart card */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
                <div className="dark-chart-card" style={{ width: 220, padding: 20, animation: 'float 4s ease-in-out 1s infinite' }}>
                  <div className="text-xs" style={{ color: '#666' }}>NET BALANCE</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#A8E63D', lineHeight: 1 }}>₹96k</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                    {[40, 60, 35, 80, 55, 70].map((h, i) => (
                      <div key={i} style={{ flex: 1, height: h, background: i % 2 === 0 ? '#A8E63D' : '#C4B5F4', borderRadius: 4 }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features Grid ─────────────────────────────────── */}
        <section style={{ padding: '64px 48px', maxWidth: 1200, margin: '0 auto' }}>
          <div className="reveal">
            <h2 className="text-h1" style={{ marginBottom: 8 }}>Everything your flat needs.</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 48 }}>
              Built on real requirements — Aisha's CSV, Rohan's audit, Meera's timeline.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {FEATURES.map(({ icon: Icon, color, title, desc }, i) => (
              <div
                key={title}
                className={`stat-card ${color} reveal reveal-delay-${Math.min(i + 1, 5)}`}
                style={{ padding: 28 }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'rgba(0,0,0,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Icon size={22} />
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.0625rem', marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.75, lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────── */}
        <section style={{ padding: '64px 48px', background: 'var(--bg-alt)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <h2 className="text-h1 reveal" style={{ marginBottom: 48, textAlign: 'center' }}>Three steps to clarity.</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
              {[
                { step: '01', color: 'lime',   title: 'Upload your CSV', desc: 'Drag & drop your exported expense sheet. Our 2-phase engine catches every anomaly before importing.' },
                { step: '02', color: 'purple', title: 'Review & Approve', desc: 'See every detected issue, AI explanations for each, and decide: import, skip, or convert to settlement.' },
                { step: '03', color: 'black',  title: 'See who owes what', desc: 'Instantly see the minimum set of transactions to settle all group debts. Share with one click.' },
              ].map(({ step, color, title, desc }, i) => (
                <div key={step} className={`stat-card ${color} reveal reveal-delay-${i + 1}`} style={{ padding: 36 }}>
                  <div style={{ fontSize: '3.5rem', fontWeight: 900, opacity: 0.25, lineHeight: 1, marginBottom: 16 }}>{step}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: 12 }}>{title}</div>
                  <div style={{ opacity: 0.75, lineHeight: 1.7 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Banner ────────────────────────────────────── */}
        <section style={{ padding: '80px 48px', textAlign: 'center' }}>
          <div className="reveal" style={{ maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700, marginBottom: 16,
            }}>
              Ready to settle up?
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '1.0625rem' }}>
              Join Flat 4B. Your balances are waiting.
            </p>
            <Link to="/register" className="btn btn-black btn-lg">
              Create your account <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* ══ Creative Footer ═══════════════════════════════════════ */}
        <footer style={{ background: 'var(--text-primary)', color: '#fff', padding: '64px 48px 32px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>

            {/* Top row: brand + tagline + links */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 56 }}>

              {/* Brand column */}
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '2rem', fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                  SpilTeX
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9375rem', lineHeight: 1.7, maxWidth: 280, marginBottom: 28 }}>
                  Shared expenses, done right. No more spreadsheets, no more arguments. Just one number per person.
                </p>
                {/* Social icons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <a href="https://github.com/ShreyRai23/splitex" target="_blank" rel="noreferrer" className="social-btn" title="GitHub">
                    <Github size={16} />
                  </a>
                  <a href="#" className="social-btn" title="Twitter / X">
                    <Twitter size={16} />
                  </a>
                  <a href="mailto:hello@spiltex.app" className="social-btn" title="Email">
                    <Mail size={16} />
                  </a>
                </div>
              </div>

              {/* Link columns */}
              {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
                <div key={heading}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
                    {heading}
                  </div>
                  {links.map((l) => (
                    <a key={l} href="#" className="footer-link" style={{ color: 'rgba(255,255,255,0.55)' }}
                       onMouseEnter={e => e.target.style.color = '#fff'}
                       onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.55)'}
                    >
                      {l}
                    </a>
                  ))}
                </div>
              ))}
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8125rem' }}>
                © {new Date().getFullYear()} SpilTeX. Built for Flat 4B and every flat like it.
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                {/* Status pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(168,230,61,0.12)', border: '1px solid rgba(168,230,61,0.3)', borderRadius: 9999, padding: '4px 12px' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#A8E63D', display: 'inline-block', boxShadow: '0 0 6px #A8E63D' }} />
                  <span style={{ color: '#A8E63D', fontSize: '0.75rem', fontWeight: 600 }}>All systems operational</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8125rem' }}>₹84 / USD locked</span>
              </div>
            </div>

          </div>
        </footer>

      </div>
    </>
  );
}
