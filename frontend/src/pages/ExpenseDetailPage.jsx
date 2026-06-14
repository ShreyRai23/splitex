// src/pages/ExpenseDetailPage.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { expensesApi } from '../api/index.js';
import Badge from '../components/ui/Badge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { ArrowLeft, Trash2, Calendar, User, SplitSquareHorizontal } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const SPLIT_COLORS = { equal: 'lime', percentage: 'purple', exact: 'sky', share: 'amber' };

export default function ExpenseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: exp, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => expensesApi.get(id).then(r => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: () => expensesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['expenses']);
      qc.invalidateQueries(['group-balances']);
      toast.success('Expense deleted');
      navigate('/expenses');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  const handleDelete = () => {
    if (!confirm(`Delete "${exp?.description}"?`)) return;
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="page">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 20 }} />)}
        </div>
      </div>
    );
  }

  if (!exp) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontSize: '3rem' }}>🔍</div>
      <h2 style={{ marginTop: 16 }}>Expense not found</h2>
      <Link to="/expenses" className="btn btn-lime" style={{ marginTop: 16 }}>← Back to Expenses</Link>
    </div>
  );

  const splitColor = SPLIT_COLORS[exp.splitType] || 'lime';

  return (
    <div className="page animate-fade-in">
      {/* Back button */}
      <div style={{ marginBottom: 24 }}>
        <Link to="/expenses" className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} /> Back to Expenses
        </Link>
      </div>

      {/* Hero card */}
      <div className={`stat-card ${splitColor}`} style={{ padding: 36, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="text-xs" style={{ opacity: 0.65, marginBottom: 8 }}>EXPENSE</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1.1, marginBottom: 12 }}>{exp.description}</h1>
            <div className="flex items-center gap-md">
              <Badge label={exp.splitType} color="black" />
              {exp.currency && exp.currency !== 'INR' && (
                <Badge label={exp.currency} color="black" />
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1 }}>{fmt(exp.amountInr)}</div>
            {exp.currency && exp.currency !== 'INR' && (
              <div style={{ opacity: 0.65, fontSize: '0.875rem', marginTop: 4 }}>
                ${parseFloat(exp.amountOriginal || 0).toFixed(2)} {exp.currency}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card lime" style={{ padding: 20 }}>
          <div className="flex items-center gap-sm" style={{ opacity: 0.7, marginBottom: 8 }}>
            <User size={14} /> <span className="text-xs">PAID BY</span>
          </div>
          <div className="flex items-center gap-md">
            <Avatar name={exp.paidBy?.name} size="md" />
            <div>
              <div style={{ fontWeight: 800 }}>{exp.paidBy?.name}</div>
              <div className="text-sm" style={{ opacity: 0.7 }}>{exp.paidBy?.email}</div>
            </div>
          </div>
        </div>

        <div className="stat-card purple" style={{ padding: 20 }}>
          <div className="flex items-center gap-sm" style={{ opacity: 0.7, marginBottom: 8 }}>
            <Calendar size={14} /> <span className="text-xs">DATE</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>
            {exp.date ? format(parseISO(exp.date), 'dd MMMM yyyy') : '—'}
          </div>
          <div className="text-sm" style={{ opacity: 0.7 }}>
            {exp.date ? format(parseISO(exp.date), 'EEEE') : ''}
          </div>
        </div>

        <div className="stat-card amber" style={{ padding: 20 }}>
          <div className="flex items-center gap-sm" style={{ opacity: 0.7, marginBottom: 8 }}>
            <SplitSquareHorizontal size={14} /> <span className="text-xs">SPLIT AMONG</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>{exp.splits?.length} people</div>
          <div className="text-sm" style={{ opacity: 0.7 }}>{exp.splitType} split</div>
        </div>
      </div>

      {/* Splits table */}
      <div style={{ marginBottom: 20 }}>
        <h2 className="text-h3" style={{ marginBottom: 12 }}>Split Breakdown</h2>
        <div className="table-card">
          <div className="table-header" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
            <span>Member</span><span>Share %</span><span>Share Amount</span><span>Status</span>
          </div>
          <div className="table-section">
            {(exp.splits || []).map((s) => (
              <div key={s.id} className="table-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                <div className="flex items-center gap-sm">
                  <Avatar name={s.user?.name} size="sm" />
                  <span style={{ fontWeight: 600 }}>{s.user?.name}</span>
                  {s.userId === exp.paidById && (
                    <Badge label="Paid" color="teal" />
                  )}
                </div>
                <div style={{ fontWeight: 600 }}>{parseFloat(s.sharePercent || 0).toFixed(1)}%</div>
                <div style={{ fontWeight: 800 }}>{fmt(s.shareAmount)}</div>
                <div>
                  {s.userId === exp.paidById
                    ? <Badge label="Paid" color="lime" />
                    : <Badge label="Owes" color="coral" />
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notes */}
      {exp.notes && (
        <div className="stat-card black" style={{ padding: 20, marginBottom: 20 }}>
          <div className="text-xs" style={{ color: '#666', marginBottom: 8 }}>NOTES</div>
          <p style={{ color: '#ccc', lineHeight: 1.6 }}>{exp.notes}</p>
        </div>
      )}

      {/* Delete */}
      <button className="btn btn-coral" onClick={handleDelete} disabled={deleteMutation.isPending}>
        <Trash2 size={15} /> {deleteMutation.isPending ? 'Deleting...' : 'Delete Expense'}
      </button>
    </div>
  );
}
