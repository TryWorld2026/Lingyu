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
 * @file SongTab.tsx
 * @description 专用音乐面板：封面、播放进度与控制、同步及逐字歌词。
 * @author 灵屿
 */

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../store/slices';
import type { SyncedLyricLine, SyncedLyricSyllable } from '../../../../store/types';
import { SvgIcon } from '../../../../utils/SvgIcon';

/** 显示歌词行数 */
const VISIBLE_LINES = 5;

// ===================== 工具函数 =====================

function findCurrentIndex(lyrics: SyncedLyricLine[], posMs: number): number {
  if (lyrics.length === 0 || posMs < lyrics[0].time_ms) return -1;
  let lo = 0;
  let hi = lyrics.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lyrics[mid].time_ms <= posMs) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function sliceNearby(
  lyrics: SyncedLyricLine[],
  idx: number,
): { text: string; isCurrent: boolean; key: string }[] {
  const half = Math.floor(VISIBLE_LINES / 2);
  const result: { text: string; isCurrent: boolean; key: string }[] = [];
  for (let offset = -half; offset <= half; offset++) {
    const i = idx + offset;
    if (i >= 0 && i < lyrics.length) {
      result.push({ text: lyrics[i].text, isCurrent: offset === 0, key: `${i}` });
    } else {
      result.push({ text: '', isCurrent: false, key: `pad_${offset}` });
    }
  }
  return result;
}

// ===================== 歌词文本轮播组件 =====================

/**
 * 歌词文本轮播
 * @description 文本超出容器时自动从右向左滚动，停顿后循环
 */
function MarqueeLyricText({ children }: { children: React.ReactNode }): React.ReactElement {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  const measure = useCallback(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) { setOverflow(0); return; }
    const diff = inner.scrollWidth - outer.clientWidth;
    setOverflow(diff > 1 ? diff : 0);
  }, []);

  useEffect(() => {
    measure();
  }, [children, measure]);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div ref={outerRef} className="ov-lrc-marquee-wrap">
      <span
        ref={innerRef}
        className={overflow > 0 ? 'ov-lrc-marquee-inner scrolling' : 'ov-lrc-marquee-inner'}
        style={overflow > 0 ? { '--marquee-dist': `${-overflow}px`, '--marquee-dur': `${Math.max(3, overflow / 30)}s` } as React.CSSProperties : undefined}
      >
        {children}
      </span>
    </div>
  );
}

// ===================== 逐字扫光组件 =====================

/**
 * 当前行逐字扫光渲染 — 按音节真实 start/duration 计算每个音节独立进度
 * @description 移植自 lyricify-lyrics-provider-rs 的音节时间模型,每个音节以 `--syl-prog` 控制渐变
 * @param syllables - 音节数组(相对偏移 + 持续时长)
 * @param lineStartMs - 行起始绝对毫秒
 * @param posMs - 当前播放位置(绝对毫秒)
 */
function KaraokeSyllableLine({
  syllables,
  lineStartMs,
  posMs,
}: {
  syllables: SyncedLyricSyllable[];
  lineStartMs: number;
  posMs: number;
}): React.ReactElement {
  return (
    <>
      {syllables.map((syl, i) => {
        const sylStart = lineStartMs + syl.start_offset_ms;
        const sylEnd = sylStart + syl.duration_ms;
        let prog = 0;
        if (posMs >= sylEnd) prog = 1;
        else if (posMs > sylStart && syl.duration_ms > 0) {
          prog = (posMs - sylStart) / syl.duration_ms;
        }
        return (
          <span
            key={i}
            className="ov-lrc-syllable"
            style={{ '--syl-prog': `${(prog * 100).toFixed(2)}%` } as React.CSSProperties}
          >
            {syl.text}
          </span>
        );
      })}
    </>
  );
}


/**
 * 渲染重新设计的专用音乐面板；保留 SMTC 控制和同步歌词。
 * @returns 完整的播放器与歌词视图。
 */
