import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { createVehicle, updateVehicle, deleteVehicle } from '../services/api';
import toast from 'react-hot-toast';
import type { Vehicle, CreateVehicleRequest } from '../types';
import { PlusCircle, Truck, Pencil, Trash2, X, Check } from 'lucide-react';

const EMPTY_FORM: CreateVehicleRequest = {
  vehicle_number: '',
  driver_name: '',
  vehicle_type: '',
  phone: '',
};

// ── Confirm Delete Dialog ───────────────────────────────────────────────────
interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}
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

// ── Inline Edit Row ─────────────────────────────────────────────────────────
interface EditRowProps {
  vehicle: Vehicle;
  onSave: (id: string, data: { driver_name: string; vehicle_type: string; phone: string }) => Promise<void>;
  onCancel: () => void;
}
const EditRow: React.FC<EditRowProps> = ({ vehicle, onSave, onCancel }) => {
  const [driverName, setDriverName] = useState(vehicle.driver_name);
  const [vehicleType, setVehicleType] = useState(vehicle.vehicle_type);
  const [phone, setPhone] = useState(vehicle.phone);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(vehicle.id, { driver_name: driverName, vehicle_type: vehicleType, phone });
    setSaving(false);
  };

  const inputCls = "w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";

  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2 font-medium text-gray-700">{vehicle.vehicle_number}</td>
      <td className="px-4 py-2"><input value={driverName} onChange={e => setDriverName(e.target.value)} className={inputCls} /></td>
      <td className="px-4 py-2"><input value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={inputCls} /></td>
      <td className="px-4 py-2"><input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} /></td>
      <td className="px-4 py-2 text-gray-400">{new Date(vehicle.created_at).toLocaleDateString()}</td>
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <button onClick={handleSave} disabled={saving} className="p-1.5 bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50" title="Save">
            <Check size={14} />
          </button>
          <button onClick={onCancel} className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded" title="Cancel">
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export const VehiclesPage: React.FC = () => {
  const { vehicles, refreshVehicles } = useAppContext();
  const [form, setForm] = useState<CreateVehicleRequest>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { refreshVehicles(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createVehicle(form);
      toast.success(`Vehicle ${form.vehicle_number} registered!`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      refreshVehicles();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to register vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, data: { driver_name: string; vehicle_type: string; phone: string }) => {
    try {
      await updateVehicle(id, data);
      toast.success('Vehicle updated');
      setEditingId(null);
      refreshVehicles();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update vehicle');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteVehicle(id);
      toast.success('Vehicle deleted');
      setDeletingId(null);
      refreshVehicles();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete vehicle');
    }
  };

  const vehicleToDelete = vehicles.find(v => v.id === deletingId);

  return (
    <div className="space-y-6">
      {deletingId && vehicleToDelete && (
        <ConfirmDialog
          message={`Delete vehicle "${vehicleToDelete.vehicle_number}"? This will also remove all its location history and violations.`}
          onConfirm={() => handleDelete(deletingId)}
          onCancel={() => setDeletingId(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-sm text-gray-500 mt-1">{vehicles.length} registered</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <PlusCircle size={16} /> Register Vehicle
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">New Vehicle</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['vehicle_number', 'driver_name', 'vehicle_type', 'phone'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">
                  {field.replace(/_/g, ' ')}
                </label>
                <input
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
                {loading ? 'Registering…' : 'Register'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {vehicles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Truck size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No vehicles registered yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Vehicle Number', 'Driver', 'Type', 'Phone', 'Registered', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map(v =>
                editingId === v.id ? (
                  <EditRow key={v.id} vehicle={v} onSave={handleUpdate} onCancel={() => setEditingId(null)} />
                ) : (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{v.vehicle_number}</td>
                    <td className="px-4 py-3 text-gray-600">{v.driver_name}</td>
                    <td className="px-4 py-3 text-gray-600">{v.vehicle_type}</td>
                    <td className="px-4 py-3 text-gray-600">{v.phone}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(v.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingId(v.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit vehicle"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingId(v.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete vehicle"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
