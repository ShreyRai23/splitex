// src/pages/UserBalancePage.jsx
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { balancesApi, expensesApi, usersApi } from '../api/index.js';
import useAppStore from '../store/app.store.js';
import Badge from '../components/ui/Badge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { ArrowLeft, TrendingDown, TrendingUp, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function UserBalancePage() {
  const { userId } = useParams();
  const { selectedGroupId } = useAppStore();

  const { data: userObj } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.get(userId).then(r => r.data.data),
  });

  const { data: balData, isLoading: balLoading } = useQuery({
    queryKey: ['user-balance', userId, selectedGroupId],
    queryFn: () => balancesApi.user(userId, selectedGroupId).then(r => r.data.data),
  });

  // We also want to fetch all expenses for this group to show the itemized list
  const { data: expenses = [], isLoading: expLoading } = useQuery({
    queryKey: ['expenses', selectedGroupId],
    queryFn: () => expensesApi.list({ groupId: selectedGroupId, limit: 1000 }).then(r => r.data.data),
  });

  if (balLoading || expLoading || !userObj) {
    return <div className="page"><div className="skeleton" style={{ height: 200, borderRadius: 20 }} /></div>;
  }

  const balance = balData?.netBalance || 0;
  const availableColors = ['purple', 'lime', 'peach', 'amber', 'teal', 'coral', 'sky'];
  const color = availableColors[Number(userId) % availableColors.length];

  // Build the itemized ledger
  // 1. Expenses they paid for (they are owed money by others)
  const paidByThem = expenses.filter(e => e.paidById === Number(userId));
  // 2. Expenses they owe money on (someone else paid, they are in the split)
  const oweOn = expenses.filter(e => e.paidById !== Number(userId) && e.splits?.some(s => s.userId === Number(userId)));

  // Compute accurate real totals
  const totalPaidIn = paidByThem.reduce((sum, e) => sum + parseFloat(e.amountInr), 0) + (balData?.breakdown?.settlementsYouMade?.total || 0);
  const totalShareOfExpenses = expenses.reduce((sum, e) => {
    const s = e.splits?.find(s => s.userId === Number(userId));
    return sum + (s ? parseFloat(s.shareAmount) : 0);
  }, 0);

  return (
    <div className="page animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <Link to="/balances" className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} /> Back to Balances
        </Link>
      </div>

      <div className={`stat-card ${color}`} style={{ padding: 40, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-md">
            <Avatar name={userObj.name} size="lg" style={{ width: 80, height: 80, fontSize: '2rem' }} />
            <div>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1 }}>{userObj.name}</h1>
              <div style={{ opacity: 0.8, marginTop: 4 }}>
                {balance > 0 ? 'Group owes them money' : balance < 0 ? 'They owe the group money' : 'Fully settled up'}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="text-xs" style={{ opacity: 0.7, marginBottom: 8 }}>NET BALANCE</div>
            <div style={{ fontSize: '4rem', fontWeight: 900, lineHeight: 0.9, letterSpacing: '-0.04em' }}>
              {balance > 0 ? '+' : balance < 0 ? '-' : ''}{fmt(Math.abs(balance))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 32, marginTop: 32, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 24 }}>
          <div>
            <div className="text-xs" style={{ opacity: 0.7 }}>TOTAL PAID IN</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{fmt(totalPaidIn)}</div>
          </div>
          <div>
            <div className="text-xs" style={{ opacity: 0.7 }}>TOTAL PERSONAL SHARE</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{fmt(totalShareOfExpenses)}</div>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <h2 className="text-h2" style={{ marginBottom: 16 }}>Itemized Ledger ({userObj.name}&apos;s View)</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
        Every expense that contributes to the {fmt(balance)} net balance.
      </p>

      <div className="responsive-grid-2" style={{ marginBottom: 24 }}>
        {/* Left: What they paid */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'var(--lime-dark)' }}>
            <TrendingUp size={18} /> <h3 className="text-h3">They Paid For...</h3>
          </div>
          <div className="table-card" style={{ background: 'var(--bg)' }}>
            {paidByThem.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No expenses paid.</div>
            ) : paidByThem.map(exp => {
              // They paid X. Their share is Y. So the group owes them X - Y.
              const theirSplit = exp.splits?.find(s => s.userId === Number(userId));
              const theirShare = theirSplit ? parseFloat(theirSplit.shareAmount) : 0;
              const theyAreOwed = parseFloat(exp.amountInr) - theirShare;

              return (
                <Link key={exp.id} to={`/expenses/${exp.id}`} className="table-row" style={{ gridTemplateColumns: '1fr auto', background: 'var(--bg-alt)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{exp.description}</div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {format(parseISO(exp.date), 'dd MMM')} • Paid {fmt(exp.amountInr)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--lime-dark)' }}>+{fmt(theyAreOwed)}</div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>owed to them</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: What they owe */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'var(--coral)' }}>
            <TrendingDown size={18} /> <h3 className="text-h3">They Owe For...</h3>
          </div>
          <div className="table-card" style={{ background: 'var(--bg)' }}>
            {oweOn.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No debts.</div>
            ) : oweOn.map(exp => {
              const theirSplit = exp.splits?.find(s => s.userId === Number(userId));
              const theyOwe = theirSplit ? parseFloat(theirSplit.shareAmount) : 0;

              return (
                <Link key={exp.id} to={`/expenses/${exp.id}`} className="table-row" style={{ gridTemplateColumns: '1fr auto', background: 'var(--bg-alt)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{exp.description}</div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {format(parseISO(exp.date), 'dd MMM')} • Paid by {exp.paidBy?.name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--coral)' }}>-{fmt(theyOwe)}</div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>they owe</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
