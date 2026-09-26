'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon?: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  subtitle?: string;
  badge?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  isPositive = true,
  icon: Icon,
  iconColor = '#A855F7',
  iconBg = 'rgba(168, 85, 247, 0.12)',
  subtitle,
  badge,
}) => {
  return (
    <div
      style={{
        backgroundColor: '#0F121C',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '14px',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.35)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 28px -10px rgba(0, 0, 0, 0.6), 0 0 20px -8px rgba(168, 85, 247, 0.15)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Top subtle highlight line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.3), transparent)',
        }}
      />

      {/* Top row: Title, Badge, and Icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#94A3B8' }}>{title}</span>
          {badge && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: '700',
                padding: '1px 5px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: '#CBD5E1',
              }}
            >
              {badge}
            </span>
          )}
        </div>
        {Icon && (
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: iconBg,
              color: iconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={16} />
          </div>
        )}
      </div>

      {/* Metric Value & Trend */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <h3 style={{ fontSize: '26px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-0.02em', margin: 0, fontFamily: 'inherit' }}>
          {value}
        </h3>
        {change && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 7px',
              borderRadius: '6px',
              backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              color: isPositive ? '#34D399' : '#F87171',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {change}
          </span>
        )}
      </div>

      {subtitle && (
        <span style={{ fontSize: '11px', color: '#64748B', marginTop: '8px' }}>
          {subtitle}
        </span>
      )}
    </div>
  );
};
