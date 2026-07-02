// src/pages/GroupsPage.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi, usersApi } from '../api/index.js';
import useAppStore from '../store/app.store.js';
import Modal from '../components/ui/Modal.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Users, ArrowRight, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GroupsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { setSelectedGroupId } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formErrs, setFormErrs] = useState({});

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list().then(r => r.data.data),
  });

  const { data: usersData = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data.data),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Client-side validation
    const errs = {};
    if (!name.trim())            errs.name    = 'Group name is required.';
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters.';
    if (members.length === 0)    errs.members = 'Select at least one member.';
    if (Object.keys(errs).length) { setFormErrs(errs); return; }

    setLoading(true);
    try {
      const { data } = await groupsApi.create({ name: name.trim(), members });
      qc.invalidateQueries(['groups']);
      toast.success('Group created');
      setShowModal(false);
      setName('');
      setMembers([]);
      setFormErrs({});
      // Auto switch to new group
      setSelectedGroupId(data.data.id);
      navigate(`/groups/${data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="text-h1">My Groups</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Manage your flat or trip groups</p>
        </div>
        <button className="btn btn-black" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Group
        </button>
      </div>

      <div className="grid-3">
        {isLoading ? (
          [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 20 }} />)
        ) : groups.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 60, textAlign: 'center', background: 'var(--bg-alt)', borderRadius: 20 }}>
            <Users size={48} color="var(--border)" style={{ margin: '0 auto 16px' }} />
            <h3 className="text-h3">No groups yet</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Create a group to start tracking expenses.</p>
            <button className="btn btn-black" onClick={() => setShowModal(true)}>Create Group</button>
          </div>
        ) : (
          groups.map((g, i) => {
            const colors = ['purple', 'lime', 'amber', 'peach', 'sky'];
            const color = colors[i % colors.length];
            return (
              <div
                key={g.id}
                className={`stat-card ${color}`}
                style={{ padding: 24, display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                onClick={() => { setSelectedGroupId(g.id); navigate(`/groups/${g.id}`); }}
              >
                <div style={{ flex: 1 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                    <div className="badge badge-black">Group #{g.id}</div>
                    <Link to={`/groups/${g.id}`} className="btn btn-ghost btn-sm btn-icon" style={{ background: 'rgba(0,0,0,0.05)' }}>
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                  <h2 className="text-h2" style={{ marginBottom: 8 }}>{g.name}</h2>
                  <div className="flex items-center gap-xs">
                    <Users size={14} />
                    <span className="text-sm">{g.members?.length || 0} members</span>
                  </div>
                </div>

                {/* Member avatars overlapping */}
                <div style={{ display: 'flex', marginTop: 24 }}>
                  {g.members?.slice(0, 5).map((m, idx) => (
                    <Avatar
                      key={m.id}
                      name={m.user?.name}
                      size="sm"
                      style={{
                        marginLeft: idx > 0 ? -12 : 0,
                        border: `2px solid var(--${color})`,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    />
                  ))}
                  {(g.members?.length || 0) > 5 && (
                    <div className="avatar avatar-sm stat-card black" style={{ marginLeft: -12, border: `2px solid var(--${color})` }}>
                      +{(g.members?.length || 0) - 5}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setFormErrs({}); }} title="Create New Group">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Group Name</label>
            <input
              className="form-input"
              placeholder="e.g. Flat 4B, Goa Trip..."
              value={name}
              onChange={e => { setName(e.target.value); setFormErrs(p => ({...p, name: ''})); }}
              style={{ borderColor: formErrs.name ? '#ef4444' : undefined }}
            />
            {formErrs.name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, color: '#b91c1c', fontSize: '0.78rem' }}>
                <AlertCircle size={12} /><span>{formErrs.name}</span>
              </div>
            )}
          </div>
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Initial Members</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {usersData.map(u => (
                <button
                  key={u.id}
                  type="button"
                  className={`btn btn-sm ${members.includes(u.id) ? 'btn-black' : 'btn-outline'}`}
                  onClick={() => { setMembers(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]); setFormErrs(p => ({...p, members: ''})); }}
                >
                  {u.name}
                </button>
              ))}
            </div>
            {formErrs.members && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, color: '#b91c1c', fontSize: '0.78rem' }}>
                <AlertCircle size={12} /><span>{formErrs.members}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="submit" className="btn btn-black" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
