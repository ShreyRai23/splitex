// src/pages/LandingPage.jsx
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, ShieldCheck, SplitSquareHorizontal, Upload, BarChart3, Users } from 'lucide-react';

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

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* ── Nav ───────────────────────────────────────────── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: 64,
        borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 100,
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.5rem', fontWeight: 700 }}>
          SpilTeX
        </span>
        <div className="flex items-center gap-md">
          <Link to="/login"    className="btn btn-ghost">Login</Link>
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

          {/* Right: floating stat cards demo */}
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
            {/* Center decorative dark card */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
            }}>
              <div className="dark-chart-card" style={{
                width: 220, padding: 20,
                animation: 'float 4s ease-in-out 1s infinite',
              }}>
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
        <h2 className="text-h1" style={{ marginBottom: 8 }}>Everything your flat needs.</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 48 }}>
          Built on real requirements — Aisha's CSV, Rohan's audit, Meera's timeline.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {FEATURES.map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className={`stat-card ${color}`} style={{ padding: 28 }}>
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
          <h2 className="text-h1" style={{ marginBottom: 48, textAlign: 'center' }}>Three steps to clarity.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {[
              { step: '01', color: 'lime',   title: 'Upload your CSV', desc: 'Drag & drop your exported expense sheet. Our 2-phase engine catches every anomaly before importing.' },
              { step: '02', color: 'purple', title: 'Review & Approve', desc: 'See every detected issue, AI explanations for each, and decide: import, skip, or convert to settlement.' },
              { step: '03', color: 'black',  title: 'See who owes what', desc: 'Instantly see the minimum set of transactions to settle all group debts. Share with one click.' },
            ].map(({ step, color, title, desc }) => (
              <div key={step} className={`stat-card ${color}`} style={{ padding: 36 }}>
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
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
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

      {/* ── Footer ────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '24px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '0.8125rem', color: 'var(--text-muted)',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, color: 'var(--text-primary)' }}>
          SpilTeX
        </span>
        <span>Flat 4B approved • ₹84/USD locked</span>
      </footer>
    </div>
  );
}
