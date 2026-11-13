import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { createAlertRule, getAlertRules, updateAlertRule, deleteAlertRule } from '../services/api';
import toast from 'react-hot-toast';
import type { AlertRule, AlertEventType } from '../types';
import { PlusCircle, Bell, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight } from 'lucide-react';

// ── Confirm Dialog ──────────────────────────────────────────────────────────
interface ConfirmDialogProps { message: string; onConfirm: () => void; onCancel: () => void; }
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
      <p className="text-sm text-gray-700 mb-5">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">Delete</button>
      </div>
    </div>
  </div>
);

// ── Edit Modal ───────────────────────────────────────────────────────────────
interface EditModalProps {
  rule: AlertRule;
  onSave: (id: string, data: { name: string; event_type: AlertEventType; is_active: boolean }) => Promise<void>;
  onClose: () => void;
}
const EditModal: React.FC<EditModalProps> = ({ rule, onSave, onClose }) => {
  const [name, setName] = useState(rule.name || '');
  const [eventType, setEventType] = useState<AlertEventType>(rule.event_type);
  const [isActive, setIsActive] = useState(rule.is_active);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(rule.id, { name, event_type: eventType, is_active: isActive });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Edit Alert Rule</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name (optional)</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Delivery zone entry alert"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Event Type</label>
            <select value={eventType} onChange={e => setEventType(e.target.value as AlertEventType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="enter">Enter</option>
              <option value="exit">Exit</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setIsActive(v => !v)}
              className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${isActive ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
              {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {isActive ? 'Active' : 'Inactive'}
            </button>
            <span className="text-xs text-gray-400">Click to toggle</span>
          </div>
          <p className="text-xs text-gray-400">Note: vehicle and geofence assignment cannot be changed after creation.</p>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1">
            <Check size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AlertRulesPage: React.FC = () => {
  const { vehicles, geofences, refreshVehicles, refreshGeofences } = useAppContext();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [vehicleId, setVehicleId] = useState<string>('');
  const [geofenceId, setGeofenceId] = useState('');
  const [eventType, setEventType] = useState<AlertEventType>('enter');
  const [isActive, setIsActive] = useState(true);
  const [ruleName, setRuleName] = useState('');

  const refresh = async () => {
    const res = await getAlertRules();
    setRules(res.data);
  };

  useEffect(() => {
    refreshVehicles();
    refreshGeofences();
    refresh();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createAlertRule({
        name: ruleName || undefined,
        vehicle_id: vehicleId || null,
        geofence_id: geofenceId || null,
        event_type: eventType,
        is_active: isActive,
      });
      toast.success('Alert rule created!');
      setVehicleId(''); setGeofenceId(''); setRuleName('');
      setShowForm(false);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create rule');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, data: { name: string; event_type: AlertEventType; is_active: boolean }) => {
    try {
      await updateAlertRule(id, data);
      toast.success('Alert rule updated');
      setEditingRule(null);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update rule');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAlertRule(id);
      toast.success('Alert rule deleted');
      setDeletingId(null);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete rule');
    }
  };

  // Quick toggle active/inactive without opening the edit modal
  const handleToggleActive = async (rule: AlertRule) => {
    try {
      await updateAlertRule(rule.id, { is_active: !rule.is_active });
      toast.success(rule.is_active ? 'Rule deactivated' : 'Rule activated');
      refresh();
    } catch {
      toast.error('Failed to toggle rule');
    }
  };

  const ruleToDelete = rules.find(r => r.id === deletingId);

  return (
    <div className="space-y-6">
      {editingRule && (
        <EditModal rule={editingRule} onSave={handleUpdate} onClose={() => setEditingRule(null)} />
      )}
      {deletingId && ruleToDelete && (
        <ConfirmDialog
          message={`Delete this alert rule? This cannot be undone.`}
          onConfirm={() => handleDelete(deletingId)}
          onCancel={() => setDeletingId(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Rules</h1>
          <p className="text-sm text-gray-500 mt-1">{rules.filter(r => r.is_active).length} active of {rules.length}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <PlusCircle size={16} /> New Rule
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold mb-4">Create Alert Rule</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Rule Name (optional)</label>
              <input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g. Restricted zone entry"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle (blank = all vehicles)</label>
              <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Vehicles</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} — {v.driver_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Geofence (blank = all geofences)</label>
              <select value={geofenceId} onChange={e => setGeofenceId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Geofences</option>
                {geofences.map(g => <option key={g.id} value={g.id}>{g.name} ({g.category})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Event Type</label>
              <select value={eventType} onChange={e => setEventType(e.target.value as AlertEventType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="enter">Enter</option>
                <option value="exit">Exit</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="active" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                className="rounded border-gray-300 text-blue-600" />
              <label htmlFor="active" className="text-sm text-gray-600">Active immediately</label>
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
                {loading ? 'Creating…' : 'Create Rule'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Bell size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No alert rules configured</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Vehicle', 'Geofence', 'Event', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map(rule => {
                const vehicle = vehicles.find(v => v.id === rule.vehicle_id);
                const geofence = geofences.find(g => g.id === rule.geofence_id);
                return (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{rule.name || <span className="text-gray-400 italic">—</span>}</td>
                    <td className="px-4 py-3 text-gray-700">{vehicle?.vehicle_number || <span className="text-gray-400">All Vehicles</span>}</td>
                    <td className="px-4 py-3 text-gray-700">{geofence?.name || <span className="text-gray-400">All Geofences</span>}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{rule.event_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggleActive(rule)}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer transition-colors ${rule.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        title="Click to toggle">
                        {rule.is_active ? '● Active' : '○ Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setEditingRule(rule)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeletingId(rule.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
