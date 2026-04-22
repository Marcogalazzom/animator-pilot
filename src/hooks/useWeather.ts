import { useEffect, useState } from 'react';
import { buildWeatherInfo, type WeatherInfo } from '@/utils/weather';

// Coordonnées de l'EHPAD (Eybens, Isère). Si l'app sert un jour plusieurs
// résidences, déplacer dans useUserSettings (residence_lat/residence_lon).
const EYBENS = { lat: 45.147, lon: 5.743 };
const CACHE_PREFIX = 'weather:eybens:';

function pad(n: number): string { return String(n).padStart(2, '0'); }

// Clé de cache au niveau de l'heure — la météo change peu plus vite.
function hourKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}`;
}

interface CachedPayload { code: number; tempC: number }

function readCache(key: string): CachedPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.code === 'number' && typeof parsed.tempC === 'number') {
      return { code: parsed.code, tempC: parsed.tempC };
    }
    return null;
  } catch {
    return null;
  }
}

function writeCache(key: string, v: CachedPayload): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(v));
    pruneOldKeys(key);
  } catch {
    // quota ou mode privé — on s'en passe.
  }
}

// Enlève toutes les clés météo qui ne sont pas l'actuelle. Les entrées sont
// minuscules mais on évite d'accumuler indéfiniment.
function pruneOldKeys(currentKey: string): void {
  try {
    const full = CACHE_PREFIX + currentKey;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX) && k !== full) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

// Retourne la météo actuelle pour Eybens, ou `null` tant que le fetch n'a pas
// réussi (et en permanence en cas d'échec). Le bonjour dégrade silencieusement.
export function useWeather(): WeatherInfo | null {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = hourKey(new Date());

    const cached = readCache(key);
    if (cached) {
      setWeather(buildWeatherInfo(cached.code, cached.tempC));
      return;
    }

    (async () => {
      try {
        const url =
          'https://api.open-meteo.com/v1/forecast' +
          `?latitude=${EYBENS.lat}&longitude=${EYBENS.lon}` +
          '&current=temperature_2m,weather_code&timezone=auto';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const code = data?.current?.weather_code;
        const tempC = data?.current?.temperature_2m;
        if (typeof code !== 'number' || typeof tempC !== 'number') {
          throw new Error('Open-Meteo: payload inattendu');
        }
        if (cancelled) return;
        writeCache(key, { code, tempC });
        setWeather(buildWeatherInfo(code, tempC));
      } catch (err) {
        if (!cancelled) {
          console.warn('[weather] fetch failed:', err);
          // On laisse `weather === null` — l'UI est conçue pour ça.
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return weather;
}
