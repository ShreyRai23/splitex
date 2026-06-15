// src/pages/BalancesPage.jsx
import { useQuery } from '@tanstack/react-query';
import { balancesApi } from '../api/index.js';
import useAppStore from '../store/app.store.js';
import Avatar from '../components/ui/Avatar.jsx';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import DarkChartCard from '../components/charts/DarkChartCard.jsx';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function BalancesPage() {
  const { selectedGroupId } = useAppStore();

  const { data, isLoading } = useQuery({
    queryKey: ['group-balances', selectedGroupId],
    queryFn: () => balancesApi.group(selectedGroupId).then(r => r.data.data),
    refetchInterval: 20000,
    enabled: !!selectedGroupId,
  });

  const summary = data?.summary || [];
  const simplified = data?.simplifiedTransactions || [];

  // Chart data: member balances
  const chartData = summary.map(m => ({
    label: m.name?.split(' ')[0] || m.name,
    value: Math.max(0, m.balance),    // owed to them
    value2: Math.abs(Math.min(0, m.balance)), // they owe
  }));

  const totalOwed = summary.reduce((s, u) => s + (u.balance > 0 ? u.balance : 0), 0);
  const totalOwe  = summary.reduce((s, u) => s + (u.balance < 0 ? Math.abs(u.balance) : 0), 0);

  if (!selectedGroupId) {
    return (
      <div className="page animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', textAlign: 'center' }}>
        <div style={{ background: 'var(--card-bg)', padding: '40px', borderRadius: 'var(--r-card)', border: '1px solid var(--border)' }}>
          <h2 className="text-h2">No Group Selected</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, marginBottom: 24, maxWidth: 400 }}>
            You need to be in a group to view balances.
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
      <div className="page-header">
        <div>
          <h1 className="text-h1">Balances</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Live computation of all debts and credits</p>
        </div>
        <Link to="/settlements" className="btn btn-teal">
          <CheckCircle2 size={16} /> Record Settlement
        </Link>
      </div>

      {/* Top row: KPIs + chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 20, marginBottom: 24 }}>
        <div className="stat-card lime" style={{ padding: 24 }}>
          <div className="stat-card-label">Total Owed to Group</div>
          <div className="stat-card-value">{fmt(totalOwed)}</div>
          <div className="stat-card-sub">Members in credit</div>
        </div>
        <div className="stat-card coral" style={{ padding: 24 }}>
          <div className="stat-card-label">Total Owed by Group</div>
          <div className="stat-card-value">{fmt(totalOwe)}</div>
          <div className="stat-card-sub">Members in debit</div>
        </div>
        <DarkChartCard
          data={chartData}
          title="Member balances (owed vs owing)"
          value={`${summary.length} members`}
          sub="GROUP OVERVIEW"
          type="bar"
          name1="Owed to them"
          name2="They owe"
          tooltipFormatter={(val, name) => [
            `₹${Number(val).toLocaleString('en-IN')}`,
            name === 'value' ? 'Owed to them' : 'They owe'
          ]}
        />
      </div>

      {/* Member balance cards */}
      <h2 className="text-h3" style={{ marginBottom: 16 }}>Member Balances</h2>
      <div className="grid-2" style={{ marginBottom: 28 }}>
        {isLoading
          ? [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 20 }} />)
          : summary.map((m) => {
              const availableColors = ['purple', 'lime', 'peach', 'amber', 'teal', 'coral', 'sky'];
              const color = availableColors[m.userId % availableColors.length];
              return (
                <Link key={m.userId} to={`/balances/${m.userId}`} style={{ textDecoration: 'none' }}>
                  <div className={`stat-card ${color}`} style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="flex items-center gap-md">
                        <Avatar name={m.name} size="lg" />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.0625rem' }}>{m.name}</div>
                          <div className="text-sm" style={{ opacity: 0.7, marginTop: 2 }}>
                            {m.balance > 0 ? '↗ is owed money' : m.balance < 0 ? '↙ owes money' : '✓ settled up'}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, lineHeight: 1 }}>
                          {fmt(Math.abs(m.balance))}
                        </div>
                        <div className="text-sm" style={{ opacity: 0.65, marginTop: 4 }}>
                          Click to see breakdown →
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
        }
      </div>

      {/* Simplified transactions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 className="text-h3">Simplified Debts</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Minimum transactions to settle all debts (greedy algorithm)
          </p>
        </div>
        <div className="badge badge-black">{simplified.length} transactions</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {simplified.length === 0 ? (
          <div className="stat-card teal" style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>All settled up!</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>No outstanding debts in this group.</div>
          </div>
        ) : simplified.map((t, i) => (
          <div key={i} className="debt-card stat-card peach" style={{ padding: '20px 24px' }}>
            <div className="flex items-center gap-md">
              <Avatar name={t.payer?.name} size="md" />
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.0625rem' }}>{t.payer?.name}</div>
                <div className="text-sm" style={{ opacity: 0.7 }}>pays</div>
              </div>
            </div>

            <div className="flex items-center gap-sm" style={{ color: 'var(--text-secondary)' }}>
              <ArrowRight size={20} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>{fmt(t.amount)}</div>
            </div>

            <div className="flex items-center gap-md" style={{ flexDirection: 'row-reverse' }}>
              <Avatar name={t.payee?.name} size="md" />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, fontSize: '1.0625rem' }}>{t.payee?.name}</div>
                <div className="text-sm" style={{ opacity: 0.7 }}>receives</div>
              </div>
            </div>

            <Link to="/settlements" className="btn btn-black btn-sm">
              Settle →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

