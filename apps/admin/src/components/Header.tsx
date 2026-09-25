import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="admin-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Console</span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
          Overview
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span className="badge badge-success">
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--success)',
              marginRight: '6px',
            }}
          />
          Cluster Online
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            AD
          </div>
          <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
            Admin
          </span>
        </div>
      </div>
    </header>
  );
};
