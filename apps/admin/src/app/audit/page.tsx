'use client';

import React, { useState, useEffect } from 'react';
import { AuthGuard } from '../../components/AuthGuard';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Activity,
  Key,
  Lock,
  FileText,
} from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [searchAdmin, setSearchAdmin] = useState('');

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_access_token');
      const res = await fetch('http://localhost:4000/api/v1/admin/audit-logs', {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data?.logs || json.data || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesAction = !filterAction || log.action?.toLowerCase().includes(filterAction.toLowerCase());
    const matchesAdmin = !searchAdmin || log.adminEmail?.toLowerCase().includes(searchAdmin.toLowerCase()) || log.adminId?.includes(searchAdmin);
    return matchesAction && matchesAdmin;
  });

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={20} color="#10B981" />
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                Immutable Audit Trail & Security Logs
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
              Real-time immutable security logs of every administrative action, parameter edit, user ban, and system override.
            </p>
          </div>

          <button onClick={fetchAuditLogs} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Audit Logs
          </button>
        </div>

        {/* Filters */}
        <div className="card" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
            <Search size={16} color="#64748B" />
            <input
              type="text"
              className="form-input"
              placeholder="Search by Admin Email or ID..."
              value={searchAdmin}
              onChange={e => setSearchAdmin(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '220px' }}>
            <Filter size={16} color="#64748B" />
            <select
              className="form-input"
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
            >
              <option value="">All Action Types</option>
              <option value="CHARACTER_UPDATE">Character Updates</option>
              <option value="USER_BAN">User Bans & Suspensions</option>
              <option value="SYSTEM_KILLSWITCH">System Killswitches</option>
              <option value="MODEL_ROUTE">Model Routing Changes</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '14px 20px' }}>Timestamp</th>
                <th style={{ padding: '14px 20px' }}>Admin Operator</th>
                <th style={{ padding: '14px 20px' }}>Action</th>
                <th style={{ padding: '14px 20px' }}>Resource Target</th>
                <th style={{ padding: '14px 20px' }}>IP Address</th>
                <th style={{ padding: '14px 20px' }}>Details / Metadata</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8' }}>Loading audit records...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8' }}>No matching audit log records found.</td>
                </tr>
              ) : (
                filteredLogs.map((log: any, idx: number) => (
                  <tr key={log.id || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <td style={{ padding: '14px 20px', color: '#CBD5E1', whiteSpace: 'nowrap' }}>
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Just now'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#F8FAFC', fontWeight: '600' }}>
                      {log.adminEmail || log.adminId || 'Super Admin'}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="badge badge-purple">{log.action || 'UPDATE'}</span>
                    </td>
                    <td style={{ padding: '14px 20px', color: '#94A3B8' }}>
                      {log.targetType ? `${log.targetType}:${log.targetId?.slice(0, 8)}` : 'System Config'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#64748B', fontFamily: 'monospace' }}>
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td style={{ padding: '14px 20px', color: '#94A3B8', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {typeof log.metadata === 'object' ? JSON.stringify(log.metadata) : (log.details || 'Action completed successfully.')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGuard>
  );
}
