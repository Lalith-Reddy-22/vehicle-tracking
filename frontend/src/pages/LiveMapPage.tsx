/**
 * LiveMapPage: Tactical Real-Time Fleet Map.
 * Features:
 *  - Dark Cyber / Street / Satellite tile layer switcher.
 *  - Custom glowing divIcon vehicle markers with pulsing radar rings & plate tags.
 *  - Searchable Fleet Roster panel with instant Fly-To & selection.
 *  - Click anywhere on map -> POST /vehicles/location for the selected vehicle.
 *  - Live coordinate & geofence status HUD.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';
import {
  Crosshair,
  Search,
  Layers,
  Maximize2,
  Navigation,
  Radio,
  Shield,
  Truck,
  Sparkles,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { updateVehicleLocation, getVehicleLocation } from '../services/api';
import type { Vehicle, GeofenceRef } from '../types';
import { CATEGORY_COLORS, CATEGORY_META } from '../utils/categoryColors';
import { MAP_STYLES, type MapStyleKey } from '../utils/mapTiles';
import 'leaflet/dist/leaflet.css';

interface VehiclePosition {
  vehicleId: string;
  lat: number;
  lon: number;
  insideGeofences: GeofenceRef[];
  updatedAt?: string;
}

function createVehicleMarkerIcon(
  vehicleNumber: string,
  isSelected: boolean,
  insideCount: number
): L.DivIcon {
  const accent = isSelected ? '#596543' : insideCount > 0 ? '#15803d' : '#8B9A6E';
  const ring = isSelected || insideCount > 0;

  const html = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
      <div style="position:relative;width:30px;height:30px;display:flex;align-items:center;justify-content:center;">
        ${
          ring
            ? `<span style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid ${accent};opacity:0.65;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>`
            : ''
        }
        <span style="width:16px;height:16px;border-radius:9999px;background:${accent};border:2.5px solid #F7F2EB;box-shadow:0 2px 10px rgba(35,40,30,0.35);display:block;"></span>
      </div>
      <div style="margin-top:2px;padding:2px 7px;border-radius:6px;background:rgba(247,242,235,0.95);border:1px solid ${accent};color:#23281E;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(35,40,30,0.18);">
        ${vehicleNumber}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'vtrack-div-icon',
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -18],
  });
}

function MapClickHandler({
  selectedVehicle,
  onLocationUpdate,
  onCursorMove,
}: {
  selectedVehicle: Vehicle | null;
  onLocationUpdate: (vehicleId: string, lat: number, lon: number) => void;
  onCursorMove: (coords: { lat: number; lon: number }) => void;
}) {
  useMapEvents({
    click(e) {
      if (!selectedVehicle) {
        toast('Select a vehicle from the Fleet Roster first, then click the map.', { icon: '🎯' });
        return;
      }
      onLocationUpdate(selectedVehicle.id, e.latlng.lat, e.latlng.lng);
    },
    mousemove(e) {
      onCursorMove({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

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

export const LiveMapPage: React.FC = () => {
  const { vehicles, geofences, refreshVehicles, refreshGeofences } = useAppContext();
  const [searchParams] = useSearchParams();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null | undefined>(undefined);
  const [positions, setPositions] = useState<Map<string, VehiclePosition>>(new Map());
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'inside' | 'tracked'>('all');
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('voyager');
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number; ts: number } | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [lastPingInfo, setLastPingInfo] = useState<string | null>(null);

  const activeVehicleId =
    selectedVehicleId === undefined ? searchParams.get('vehicle') : selectedVehicleId;
  const selectedVehicle = useMemo(
    () => vehicles.find(v => v.id === activeVehicleId) || null,
    [vehicles, activeVehicleId]
  );

  useEffect(() => {
    refreshVehicles();
    refreshGeofences();
  }, [refreshVehicles, refreshGeofences]);

  // Load existing positions for all vehicles
  useEffect(() => {
    const queryVehicleId = searchParams.get('vehicle');
    vehicles.forEach(async v => {
      try {
        const res = await getVehicleLocation(v.id);
        if (res.location) {
          const lat = res.location.latitude;
          const lon = res.location.longitude;
          setPositions(prev => {
            const next = new Map(prev);
            next.set(v.id, {
              vehicleId: v.id,
              lat,
              lon,
              insideGeofences: res.inside_geofences || [],
              updatedAt: res.location!.timestamp,
            });
            return next;
          });
          if (queryVehicleId && v.id === queryVehicleId) {
            setFlyTarget({ lat, lon, ts: Date.now() });
          }
        }
      } catch {
        /* vehicle has no location yet */
      }
    });
  }, [vehicles, searchParams]);

  const handleLocationUpdate = useCallback(
    async (vehicleId: string, lat: number, lon: number) => {
      try {
        const res = await updateVehicleLocation({
          vehicle_id: vehicleId,
          latitude: lat,
          longitude: lon,
          timestamp: new Date().toISOString(),
        });

        setPositions(prev => {
          const next = new Map(prev);
          next.set(vehicleId, {
            vehicleId,
            lat: res.location.latitude,
            lon: res.location.longitude,
            insideGeofences: res.inside_geofences || [],
            updatedAt: res.location.timestamp,
          });
          return next;
        });

        const v = vehicles.find(item => item.id === vehicleId);
        const events = res.events || [];
        setLastPingInfo(
          `${v?.vehicle_number || 'Unit'} @ ${lat.toFixed(4)}, ${lon.toFixed(4)} (${events.length} event${events.length === 1 ? '' : 's'})`
        );

        if (events.length > 0) {
          events.forEach(ev => {
            toast.success(
              `${v?.vehicle_number || 'Vehicle'} ${ev.event_type === 'enter' ? 'entered' : 'exited'} ${ev.geofence_name}`,
              { duration: 4000 }
            );
          });
        } else {
          toast.success(`GPS fix transmitted for ${v?.vehicle_number || 'vehicle'}`);
        }
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to update location';
        toast.error(msg);
      }
    },
    [vehicles]
  );

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter(v => {
      const pos = positions.get(v.id);
      if (filterMode === 'tracked' && !pos) return false;
      if (filterMode === 'inside' && (!pos || pos.insideGeofences.length === 0)) return false;
      if (!q) return true;
      return (
        v.vehicle_number.toLowerCase().includes(q) ||
        v.driver_name.toLowerCase().includes(q) ||
        v.vehicle_type.toLowerCase().includes(q)
      );
    });
  }, [vehicles, positions, search, filterMode]);

  const allBoundsPoints = useMemo(() => {
    const pts: [number, number][] = [];
    geofences.forEach(g => g.coordinates.forEach(c => pts.push([c.lat, c.lon])));
    positions.forEach(p => pts.push([p.lat, p.lon]));
    return pts;
  }, [geofences, positions]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Top Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-[#23281E]">Live Tactical Map</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#8B9A6E]/20 border border-[#8B9A6E]/45 text-[11px] font-mono text-[#424C32]">
              <Radio size={11} className="animate-pulse" /> {positions.size} TRACKED
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#5C6356] mt-0.5">
            {selectedVehicle ? (
              <span className="text-[#424C32] font-medium">
                Target locked: <span className="font-mono font-bold">{selectedVehicle.vehicle_number}</span> — click anywhere on the map to transmit GPS position
              </span>
            ) : (
              'Select a vehicle from the Fleet Roster, then click anywhere on the map to update its GPS location'
            )}
          </p>
        </div>

        {lastPingInfo && (
          <div className="px-3 py-1.5 rounded-xl bg-[#EAE2D6] border border-[#8B9A6E]/45 text-xs font-mono text-[#424C32] flex items-center gap-2">
            <Sparkles size={13} className="text-[#596543]" />
            {lastPingInfo}
          </div>
        )}
      </div>

      {/* Main Split Workspace */}
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-205px)] min-h-[540px]">
        {/* Fleet Roster Sidebar */}
        <div className="w-full lg:w-72 glass-card flex flex-col overflow-hidden flex-shrink-0 max-h-64 lg:max-h-none">
          <div className="p-3.5 border-b border-[#D6CCBE] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#4B5243] flex items-center gap-1.5">
                <Truck size={14} className="text-[#596543]" />
                Fleet Roster ({filteredVehicles.length})
              </span>
              {selectedVehicle && (
                <button
                  onClick={() => setSelectedVehicleId(null)}
                  className="text-[11px] text-[#5C6356] hover:text-[#23281E]"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E7565]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search plate or driver…"
                className="w-full rounded-xl bg-[#EEEEEE] border border-[#D4CFC7] pl-8 pr-3 py-1.5 text-xs text-[#23281E] placeholder-[#7B8273] focus:outline-none focus:bg-[#F7F2EB] focus:border-[#8B9A6E]"
              />
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#EEEEEE] border border-[#D4CFC7]">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'tracked', label: 'GPS Fix' },
                  { id: 'inside', label: 'In Zone' },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterMode(tab.id)}
                  className={`py-1 rounded-lg text-[11px] font-medium transition-all ${
                    filterMode === tab.id
                      ? 'bg-[#8B9A6E] text-[#F7F2EB] shadow-sm'
                      : 'text-[#5C6356] hover:text-[#23281E]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#D6CCBE]/60 bg-[#F7F2EB]/55">
            {filteredVehicles.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs text-[#6E7565]">No matching vehicles</p>
              </div>
            ) : (
              filteredVehicles.map(v => {
                const pos = positions.get(v.id);
                const isSelected = selectedVehicle?.id === v.id;
                const insideLen = pos?.insideGeofences.length || 0;

                return (
                  <div
                    key={v.id}
                    onClick={() =>
                      setSelectedVehicleId(prev => {
                        const curr = prev === undefined ? searchParams.get('vehicle') : prev;
                        return curr === v.id ? null : v.id;
                      })
                    }
                    className={`p-3.5 cursor-pointer transition-all relative ${
                      isSelected
                        ? 'bg-[#8B9A6E]/20 border-l-2 border-[#596543]'
                        : 'hover:bg-[#EAE2D6]/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              insideLen > 0
                                ? 'bg-emerald-600'
                                : pos
                                ? 'bg-[#8B9A6E]'
                                : 'bg-[#A8A296]'
                            }`}
                          />
                          <p className="font-mono text-sm font-bold text-[#23281E] truncate">
                            {v.vehicle_number}
                          </p>
                        </div>
                        <p className="text-xs text-[#5C6356] mt-0.5 truncate">
                          {v.driver_name} • {v.vehicle_type}
                        </p>
                      </div>

                      {pos && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedVehicleId(v.id);
                            setFlyTarget({ lat: pos.lat, lon: pos.lon, ts: Date.now() });
                          }}
                          title="Fly to vehicle"
                          className="p-1.5 rounded-lg bg-[#EEEEEE] hover:bg-[#8B9A6E] text-[#5C6356] hover:text-[#F7F2EB] border border-[#D4CFC7] transition-colors"
                        >
                          <Crosshair size={13} />
                        </button>
                      )}
                    </div>

                    {pos ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            insideLen > 0
                              ? 'bg-[#8B9A6E]/20 text-[#424C32] border-[#8B9A6E]/45'
                              : 'bg-[#EEEEEE] text-[#5C6356] border-[#D4CFC7]'
                          }`}
                        >
                          {insideLen > 0 ? `Inside ${insideLen} zone${insideLen > 1 ? 's' : ''}` : 'Outside zones'}
                        </span>
                        <span className="font-mono text-[10px] text-[#6E7565]">
                          {pos.lat.toFixed(3)}, {pos.lon.toFixed(3)}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[10px] font-mono text-[#6E7565]">
                        No GPS fix — select & click map
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Tactical Map Canvas */}
        <div className="relative flex-1 rounded-2xl overflow-hidden border border-[#D6CCBE] shadow-warm-card">
          {/* Top-Right Floating Map Controls */}
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

          {/* Bottom-Left Floating Legend & Cursor Telemetry */}
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

          <MapContainer
            center={[12.9716, 77.5946]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            className={selectedVehicle ? 'cursor-crosshair' : ''}
          >
            <TileLayer
              key={mapStyle}
              url={MAP_STYLES[mapStyle].url}
              attribution={MAP_STYLES[mapStyle].attribution}
            />

            <MapClickHandler
              selectedVehicle={selectedVehicle}
              onLocationUpdate={handleLocationUpdate}
              onCursorMove={setCursorCoords}
            />

            <MapController
              flyTarget={flyTarget}
              fitTrigger={fitTrigger}
              boundsPoints={allBoundsPoints}
            />

            {/* Geofence Polygons */}
            {geofences.map(g => {
              const color = CATEGORY_COLORS[g.category];
              return (
                <Polygon
                  key={g.id}
                  positions={g.coordinates.map(c => [c.lat, c.lon] as [number, number])}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: g.category === 'restricted_zone' ? 0.28 : 0.16,
                    weight: g.category === 'restricted_zone' ? 2.5 : 2,
                  }}
                >
                  <Tooltip permanent={false} sticky>
                    <div className="font-sans">
                      <span className="font-semibold">{g.name}</span>
                      <span className="ml-1.5 text-[11px] opacity-75">
                        ({CATEGORY_META[g.category]?.shortLabel || g.category})
                      </span>
                    </div>
                  </Tooltip>
                </Polygon>
              );
            })}

            {/* Custom Glowing Vehicle Markers */}
            {Array.from(positions.values()).map(pos => {
              const vehicle = vehicles.find(v => v.id === pos.vehicleId);
              if (!vehicle) return null;
              const isSelected = selectedVehicle?.id === vehicle.id;

              return (
                <Marker
                  key={pos.vehicleId}
                  position={[pos.lat, pos.lon]}
                  icon={createVehicleMarkerIcon(
                    vehicle.vehicle_number,
                    isSelected,
                    pos.insideGeofences.length
                  )}
                >
                  <Popup>
                    <div className="min-w-[200px] space-y-2 p-0.5">
                      <div className="flex items-center justify-between gap-2 border-b border-[#D6CCBE] pb-2">
                        <span className="font-mono text-sm font-bold text-[#424C32]">
                          {vehicle.vehicle_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EEEEEE] text-[#4B5243]">
                          {vehicle.vehicle_type}
                        </span>
                      </div>
                      <div className="text-xs space-y-1">
                        <p className="text-[#5C6356]">
                          Driver: <span className="text-[#23281E] font-medium">{vehicle.driver_name}</span>
                        </p>
                        <p className="font-mono text-[11px] text-[#6E7565]">
                          {pos.lat.toFixed(5)}, {pos.lon.toFixed(5)}
                        </p>
                      </div>
                      {pos.insideGeofences.length > 0 ? (
                        <div className="pt-1 border-t border-[#D6CCBE]">
                          <p className="text-[10px] uppercase tracking-wider text-[#596543] font-semibold flex items-center gap-1 mb-1">
                            <Shield size={11} /> Inside Geofences
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {pos.insideGeofences.map(gf => (
                              <span
                                key={gf.id}
                                className="text-[11px] px-2 py-0.5 rounded-md bg-[#8B9A6E]/20 border border-[#8B9A6E]/40 text-[#424C32]"
                              >
                                {gf.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#6E7565] pt-1 border-t border-[#D6CCBE]">
                          Outside all active geofences
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
