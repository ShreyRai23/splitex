// src/components/ui/Avatar.jsx
const COLORS = ['lime','purple','coral','amber','teal','sky','peach','black'];
function pickColor(name = '') {
  return COLORS[(name.charCodeAt(0) || 0) % COLORS.length];
}

export default function Avatar({ name = '', size = 'md', style }) {
  const color = pickColor(name);
  const initial = name?.[0]?.toUpperCase() || '?';
  return (
    <div
      className={`avatar avatar-${size} stat-card ${color}`}
      style={{ fontFamily: 'var(--font-body)', ...style }}
      title={name}
    >
      {initial}
    </div>
  );
}
