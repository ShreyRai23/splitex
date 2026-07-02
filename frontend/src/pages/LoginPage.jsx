// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/index.js';
import useAuthStore from '../store/auth.store.js';
import toast from 'react-hot-toast';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

/* ── tiny helpers ─────────────────────────────────────── */
function validate(form) {
  const errs = {};
  if (!form.email.trim())                    errs.email    = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                             errs.email    = 'Enter a valid email address.';
  if (!form.password)                        errs.password = 'Password is required.';
  else if (form.password.length < 6)         errs.password = 'Password must be at least 6 characters.';
  return errs;
}

function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: '#b91c1c', fontSize: '0.8125rem' }}>
      <AlertCircle size={13} strokeWidth={2.5} />
      <span>{msg}</span>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [form, setForm]         = useState({ email: '', password: '' });
  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  /* clear field-level error on change; API error persists until next submit */
  const handleChange = (field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setErrors(p => ({ ...p, [field]: '' }));
    // NOTE: do NOT clear apiError here — it must stay visible until the user resubmits
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError('');
    try {
      const { data } = await authApi.login(form);
      setAuth(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      const status  = err.response?.status;
      const message = err.response?.data?.message || 'Login failed. Please try again.';

      /* map backend status codes to friendly messages */
      if (status === 401) {
        setApiError('Incorrect email or password. Please try again.');
      } else if (status === 429) {
        setApiError('Too many attempts. Please wait a moment and try again.');
      } else if (!navigator.onLine) {
        setApiError('You appear to be offline. Check your internet connection.');
      } else {
        setApiError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--r-sm)',
    border: `1.5px solid ${errors[field] ? '#ef4444' : 'rgba(0,0,0,0.15)'}`,
    background: 'rgba(255,255,255,0.6)',
    fontSize: '0.9375rem',
    outline: 'none',
    transition: 'border-color 0.18s',
    boxSizing: 'border-box',
  });

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--sp-lg)',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '2rem', fontWeight: 700 }}>
            SpilTeX
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="stat-card amber animate-slide-up" style={{ padding: 32 }}>

          {/* API-level error banner — fades in, stays until next submit */}
          {apiError && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 20,
              color: '#7f1d1d', fontSize: '0.875rem', lineHeight: 1.5,
              animation: 'fade-in 0.25s ease both',
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div className="form-group" style={{ marginBottom: errors.email ? 4 : 16 }}>
              <label className="form-label">Email</label>
              <input
                style={inputStyle('email')}
                type="email"
                placeholder="aisha@example.com"
                value={form.email}
                onChange={handleChange('email')}
                autoComplete="email"
                disabled={loading}
              />
              <FieldError msg={errors.email} />
            </div>

            {/* Password */}
            <div className="form-group" style={{ marginBottom: errors.password ? 4 : 8 }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle('password'), paddingRight: 40 }}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange('password')}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(0,0,0,0.4)', padding: 0, display: 'flex',
                  }}
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FieldError msg={errors.password} />
            </div>

            <button
              type="submit"
              className="btn btn-black"
              id="login-submit-btn"
              style={{ width: '100%', justifyContent: 'center', marginTop: 16, opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }} />
                  Signing in…
                </span>
              ) : 'Sign In →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem' }}>
            No account?{' '}
            <Link to="/register" style={{ fontWeight: 700, borderBottom: '2px solid currentColor' }}>
              Register here
            </Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
