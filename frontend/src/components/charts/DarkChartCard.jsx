// src/components/charts/DarkChartCard.jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function DarkChartCard({ data = [], title, value, sub, type = 'line', tooltipFormatter, name1 = "value", name2 = "value2" }) {
  const green = '#A8E63D';
  const purple = '#C4B5F4';

  return (
    <div className="dark-chart-card" style={{ height: '100%', minHeight: 200 }}>
      {title && (
        <div style={{ marginBottom: 16 }}>
          <div className="text-xs" style={{ color: '#666', marginBottom: 4 }}>{sub}</div>
          <div className="text-kpi" style={{ color: green }}>{value}</div>
          <div className="text-sm" style={{ color: '#999', marginTop: 4 }}>{title}</div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={title ? 100 : 140}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Bar dataKey="value" name={name1} fill={green} radius={[4, 4, 0, 0]} />
            <Bar dataKey="value2" name={name2} fill={purple} radius={[4, 4, 0, 0]} />
            <XAxis dataKey="label" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: 'none', borderRadius: 12, color: '#fff', fontSize: 13 }}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              formatter={tooltipFormatter || ((val) => `₹${val}`)}
            />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <Line type="monotone" dataKey="value" name={name1} stroke={green} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="value2" name={name2} stroke={purple} strokeWidth={2} dot={false} strokeDasharray="4 4" />
            <XAxis dataKey="label" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1a1a1a', border: 'none', borderRadius: 12, color: '#fff', fontSize: 13 }}
              cursor={{ stroke: '#444', strokeWidth: 1 }}
              formatter={tooltipFormatter || ((val) => `₹${val}`)}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
