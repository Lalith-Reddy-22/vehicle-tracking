import React, { useEffect, useState, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import {
  PlusCircle,
  Hexagon,
  Pencil,
  Trash2,
  X,
  Check,
  Layers,
  Maximize2,
  Navigation,
  Crosshair,
  Search,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { createGeofence, updateGeofence, deleteGeofence } from '../services/api';
import type { GeofenceCategory, Geofence } from '../types';
import { CATEGORY_COLORS, CATEGORY_META } from '../utils/categoryColors';
import { MAP_STYLES, type MapStyleKey } from '../utils/mapTiles';
import 'leaflet/dist/leaflet.css';

const CATEGORIES: GeofenceCategory[] = [
  'delivery_zone',
  'restricted_zone',
  'toll_zone',
  'customer_area',
];

// ── Confirm Delete Dialog ────────────────────────────────────────────────────
interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-[#F7F2EB] rounded-2xl shadow-warm-modal border border-[#D6CCBE] p-6 w-full max-w-sm">
      <p className="text-sm text-[#23281E] mb-5 font-medium">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-[#D4CFC7] rounded-xl hover:bg-[#EAE2D6] text-[#5C6356] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-sm bg-rose-700 hover:bg-rose-800 text-[#F7F2EB] font-medium rounded-xl transition-colors shadow-sm"
        >
          Delete
        </button>
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
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    await onSave(geofence.id, name, category);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#F7F2EB] rounded-2xl shadow-warm-modal border border-[#D6CCBE] p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#23281E]">Edit Geofence</h2>
          <button onClick={onClose} className="text-[#6E7565] hover:text-[#23281E]">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#4B5243] mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[#D4CFC7] rounded-xl px-3 py-2 text-sm text-[#23281E] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4B5243] mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as GeofenceCategory)}
              className="w-full bg-[#FFFFFF] border border-[#D4CFC7] rounded-xl px-3 py-2 text-sm text-[#23281E] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {CATEGORY_META[c]?.label || c}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-[#6E7565]">
            Note: Boundary coordinates cannot be modified after creation to preserve spatial audit history.
          </p>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[#D4CFC7] rounded-xl hover:bg-[#EAE2D6] text-[#5C6356] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-[#596543] hover:bg-[#475135] disabled:opacity-50 text-[#F7F2EB] font-medium rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Check size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Map Controller & Handlers ────────────────────────────────────────────────
function MapController({
  flyTarget,
  fitTrigger,
  boundsPoints,
}: {
  flyTarget: { lat: number; lon: number; ts: number } | null;
  fitTrigger: number;
  boundsPoints: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (flyTarget) {
      map.flyTo([flyTarget.lat, flyTarget.lon], 14, { duration: 0.9 });
    }
  }, [flyTarget, map]);

  useEffect(() => {
    if (fitTrigger > 0 && boundsPoints.length > 0) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    }
  }, [fitTrigger, boundsPoints, map]);

  return null;
}

function MapCursorHandler({
  onCursorMove,
}: {
  onCursorMove: (coords: { lat: number; lon: number }) => void;
}) {
  useMapEvents({
    mousemove(e) {
      onCursorMove({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

function getPolygonCenter(coordinates: { lat: number; lon: number }[]): [number, number] {
  if (coordinates.length === 0) return [12.9716, 77.5946];
  let sumLat = 0;
  let sumLon = 0;
  coordinates.forEach(c => {
    sumLat += c.lat;
    sumLon += c.lon;
  });
  return [sumLat / coordinates.length, sumLon / coordinates.length];
}

// ── Main GeofencesPage Component ─────────────────────────────────────────────
export const GeofencesPage: React.FC = () => {
  const { geofences, refreshGeofences } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GeofenceCategory>('delivery_zone');
  const [rawCoords, setRawCoords] = useState('');
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedGeofenceId, setSelectedGeofenceId] = useState<string | null>(null);

  // Map state matching LiveMapPage
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('voyager');
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; ts: number } | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);

  useEffect(() => {
    refreshGeofences();
  }, [refreshGeofences]);

  const allBoundsPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    geofences.forEach(g => {
      g.coordinates.forEach(c => pts.push([c.lat, c.lon]));
    });
    return pts;
  }, [geofences]);

  const filteredGeofences = useMemo(() => {
    return geofences.filter(g => {
      const matchesCategory = filter ? g.category === filter : true;
      const matchesSearch = search
        ? g.name.toLowerCase().includes(search.toLowerCase()) ||
          g.category.toLowerCase().includes(search.toLowerCase())
        : true;
      return matchesCategory && matchesSearch;
    });
  }, [geofences, filter, search]);

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
      const created = await createGeofence({ name, category, coordinates: coords });
      toast.success(`Geofence "${name}" created!`);
      setName('');
      setRawCoords('');
      setShowForm(false);
      refreshGeofences();
      if (created.coordinates && created.coordinates.length > 0) {
        const center = getPolygonCenter(created.coordinates);
        setFlyTarget({ lat: center[0], lon: center[1], ts: Date.now() });
      }
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
      if (selectedGeofenceId === id) setSelectedGeofenceId(null);
      refreshGeofences();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete geofence');
    }
  };

  const handleSelectGeofence = (g: Geofence) => {
    setSelectedGeofenceId(g.id);
    const center = getPolygonCenter(g.coordinates);
    setFlyTarget({ lat: center[0], lon: center[1], ts: Date.now() });
  };

  const geofenceToDelete = geofences.find(g => g.id === deletingId);

  return (
    <div className="space-y-5">
      {editingGeofence && (
        <EditModal
          geofence={editingGeofence}
          onSave={handleUpdate}
          onClose={() => setEditingGeofence(null)}
        />
      )}
      {deletingId && geofenceToDelete && (
        <ConfirmDialog
          message={`Delete geofence "${geofenceToDelete.name}"? All associated violations and alert rules will also be removed.`}
          onConfirm={() => handleDelete(deletingId)}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#23281E]">
              Geofences
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-[#8B9A6E]/20 text-[#424C32] border border-[#8B9A6E]/40 font-semibold">
              {geofences.length} active
            </span>
          </div>
          <p className="text-xs text-[#5C6356] mt-0.5">
            Spatial perimeters evaluated against live telemetry via PostGIS ST_Covers
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-[#596543] hover:bg-[#475135] text-[#F7F2EB] text-sm font-medium px-4 py-2 rounded-xl transition-all shadow-sm"
        >
          <PlusCircle size={16} /> {showForm ? 'Close Form' : 'New Geofence'}
        </button>
      </div>

      {/* Create Geofence Collapsible Form */}
      {showForm && (
        <div className="bg-[#F7F2EB] border border-[#D6CCBE] rounded-2xl p-5 shadow-warm-card space-y-4">
          <div className="flex items-center justify-between border-b border-[#D6CCBE] pb-3">
            <h2 className="text-sm font-bold text-[#23281E] flex items-center gap-2">
              <Hexagon size={16} className="text-[#596543]" /> Define Geofence Perimeter
            </h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-[#6E7565] hover:text-[#23281E]"
            >
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#4B5243] mb-1">Perimeter Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="e.g. Central Warehouse Hub"
                  className="w-full bg-[#FFFFFF] border border-[#D4CFC7] rounded-xl px-3 py-2 text-sm text-[#23281E] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4B5243] mb-1">Classification Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as GeofenceCategory)}
                  className="w-full bg-[#FFFFFF] border border-[#D4CFC7] rounded-xl px-3 py-2 text-sm text-[#23281E] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {CATEGORY_META[c]?.label || c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[#4B5243]">
                  Boundary Coordinates (JSON Array of [lat, lon] pairs)
                </label>
                <span className="text-[11px] font-mono text-[#6E7565]">
                  Minimum 4 coordinates, closed ring
                </span>
              </div>
              <textarea
                value={rawCoords}
                onChange={e => setRawCoords(e.target.value)}
                required
                rows={3}
                placeholder="[[19.0760, 72.8777], [19.0800, 72.8777], [19.0800, 72.8850], [19.0760, 72.8850], [19.0760, 72.8777]]"
                className="w-full bg-[#FFFFFF] border border-[#D4CFC7] rounded-xl px-3 py-2 text-xs font-mono text-[#23281E] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-medium border border-[#D4CFC7] rounded-xl hover:bg-[#EAE2D6] text-[#5C6356] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#596543] hover:bg-[#475135] disabled:opacity-50 text-[#F7F2EB] text-xs font-medium px-5 py-2 rounded-xl transition-all shadow-sm"
              >
                {loading ? 'Validating & Persisting…' : 'Create Geofence'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Two-Panel Layout: Map Canvas + Geofence Roster */}
      <div className="flex flex-col lg:flex-row gap-4 h-[620px]">
        {/* Left Side: Geofence Roster & Search */}
        <div className="w-full lg:w-80 flex flex-col bg-[#F7F2EB] rounded-2xl border border-[#D6CCBE] shadow-warm-card overflow-hidden">
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-[#D6CCBE] space-y-2 bg-[#F2EDE4]/60">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 text-[#6E7565]" size={13} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search perimeters…"
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#D4CFC7] text-xs text-[#23281E] placeholder:text-[#A8A296] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
              />
            </div>

            {/* Filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilter('')}
                className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                  !filter
                    ? 'bg-[#8B9A6E] text-[#F7F2EB] border-[#8B9A6E]'
                    : 'border-[#D4CFC7] bg-[#FFFFFF] text-[#5C6356] hover:bg-[#EAE2D6]'
                }`}
              >
                All ({geofences.length})
              </button>
              {CATEGORIES.map(c => {
                const count = geofences.filter(g => g.category === c).length;
                return (
                  <button
                    key={c}
                    onClick={() => setFilter(f => (f === c ? '' : c))}
                    className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
                      filter === c
                        ? 'bg-[#8B9A6E] text-[#F7F2EB] border-[#8B9A6E]'
                        : 'border-[#D4CFC7] bg-[#FFFFFF] text-[#5C6356] hover:bg-[#EAE2D6]'
                    }`}
                  >
                    {CATEGORY_META[c]?.shortLabel} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Geofence List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E5DEC9]">
            {filteredGeofences.length === 0 ? (
              <div className="p-10 text-center">
                <Hexagon size={36} className="mx-auto text-[#A8A296] mb-2" />
                <p className="text-xs text-[#6E7565]">No geofences match criteria</p>
              </div>
            ) : (
              filteredGeofences.map(g => {
                const isSelected = selectedGeofenceId === g.id;
                const meta = CATEGORY_META[g.category];
                const color = CATEGORY_COLORS[g.category];

                return (
                  <div
                    key={g.id}
                    onClick={() => handleSelectGeofence(g)}
                    className={`p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#8B9A6E]/20 border-l-3 border-[#596543]'
                        : 'hover:bg-[#EAE2D6]/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <p className="font-semibold text-xs text-[#23281E] truncate">{g.name}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${meta?.badgeClass}`}
                          >
                            {meta?.shortLabel || g.category}
                          </span>
                          <span className="text-[10px] text-[#6E7565] font-mono">
                            {g.coordinates.length} pts
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleSelectGeofence(g);
                          }}
                          title="Fly to perimeter on map"
                          className="p-1 rounded-lg bg-[#FFFFFF] hover:bg-[#8B9A6E] text-[#5C6356] hover:text-[#F7F2EB] border border-[#D4CFC7] transition-colors"
                        >
                          <Crosshair size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setEditingGeofence(g);
                          }}
                          title="Edit"
                          className="p-1 rounded-lg bg-[#FFFFFF] hover:bg-[#8B9A6E] text-[#5C6356] hover:text-[#F7F2EB] border border-[#D4CFC7] transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setDeletingId(g.id);
                          }}
                          title="Delete"
                          className="p-1 rounded-lg bg-[#FFFFFF] hover:bg-rose-700 text-[#5C6356] hover:text-[#F7F2EB] border border-[#D4CFC7] transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: High-Definition Tactical Map Canvas (Same as LiveMapPage) */}
        <div className="relative flex-1 rounded-2xl overflow-hidden border border-[#D6CCBE] shadow-warm-card">
          {/* Top-Right Floating Controls (Layer Switcher + Fit All) */}
          <div className="absolute top-3 right-3 z-[400] flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F7F2EB]/95 backdrop-blur-xl border border-[#D6CCBE] shadow-lg">
              <Layers size={13} className="text-[#596543] ml-1.5 mr-1" />
              {(Object.keys(MAP_STYLES) as MapStyleKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => setMapStyle(key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    mapStyle === key
                      ? 'bg-[#8B9A6E] text-[#F7F2EB]'
                      : 'text-[#5C6356] hover:text-[#23281E]'
                  }`}
                >
                  {MAP_STYLES[key].label}
                </button>
              ))}
            </div>

            {allBoundsPoints.length > 0 && (
              <button
                onClick={() => setFitTrigger(c => c + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F7F2EB]/95 backdrop-blur-xl border border-[#D6CCBE] text-xs font-medium text-[#23281E] hover:bg-[#EAE2D6] hover:border-[#8B9A6E] shadow-lg transition-all"
              >
                <Maximize2 size={13} /> Fit All
              </button>
            )}
          </div>

          {/* Bottom-Left Floating Legend & Cursor HUD */}
          <div className="absolute bottom-3 left-3 z-[400] flex flex-col gap-2 pointer-events-none">
            <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-xl bg-[#F7F2EB]/95 backdrop-blur-xl border border-[#D6CCBE] shadow-lg">
              {(Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).map(cat => (
                <div key={cat} className="flex items-center gap-1.5 text-[11px] text-[#4B5243]">
                  <span className={`w-2 h-2 rounded-full ${CATEGORY_META[cat].dotClass}`} />
                  <span>{CATEGORY_META[cat].shortLabel}</span>
                </div>
              ))}
            </div>

            {cursorCoords && (
              <div className="self-start px-2.5 py-1 rounded-lg bg-[#F7F2EB]/95 backdrop-blur-xl border border-[#D6CCBE] font-mono text-[11px] text-[#424C32] flex items-center gap-1.5 shadow">
                <Navigation size={11} />
                {cursorCoords.lat.toFixed(5)}, {cursorCoords.lon.toFixed(5)}
              </div>
            )}
          </div>

          {/* Leaflet MapContainer */}
          <MapContainer
            center={[19.076, 72.8777]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              key={mapStyle}
              url={MAP_STYLES[mapStyle].url}
              attribution={MAP_STYLES[mapStyle].attribution}
            />

            <MapCursorHandler onCursorMove={setCursorCoords} />

            <MapController
              flyTarget={flyTarget}
              fitTrigger={fitTrigger}
              boundsPoints={allBoundsPoints}
            />

            {/* Geofence Polygons */}
            {filteredGeofences.map(g => {
              const isSelected = selectedGeofenceId === g.id;
              const color = CATEGORY_COLORS[g.category];
              const meta = CATEGORY_META[g.category];

              return (
                <Polygon
                  key={g.id}
                  positions={g.coordinates.map(c => [c.lat, c.lon] as [number, number])}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.35 : g.category === 'restricted_zone' ? 0.28 : 0.16,
                    weight: isSelected ? 3.5 : g.category === 'restricted_zone' ? 2.5 : 2,
                    dashArray: isSelected ? '6, 6' : undefined,
                  }}
                  eventHandlers={{
                    click: () => handleSelectGeofence(g),
                  }}
                >
                  <Tooltip permanent={false} sticky>
                    <div className="font-sans">
                      <span className="font-semibold text-xs text-[#23281E]">{g.name}</span>
                      <span className="ml-1.5 text-[10px] text-[#6E7565]">
                        ({meta?.shortLabel || g.category})
                      </span>
                    </div>
                  </Tooltip>

                  <Popup>
                    <div className="p-1 space-y-2 min-w-[180px]">
                      <div>
                        <p className="font-bold text-sm text-[#23281E]">{g.name}</p>
                        <p className="text-[11px] text-[#5C6356]">{meta?.description}</p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#6E7565] border-t border-[#D6CCBE] pt-1">
                        <span>Points:</span>
                        <span>{g.coordinates.length}</span>
                      </div>
                      <div className="flex gap-2 pt-1 border-t border-[#D6CCBE]">
                        <button
                          onClick={() => setEditingGeofence(g)}
                          className="flex-1 py-1 px-2 text-xs bg-[#EAE2D6] hover:bg-[#8B9A6E] hover:text-[#F7F2EB] rounded-lg text-[#23281E] transition-colors font-medium flex items-center justify-center gap-1"
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        <button
                          onClick={() => setDeletingId(g.id)}
                          className="py-1 px-2 text-xs bg-rose-50 hover:bg-rose-700 hover:text-white rounded-lg text-rose-700 transition-colors flex items-center justify-center"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
