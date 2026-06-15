// src/pages/DashboardPage.jsx
import { useQuery } from '@tanstack/react-query';
import { balancesApi, expensesApi } from '../api/index.js';
import useAppStore from '../store/app.store.js';
import StatCard from '../components/ui/StatCard.jsx';
import DarkChartCard from '../components/charts/DarkChartCard.jsx';
import Badge from '../components/ui/Badge.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function Skeleton({ width = '100%', height = 20 }) {
  return <div className="skeleton" style={{ width, height, borderRadius: 8 }} />;
}

export default function DashboardPage() {
  const { selectedGroupId } = useAppStore();

  const { data: balData, isLoading: balLoading } = useQuery({
    queryKey: ['group-balances', selectedGroupId],
    queryFn: () => balancesApi.group(selectedGroupId).then(r => r.data.data),
    refetchInterval: 30000,
    enabled: !!selectedGroupId,
  });

  const { data: expData, isLoading: expLoading } = useQuery({
    queryKey: ['recent-expenses', selectedGroupId],
    queryFn: () => expensesApi.list({ groupId: selectedGroupId, limit: 6 }).then(r => r.data.data),
    enabled: !!selectedGroupId,
  });

  const summary = balData?.summary || [];
  const simplified = balData?.simplifiedTransactions || [];

  // Build chart data from expenses
  const chartData = (expData || []).slice().reverse().map((e, i) => ({
    label: format(parseISO(e.date), 'dd MMM'),
    value: parseFloat(e.amountInr),
    value2: parseFloat(e.splits?.[0]?.shareAmount || 0),
  }));

  // Total paid, owed, net
  const totalPaid = summary.reduce((s, u) => s + (u.balance > 0 ? u.balance : 0), 0);
  const totalOwed = summary.reduce((s, u) => s + (u.balance < 0 ? Math.abs(u.balance) : 0), 0);

  if (!selectedGroupId) {
    return (
      <div className="page animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center' }}>
        <div style={{ background: 'var(--card-bg)', padding: '40px', borderRadius: 'var(--r-card)', border: '1px solid var(--border)' }}>
          <Users size={48} color="var(--purple)" style={{ marginBottom: 16 }} />
          <h2 className="text-h2">Welcome to SpilTeX!</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, marginBottom: 24, maxWidth: 400 }}>
            You don't belong to any groups yet. To start tracking expenses, you need to create a new group or join an existing one.
          </p>
          <Link to="/groups" className="btn btn-purple btn-lg">
            Manage Groups →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page animate-fade-in">
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="text-h1">Overview</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Monitor your group's financial health</p>
        </div>
        <Link to="/expenses" className="btn btn-lime">
          + New Expense
        </Link>
      </div>

      {/* ── KPI Row ─────────────────────────────────────── */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {balLoading ? (
          [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 20 }} />)
        ) : (
          <>
            <StatCard color="lime"   label="Total Paid In"  value={fmt(totalPaid)}   sub={`${summary.length} members`}     arrow="up" />
            <StatCard color="purple" label="Total Owed Out" value={fmt(totalOwed)}   sub="Pending settlement"               arrow="down" />
            <StatCard color="black"  label="Transactions Needed" value={simplified.length} sub="To settle all group debts"  arrow="net" />
          </>
        )}
      </div>

      {/* ── Main Grid: Chart + Simplified Debts ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Chart card */}
        <DarkChartCard
          data={chartData}
          title="Expense trend"
          value={fmt(expData?.[0]?.amountInr)}
          sub="LATEST EXPENSE"
          name1="Total Expense"
          name2="Your Share"
        />

        {/* Who pays whom */}
        <div className="stat-card coral" style={{ padding: 24 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={16} /> Who Pays Whom
          </div>
          {balLoading ? <Skeleton height={80} /> : (
            simplified.length === 0 ? (
              <div style={{ opacity: 0.6, fontSize: '0.875rem' }}>All settled up! 🎉</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {simplified.slice(0, 4).map((t, i) => (
                  <div key={i} style={{
                    background: 'rgba(0,0,0,0.1)', borderRadius: 12, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '0.875rem',
                  }}>
                    <div className="flex items-center gap-sm">
                      <Avatar name={t.payer?.name} size="sm" />
                      <span style={{ fontWeight: 600 }}>{t.payer?.name}</span>
                      <ArrowRight size={12} />
                      <span>{t.payee?.name}</span>
                    </div>
                    <strong>{fmt(t.amount)}</strong>
                  </div>
                ))}
              </div>
            )
          )}
          <Link to="/balances" className="btn btn-black btn-sm" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
            View full balances
          </Link>
        </div>
      </div>

      {/* ── Member Balances + Recent Expenses ───────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
        {/* Member summary */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="text-h3">Member Balances</h2>
            <Link to="/balances" className="btn btn-ghost btn-sm">View all →</Link>
          </div>
          <div className="table-card">
            <div className="table-section">
              {balLoading ? (
                [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 12, marginBottom: 4 }} />)
              ) : summary.map((m) => (
                <Link key={m.userId} to={`/balances/${m.userId}`} className="table-row" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div className="flex items-center gap-md">
                    <Avatar name={m.name} size="sm" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.name}</div>
                      <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {m.balance >= 0 ? 'is owed' : 'owes'}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontWeight: 800, fontSize: '1rem',
                    color: m.balance >= 0 ? 'var(--lime-dark)' : 'var(--coral)',
                  }}>
                    {fmt(Math.abs(m.balance))}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent expenses */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="text-h3">Recent Expenses</h2>
            <Link to="/expenses" className="btn btn-ghost btn-sm">View all →</Link>
          </div>
          <div className="table-card">
            <div className="table-section">
              {expLoading ? (
                [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 4 }} />)
              ) : (expData || []).map((exp) => (
                <Link key={exp.id} to={`/expenses/${exp.id}`} className="table-row" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{exp.description}</div>
                    <div className="flex items-center gap-sm">
                      <Avatar name={exp.paidBy?.name} size="sm" />
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {exp.paidBy?.name} • {format(parseISO(exp.date), 'dd MMM')}
                      </span>
                      <Badge label={exp.splitType} />
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1rem' }}>{fmt(exp.amountInr)}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
