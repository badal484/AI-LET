import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  isPositive = true,
}) => {
  return (
    <div className="card" style={{ flex: 1, minWidth: '220px' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>{title}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
          {value}
        </h3>
        {change && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: '500',
              color: isPositive ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  );
};
