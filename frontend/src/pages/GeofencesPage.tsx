import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip } from 'react-leaflet';
import { useAppContext } from '../context/AppContext';
import { createGeofence } from '../services/api';
import toast from 'react-hot-toast';
import type { GeofenceCategory } from '../types';
import { PlusCircle, Hexagon } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { CATEGORY_COLORS } from '../utils/categoryColors';

const CATEGORIES: GeofenceCategory[] = ['delivery_zone', 'restricted_zone', 'toll_zone', 'customer_area'];

export const GeofencesPage: React.FC = () => {
  const { geofences, refreshGeofences } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GeofenceCategory>('delivery_zone');
  const [rawCoords, setRawCoords] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { refreshGeofences(); }, []);

  const filteredGeofences = filter
    ? geofences.filter(g => g.category === filter)
    : geofences;

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Geofences</h1>
          <p className="text-sm text-gray-500 mt-1">{geofences.length} geofences</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <PlusCircle size={16} /> New Geofence
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold">Create Geofence</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <textarea value={rawCoords} onChange={e => setRawCoords(e.target.value)} required rows={4}
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

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('')}
          className={`text-xs px-3 py-1 rounded-full border ${!filter ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
          All
        </button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`text-xs px-3 py-1 rounded-full border ${filter === c ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}>
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
              <Polygon
                key={g.id}
                positions={g.coordinates.map(c => [c.lat, c.lon] as [number, number])}
                pathOptions={{ color: CATEGORY_COLORS[g.category], fillOpacity: 0.2 }}
              >
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
                <li key={g.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{g.name}</p>
                    <p className="text-xs text-gray-400">{g.coordinates.length} points</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ background: CATEGORY_COLORS[g.category] + '22', color: CATEGORY_COLORS[g.category] }}>
                    {g.category}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
