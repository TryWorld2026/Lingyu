/*
 * 灵屿 Lingyu - 免费开源的 Windows 桌面灵动岛（基于 eIsland 二次开发）
 * https://github.com/TryWorld2026/Lingyu
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 * Original author: JNTMTMTM (https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3, or (at your option) any later version.
 */

/**
 * @file AiConnectionForm.tsx
 * @description 本地模型与自带 Key 的连接设置，同时用于 AI 页和设置搜索入口。
 * @author 灵屿
 */

import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_AI_CONFIG } from '../../../../../../shared/ai';
import type { AiErrorCode, AiProvider, AiPublicConfig } from '../../../../../../shared/ai';
import '../../../../../styles/ai.css';

interface AiConnectionFormProps {
  onSaved?: (config: AiPublicConfig) => void;
}

/**
 * 渲染免费模型连接设置。
 * @param props - 可选的公开配置保存回调。
 * @returns 连接配置表单。
 */
export function AiConnectionForm({ onSaved }: AiConnectionFormProps): ReactElement {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AiPublicConfig>(DEFAULT_AI_CONFIG);
  const [apiKey, setApiKey] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AiErrorCode | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | undefined>();
  const [feedback, setFeedback] = useState<'saved' | 'loaded' | 'noModels' | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.api.aiGetConfig().then((result) => {
      if (cancelled) return;
      if (result.ok) setConfig(result.value);
      if (!result.ok) setError(result.error);
      setLoaded(true);
    }).catch(() => {
      if (!cancelled) { setError('network'); setLoaded(true); }
    });
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async (notify: boolean): Promise<AiPublicConfig | null> => {
    setError(null);
    setFeedback(null);
    try {
      const result = await window.api.aiSaveConfig({
        provider: config.provider, endpoint: config.endpoint, model: config.model,
        apiKey: apiKey.trim() || (clearKey ? '' : undefined),
      });
      if (!result.ok) {
        setError(result.error);
        setHttpStatus(result.status);
        return null;
      }
      setConfig(result.value);
      setApiKey('');
      setClearKey(false);
      setFeedback('saved');
      if (notify) onSaved?.(result.value);
      return result.value;
    } catch {
      setError('network');
      return null;
    }
  }, [config, apiKey, clearKey, onSaved]);

  const handleSave = useCallback(async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    await persist(true);
    setBusy(false);
  }, [busy, persist]);

  const handleLoadModels = useCallback(async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    const saved = await persist(false);
    if (saved) {
      try {
        const result = await window.api.aiListModels();
        if (result.ok) {
          setModels(result.value);
          if (!saved.model && result.value[0]) setConfig({ ...saved, model: result.value[0] });
          setFeedback(result.value.length ? 'loaded' : 'noModels');
        } else {
          setError(result.error);
          setHttpStatus(result.status);
        }
      } catch {
        setError('network');
      }
    }
    setBusy(false);
  }, [busy, persist]);

  const handleProvider = useCallback((event: ChangeEvent<HTMLSelectElement>): void => {
    const provider = event.target.value as AiProvider;
    setConfig({ provider, endpoint: provider === 'ollama' ? DEFAULT_AI_CONFIG.endpoint : 'https://api.openai.com/v1', model: '', hasApiKey: false });
    setApiKey('');
    setClearKey(true);
    setModels([]);
    setFeedback(null);
  }, []);

  const handleEndpoint = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    setConfig((previous) => ({ ...previous, endpoint: event.target.value }));
    setApiKey('');
    setClearKey(true);
    setModels([]);
    setFeedback(null);
  }, []);

  return (
    <form className="lingyu-ai-connection settings-card" onSubmit={handleSave}>
      <div className="settings-card-header">
        <h2 className="settings-card-title">{t('settings.ai.title')}</h2>
        <p className="settings-card-subtitle">{t('settings.ai.hint')}</p>
      </div>
      <fieldset className="lingyu-ai-fields" disabled={!loaded || busy}>
        <div className="lingyu-ai-field">
          <label htmlFor="lingyu-ai-provider">{t('settings.ai.provider')}</label>
          <select id="lingyu-ai-provider" className="settings-field-input" value={config.provider} onChange={handleProvider}>
            <option value="ollama">{t('settings.ai.localProvider')}</option>
            <option value="openai">{t('settings.ai.compatibleProvider')}</option>
          </select>
          <p>{t('settings.ai.providerHint')}</p>
        </div>
        <div className="lingyu-ai-field">
          <label htmlFor="lingyu-ai-endpoint">{t('settings.ai.endpoint')}</label>
          <input id="lingyu-ai-endpoint" className="settings-field-input" type="url" value={config.endpoint} onChange={handleEndpoint} required />
          <p>{t('settings.ai.endpointHint')}</p>
        </div>
        <div className="lingyu-ai-field">
          <label htmlFor="lingyu-ai-model">{t('settings.ai.model')}</label>
          <input id="lingyu-ai-model" className="settings-field-input" value={config.model}
            onChange={(event) => setConfig((previous) => ({ ...previous, model: event.target.value }))}
            placeholder={t('settings.ai.modelPlaceholder')} list="lingyu-ai-model-list" autoComplete="off" />
          <datalist id="lingyu-ai-model-list">{models.map((model) => <option key={model} value={model} />)}</datalist>
          <p>{t('settings.ai.modelHint')}</p>
        </div>
        {config.provider === 'openai' && (
          <div className="lingyu-ai-field">
            <label htmlFor="lingyu-ai-key">{t('settings.ai.apiKey')}</label>
            <input id="lingyu-ai-key" className="settings-field-input" type="password" value={apiKey}
              onChange={(event) => setApiKey(event.target.value)} autoComplete="off"
              placeholder={t(config.hasApiKey && !clearKey ? 'settings.ai.keySaved' : 'settings.ai.keyPlaceholder')} />
            <p>{t('settings.ai.keyHint')}</p>
            {config.hasApiKey && (
              <button className="lingyu-ai-button" type="button" onClick={() => { setApiKey(''); setClearKey(true); }}>
                {t(clearKey ? 'settings.ai.keyRemovalPending' : 'settings.ai.removeKey')}
              </button>
            )}
          </div>
        )}
        <div className="lingyu-ai-actions">
          <button className="lingyu-ai-button" type="button" onClick={handleLoadModels}>{t(busy ? 'settings.ai.loading' : 'settings.ai.loadModels')}</button>
          <button className="lingyu-ai-button lingyu-ai-button--primary" type="submit">{t('settings.ai.save')}</button>
        </div>
      </fieldset>
      <p className="lingyu-ai-note">{t(config.provider === 'ollama' ? 'settings.ai.localHint' : 'settings.ai.costHint')}</p>
      {feedback && !error && <p className="lingyu-ai-feedback" role="status">{t(`settings.ai.${feedback}`)}</p>}
      {error && <p className="lingyu-ai-feedback lingyu-ai-feedback--error" role="alert">{t(`ai.errors.${error}`, { status: httpStatus })}</p>}
    </form>
  );
}
