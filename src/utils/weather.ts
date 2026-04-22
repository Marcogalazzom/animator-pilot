// Mapping WMO weather codes (Open-Meteo) vers icône + label français +
// règle "remarkable" (météo qui mérite une phrase dans le bonjour).
//
// Codes WMO : https://open-meteo.com/en/docs

export type RemarkableKind = 'sunny' | 'rain' | 'snow' | 'hot' | 'cold' | 'fog' | 'thunder';

export interface WeatherInfo {
  tempC: number;
  code: number;
  icon: string;
  label: string;
  remarkable: boolean;
  remarkableKind: RemarkableKind | null;
}

export function iconForCode(code: number): string {
  if (code <= 1) return '☀';
  if (code === 2) return '⛅';
  if (code === 3) return '☁';
  if (code === 45 || code === 48) return '🌫';
  if (code >= 51 && code <= 67) return '🌧';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '❄';
  if (code >= 80 && code <= 82) return '🌧';
  if (code >= 95) return '⛈';
  return '☁';
}

export function labelForCode(code: number): string {
  if (code === 0) return 'Ciel clair';
  if (code === 1) return 'Beau temps';
  if (code === 2) return 'Éclaircies';
  if (code === 3) return 'Ciel couvert';
  if (code === 45 || code === 48) return 'Brouillard';
  if (code >= 51 && code <= 57) return 'Bruine';
  if (code >= 61 && code <= 67) return 'Pluie';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Neige';
  if (code >= 80 && code <= 82) return 'Averses';
  if (code >= 95) return 'Orage';
  return '—';
}

function remarkableKindFor(code: number, tempC: number): RemarkableKind | null {
  // Ordre de priorité : phénomènes extrêmes d'abord.
  if (code >= 95) return 'thunder';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (tempC >= 30) return 'hot';
  if (tempC <= 0) return 'cold';
  if (code === 45 || code === 48) return 'fog';
  // Grand soleil : ciel clair + températures douces ou chaudes.
  if (code <= 1 && tempC >= 15) return 'sunny';
  return null;
}

export function buildWeatherInfo(code: number, tempC: number): WeatherInfo {
  const kind = remarkableKindFor(code, tempC);
  return {
    tempC,
    code,
    icon: iconForCode(code),
    label: labelForCode(code),
    remarkable: kind !== null,
    remarkableKind: kind,
  };
}

// Phrases insérées dans le bonjour pour chaque situation remarquable.
// Plusieurs variantes pour éviter la redondance ; le choix est stable dans
// la journée (sélection via un seed jour+kind côté greeting.ts).
export const REMARKABLE_PHRASES: Record<RemarkableKind, string[]> = {
  sunny: [
    'Le soleil est avec nous aujourd’hui.',
    'Belle lumière dehors.',
    'Un vrai temps de sortie.',
  ],
  rain: [
    'Il pleut sur Eybens — un temps à rester au chaud.',
    'Pluie douce aujourd’hui.',
    'La pluie s’installe — prévoir un temps calme à l’intérieur.',
  ],
  snow: [
    'La neige est tombée sur Eybens.',
    'Journée blanche aujourd’hui.',
  ],
  hot: [
    'Il fait chaud — pense à l’hydratation des résidents.',
    'Grosse chaleur aujourd’hui, à surveiller.',
  ],
  cold: [
    'Grand froid ce matin — soigner les sorties.',
    'Il gèle dehors — on reste au chaud.',
  ],
  fog: [
    'Brume ce matin sur la cuvette grenobloise.',
    'Brouillard au réveil — la ville est feutrée.',
  ],
  thunder: [
    'Orages annoncés — prévoir un repli à l’intérieur.',
  ],
};
