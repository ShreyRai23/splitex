// src/pages/GroupDetailPage.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { groupsApi, usersApi } from '../api/index.js';
import useAuthStore from '../store/auth.store.js';
import Modal from '../components/ui/Modal.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { ArrowLeft, UserPlus, LogOut, AlertCircle } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

export default function GroupDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ userId: '', joinedAt: new Date().toISOString().slice(0,10) });
  const [addErr, setAddErr] = useState('');
  const [leaveModal, setLeaveModal] = useState({ open: false, uid: null, name: '', date: new Date().toISOString().slice(0,10) });
  const [leaveErr, setLeaveErr] = useState('');

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
    if (!addForm.userId) { setAddErr('Please select a user.'); return; }
    setAddErr('');
    addMutation.mutate({ userId: parseInt(addForm.userId), joinedAt: addForm.joinedAt });
  };

  const handleLeave = (uid, name) => {
    setLeaveModal({ open: true, uid, name, date: new Date().toISOString().slice(0,10) });
    setLeaveErr('');
  };

  const confirmLeave = () => {
    if (!leaveModal.date) { setLeaveErr('Please select a leave date.'); return; }
    leaveMutation.mutate({ uid: leaveModal.uid, leftAt: new Date(leaveModal.date).toISOString() });
    setLeaveModal(p => ({ ...p, open: false }));
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
            <button
              className="btn btn-outline"
              style={{ borderColor: 'var(--coral)', color: 'var(--coral)' }}
              onClick={() => handleLeave(currentUser.id, currentUser.name)}
            >
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
              <div key={m.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24, marginBottom: 16 }}>
                <div className="flex items-center gap-md" style={{ flex: '1 1 180px' }}>
                  <Avatar name={m.user?.name} size="sm" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.user?.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {format(join, 'MMM yyyy')} {m.leftAt ? ` - ${format(leave, 'MMM yyyy')}` : ' - Present'}
                    </div>
                  </div>
                </div>

                {/* Timeline Bar */}
                <div style={{ position: 'relative', height: 12, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden', flex: '2 1 200px' }}>
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

      <Modal open={showAdd} onClose={() => { setShowAdd(false); setAddErr(''); }} title="Add Member">
        <form onSubmit={handleAdd} noValidate>
          <div className="form-group">
            <label className="form-label">Select User</label>
            <select
              className="pill-select form-input"
              value={addForm.userId}
              onChange={e => { setAddForm(p => ({...p, userId: e.target.value})); setAddErr(''); }}
              style={{ borderColor: addErr ? '#ef4444' : undefined }}
            >
              <option value="">Select...</option>
              {(usersData || []).filter(u => !group.members?.find(m => m.userId === u.id)).map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
            {addErr && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: '#b91c1c', fontSize: '0.78rem' }}>
                <AlertCircle size={12} /><span>{addErr}</span>
              </div>
            )}
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

      {/* Leave Group Modal */}
      <Modal open={leaveModal.open} onClose={() => setLeaveModal(p => ({...p, open: false}))} title="Leave Group">
        <p style={{ marginBottom: 20, color: 'var(--text-secondary)' }}>
          When is <strong>{leaveModal.name}</strong> leaving the group? Members won't be charged expenses after this date.
        </p>
        <div className="form-group">
          <label className="form-label">Leave Date</label>
          <input
            className="form-input"
            type="date"
            value={leaveModal.date}
            onChange={e => { setLeaveModal(p => ({...p, date: e.target.value})); setLeaveErr(''); }}
            style={{ borderColor: leaveErr ? '#ef4444' : undefined }}
          />
          {leaveErr && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: '#b91c1c', fontSize: '0.78rem' }}>
              <AlertCircle size={12} /><span>{leaveErr}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button
            className="btn btn-outline"
            style={{ flex: 1, justifyContent: 'center', borderColor: 'var(--coral)', color: 'var(--coral)' }}
            onClick={confirmLeave}
            disabled={leaveMutation.isPending}
          >
            {leaveMutation.isPending ? 'Saving...' : 'Confirm Leave'}
          </button>
          <button className="btn btn-outline" onClick={() => setLeaveModal(p => ({...p, open: false}))}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
