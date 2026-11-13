import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { createVehicle, updateVehicle, deleteVehicle } from '../services/api';
import toast from 'react-hot-toast';
import type { Vehicle, CreateVehicleRequest } from '../types';
import {
  PlusCircle,
  Truck,
  Pencil,
  Trash2,
  X,
  Check,
  Search,
  Info,
  Phone,
  User,
  Hash,
} from 'lucide-react';

export const VEHICLE_TYPES = [
  'Truck',
  'Van',
  'Trailer',
  'Pickup',
  'Tanker',
  'Car',
  'Motorcycle',
  'Bus',
] as const;

const EMPTY_FORM: CreateVehicleRequest = {
  vehicle_number: '',
  driver_name: '',
  vehicle_type: 'Truck',
  phone: '',
};

// ── Hover Info Tooltip Component ────────────────────────────────────────────
interface InfoTooltipProps {
  text: string;
}
const InfoTooltip: React.FC<InfoTooltipProps> = ({ text }) => (
  <span className="relative group inline-flex items-center ml-1 align-middle">
    <span className="cursor-help text-[#6E7565] hover:text-[#23281E] transition-colors p-0.5 rounded-full hover:bg-[#EAE2D6]">
      <Info size={12} />
    </span>
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
      <span className="bg-[#23281E] text-[#F7F2EB] text-[11px] leading-snug font-normal px-2.5 py-1.5 rounded-lg shadow-xl border border-[#4B5243] w-max max-w-[210px] text-center whitespace-normal">
        {text}
      </span>
      <span className="w-2 h-2 bg-[#23281E] rotate-45 -mt-1 border-r border-b border-[#4B5243]" />
    </span>
  </span>
);

// ── Confirm Delete Dialog ───────────────────────────────────────────────────
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

