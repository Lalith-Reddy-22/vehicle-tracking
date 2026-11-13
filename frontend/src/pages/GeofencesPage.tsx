import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet';
import { useAppContext } from '../context/AppContext';
import { createGeofence, updateGeofence, deleteGeofence } from '../services/api';
import toast from 'react-hot-toast';
import type { GeofenceCategory, Geofence } from '../types';
import { PlusCircle, Hexagon, Pencil, Trash2, X, Check } from 'lucide-react';
import { CATEGORY_COLORS } from '../utils/categoryColors';
import 'leaflet/dist/leaflet.css';

const CATEGORIES: GeofenceCategory[] = ['delivery_zone', 'restricted_zone', 'toll_zone', 'customer_area'];

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
  geofence: Geofence;
  onSave: (id: string, name: string, category: GeofenceCategory) => Promise<void>;
  onClose: () => void;
}
const EditModal: React.FC<EditModalProps> = ({ geofence, onSave, onClose }) => {
  const [name, setName] = useState(geofence.name);
  const [category, setCategory] = useState<GeofenceCategory>(geofence.category);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    await onSave(geofence.id, name, category);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Edit Geofence</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value as GeofenceCategory)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-400">Note: polygon coordinates cannot be changed after creation.</p>
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

export const GeofencesPage: React.FC = () => {
  const { geofences, refreshGeofences } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GeofenceCategory>('delivery_zone');
  const [rawCoords, setRawCoords] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { refreshGeofences(); }, []);

  const filteredGeofences = filter ? geofences.filter(g => g.category === filter) : geofences;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    let coords: number[][];
    try {
      coords = JSON.parse(rawCoords);
      if (!Array.isArray(coords)) throw new Error();
    } catch {
      toast.error('Coordinates must be a JSON array of [[lat,lon],…]');
      return;
    }
    setLoading(true);
    try {
      await createGeofence({ name, category, coordinates: coords });
      toast.success(`Geofence "${name}" created!`);
      setName(''); setRawCoords(''); setShowForm(false);
      refreshGeofences();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create geofence');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, newName: string, newCategory: GeofenceCategory) => {
    try {
      await updateGeofence(id, { name: newName, category: newCategory });
      toast.success('Geofence updated');
      setEditingGeofence(null);
      refreshGeofences();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update geofence');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGeofence(id);
      toast.success('Geofence deleted');
      setDeletingId(null);
      refreshGeofences();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete geofence');
    }
  };

  const geofenceToDelete = geofences.find(g => g.id === deletingId);

  return (
    <div className="space-y-6">
      {editingGeofence && (
        <EditModal geofence={editingGeofence} onSave={handleUpdate} onClose={() => setEditingGeofence(null)} />
      )}
      {deletingId && geofenceToDelete && (
        <ConfirmDialog
          message={`Delete geofence "${geofenceToDelete.name}"? All associated violations and alert rules will also be removed.`}
          onConfirm={() => handleDelete(deletingId)}
          onCancel={() => setDeletingId(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Geofences</h1>
          <p className="text-sm text-gray-500 mt-1">{geofences.length} geofences</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          <PlusCircle size={16} /> New Geofence
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold">Create Geofence</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value as GeofenceCategory)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Coordinates (JSON) — [[lat,lon],…] closed ring
              </label>
              <textarea value={rawCoords} onChange={e => setRawCoords(e.target.value)} required rows={3}
                placeholder='[[12.97,77.59],[12.98,77.59],[12.98,77.60],[12.97,77.60],[12.97,77.59]]'
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
                {loading ? 'Creating…' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('')}
          className={`text-xs px-3 py-1 rounded-full border ${!filter ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          All
        </button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`text-xs px-3 py-1 rounded-full border ${filter === c ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Preview */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: 420 }}>
          <MapContainer center={[20, 78]} zoom={5} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
            {filteredGeofences.map(g => (
              <Polygon key={g.id}
                positions={g.coordinates.map(c => [c.lat, c.lon] as [number, number])}
                pathOptions={{ color: CATEGORY_COLORS[g.category], fillOpacity: 0.2 }}>
                <Tooltip>{g.name}</Tooltip>
              </Polygon>
            ))}
          </MapContainer>
        </div>

        {/* Geofence List */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filteredGeofences.length === 0 ? (
            <div className="p-12 text-center">
              <Hexagon size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No geofences found</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredGeofences.map(g => (
                <li key={g.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{g.name}</p>
                    <p className="text-xs text-gray-400">{g.coordinates.length} points</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: CATEGORY_COLORS[g.category] + '22', color: CATEGORY_COLORS[g.category] }}>
                      {g.category}
                    </span>
                    <button onClick={() => setEditingGeofence(g)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeletingId(g.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
