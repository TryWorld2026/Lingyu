/*
 * Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026 · GPL-3.0-or-later
 */
/**
 * @file DailyCapsule.tsx
 * @description 音乐、实际天气预报和时间三栏胶囊；完整工具进入工作台。
 * @author 灵屿
 */

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../store/slices';
import type { MaxExpandTab } from '../../../../store/types';
import { SongTab } from './SongTab';
import { VolumeControl } from '../../hover/pages/time/components/VolumeControl';
import { getWeatherIconPath, getWeatherSmallIconPath, getWeekLabel } from '../../hover/pages/weather/utils/weatherUtils';
import { FALLBACK_WEATHER_ICON } from '../../hover/pages/weather/config/weatherConfig';
import { abbreviateWeatherDescription } from '../../../../utils/weatherText';
import { SvgIcon } from '../../../../utils/SvgIcon';

/** @returns 连接真实媒体、天气及系统音量的日常面板。 */
export function DailyCapsule(): ReactElement {
  const { t, i18n } = useTranslation();
  const { weather, location, fetchWeatherData, setMaxExpandTab, setMaxExpand } = useIslandStore();
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const isDay = now.getHours() >= 6 && now.getHours() < 18;
  const hasWeather = weather.temperature !== 0 || weather.description !== '';
  const description = abbreviateWeatherDescription(weather.description, t);
  const openTool = (tab: MaxExpandTab): void => { setMaxExpandTab(tab); setMaxExpand(); };
  const refresh = async (): Promise<void> => {
    if (refreshing) return;
    setRefreshing(true);
    try { await fetchWeatherData(undefined, true); } finally { setRefreshing(false); }
  };
  const actions = [
    { tab: 'focus', icon: SvgIcon.POMODORO, key: 'workspace.focus' },
    { tab: 'todo', icon: SvgIcon.CHECKED, key: 'expanded.nav.todo' },
    { tab: 'system', icon: SvgIcon.VOLUME, key: 'workspace.system' },
    { tab: 'settings', icon: SvgIcon.SETTING, key: 'expanded.nav.settings' },
  ] as const;
  return <div className="lingyu-daily">
    <div className="lingyu-daily-music"><SongTab /></div>
    <section className="lingyu-daily-weather" aria-label={t('hover.weather.today')}>
      <div className="lingyu-daily-weather-heading"><span>{location?.city || t('hover.weather.unknownCity')}</span>
        <button type="button" disabled={refreshing} aria-busy={refreshing} aria-label={t('hover.weather.refreshTitle')} onClick={() => void refresh()}><span aria-hidden="true">↻</span></button>
      </div>
      <div className="lingyu-daily-current-weather"><img src={getWeatherIconPath(weather.iconCode, isDay)} alt={hasWeather ? description : ''} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_WEATHER_ICON; }} />
        <div><strong>{hasWeather ? weather.temperature + '°' : '—'}</strong><p>{hasWeather ? description : t('hover.weather.empty')}</p></div>
      </div>
      {hasWeather && <div className="lingyu-daily-weather-detail"><span>{t('capsule.humidity', { value: weather.humidity })}</span><span>{t('capsule.wind', { value: weather.windSpeed })}</span></div>}
      <div className="lingyu-daily-forecast">{hasWeather && weather.forecast.map((day, index) => <div key={index}>
        <span>{getWeekLabel(index, t)}</span><img src={getWeatherSmallIconPath(day.iconCode, isDay)} alt={abbreviateWeatherDescription(day.description, t)} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_WEATHER_ICON; }} />
        <span>{day.temperatureMin}° / {day.temperatureMax}°</span>
      </div>)}</div>
      {!hasWeather && <p className="lingyu-daily-weather-empty">{t('capsule.refreshHint')}</p>}
    </section>
    <section className="lingyu-daily-time" aria-label={t('capsule.time')}>
      <time className="lingyu-daily-clock" dateTime={now.toISOString()}>{now.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit', hour12: false })}</time>
      <p className="lingyu-daily-date">{now.toLocaleDateString(i18n.language, { month: 'long', day: 'numeric', weekday: 'long' })}</p>
      <VolumeControl />
      <div className="lingyu-daily-actions">{actions.map((action) => <button type="button" key={action.tab} aria-label={t(action.key)} title={t(action.key)} onClick={() => openTool(action.tab)}><img className="workspace-icon" src={action.icon} alt="" /></button>)}</div>
    </section>
  </div>;
}
