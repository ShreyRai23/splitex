// src/components/ui/Badge.jsx
const STATUS_COLORS = {
  READY: 'teal', ready: 'teal',
  BLOCKED: 'coral', blocked: 'coral',
  NEEDS_REVIEW: 'amber', needs_review: 'amber',
  CONVERT_TO_SETTLEMENT: 'purple',
  SKIPPED: 'black', skipped: 'black',
  equal: 'lime', percentage: 'purple', exact: 'sky', share: 'amber',
  COMMITTED: 'teal', DRY_RUN_COMPLETE: 'amber', DRY_RUN_PENDING: 'black',
};

export default function Badge({ label, color, dot }) {
  const c = color || STATUS_COLORS[label] || 'black';
  return (
    <span className={`badge badge-${c}`}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />}
      {label?.replace(/_/g, ' ')}
    </span>
  );
}
