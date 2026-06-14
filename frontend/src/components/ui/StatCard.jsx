// src/components/ui/StatCard.jsx
export default function StatCard({ color = 'lime', label, value, sub, arrow, children, onClick, style }) {
  const arrowMap = { up: '↗', down: '↙', net: '↔' };
  return (
    <div className={`stat-card ${color}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default', ...style }}>
      {arrow && <span className="stat-card-arrow">{arrowMap[arrow] ?? arrow}</span>}
      {label && <div className="stat-card-label">{label}</div>}
      {value && <div className="stat-card-value">{value}</div>}
      {sub   && <div className="stat-card-sub">{sub}</div>}
      {children}
    </div>
  );
}
