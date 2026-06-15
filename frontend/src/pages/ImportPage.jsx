// src/pages/ImportPage.jsx
import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { importApi } from '../api/index.js';
import useAppStore from '../store/app.store.js';
import Badge from '../components/ui/Badge.jsx';
import { UploadCloud, File, AlertCircle, Sparkles, Check, X, ArrowRight, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function ImportPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { selectedGroupId } = useAppStore();
  const fileInputRef = useRef(null);
  
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  
  // Phase state: 0 = upload, 1 = dry-run review, 2 = success
  const [phase, setPhase] = useState(0);
  const [dryRunRes, setDryRunRes] = useState(null);
  
  // User decisions per row
  const [decisions, setDecisions] = useState({});

  const dryRunMutation = useMutation({
    mutationFn: (formData) => importApi.dryRun(formData),
    onSuccess: (res) => {
      setDryRunRes(res.data);
      // Initialize decisions (default to IMPORT for ready/warnings, SKIP for errors)
      const initialDecisions = {};
      res.data.report.rows.forEach((row) => {
        initialDecisions[row.rowNumber] = (row.status === 'BLOCKED' || row.status === 'PARSE_ERROR') ? 'SKIP' : 'IMPORT';
        // Auto-suggest SETTLEMENT for SETTLEMENT_DISGUISED
        if (row.anomalies?.some(a => a.type === 'SETTLEMENT_DISGUISED')) {
          initialDecisions[row.rowNumber] = 'CONVERT_TO_SETTLEMENT';
        }
      });
      setDecisions(initialDecisions);
      setPhase(1);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Dry run failed'),
  });

  const commitMutation = useMutation({
    mutationFn: (data) => importApi.commit(data),
    onSuccess: () => {
      qc.invalidateQueries(['expenses']);
      qc.invalidateQueries(['group-balances']);
      qc.invalidateQueries(['import-batches']);
      toast.success('Import complete!');
      setPhase(2);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Commit failed'),
  });

  // --- Upload Handlers ---
  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };
  
  const handleStartDryRun = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('groupId', selectedGroupId);
    dryRunMutation.mutate(formData);
  };

  const handleCommit = () => {
    const userDecisions = Object.entries(decisions).map(([rowNumber, action]) => ({
      rowNumber: parseInt(rowNumber, 10),
      action,
    }));
    const payload = {
      batchId: dryRunRes.batchId,
      groupId: selectedGroupId,
      userDecisions,
    };
    commitMutation.mutate(payload);
  };

  // --- UI Renders ---

  if (phase === 2) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div className="stat-card teal" style={{ display: 'inline-block', padding: 48, borderRadius: 'var(--r-card)' }}>
          <CheckCircle2 size={64} style={{ margin: '0 auto 24px' }} />
          <h1 className="text-h1" style={{ marginBottom: 16 }}>Import Complete!</h1>
          <p style={{ opacity: 0.8, marginBottom: 32 }}>Your expenses and settlements have been successfully recorded.</p>
          <button className="btn btn-black btn-lg" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="text-h1">Import CSV</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Bulk import and analyze expenses from CSV</p>
        </div>
        {phase === 1 && (
          <button className="btn btn-coral" onClick={() => { setPhase(0); setFile(null); }}>
            Cancel Import
          </button>
        )}
      </div>

      {phase === 0 ? (
        <div style={{ maxWidth: 640, margin: '40px auto 0' }}>
          <div
            className={`upload-zone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" hidden ref={fileInputRef} accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
            
            {file ? (
              <div className="flex-col items-center gap-md">
                <File size={48} color="var(--lime-dark)" />
                <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>{file.name}</div>
                <div style={{ color: 'var(--text-muted)' }}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            ) : (
              <div className="flex-col items-center gap-md">
                <UploadCloud size={48} color="var(--border)" />
                <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>Drag & drop your CSV here</div>
                <div style={{ color: 'var(--text-muted)' }}>or click to browse (.csv only)</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              className="btn btn-black btn-lg"
              disabled={!file || dryRunMutation.isPending}
              onClick={handleStartDryRun}
            >
              {dryRunMutation.isPending ? 'Analyzing with AI...' : 'Run Analysis (Dry Run) →'}
            </button>
          </div>
        </div>
      ) : (
        // PHASE 1: DRY RUN REVIEW
        <div>
          {/* Summary */}
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <div className="stat-card black" style={{ padding: 20 }}>
              <div className="text-xs" style={{ opacity: 0.7 }}>TOTAL ROWS</div>
              <div style={{ fontSize: '2rem', fontWeight: 900 }}>{dryRunRes.report.summary.totalRows}</div>
            </div>
            <div className="stat-card teal" style={{ padding: 20 }}>
              <div className="text-xs" style={{ opacity: 0.7 }}>READY</div>
              <div style={{ fontSize: '2rem', fontWeight: 900 }}>{dryRunRes.report.summary.ready}</div>
            </div>
            <div className="stat-card amber" style={{ padding: 20 }}>
              <div className="text-xs" style={{ opacity: 0.7 }}>WARNINGS (AI Fixed)</div>
              <div style={{ fontSize: '2rem', fontWeight: 900 }}>{dryRunRes.report.summary.needsReview}</div>
            </div>
            <div className="stat-card coral" style={{ padding: 20 }}>
              <div className="text-xs" style={{ opacity: 0.7 }}>BLOCKED</div>
              <div style={{ fontSize: '2rem', fontWeight: 900 }}>{dryRunRes.report.summary.blocked + dryRunRes.report.summary.parseErrors}</div>
            </div>
          </div>

          {/* Review Rows */}
          <h2 className="text-h3" style={{ marginBottom: 16 }}>Review Anomalies</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
            {dryRunRes.report.rows.map((row, i) => {
              if (row.status === 'READY' && row.anomalies.length === 0) return null; // hide perfect rows
              
              const isError = row.status === 'BLOCKED' || row.status === 'PARSE_ERROR';
              const isWarning = row.status === 'NEEDS_REVIEW';
              const cardClass = isError ? 'error' : isWarning ? 'warning' : 'info';

              return (
                <div key={i} className={`anomaly-card ${cardClass}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div className="flex items-center gap-sm" style={{ marginBottom: 8 }}>
                        <span className="badge badge-black">Row {row.rowNumber}</span>
                        {row.anomalies.map((a, j) => <Badge key={j} label={a.type} />)}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>
                        {row.processedRow?.description || row.originalRow?.description || 'Unknown'} — {fmt(row.processedRow?.amountInr || row.originalRow?.amount)}
                      </div>
                    </div>
                    
                    {/* Decision Dropdown */}
                    <div style={{ position: 'relative' }}>
                      <select
                        className="pill-select"
                        style={{ background: 'var(--bg)', minWidth: 160, paddingRight: 32, appearance: 'none' }}
                        value={decisions[row.rowNumber] || 'SKIP'}
                        onChange={(e) => setDecisions({ ...decisions, [row.rowNumber]: e.target.value })}
                      >
                        <option value="IMPORT" disabled={isError}>Import</option>
                        <option value="SKIP">Skip Row</option>
                        <option value="CONVERT_TO_SETTLEMENT" disabled={isError}>Convert to Settlement</option>
                      </select>
                      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                    </div>
                  </div>

                  {/* AI Explanations */}
                  {row.anomalies.map((a, j) => (
                    <div key={j} style={{
                      background: 'rgba(255,255,255,0.4)', borderRadius: 8, padding: 12, marginTop: 8,
                      display: 'flex', gap: 12, alignItems: 'flex-start'
                    }}>
                      <div style={{ marginTop: 2, color: 'var(--purple)' }}><Sparkles size={16} /></div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{a.message}</div>
                        {a.aiContext && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                            <div style={{ marginBottom: 2 }}>🤖 <strong>AI Analysis:</strong> {a.aiContext.explanation}</div>
                            <div style={{ opacity: 0.8 }}>👉 <strong>Recommendation:</strong> {a.aiContext.recommendation}</div>
                          </div>
                        )}
                        {a.autoFixApplied && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--lime-dark)', marginTop: 4, fontWeight: 600 }}>
                            ✓ Auto-fixed: {a.autoFixDetail}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Commit Banner */}
          <div style={{
            position: 'sticky', bottom: 24,
            background: 'var(--black)', color: 'white',
            padding: '20px 32px', borderRadius: 'var(--r-card)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: 'var(--shadow-dark)'
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.125rem' }}>Ready to commit?</div>
              <div className="text-sm" style={{ opacity: 0.7 }}>
                {Object.values(decisions).filter(d => d === 'IMPORT').length} expenses, {Object.values(decisions).filter(d => d === 'CONVERT_TO_SETTLEMENT').length} settlements
              </div>
            </div>
            <button
              className="btn btn-lime btn-lg"
              onClick={handleCommit}
              disabled={commitMutation.isPending}
            >
              {commitMutation.isPending ? 'Importing...' : 'Approve & Import'} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
