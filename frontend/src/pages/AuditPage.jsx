// src/pages/AuditPage.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api/index.js';
import Avatar from '../components/ui/Avatar.jsx';
import Badge from '../components/ui/Badge.jsx';
import { format, parseISO } from 'date-fns';
import { Search } from 'lucide-react';

export default function AuditPage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => auditApi.list().then(r => r.data.data),
  });

  const filtered = logs;

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="text-h1">Audit Log</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Verify every mutation in the system</p>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 2fr 1.5fr' }}>
          <span>Timestamp</span><span>User</span><span>Action</span><span>Entity</span><span>Details</span>
        </div>
        <div className="table-section">
          {isLoading
            ? [1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 4 }} />)
            : filtered.length === 0
              ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No logs found.</div>
              : filtered.map(log => {
                const colorMap = { CREATE: 'lime', UPDATE: 'amber', DELETE: 'coral' };
                const color = colorMap[log.action] || 'black';

                return (
                  <div key={log.id} className="table-row" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 2fr 1.5fr', fontSize: '0.875rem' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {format(parseISO(log.createdAt), 'dd MMM yyyy, HH:mm:ss')}
                    </div>
                    <div className="flex items-center gap-sm">
                      <Avatar name={log.user?.name} size="sm" />
                      <span style={{ fontWeight: 600 }}>{log.user?.name || 'System'}</span>
                    </div>
                    <div>
                      <Badge label={log.action} color={color} />
                    </div>
                    <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {log.targetType} #{String(log.targetId).length > 10 ? String(log.targetId).substring(0, 8) + '...' : log.targetId}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {log.detail && typeof log.detail === 'object' ? (
                        Object.entries(log.detail).map(([k, v]) => (
                          <span key={k} style={{ background: 'var(--border)', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>
                            <span style={{ opacity: 0.6, marginRight: 2 }}>{k}:</span> 
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </span>
                        ))
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>
    </div>
  );
}
