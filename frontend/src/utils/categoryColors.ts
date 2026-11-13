import type { GeofenceCategory } from '../types';

export const CATEGORY_COLORS: Record<GeofenceCategory, string> = {
  delivery_zone: '#596543',
  restricted_zone: '#be123c',
  toll_zone: '#b45309',
  customer_area: '#0369a1',
};

export interface CategoryMeta {
  label: string;
  shortLabel: string;
  color: string;
  badgeClass: string;
  dotClass: string;
  barClass: string;
  description: string;
}

export const CATEGORY_META: Record<GeofenceCategory, CategoryMeta> = {
  delivery_zone: {
    label: 'Delivery Zone',
    shortLabel: 'Delivery',
    color: '#596543',
    badgeClass: 'bg-[#8B9A6E]/20 text-[#424C32] border-[#8B9A6E]/45',
    dotClass: 'bg-[#8B9A6E]',
    barClass: 'from-[#8B9A6E] to-[#728056]',
    description: 'Authorized dispatch & drop-off hubs',
  },
  restricted_zone: {
    label: 'Restricted Zone',
    shortLabel: 'Restricted',
    color: '#be123c',
    badgeClass: 'bg-rose-700/10 text-rose-800 border-rose-700/25',
    dotClass: 'bg-rose-600',
    barClass: 'from-rose-500 to-rose-700',
    description: 'High-security & no-entry perimeters',
  },
  toll_zone: {
    label: 'Toll Zone',
    shortLabel: 'Toll',
    color: '#b45309',
    badgeClass: 'bg-amber-700/10 text-amber-900 border-amber-700/25',
    dotClass: 'bg-amber-600',
    barClass: 'from-amber-500 to-amber-700',
    description: 'Automated tolling & highway checkpoints',
  },
  customer_area: {
    label: 'Customer Area',
    shortLabel: 'Customer',
    color: '#0369a1',
    badgeClass: 'bg-sky-700/10 text-sky-900 border-sky-700/25',
    dotClass: 'bg-sky-600',
    barClass: 'from-sky-500 to-sky-700',
    description: 'Client sites & scheduled service bays',
  },
};