export function SongTab(): React.ReactElement {
  const { t } = useTranslation();
  const { isMusicPlaying, isPlaying, mediaInfo, syncedLyrics, lyricsLoading, coverImage, currentPositionMs, currentDurationMs } = useIslandStore();
  const [karaokeEnabled, setKaraokeEnabled] = useState(false);
  const [controlFailed, setControlFailed] = useState(false);

  useEffect(() => {
    window.api.musicLyricsKaraokeGet().then(setKaraokeEnabled).catch(() => {});
  }, []);

  const currentIdx = useMemo(() => findCurrentIndex(syncedLyrics || [], currentPositionMs), [syncedLyrics, currentPositionMs]);
  const hasLyrics = !!syncedLyrics?.length && !lyricsLoading;
  const lines = useMemo(() => hasLyrics ? sliceNearby(syncedLyrics!, Math.max(0, currentIdx)) : [], [hasLyrics, syncedLyrics, currentIdx]);
  const currentLine = currentIdx >= 0 ? syncedLyrics?.[currentIdx] : null;
  const duration = Math.max(0, currentDurationMs || mediaInfo.duration_ms || 0);
  const position = Math.max(0, Math.min(currentPositionMs, duration));
  const formatPosition = (milliseconds: number): string => Math.floor(milliseconds / 60000) + ':' + Math.floor(milliseconds / 1000 % 60).toString().padStart(2, '0');
  const control = (action: () => Promise<void>): void => {
    setControlFailed(false);
    void action().catch(() => setControlFailed(true));
  };

  return (
    <section className="lingyu-player" aria-label={t('songTab.onboarding.title')}>
      <div className="lingyu-player-cover" style={coverImage ? { backgroundImage: 'url(' + coverImage + ')' } : undefined}>
        {!coverImage && <img className="lingyu-brand-icon" src="./svg/lingyu-mark.svg" alt="" />}
      </div>
      <div className="lingyu-player-body">
        <div className="lingyu-player-heading">
          <div><h2>{mediaInfo.title || t('songTab.meta.notPlaying')}</h2><p>{mediaInfo.artist || t('songTab.onboarding.hint')}</p></div>
          <div className={'lingyu-equalizer' + (isPlaying ? ' playing' : '')} aria-hidden="true">
            {[7, 13, 22, 31, 19, 37, 26, 15, 29, 19, 12, 5].map((height, index) => <span key={height + '-' + index} style={{ height, animationDelay: index * -0.11 + 's' }} />)}
          </div>
        </div>
        <div className="lingyu-player-timeline">
          <input type="range" min={0} max={Math.max(1, duration)} step={1000} value={position}
            aria-label={t('songTab.controls.seek')} disabled={!isMusicPlaying || !duration}
            style={{ '--player-progress': (duration ? position / duration * 100 : 0) + '%' } as React.CSSProperties}
            onChange={(event) => control(() => window.api.mediaSeek(Number(event.target.value)))} />
          <div><time>{formatPosition(position)}</time><time>{formatPosition(duration)}</time></div>
        </div>
        <div className="lingyu-player-footer">
          <div className="lingyu-player-lyrics" aria-live="off">
            {lyricsLoading && <p>{t('songTab.lyrics.loading')}</p>}
            {!lyricsLoading && !hasLyrics && <p>{t(isMusicPlaying ? 'songTab.lyrics.empty' : 'songTab.onboarding.desc')}</p>}
            {lines.slice(1, 4).filter((line) => line.text).map((line) => <div className={'lingyu-player-line' + (line.isCurrent ? ' current' : '')} key={line.key}>
              <MarqueeLyricText>{line.isCurrent && karaokeEnabled && currentLine?.syllables?.length ? <KaraokeSyllableLine
                syllables={currentLine.syllables} lineStartMs={currentLine.time_ms} posMs={currentPositionMs} /> : line.text}</MarqueeLyricText>
            </div>)}
          </div>
          <div className="lingyu-player-controls">
            <button type="button" disabled={!isMusicPlaying} aria-label={t('songTab.controls.prev')} onClick={() => control(() => window.api.mediaPrev())}>
              <img className="workspace-icon" src={SvgIcon.PREVIOUS_SONG} alt="" />
            </button>
            <button type="button" className="lingyu-player-play" disabled={!isMusicPlaying} aria-label={t(isPlaying ? 'songTab.controls.pause' : 'songTab.controls.play')} onClick={() => control(() => window.api.mediaPlayPause())}>
              <img className="workspace-icon" src={isPlaying ? SvgIcon.PAUSE : SvgIcon.CONTINUE} alt="" />
            </button>
            <button type="button" disabled={!isMusicPlaying} aria-label={t('songTab.controls.next')} onClick={() => control(() => window.api.mediaNext())}>
              <img className="workspace-icon" src={SvgIcon.NEXT_SONG} alt="" />
            </button>
          </div>
        </div>
        {controlFailed && <p className="lingyu-player-feedback" role="alert">{t('songTab.controls.failed')}</p>}
      </div>
    </section>
  );
}
