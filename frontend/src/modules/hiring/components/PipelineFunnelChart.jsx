import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getPipelineStyle } from '../constants/pipeline';
import EmptyState from '../../../shared/components/EmptyState';

export default function PipelineFunnelChart({ data }) {
  if (!data || data.length === 0) return <EmptyState icon="filter_alt" message="No pipeline data yet." />;
  const chartData = data.map(d => ({ label: d.status, count: d.count, fill: getPipelineStyle(d.status).color }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 32)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#70787C' }} />
        <YAxis dataKey="label" type="category" width={140} tick={{ fontSize: 10, fill: '#40484B' }} />
        <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 4 }} formatter={(v) => [v + ' candidates', 'Count']} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
