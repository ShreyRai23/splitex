// src/pages/ExpensesPage.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi, usersApi, groupsApi } from '../api/index.js';
import useAppStore from '../store/app.store.js';
import Modal from '../components/ui/Modal.jsx';
import Badge from '../components/ui/Badge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Pencil, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const SPLIT_TYPES = ['equal', 'percentage', 'exact', 'share'];

function ExpenseForm({ onClose, groupId, users }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    groupId, paidById: '', description: '', amount: '', currency: 'INR',
    date: new Date().toISOString().slice(0, 10), splitType: 'equal',
    splitWith: [], splitDetails: null, notes: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const toggleMember = (id) => {
    set('splitWith', form.splitWith.includes(id)
      ? form.splitWith.filter(x => x !== id)
      : [...form.splitWith, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.paidById) return toast.error('Select who paid');
    if (!form.splitWith.length) return toast.error('Select at least one person to split with');
    setLoading(true);
    try {
      const idKey = uuidv4();
      await expensesApi.create({
        ...form,
        paidById: parseInt(form.paidById),
        amount: parseFloat(form.amount),
        splitWith: form.splitWith.map(Number),
      }, idKey);
      qc.invalidateQueries(['expenses']);
      qc.invalidateQueries(['group-balances']);
      toast.success('Expense added!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Error creating expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Description</label>
        <input className="form-input" placeholder="Rent, groceries..." value={form.description}
          onChange={e => set('description', e.target.value)} required />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Amount</label>
          <input className="form-input" type="number" step="0.01" placeholder="0.00" value={form.amount}
            onChange={e => set('amount', e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">Currency</label>
          <select className="pill-select form-input" value={form.currency} onChange={e => set('currency', e.target.value)}>
            <option value="INR">INR ₹</option>
            <option value="USD">USD $</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">Split Type</label>
          <select className="pill-select form-input" value={form.splitType} onChange={e => set('splitType', e.target.value)}>
            {SPLIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Paid By</label>
        <select className="pill-select form-input" value={form.paidById} onChange={e => set('paidById', e.target.value)} required>
          <option value="">Select person...</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Split Among</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {users.map(u => (
            <button key={u.id} type="button"
              className={`btn btn-sm ${form.splitWith.includes(u.id) ? 'btn-black' : 'btn-outline'}`}
              onClick={() => toggleMember(u.id)}
            >{u.name}</button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes (optional)</label>
        <input className="form-input" placeholder="Any notes..." value={form.notes}
          onChange={e => set('notes', e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button type="submit" className="btn btn-lime" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
          {loading ? 'Adding...' : 'Add Expense'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

export default function ExpensesPage() {
  const { selectedGroupId } = useAppStore();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const [splitFilter, setSplitFilter] = useState('');

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', selectedGroupId],
    queryFn: () => expensesApi.list({ groupId: selectedGroupId, limit: 100 }).then(r => r.data.data),
  });
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data.data),
  });
  const users = usersData || [];

  const deleteMutation = useMutation({
    mutationFn: (id) => expensesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries(['expenses']); qc.invalidateQueries(['group-balances']); toast.success('Deleted'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  const handleDelete = (id, desc) => {
    if (!confirm(`Delete "${desc}"?`)) return;
    deleteMutation.mutate(id);
  };

  const filtered = (expenses || []).filter(e => {
    const q = filter.toLowerCase();
    const matchSearch = !q || e.description?.toLowerCase().includes(q) || e.paidBy?.name?.toLowerCase().includes(q);
    const matchSplit = !splitFilter || e.splitType === splitFilter;
    return matchSearch && matchSplit;
  });

  // Stats
  const total = filtered.reduce((s, e) => s + parseFloat(e.amountInr || 0), 0);

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="text-h1">Expenses</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>{filtered.length} expenses • {fmt(total)} total</p>
        </div>
        <button className="btn btn-lime" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: '1 1 280px', maxWidth: 380 }}>
          <Search size={15} color="var(--text-muted)" />
          <input placeholder="Search expenses..." value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        <select className="pill-select" value={splitFilter} onChange={e => setSplitFilter(e.target.value)}>
          <option value="">All split types</option>
          {SPLIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {['equal','percentage','exact','share'].map((type, i) => {
          const count = expenses.filter(e => e.splitType === type).length;
          const colors = ['lime','purple','amber','teal'];
          return (
            <StatCardMini key={type} color={colors[i]} label={type} value={count} />
          );
        })}
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="table-header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
          <span>Description</span><span>Paid By</span><span>Date</span><span>Split</span><span>Amount</span><span></span>
        </div>
        <div className="table-section">
          {isLoading
            ? [1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 4 }} />)
            : filtered.length === 0
              ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No expenses found.</div>
              : filtered.map((exp) => (
                <div key={exp.id} className="table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
                  <div>
                    <Link to={`/expenses/${exp.id}`} style={{ fontWeight: 600 }}>{exp.description}</Link>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {exp.splits?.length} people
                    </div>
                  </div>
                  <div className="flex items-center gap-sm">
                    <Avatar name={exp.paidBy?.name} size="sm" />
                    <span className="text-sm">{exp.paidBy?.name}</span>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {exp.date ? format(parseISO(exp.date), 'dd MMM yy') : '—'}
                  </div>
                  <div><Badge label={exp.splitType} /></div>
                  <div style={{ fontWeight: 800 }}>{fmt(exp.amountInr)}</div>
                  <div className="flex gap-sm">
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(exp.id, exp.description)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
          }
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add New Expense">
        <ExpenseForm onClose={() => setShowModal(false)} groupId={selectedGroupId} users={users} />
      </Modal>
    </div>
  );
}

function StatCardMini({ color, label, value }) {
  return (
    <div className={`stat-card ${color}`} style={{ padding: '16px 20px' }}>
      <div className="text-xs" style={{ opacity: 0.7, marginBottom: 4 }}>{label} split</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 900 }}>{value}</div>
    </div>
  );
}
