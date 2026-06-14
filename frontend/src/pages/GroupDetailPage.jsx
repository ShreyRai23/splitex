// src/pages/GroupDetailPage.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { groupsApi, usersApi } from '../api/index.js';
import useAuthStore from '../store/auth.store.js';
import Modal from '../components/ui/Modal.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { ArrowLeft, UserPlus, LogOut } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

export default function GroupDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ userId: '', joinedAt: new Date().toISOString().slice(0,10) });

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: () => groupsApi.get(id).then(r => r.data.data),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data.data),
  });

  const addMutation = useMutation({
    mutationFn: (data) => groupsApi.addMember(id, data),
    onSuccess: () => { qc.invalidateQueries(['group', id]); toast.success('Member added'); setShowAdd(false); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add member'),
  });

  const leaveMutation = useMutation({
    mutationFn: ({ uid, leftAt }) => groupsApi.removeMember(id, uid, { leftAt }),
    onSuccess: () => { qc.invalidateQueries(['group', id]); toast.success('Member marked as left'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!addForm.userId) return;
    addMutation.mutate({ userId: parseInt(addForm.userId), joinedAt: addForm.joinedAt });
  };

  const handleLeave = (uid, name) => {
    const d = prompt(`When are you leaving? (YYYY-MM-DD)`, new Date().toISOString().slice(0,10));
    if (!d) return;
    leaveMutation.mutate({ uid, leftAt: new Date(d).toISOString() });
  };

  if (isLoading || !group) return <div className="page"><div className="skeleton" style={{ height: 200 }} /></div>;

  // Timeline viz logic
  const now = new Date();
  const earliestDate = (group.members || []).reduce((min, m) => {
    const d = parseISO(m.joinedAt);
    return d < min ? d : min;
  }, now);

  const totalDays = Math.max(1, differenceInDays(now, earliestDate));
  const isActiveMember = group.members?.find(m => m.userId === currentUser?.id && !m.leftAt);

  return (
    <div className="page animate-fade-in">
      <div style={{ marginBottom: 24 }}>
        <Link to="/groups" className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} /> Back to Groups
        </Link>
      </div>

      <div className="stat-card black" style={{ padding: '32px 40px', marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="badge badge-lime" style={{ marginBottom: 12 }}>Group #{group.id}</div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900 }}>{group.name}</h1>
          <p style={{ opacity: 0.7, marginTop: 8 }}>{group.members?.length || 0} members</p>
        </div>
        <div className="flex gap-md">
          {isActiveMember && (
            <button className="btn btn-outline" style={{ borderColor: 'var(--coral)', color: 'var(--coral)' }} onClick={() => handleLeave(currentUser.id, currentUser.name)}>
              <LogOut size={16} /> Leave Group
            </button>
          )}
          <button className="btn btn-lime" onClick={() => setShowAdd(true)}>
            <UserPlus size={16} /> Add Member
          </button>
        </div>
      </div>

      {/* Member Timeline */}
      <div style={{ marginBottom: 24 }}>
        <h2 className="text-h3" style={{ marginBottom: 8 }}>Member Timeline</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.875rem' }}>
          Expenses are only split among members active on the expense date.
        </p>

        <div className="table-card" style={{ padding: '24px 32px' }}>
          {group.members?.map((m) => {
            const join = parseISO(m.joinedAt);
            const leave = m.leftAt ? parseISO(m.leftAt) : now;
            
            // Calculate percentages for CSS
            const leftPct = Math.max(0, (differenceInDays(join, earliestDate) / totalDays) * 100);
            const widthPct = Math.max(2, (differenceInDays(leave, join) / totalDays) * 100);
            
            const isActive = !m.leftAt;

            return (
              <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 100px', alignItems: 'center', gap: 24, marginBottom: 16 }}>
                <div className="flex items-center gap-md">
                  <Avatar name={m.user?.name} size="sm" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.user?.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {format(join, 'MMM yyyy')} {m.leftAt ? ` - ${format(leave, 'MMM yyyy')}` : ' - Present'}
                    </div>
                  </div>
                </div>

                {/* Timeline Bar */}
                <div style={{ position: 'relative', height: 12, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute',
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    height: '100%',
                    background: isActive ? 'var(--lime)' : 'var(--border)',
                    borderRadius: 6,
                    minWidth: 4,
                  }} />
                </div>

                {/* Actions */}
                <div style={{ textAlign: 'right' }}>
                  {isActive ? (
                    <span className="badge" style={{ border: '1px solid var(--lime)', color: 'var(--lime-dark)' }}>Active</span>
                  ) : (
                    <span className="badge badge-black">Left</span>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Timeline axis */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 224, paddingRight: 124, marginTop: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>{format(earliestDate, 'MMM yyyy')}</span>
            <span>Now</span>
          </div>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Member">
        <form onSubmit={handleAdd}>
          <div className="form-group">
            <label className="form-label">Select User</label>
            <select className="pill-select form-input" value={addForm.userId} onChange={e => setAddForm(p => ({...p, userId: e.target.value}))} required>
              <option value="">Select...</option>
              {(usersData || []).filter(u => !group.members?.find(m => m.userId === u.id)).map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Joined Date</label>
            <input className="form-input" type="date" value={addForm.joinedAt} onChange={e => setAddForm(p => ({...p, joinedAt: e.target.value}))} required />
          </div>
          <button type="submit" className="btn btn-lime" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} disabled={addMutation.isPending}>
            {addMutation.isPending ? 'Adding...' : 'Add Member'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
