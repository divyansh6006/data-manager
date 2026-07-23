import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import EmptyState from '../../../shared/components/EmptyState';

export default function WeeklyTrendChart({ data }) {
  if (!data || data.length === 0) return <EmptyState icon="trending_up" message="No trend data yet." />;
  const chartData = data.map(d => ({ ...d, label: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 10 }}>
        <defs>
          <linearGradient id="hiringTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#70787C' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#70787C' }} />
        <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 4 }} />
        <Area type="monotone" dataKey="count" stroke="#7C3AED" strokeWidth={2} fill="url(#hiringTrendFill)" name="Candidates Assigned" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
