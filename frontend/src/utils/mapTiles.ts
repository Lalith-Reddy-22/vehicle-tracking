export type MapStyleKey = 'dark' | 'voyager' | 'satellite';

const CARTO_API_KEY = (import.meta.env.VITE_CARTO_API_KEY || '').trim();

function withCartoKey(baseUrl: string): string {
  return CARTO_API_KEY
    ? `${baseUrl}?key=${encodeURIComponent(CARTO_API_KEY)}`
    : baseUrl;
}

export const MAP_STYLES: Record<
  MapStyleKey,
  { label: string; url: string; attribution: string }
> = {
  dark: {
    label: 'Cyber Dark',
    url: withCartoKey(
      'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'
    ),
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  voyager: {
    label: 'Voyager',
    url: withCartoKey(
      'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    ),
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

