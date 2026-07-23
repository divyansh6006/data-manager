import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import EmptyState from '../../../shared/components/EmptyState';

export default function RecruiterPerformanceChart({ data }) {
  if (!data || data.length === 0) return <EmptyState icon="leaderboard" message="No recruiter performance data yet." />;

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#70787C' }} />
        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10, fill: '#40484B' }} />
        <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 4 }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="activeCandidates" name="Active" fill="#7C3AED" radius={[0, 4, 4, 0]} />
        <Bar dataKey="joined" name="Joined" fill="#047857" radius={[0, 4, 4, 0]} />
        <Bar dataKey="rejected" name="Rejected" fill="#DC2626" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