// ── Inline Edit Row ─────────────────────────────────────────────────────────
interface EditRowProps {
  vehicle: Vehicle;
  onSave: (id: string, data: { driver_name: string; vehicle_type: string; phone: string }) => Promise<void>;
  onCancel: () => void;
}
const EditRow: React.FC<EditRowProps> = ({ vehicle, onSave, onCancel }) => {
  const [driverName, setDriverName] = useState(vehicle.driver_name);
  const [vehicleType, setVehicleType] = useState(vehicle.vehicle_type || 'Truck');
  const [phone, setPhone] = useState(vehicle.phone);
  const [saving, setSaving] = useState(false);

  const handlePhoneChange = (val: string) => {
    // Numbers only, maximum 10 digits
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    setPhone(cleaned);
  };

  const handleSave = async () => {
    if (!driverName.trim()) {
      toast.error('Driver name is required');
      return;
    }
    if (phone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    setSaving(true);
    await onSave(vehicle.id, {
      driver_name: driverName.trim(),
      vehicle_type: vehicleType,
      phone,
    });
    setSaving(false);
  };

  const inputCls =
    'w-full bg-[#FFFFFF] border border-[#D4CFC7] rounded-lg px-2.5 py-1.5 text-xs text-[#23281E] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]';

  return (
    <tr className="bg-[#8B9A6E]/15 border-b border-[#D6CCBE]">
      <td className="px-4 py-3 font-mono font-bold text-xs text-[#23281E]">
        {vehicle.vehicle_number}
      </td>
      <td className="px-4 py-2">
        <input
          value={driverName}
          onChange={e => setDriverName(e.target.value)}
          placeholder="Driver Name"
          className={inputCls}
        />
      </td>
      <td className="px-4 py-2">
        <select
          value={vehicleType}
          onChange={e => setVehicleType(e.target.value)}
          className={inputCls}
        >
          {VEHICLE_TYPES.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-2">
        <div className="relative">
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={e => handlePhoneChange(e.target.value)}
            placeholder="10-digit number"
            maxLength={10}
            className={`${inputCls} font-mono`}
          />
          <span className="absolute right-2 top-1.5 text-[10px] font-mono text-[#6E7565]">
            {phone.length}/10
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-[#6E7565] font-mono">
        {new Date(vehicle.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-1.5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1.5 bg-[#596543] hover:bg-[#475135] text-[#F7F2EB] rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            title="Save changes"
          >
            <Check size={13} />
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 bg-[#FFFFFF] hover:bg-[#EAE2D6] text-[#5C6356] border border-[#D4CFC7] rounded-lg transition-colors"
            title="Cancel"
          >
            <X size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
};

// ── Main VehiclesPage Component ─────────────────────────────────────────────
export const VehiclesPage: React.FC = () => {
  const { vehicles, refreshVehicles } = useAppContext();
  const [form, setForm] = useState<CreateVehicleRequest>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    refreshVehicles();
  }, [refreshVehicles]);

  const handlePhoneInput = (val: string) => {
    // Numbers only, max 10 digits
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    setForm(f => ({ ...f, phone: cleaned }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const vehicleNumber = form.vehicle_number.trim().toUpperCase();
    const driverName = form.driver_name.trim();

    if (!vehicleNumber) {
      toast.error('Vehicle registration number is required');
      return;
    }
    if (!driverName) {
      toast.error('Driver name is required');
      return;
    }
    if (form.phone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }

    setLoading(true);
    try {
      await createVehicle({
        vehicle_number: vehicleNumber,
        driver_name: driverName,
        vehicle_type: form.vehicle_type,
        phone: form.phone,
      });
      toast.success(`Vehicle ${vehicleNumber} registered successfully!`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      refreshVehicles();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to register vehicle');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (
    id: string,
    data: { driver_name: string; vehicle_type: string; phone: string }
  ) => {
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

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchesSearch = search
        ? v.vehicle_number.toLowerCase().includes(search.toLowerCase()) ||
        v.driver_name.toLowerCase().includes(search.toLowerCase()) ||
        v.phone.includes(search)
        : true;
      const matchesType = typeFilter ? v.vehicle_type === typeFilter : true;
      return matchesSearch && matchesType;
    });
  }, [vehicles, search, typeFilter]);

  const vehicleToDelete = vehicles.find(v => v.id === deletingId);

  return (
    <div className="space-y-5">
      {deletingId && vehicleToDelete && (
        <ConfirmDialog
          message={`Delete vehicle "${vehicleToDelete.vehicle_number}"? This will also remove all its telemetry history and violations.`}
          onConfirm={() => handleDelete(deletingId)}
          onCancel={() => setDeletingId(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#23281E]">
              Fleet Vehicles
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-[#8B9A6E]/20 text-[#424C32] border border-[#8B9A6E]/40 font-semibold">
              {vehicles.length} registered
            </span>
          </div>
          <p className="text-xs text-[#5C6356] mt-0.5">
            Active fleet assets tracked across geofence boundaries
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-[#596543] hover:bg-[#475135] text-[#F7F2EB] text-sm font-medium px-4 py-2 rounded-xl transition-all shadow-sm"
        >
          <PlusCircle size={16} /> {showForm ? 'Close Form' : 'Register Vehicle'}
        </button>
      </div>

      {/* Register Vehicle Form with Info Hover Buttons */}
      {showForm && (
        <div className="bg-[#F7F2EB] border border-[#D6CCBE] rounded-2xl p-5 shadow-warm-card space-y-4">
          <div className="flex items-center justify-between border-b border-[#D6CCBE] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#23281E] flex items-center gap-2">
                <Truck size={16} className="text-[#596543]" /> Register New Vehicle
              </h2>
              <p className="text-xs text-[#5C6356] mt-0.5">
                Hover over any <span className="font-semibold text-[#23281E]">(i)</span> icon to see field requirements.
              </p>
            </div>
            <button
              onClick={() => setShowForm(false)}
              className="text-[#6E7565] hover:text-[#23281E]"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vehicle Number */}
              <div>
                <label className="block text-xs font-medium text-[#4B5243] mb-1 flex items-center gap-1">
                  <Hash size={12} className="text-[#6E7565]" />
                  <span>Vehicle Number</span>
                  <InfoTooltip text="Unique license plate number (e.g. KA-01-AB-1234). Letters, numbers, and hyphens only." />
                </label>
                <input
                  type="text"
                  value={form.vehicle_number}
                  onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value.toUpperCase() }))}
                  required
                  placeholder="e.g. KA-01-AB-1234"
                  className="w-full bg-[#FFFFFF] border border-[#D4CFC7] rounded-xl px-3 py-2 text-sm text-[#23281E] font-mono placeholder:text-[#A8A296] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                />
              </div>

              {/* Driver Name */}
              <div>
                <label className="block text-xs font-medium text-[#4B5243] mb-1 flex items-center gap-1">
                  <User size={12} className="text-[#6E7565]" />
                  <span>Driver Name</span>
                  <InfoTooltip text="Full legal name of the designated primary fleet driver or operator." />
                </label>
                <input
                  type="text"
                  value={form.driver_name}
                  onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))}
                  required
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full bg-[#FFFFFF] border border-[#D4CFC7] rounded-xl px-3 py-2 text-sm text-[#23281E] placeholder:text-[#A8A296] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                />
              </div>

              {/* Vehicle Type Dropdown */}
              <div>
                <label className="block text-xs font-medium text-[#4B5243] mb-1 flex items-center gap-1">
                  <Truck size={12} className="text-[#6E7565]" />
                  <span>Vehicle Type</span>
                  <InfoTooltip text="Asset classification category (Truck, Van, Trailer, etc.) used for fleet rules." />
                </label>
                <select
                  value={form.vehicle_type}
                  onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}
                  required
                  className="w-full bg-[#FFFFFF] border border-[#D4CFC7] rounded-xl px-3 py-2 text-sm text-[#23281E] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                >
                  {VEHICLE_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone Number (Numbers only, exactly 10 digits) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[#4B5243] flex items-center gap-1">
                    <Phone size={12} className="text-[#6E7565]" />
                    <span>Phone Number</span>
                    <InfoTooltip text="Must be exactly 10 numeric digits. Used for automated dispatch and geofence SMS alerts." />
                  </label>
                  <span className={`text-[10px] font-mono ${form.phone.length === 10 ? 'text-emerald-700 font-bold' : 'text-[#6E7565]'}`}>
                    {form.phone.length}/10 digits
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={e => handlePhoneInput(e.target.value)}
                    required
                    maxLength={10}
                    placeholder="e.g. 9876543210 (exclude the +91)"
                    className="w-full bg-[#FFFFFF] border border-[#D4CFC7] rounded-xl px-3 py-2 text-sm text-[#23281E] font-mono placeholder:text-[#A8A296] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                  />
                  {form.phone.length === 10 && (
                    <span className="absolute right-3 top-2.5 text-emerald-600">
                      <Check size={14} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-[#D6CCBE]">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-medium border border-[#D4CFC7] rounded-xl hover:bg-[#EAE2D6] text-[#5C6356] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || form.phone.length !== 10}
                className="bg-[#596543] hover:bg-[#475135] disabled:opacity-50 text-[#F7F2EB] text-xs font-medium px-5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
              >
                <Check size={14} /> {loading ? 'Registering…' : 'Register Vehicle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 text-[#6E7565]" size={14} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by vehicle plate, driver, or phone…"
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#D4CFC7] text-xs text-[#23281E] placeholder:text-[#A8A296] focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setTypeFilter('')}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${!typeFilter
                ? 'bg-[#8B9A6E] text-[#F7F2EB] border-[#8B9A6E]'
                : 'border-[#D4CFC7] bg-[#FFFFFF] text-[#5C6356] hover:bg-[#EAE2D6]'
              }`}
          >
            All Types ({vehicles.length})
          </button>
          {VEHICLE_TYPES.map(type => {
            const count = vehicles.filter(v => v.vehicle_type === type).length;
            if (count === 0) return null;
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(t => (t === type ? '' : type))}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${typeFilter === type
                    ? 'bg-[#8B9A6E] text-[#F7F2EB] border-[#8B9A6E]'
                    : 'border-[#D4CFC7] bg-[#FFFFFF] text-[#5C6356] hover:bg-[#EAE2D6]'
                  }`}
              >
                {type} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Vehicle Table with Column Name Info Buttons */}
      {filteredVehicles.length === 0 ? (
        <div className="bg-[#F7F2EB] rounded-2xl border border-[#D6CCBE] p-12 text-center shadow-warm-card">
          <Truck size={40} className="mx-auto text-[#A8A296] mb-3" />
          <p className="text-sm font-medium text-[#23281E]">
            {vehicles.length === 0 ? 'No vehicles registered yet' : 'No matching vehicles found'}
          </p>
          <p className="text-xs text-[#6E7565] mt-1">
            {vehicles.length === 0
              ? 'Click "Register Vehicle" above to add your first fleet asset.'
              : 'Try clearing your search query or filter.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#F7F2EB] rounded-2xl border border-[#D6CCBE] shadow-warm-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F2EDE4] border-b border-[#D6CCBE] text-[#4B5243] font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center">
                      Vehicle Number
                      <InfoTooltip text="Official license plate format (unique per asset)." />
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center">
                      Driver Name
                      <InfoTooltip text="Full legal name of the designated driver." />
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center">
                      Type
                      <InfoTooltip text="Asset classification category (Truck, Van, Trailer, etc.)." />
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center">
                      Phone Number
                      <InfoTooltip text="10-digit mobile number for dispatch alerts." />
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center">
                      Registered
                      <InfoTooltip text="Timestamp when the vehicle was enrolled into the system." />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-end">
                      Actions
                      <InfoTooltip text="Edit driver details or permanently remove asset." />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DEC9]">
                {filteredVehicles.map(v =>
                  editingId === v.id ? (
                    <EditRow
                      key={v.id}
                      vehicle={v}
                      onSave={handleUpdate}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={v.id} className="hover:bg-[#EAE2D6]/60 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-xs text-[#23281E]">
                        {v.vehicle_number}
                      </td>
                      <td className="px-4 py-3 text-[#23281E] font-medium">{v.driver_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FFFFFF] border border-[#D4CFC7] text-[#424C32]">
                          {v.vehicle_type || 'Unspecified'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#5C6356]">{v.phone}</td>
                      <td className="px-4 py-3 text-[#6E7565] font-mono">
                        {new Date(v.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingId(v.id)}
                            className="p-1.5 bg-[#FFFFFF] hover:bg-[#8B9A6E] text-[#5C6356] hover:text-[#F7F2EB] border border-[#D4CFC7] rounded-lg transition-colors shadow-sm"
                            title="Edit vehicle"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingId(v.id)}
                            className="p-1.5 bg-[#FFFFFF] hover:bg-rose-700 text-[#5C6356] hover:text-[#F7F2EB] border border-[#D4CFC7] rounded-lg transition-colors shadow-sm"
                            title="Delete vehicle"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
