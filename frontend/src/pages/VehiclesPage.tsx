import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { createVehicle } from '../services/api';
import toast from 'react-hot-toast';
import type { CreateVehicleRequest } from '../types';
import { PlusCircle, Truck } from 'lucide-react';

const EMPTY_FORM: CreateVehicleRequest = {
  vehicle_number: '',
  driver_name: '',
  vehicle_type: '',
  phone: '',
};

export const VehiclesPage: React.FC = () => {
  const { vehicles, refreshVehicles } = useAppContext();
  const [form, setForm] = useState<CreateVehicleRequest>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { refreshVehicles(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createVehicle(form);
      toast.success(`Vehicle ${form.vehicle_number} registered!`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      refreshVehicles();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to register vehicle';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
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
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['vehicle_number', 'driver_name', 'vehicle_type', 'phone'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">
                  {field.replace('_', ' ')}
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
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {loading ? 'Registering…' : 'Register'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vehicle List */}
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
                {['Vehicle Number', 'Driver', 'Type', 'Phone', 'Registered'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.vehicle_number}</td>
                  <td className="px-4 py-3 text-gray-600">{v.driver_name}</td>
                  <td className="px-4 py-3 text-gray-600">{v.vehicle_type}</td>
                  <td className="px-4 py-3 text-gray-600">{v.phone}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(v.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
