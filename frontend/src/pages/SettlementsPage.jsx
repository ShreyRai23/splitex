// src/pages/SettlementsPage.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settlementsApi, usersApi } from '../api/index.js';
import useAppStore from '../store/app.store.js';
import Modal from '../components/ui/Modal.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function SettlementForm({ onClose, groupId, users }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    groupId, payerId: '', payeeId: '', amount: '',
    date: new Date().toISOString().slice(0, 10), method: 'UPI', notes: ''
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.payerId === form.payeeId) return toast.error('Payer and Payee cannot be the same person');
    setLoading(true);
    try {
      await settlementsApi.create({
        ...form,
        payerId: parseInt(form.payerId),
        payeeId: parseInt(form.payeeId),
        amount: parseFloat(form.amount),
      });
      qc.invalidateQueries(['settlements']);
      qc.invalidateQueries(['group-balances']);
      toast.success('Settlement recorded!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error recording settlement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Who paid (Payer)</label>
          <select className="pill-select form-input" value={form.payerId} onChange={e => set('payerId', e.target.value)} required>
            <option value="">Select...</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <ArrowRight size={20} color="var(--text-muted)" style={{ marginTop: 24 }} />
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Who received (Payee)</label>
          <select className="pill-select form-input" value={form.payeeId} onChange={e => set('payeeId', e.target.value)} required>
            <option value="">Select...</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Amount (₹)</label>
          <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.amount}
            onChange={e => set('amount', e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Method</label>
          <select className="pill-select form-input" value={form.method} onChange={e => set('method', e.target.value)}>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cash">Cash</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-input" placeholder="Transaction ID, etc." value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button type="submit" className="btn btn-teal" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
          {loading ? 'Recording...' : 'Record Settlement'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

export default function SettlementsPage() {
  const { selectedGroupId } = useAppStore();
  const [showModal, setShowModal] = useState(false);

  const { data: settlements = [], isLoading } = useQuery({
    queryKey: ['settlements', selectedGroupId],
    queryFn: () => settlementsApi.list({ groupId: selectedGroupId }).then(r => r.data.data),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data.data),
  });

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="text-h1">Settlements</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Record payments between members</p>
        </div>
        <button className="btn btn-teal" onClick={() => setShowModal(true)}>
          <CheckCircle2 size={16} /> Record Settlement
        </button>
      </div>

      <div className="table-card">
        <div className="table-header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
          <span>Transaction</span><span>Date</span><span>Method</span><span>Amount</span>
        </div>
        <div className="table-section">
          {isLoading
            ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 4 }} />)
            : settlements.length === 0
              ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No settlements recorded yet.</div>
              : settlements.map(s => (
                <div key={s.id} className="table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                  <div className="flex items-center gap-md">
                    <div className="flex items-center gap-sm">
                      <Avatar name={s.payer?.name} size="sm" />
                      <span style={{ fontWeight: 600 }}>{s.payer?.name}</span>
                    </div>
                    <ArrowRight size={14} color="var(--text-muted)" />
                    <div className="flex items-center gap-sm">
                      <Avatar name={s.payee?.name} size="sm" />
                      <span style={{ fontWeight: 600 }}>{s.payee?.name}</span>
                    </div>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {format(parseISO(s.date), 'dd MMM yyyy')}
                  </div>
                  <div>
                    <span className="badge badge-black">{s.method || 'UPI'}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--teal)' }}>
                    {fmt(s.amount)}
                  </div>
                </div>
              ))
          }
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Record Settlement">
        <SettlementForm onClose={() => setShowModal(false)} groupId={selectedGroupId} users={usersData || []} />
      </Modal>
    </div>
  );
}
