import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getPipelineStyle } from '../constants/pipeline';
import EmptyState from '../../../shared/components/EmptyState';

export default function StatusDistributionChart({ data }) {
  if (!data || data.length === 0) return <EmptyState icon="donut_large" message="No status data yet." />;
  const chartData = data.map(d => ({ name: d.status, value: d.count, fill: getPipelineStyle(d.status).color }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 4 }} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
