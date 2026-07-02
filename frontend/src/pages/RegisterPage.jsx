// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/index.js';
import useAuthStore from '../store/auth.store.js';
import toast from 'react-hot-toast';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

/* ── validation ───────────────────────────────────────── */
function validate(form) {
  const errs = {};

  if (!form.name.trim())
    errs.name = 'Name is required.';
  else if (form.name.trim().length < 2)
    errs.name = 'Name must be at least 2 characters.';
  else if (form.name.trim().length > 40)
    errs.name = 'Name must be 40 characters or fewer.';

  if (!form.email.trim())
    errs.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errs.email = 'Enter a valid email address.';

  if (!form.password)
    errs.password = 'Password is required.';
  else if (form.password.length < 6)
    errs.password = 'Password must be at least 6 characters.';

  if (!form.confirmPassword)
    errs.confirmPassword = 'Please confirm your password.';
  else if (form.password !== form.confirmPassword)
    errs.confirmPassword = 'Passwords do not match.';

  return errs;
}

/* ── password strength ────────────────────────────────── */
function getStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0-5
}
const STRENGTH_LABEL = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
const STRENGTH_COLOR = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

/* ── sub-components ───────────────────────────────────── */
function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: '#b91c1c', fontSize: '0.8125rem' }}>
      <AlertCircle size={13} strokeWidth={2.5} />
      <span>{msg}</span>
    </div>
  );
}

function PasswordStrengthBar({ password }) {
  const strength = getStrength(password);
  if (!password) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 9999,
            background: i <= strength ? STRENGTH_COLOR[strength] : 'rgba(0,0,0,0.12)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: '0.75rem', color: STRENGTH_COLOR[strength], fontWeight: 600 }}>
        {STRENGTH_LABEL[strength]}
      </span>
    </div>
  );
}

/* ── main component ───────────────────────────────────── */
export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [form, setForm]         = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setErrors(p => ({ ...p, [field]: '' }));
    setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setApiError('');
    try {
      const { data } = await authApi.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setAuth(data.token, data.user);
      toast.success(`Account created! Welcome, ${data.user.name}! 🎉`);
      navigate('/dashboard');
    } catch (err) {
      const status  = err.response?.status;
      const message = err.response?.data?.message || 'Registration failed. Please try again.';

      if (status === 409) {
        /* distinguish "Email already registered" vs "Username already taken" */
        if (/email/i.test(message)) {
          setErrors(p => ({ ...p, email: 'This email is already registered. Try signing in instead.' }));
        } else if (/username|name/i.test(message)) {
          setErrors(p => ({ ...p, name: 'This name is already taken. Please choose a different one.' }));
        } else {
          setApiError(message);
        }
      } else if (status === 400) {
        setApiError('Some fields are invalid: ' + message);
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

  const passwordsMatch = form.confirmPassword && form.password === form.confirmPassword;

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
          <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Create your account</p>
        </div>

        {/* Card */}
        <div className="stat-card teal animate-slide-up" style={{ padding: 32 }}>

          {/* API-level error banner */}
          {apiError && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 20,
              color: '#7f1d1d', fontSize: '0.875rem', lineHeight: 1.5,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* Name */}
            <div className="form-group" style={{ marginBottom: errors.name ? 4 : 16 }}>
              <label className="form-label">Your name</label>
              <input
                style={inputStyle('name')}
                type="text"
                placeholder="Aisha, Rohan…"
                value={form.name}
                onChange={handleChange('name')}
                autoComplete="name"
                disabled={loading}
              />
              <FieldError msg={errors.name} />
            </div>

            {/* Email */}
            <div className="form-group" style={{ marginBottom: errors.email ? 4 : 16 }}>
              <label className="form-label">Email</label>
              <input
                style={inputStyle('email')}
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange('email')}
                autoComplete="email"
                disabled={loading}
              />
              <FieldError msg={errors.email} />
            </div>

            {/* Password */}
            <div className="form-group" style={{ marginBottom: errors.password ? 4 : 16 }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle('password'), paddingRight: 40 }}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={handleChange('password')}
                  autoComplete="new-password"
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
              <PasswordStrengthBar password={form.password} />
              <FieldError msg={errors.password} />
            </div>

            {/* Confirm Password */}
            <div className="form-group" style={{ marginBottom: errors.confirmPassword ? 4 : 8 }}>
              <label className="form-label">Confirm password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle('confirmPassword'), paddingRight: 40 }}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  autoComplete="new-password"
                  disabled={loading}
                />
                {/* match indicator */}
                {passwordsMatch && (
                  <CheckCircle2
                    size={16}
                    style={{
                      position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)',
                      color: '#16a34a',
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(0,0,0,0.4)', padding: 0, display: 'flex',
                  }}
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FieldError msg={errors.confirmPassword} />
            </div>

            <button
              type="submit"
              className="btn btn-black"
              id="register-submit-btn"
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
                  Creating account…
                </span>
              ) : 'Create Account →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem' }}>
            Already have one?{' '}
            <Link to="/login" style={{ fontWeight: 700, borderBottom: '2px solid currentColor' }}>
              Sign in
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
