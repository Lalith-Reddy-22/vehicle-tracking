/**
 * LiveMapPage: the main interactive map.
 * Features:
 *  - Renders all geofences as colored polygons.
 *  - Renders vehicle markers with popup details.
 *  - Click on the map → sends POST /vehicles/location for the selected vehicle.
 *  - After a successful update, refreshes the vehicle list and markers.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  Popup,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { useAppContext } from '../context/AppContext';
import { updateVehicleLocation, getVehicleLocation } from '../services/api';
import toast from 'react-hot-toast';
import type { Vehicle, GeofenceRef } from '../types';
import 'leaflet/dist/leaflet.css';
import { CATEGORY_COLORS } from '../utils/categoryColors';

// Fix Leaflet default marker icon issue with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface VehiclePosition {
  vehicleId: string;
  lat: number;
  lon: number;
  insideGeofences: GeofenceRef[];
}

/** MapClickHandler: captures click coordinates and updates the selected vehicle */
function MapClickHandler({
  selectedVehicle,
  onLocationUpdate,
}: {
  selectedVehicle: Vehicle | null;
  onLocationUpdate: (vehicleId: string, lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!selectedVehicle) {
        toast('Select a vehicle first, then click the map to place it.', { icon: '👆' });
        return;
      }
      onLocationUpdate(selectedVehicle.id, e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export const LiveMapPage: React.FC = () => {
  const { vehicles, geofences, refreshVehicles, refreshGeofences } = useAppContext();
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [positions, setPositions] = useState<Map<string, VehiclePosition>>(new Map());

  useEffect(() => {
    refreshVehicles();
    refreshGeofences();
  }, []);

  const handleLocationUpdate = useCallback(async (vehicleId: string, lat: number, lon: number) => {
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
        });
        return next;
      });

      const events = res.events || [];
      if (events.length > 0) {
        events.forEach(ev => {
          const v = vehicles.find(v => v.id === vehicleId);
          toast.success(`${v?.vehicle_number || 'Vehicle'} ${ev.event_type === 'enter' ? 'entered' : 'exited'} ${ev.geofence_name}`, {
            duration: 4000,
          });
        });
      } else {
        toast.success('Location updated');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update location');
    }
  }, [vehicles]);

  // Load existing positions for all vehicles
  useEffect(() => {
    vehicles.forEach(async v => {
      try {
        const res = await getVehicleLocation(v.id);
        if (res.location) {
          setPositions(prev => {
            const next = new Map(prev);
            next.set(v.id, {
              vehicleId: v.id,
              lat: res.location!.latitude,
              lon: res.location!.longitude,
              insideGeofences: res.inside_geofences || [],
            });
            return next;
          });
        }
      } catch { /* vehicle has no location yet */ }
    });
  }, [vehicles]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Live Map</h1>
        <p className="text-sm text-gray-500 mt-1">
          {selectedVehicle
            ? `Click anywhere on the map to move ${selectedVehicle.vehicle_number}`
            : 'Select a vehicle from the sidebar, then click the map'}
        </p>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Vehicle selector */}
        <div className="w-56 bg-white border border-gray-200 rounded-xl overflow-y-auto flex-shrink-0">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicles</p>
          </div>
          {vehicles.length === 0 ? (
            <p className="text-xs text-gray-400 p-3">No vehicles</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {vehicles.map(v => (
                <li
                  key={v.id}
                  onClick={() => setSelectedVehicle(prev => prev?.id === v.id ? null : v)}
                  className={`px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors ${selectedVehicle?.id === v.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                >
                  <p className="text-sm font-medium text-gray-900">{v.vehicle_number}</p>
                  <p className="text-xs text-gray-400">{v.driver_name}</p>
                  {positions.has(v.id) && (
                    <p className="text-xs text-green-600 mt-0.5">
                      {positions.get(v.id)!.insideGeofences.length > 0
                        ? `Inside ${positions.get(v.id)!.insideGeofences.length} zone(s)`
                        : 'Outside all zones'}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 rounded-xl overflow-hidden border border-gray-200">
          <MapContainer center={[12.97, 77.59]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            <MapClickHandler
              selectedVehicle={selectedVehicle}
              onLocationUpdate={handleLocationUpdate}
            />

            {/* Geofence Polygons */}
            {geofences.map(g => (
              <Polygon
                key={g.id}
                positions={g.coordinates.map(c => [c.lat, c.lon] as [number, number])}
                pathOptions={{
                  color: CATEGORY_COLORS[g.category],
                  fillOpacity: g.category === 'restricted_zone' ? 0.3 : 0.15,
                  weight: g.category === 'restricted_zone' ? 2.5 : 1.5,
                }}
              >
                <Tooltip permanent={false} sticky>{g.name} ({g.category})</Tooltip>
              </Polygon>
            ))}

            {/* Vehicle Markers */}
            {Array.from(positions.values()).map(pos => {
              const vehicle = vehicles.find(v => v.id === pos.vehicleId);
              if (!vehicle) return null;
              return (
                <Marker key={pos.vehicleId} position={[pos.lat, pos.lon]}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{vehicle.vehicle_number}</p>
                      <p className="text-gray-600">{vehicle.driver_name}</p>
                      <p className="text-gray-500 text-xs">{vehicle.vehicle_type}</p>
                      {pos.insideGeofences.length > 0 && (
                        <div className="mt-1">
                          <p className="text-xs font-medium text-gray-700">Inside:</p>
                          {pos.insideGeofences.map(gf => (
                            <p key={gf.id} className="text-xs text-blue-600">{gf.name}</p>
                          ))}
                        </div>
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
