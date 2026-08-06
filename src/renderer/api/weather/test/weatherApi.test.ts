/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM[](https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file weatherApi.test.ts
 * @description 单元测试文件
 * @author 灵屿
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ------------------------------------------------------------------ */
/*  hoisted mocks                                                     */
/* ------------------------------------------------------------------ */

const { mockNetFetch, mockLoadNetworkConfig, mockLoadWeatherProviderConfig,
  mockLoadLocationFromStorage, mockLoadWeatherLocationConfig,
  mockSaveLocationToStorage, mockFetchLocation, mockLogger } = vi.hoisted(() => ({
    mockNetFetch: vi.fn(),
    mockLoadNetworkConfig: vi.fn(() => ({ timeoutMs: 10000 })),
    mockLoadWeatherProviderConfig: vi.fn(() => ({ primaryProvider: 'open-meteo' as const })),
    mockLoadLocationFromStorage: vi.fn(() => null),
    mockLoadWeatherLocationConfig: vi.fn(() => ({ priority: 'ip' as const, customLocation: null })),
    mockSaveLocationToStorage: vi.fn(),
    mockFetchLocation: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));

vi.mock('../../../store/utils/storage', () => ({
  loadNetworkConfig: mockLoadNetworkConfig,
  loadWeatherProviderConfig: mockLoadWeatherProviderConfig,
  loadLocationFromStorage: mockLoadLocationFromStorage,
  loadWeatherLocationConfig: mockLoadWeatherLocationConfig,
  saveLocationToStorage: mockSaveLocationToStorage,
}));


const setTestWindow = (value: TestWindow): void => {
  Object.defineProperty(globalThis, 'window', {
    value,
    configurable: true,
    writable: true,
  });
};

const makeOpenMeteoBody = (overrides?: Record<string, unknown>): string => {
  const base = {
    current: {
      temperature_2m: 25,
      weather_code: 0,
      relative_humidity_2m: 60,
      wind_speed_10m: 12,
    },
    daily: {
      temperature_2m_max: [28, 30, 27],
      temperature_2m_min: [18, 20, 17],
      weather_code: [0, 2, 61],
      wind_speed_10m_max: [15, 18, 10],
      uv_index_max: [6, 7, 4],
      precipitation_probability_max: [10, 20, 80],
    },
  };
  const merged = overrides
    ? { ...base, current: { ...base.current, ...overrides.current }, daily: { ...base.daily, ...overrides.daily } }
    : base;
  return JSON.stringify(merged);
};

const makeUapiBody = (overrides?: Record<string, unknown>): string => {
  const base = {
    data: {
      weather: '晴',
      weather_icon: '100',
      temperature: 26,
      humidity: 55,
      uv: 5,
      wind_power: '3-4级',
      temp_max: 29,
      temp_min: 19,
      forecast: [
        { temp_max: 30, temp_min: 20, weather_day: '多云', weather_night: '晴', wind_speed_day: 10, uv_index: 6, precip: 5, weather_icon: '101' },
        { temp_max: 28, temp_min: 18, weather_day: '小雨', weather_night: '阴', wind_speed_day: 12, uv_index: 3, precip: 60, weather_icon: '305' },
      ],
    },
  };
  const merged = overrides ? { ...base, ...overrides } : base;
  return JSON.stringify(merged);
};


/* ------------------------------------------------------------------ */
/*  tests                                                             */
/* ------------------------------------------------------------------ */

describe('weatherApi', () => {
  beforeEach(() => {
    vi.resetModules();
    mockNetFetch.mockReset();
    mockLoadNetworkConfig.mockReset();
    mockLoadWeatherProviderConfig.mockReset();
    mockLoadLocationFromStorage.mockReset();
    mockLoadWeatherLocationConfig.mockReset();
    mockSaveLocationToStorage.mockReset();
    mockFetchLocation.mockReset();

    mockLoadNetworkConfig.mockReturnValue({ timeoutMs: 10000 });
    mockLoadWeatherProviderConfig.mockReturnValue({ primaryProvider: 'open-meteo' });
    mockLoadLocationFromStorage.mockReturnValue(null);
    mockLoadWeatherLocationConfig.mockReturnValue({ priority: 'ip', customLocation: null });

    setTestWindow({
      location: { hostname: 'localhost' },
      api: { netFetch: mockNetFetch },
    });
  });

  /* ============================================================= */
  /*  fetchWeather — open-meteo provider                            */
  /* ============================================================= */

  describe('fetchWeather with open-meteo provider', () => {
    it('returns mapped WeatherData on success', async () => {
      mockNetFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: makeOpenMeteoBody(),
      });

      const { fetchWeather } = await import('../weatherApi');
      const data = await fetchWeather({ latitude: 39.9, longitude: 116.4 });

      expect(data.temperature).toBe(25);
      expect(data.description).toBe('晴');
      expect(data.humidity).toBe(60);
      expect(data.windSpeed).toBe(12);
      expect(data.uvIndex).toBe(6);
      expect(data.iconCode).toBe(0);
      expect(data.forecast).toHaveLength(2);
      expect(data.forecast[0].temperatureMax).toBe(30);
      expect(data.forecast[0].temperatureMin).toBe(20);
      expect(data.forecast[0].description).toBe('多云');
      expect(data.forecast[1].description).toBe('小雨');
      expect(data.forecast[1].precipitationProbability).toBe(80);
    });

    it('builds correct Open-Meteo URL with query params', async () => {
      mockNetFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: makeOpenMeteoBody(),
      });

      const { fetchWeather } = await import('../weatherApi');
      await fetchWeather({ latitude: 31.2, longitude: 121.5 });

      const calledUrl: string = mockNetFetch.mock.calls[0][0];
      expect(calledUrl).toContain('api.open-meteo.com');
      expect(calledUrl).toContain('latitude=31.2');
      expect(calledUrl).toContain('longitude=121.5');
    });

    it('throws when all providers fail with HTTP error', async () => {
      mockNetFetch.mockResolvedValue({
        ok: false,
        status: 503,
        body: 'Service Unavailable',
      });

      const { fetchWeather } = await import('../weatherApi');
      await expect(fetchWeather({ latitude: 39.9, longitude: 116.4 }))
        .rejects.toThrow('HTTP 503');
    });

    it('throws when response body is HTML (non-JSON)', async () => {
      mockNetFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: '<!DOCTYPE html><html><body>Error</body></html>',
      });

      const { fetchWeather } = await import('../weatherApi');
      await expect(fetchWeather({ latitude: 39.9, longitude: 116.4 }))
        .rejects.toThrow('非 JSON');
    });

    it('throws when response body is HTML with ok=false (gateway error)', async () => {
      mockNetFetch.mockResolvedValue({
        ok: false,
        status: 502,
        body: '<!DOCTYPE html><html><body>Bad Gateway</body></html>',
      });

      const { fetchWeather } = await import('../weatherApi');
      await expect(fetchWeather({ latitude: 39.9, longitude: 116.4 }))
        .rejects.toThrow('HTTP 502');
    });
  });

  /* ============================================================= */
  /*  fetchWeather — uapi provider                                  */
  /* ============================================================= */

  describe('fetchWeather with uapi provider', () => {
    it('returns mapped WeatherData from uapi response', async () => {
      mockLoadWeatherProviderConfig.mockReturnValue({ primaryProvider: 'uapi' });
      mockNetFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: makeUapiBody(),
      });

      const { fetchWeather } = await import('../weatherApi');
      const data = await fetchWeather({ latitude: 39.9, longitude: 116.4 });

      expect(data.temperature).toBe(26);
      expect(data.description).toBe('晴');
      expect(data.humidity).toBe(55);
      expect(data.windSpeed).toBe(4);
      expect(data.uvIndex).toBe(5);
      expect(data.iconCode).toBe(0);
      expect(data.forecast).toHaveLength(2);
    });

    it('throws when all providers fail with HTTP error (uapi primary)', async () => {
      mockLoadWeatherProviderConfig.mockReturnValue({ primaryProvider: 'uapi' });
      mockNetFetch.mockResolvedValue({
        ok: false,
        status: 500,
        body: 'Internal Server Error',
      });

      const { fetchWeather } = await import('../weatherApi');
      await expect(fetchWeather({ latitude: 39.9, longitude: 116.4 }))
        .rejects.toThrow('HTTP 500');
    });

    it('throws when uapi response body is HTML', async () => {
      mockLoadWeatherProviderConfig.mockReturnValue({ primaryProvider: 'uapi' });
      mockNetFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: '<html>error</html>',
      });

      const { fetchWeather } = await import('../weatherApi');
      await expect(fetchWeather({ latitude: 39.9, longitude: 116.4 }))
        .rejects.toThrow('非 JSON');
    });

    it('parses uapi response when data is at top level (no data wrapper)', async () => {
      mockLoadWeatherProviderConfig.mockReturnValue({ primaryProvider: 'uapi' });
      mockNetFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: JSON.stringify({
          weather: '阴',
          weather_icon: '104',
          temperature: 20,
          humidity: 70,
          uv: 2,
          wind_power: '2级',
          temp_max: 22,
          temp_min: 16,
        }),
      });

      const { fetchWeather } = await import('../weatherApi');
      const data = await fetchWeather({ latitude: 39.9, longitude: 116.4 });

      expect(data.temperature).toBe(20);
      expect(data.description).toBe('阴');
    });
  });

  /* ============================================================= */
  /*  fetchWeather — qweather-pro provider                          */
  /* ============================================================= */

  describe('fetchWeather fallback chain', () => {
    it('falls back to uapi when open-meteo fails', async () => {
      mockNetFetch
        .mockRejectedValueOnce(new Error('network timeout'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          body: makeUapiBody(),
        });

      const { fetchWeather } = await import('../weatherApi');
      const data = await fetchWeather({ latitude: 39.9, longitude: 116.4 });

      expect(data.temperature).toBe(26);
      expect(mockNetFetch).toHaveBeenCalledTimes(2);
    });

    it('throws last error when all providers fail', async () => {
      mockNetFetch
        .mockRejectedValueOnce(new Error('open-meteo down'))
        .mockRejectedValueOnce(new Error('uapi down'));

      const { fetchWeather } = await import('../weatherApi');
      await expect(fetchWeather({ latitude: 39.9, longitude: 116.4 }))
        .rejects.toThrow('uapi down');
    });


  });

  /* ============================================================= */
  /*  fetchWeather — WMO code mapping (via open-meteo response)     */
  /* ============================================================= */

  describe('WMO code mapping (indirect via open-meteo)', () => {
    it.each([
      [0, '晴'],
      [1, '晴'],
      [2, '多云'],
      [3, '阴'],
      [45, '雾'],
      [51, '毛毛雨'],
      [61, '小雨'],
      [63, '中雨'],
      [65, '大雨'],
      [71, '小雪'],
      [73, '中雪'],
      [75, '大雪'],
      [80, '阵雨'],
      [95, '雷雨'],
      [999, '未知'],
    ])('maps WMO code %i to "%s"', async (code, expectedDesc) => {
      mockNetFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: makeOpenMeteoBody({
          current: { weather_code: code },
          daily: { weather_code: [code, code, code] },
        }),
      });

      const { fetchWeather } = await import('../weatherApi');
      const data = await fetchWeather({ latitude: 39.9, longitude: 116.4 });

      expect(data.description).toBe(expectedDesc);
      expect(data.iconCode).toBe(code);
    });
  });


});
