/*
 * Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026 · GPL-3.0-or-later
 */
/**
 * @file DesktopLauncher.tsx
 * @description 原全展开入口转入独立工作台，胶囊只展示紧凑启动和失败反馈。
 * @author 灵屿
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../store/slices';
import { openDesktopWorkspace } from '../../../utils/openDesktopWorkspace';

/** @returns 进入桌面工作台的紧凑启动状态，失败时保留重试入口。 */
export function DesktopLauncher(): ReactElement {
  const { t } = useTranslation();
  const tab = useIslandStore((state) => state.maxExpandTab);
  const setHover = useIslandStore((state) => state.setHover);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const attempt = useRef(0);
  const open = useCallback(async (): Promise<void> => {
    const currentAttempt = ++attempt.current;
    setFailed(false);
    setBusy(true);
    try {
      const opened = await openDesktopWorkspace(tab);
      if (currentAttempt !== attempt.current) return;
      if (opened && useIslandStore.getState().state === 'maxExpand') setHover();
      else setFailed(true);
    } catch { if (currentAttempt === attempt.current) setFailed(true); }
    if (currentAttempt !== attempt.current) return;
    setBusy(false);
  }, [tab, setHover]);
  useEffect(() => { void open(); return () => { attempt.current += 1; }; }, [open]);
  return <section className="lingyu-desktop-launch" onClick={(event) => event.stopPropagation()} aria-label={t('workspace.openDesktop')}>
    <img className="lingyu-brand-icon" src="./svg/lingyu-mark.svg" alt="" />
    <div role="status"><h2>{t(failed ? 'workspace.openFailed' : 'workspace.opening')}</h2><p>{t('workspace.launchHint')}</p></div>
    {failed && <button type="button" className="lingyu-ai-button" disabled={busy} onClick={() => void open()}>{t('workspace.retry')}</button>}
    <button type="button" className="lingyu-desktop-launch-close" aria-label={t('workspace.backToIsland')} onClick={setHover}><span aria-hidden="true">×</span></button>
  </section>;
}
