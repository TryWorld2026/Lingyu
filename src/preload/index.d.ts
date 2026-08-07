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
 * @file index.d.ts
 * @description 渲染进程全局类型声明，扩展 Window 接口以包含 Electron API 和自定义 API
 * @author 灵屿
 */

import { ElectronAPI } from '@electron-toolkit/preload';
import type {
  Point,
  Bounds,
  IslandDisplayInfo,
  SearchLocalFilesOptions,
  SearchLocalFileResult,
  SaveTextFilePayload,
  SaveTextFileResult,
  ComputeFileHashResult,
        ChatEvent,
  ChatStartResult,
  ChatAbortResult,
    NowPlayingInfo,
  SmtcTimestampResult,
  DetectSourceAppIdResult,
    SaveImageAsResult,
  ResolveShortcutResult,
  ExtractVideoTrackOptions,
  ExtractVideoTrackResult,
  PickVideoForExtractResult,
  NetFetchOptions,
  NetFetchResult,
  NavOrderPayload,
  SetWallpaperPayload,
    UpdaterCheckResult,
  UpdaterProgress,
  UpdaterDownloadedData,
  UpdaterAvailableData,
  UpdaterNotAvailableData,
  UpdaterStartupAutoCheckRequestData,
  ClipboardUrlsDetectedData,
    RunningProcessInfo,
  RunningWindowInfo,
  PerformanceHardwareSelection,
  PerformanceSnapshot,
  BluetoothDeviceInfo,
  WifiInfo,
        } from './types';

declare global {
  interface Window {
    electron: ElectronAPI;
    api: {
      enableMousePassthrough: () => void;
      disableMousePassthrough: () => void;
      expandWindow: () => void;
      expandWindowNotification: () => void;
      expandWindowLyrics: () => void;
      expandWindowLyricsTranslation: () => void;
      expandWindowFull: () => void;
      expandWindowSettings: () => void;
      collapseWindow: () => void;
      hideWindow: () => void;
      moveWindowDelta: (dx: number, dy: number) => void;
      getMousePosition: () => Promise<Point>;
      getWindowBounds: () => Promise<Bounds>;
      getIslandDisplays: () => Promise<IslandDisplayInfo[]>;
      getIslandDisplaySelection: () => Promise<string>;
      setIslandDisplaySelection: (selection: string) => Promise<boolean>;
      getIslandPositionOffset: () => Promise<Point>;
      setIslandPositionOffset: (offset: Point) => Promise<boolean>;
      onIslandPositionOffsetChanged: (callback: (offset: Point) => void) => () => void;
      quitApp: () => void;
      restartApp: () => Promise<boolean>;
      openLogsFolder: () => Promise<boolean>;
      pickFeedbackLogFile: () => Promise<string | null>;
      pickFeedbackScreenshotFile: () => Promise<string | null>;
      pickLocalSearchDirectory: () => Promise<string | null>;
      pickSkillFile: () => Promise<string | null>;
      readTextFile: (filePath: string) => Promise<string | null>;
      saveTextFile: (payload: SaveTextFilePayload) => Promise<SaveTextFileResult>;
      searchLocalFiles: (
        rootDir: string,
        keyword: string,
        options?: SearchLocalFilesOptions,
      ) => Promise<SearchLocalFileResult[]>;
      clearLogsCache: () => Promise<{ success: boolean; freedBytes: number }>;
      windowMinimize: () => void;
      windowMaximize: () => void;
      windowClose: () => void;
      openStandaloneWindow: () => Promise<boolean>;
      closeStandaloneWindow: () => Promise<boolean>;
      mediaPlayPause: () => Promise<void>;
      mediaNext: () => Promise<void>;
      mediaPrev: () => Promise<void>;
      mediaSeek: (positionMs: number) => Promise<void>;
      mediaGetVolume: () => Promise<number>;
      mediaSetVolume: (volume: number) => Promise<void>;
      mediaGetMuted: () => Promise<boolean | null>;
      mediaToggleMuted: () => Promise<boolean | null>;
      mediaCurrentInfoGet: () => Promise<NowPlayingInfo | null>;
      onNowPlayingInfo: (callback: (info: NowPlayingInfo | null) => void) => () => void;
      screenshot: () => Promise<string | null>;
      startRegionScreenshot: () => Promise<boolean>;
      openTaskManager: () => void;
      getPerformanceSnapshot: (
        selection?: PerformanceHardwareSelection,
        includeHardwareOptions?: boolean,
      ) => Promise<PerformanceSnapshot>;
      getBluetoothDevices: () => Promise<BluetoothDeviceInfo[]>;
      getWifiInfo: () => Promise<WifiInfo | null>;
      getPathForFile: (file: File) => string;
      getFileIcon: (filePath: string) => Promise<string | null>;
      openFile: (filePath: string) => Promise<boolean>;
      openInExplorer: (filePath: string) => Promise<boolean>;
      pickFileForHash: () => Promise<string | null>;
      computeFileHash: (filePath: string, algorithm: string) => Promise<ComputeFileHashResult | null>;
      saveImageAs: (sourcePath: string) => Promise<SaveImageAsResult>;
      resolveShortcut: (lnkPath: string) => Promise<ResolveShortcutResult | null>;
      openImageDialog: () => Promise<string | null>;
      openVideoDialog: () => Promise<string | null>;
      openFontDialog: () => Promise<{ path: string; data: string; ext: string; name: string } | null>;
      readFontFile: (filePath: string) => Promise<{ path: string; data: string; ext: string; name: string } | null>;
      loadWallpaperFile: (filePath: string) => Promise<string | null>;
      loadAlbumThumbnail: (filePath: string) => Promise<string | null>;
      clearWallpaperCache: () => Promise<void>;
      setSystemDesktopWallpaper: (payload: SetWallpaperPayload) => Promise<boolean>;
      readLocalFileAsBuffer: (filePath: string) => Promise<Uint8Array | null>;
      pickVideoForExtract: () => Promise<PickVideoForExtractResult | null>;
      extractVideoTrack: (options: ExtractVideoTrackOptions) => Promise<ExtractVideoTrackResult>;
      netFetch: (url: string, options?: NetFetchOptions) => Promise<NetFetchResult>;      storeRead: (key: string) => Promise<unknown>;
      storeWrite: (key: string, data: unknown) => Promise<boolean>;
      hotkeyGet: () => Promise<string>;
      hotkeySet: (accelerator: string) => Promise<boolean>;
      hotkeySuspend: () => Promise<boolean>;
      hotkeyResume: () => Promise<boolean>;
      quitHotkeyGet: () => Promise<string>;
      quitHotkeySet: (accelerator: string) => Promise<boolean>;
      screenshotHotkeyGet: () => Promise<string>;
      screenshotHotkeySet: (accelerator: string) => Promise<boolean>;
      nextSongHotkeyGet: () => Promise<string>;
      nextSongHotkeySet: (accelerator: string) => Promise<boolean>;
      playPauseSongHotkeyGet: () => Promise<string>;
      playPauseSongHotkeySet: (accelerator: string) => Promise<boolean>;
      resetPositionHotkeyGet: () => Promise<string>;
      resetPositionHotkeySet: (accelerator: string) => Promise<boolean>;
      toggleTrayHotkeyGet: () => Promise<string>;
      toggleTrayHotkeySet: (accelerator: string) => Promise<boolean>;
      showSettingsWindowHotkeyGet: () => Promise<string>;
      showSettingsWindowHotkeySet: (accelerator: string) => Promise<boolean>;
      openClipboardHistoryHotkeyGet: () => Promise<string>;
      openClipboardHistoryHotkeySet: (accelerator: string) => Promise<boolean>;
      togglePassthroughHotkeyGet: () => Promise<string>;
      togglePassthroughHotkeySet: (accelerator: string) => Promise<boolean>;
      toggleUiLockHotkeyGet: () => Promise<string>;
      toggleUiLockHotkeySet: (accelerator: string) => Promise<boolean>;
      toggleShapeModeHotkeyGet: () => Promise<string>;
      toggleShapeModeHotkeySet: (accelerator: string) => Promise<boolean>;
      onPassthroughLockChanged: (callback: (locked: boolean) => void) => () => void;
      logWrite: (level: string, message: string) => void;
      musicWhitelistGet: () => Promise<string[]>;
      musicWhitelistSet: (list: string[]) => Promise<boolean>;
      musicLyricsSourceGet: () => Promise<string>;
      musicLyricsSourceSet: (source: string) => Promise<boolean>;
      musicLyricsEnabledGet: () => Promise<boolean>;
      musicLyricsEnabledSet: (enabled: boolean) => Promise<boolean>;
      musicLyricsTranslationEnabledGet: () => Promise<boolean>;
      musicLyricsTranslationEnabledSet: (enabled: boolean) => Promise<boolean>;
      musicLyricsKaraokeGet: () => Promise<boolean>;
      musicLyricsKaraokeSet: (enabled: boolean) => Promise<boolean>;
      musicLyricsClockGet: () => Promise<boolean>;
      musicLyricsClockSet: (enabled: boolean) => Promise<boolean>;
      musicLyricsCalibrateEnabledGet: () => Promise<boolean>;
      musicLyricsCalibrateEnabledSet: (enabled: boolean) => Promise<boolean>;
      musicLyricsCalibrateDelayGet: () => Promise<number>;
      musicLyricsCalibrateDelaySet: (delaySec: number) => Promise<boolean>;
      musicSmtcUnsubscribeMsGet: () => Promise<number>;
      musicSmtcUnsubscribeMsSet: (valueMs: number) => Promise<boolean>;
      musicDetectSourceAppId: () => Promise<DetectSourceAppIdResult>;
      smtcGetTimestamp: () => Promise<SmtcTimestampResult>;
      getRunningNonSystemProcesses: () => Promise<string[]>;
      getRunningNonSystemProcessesWithIcons: () => Promise<RunningProcessInfo[]>;
      getOpenWindowsWithIcons: () => Promise<RunningWindowInfo[]>;
      getFocusedWindow: () => Promise<RunningWindowInfo | null>;
      getBrightness: () => Promise<number | null>;
      setBrightness: (brightness: number) => Promise<boolean>;
      getVolume: () => Promise<number | null>;
      setVolume: (volume: number) => Promise<boolean>;
      hideProcessListGet: () => Promise<string[]>;
      hideProcessListSet: (list: string[]) => Promise<boolean>;
      autoHideFullscreenWindowsGet: () => Promise<boolean>;
      autoHideFullscreenWindowsSet: (enabled: boolean) => Promise<boolean>;
      onSourceSwitchRequest: (callback: (data: { sourceAppId: string; title: string; artist: string }) => void) => () => void;
      mediaAcceptSourceSwitch: () => Promise<void>;
      mediaRejectSourceSwitch: () => Promise<void>;
      themeModeGet: () => Promise<string>;
      themeModeSet: (mode: string) => Promise<boolean>;
      settingsPreview: (channel: string, value: unknown) => Promise<boolean>;
      onSettingsChanged: (callback: (channel: string, value: unknown) => void) => () => void;
      islandOpacityGet: () => Promise<number>;
      islandOpacitySet: (opacity: number) => Promise<boolean>;
      shapeModeGet: () => Promise<string>;
      shapeModeSet: (mode: string) => Promise<boolean>;
      onShapeModeChanged: (callback: (mode: string, targetX: number, targetY: number) => void) => () => void;
      expandMouseleaveIdleGet: () => Promise<boolean>;
      expandMouseleaveIdleSet: (enabled: boolean) => Promise<boolean>;
      maxexpandMouseleaveIdleGet: () => Promise<boolean>;
      maxexpandMouseleaveIdleSet: (enabled: boolean) => Promise<boolean>;
      idleClickExpandGet: () => Promise<boolean>;
      idleClickExpandSet: (enabled: boolean) => Promise<boolean>;
      springAnimationGet: () => Promise<boolean>;
      springAnimationSet: (enabled: boolean) => Promise<boolean>;
      animationSpeedGet: () => Promise<string>;
      animationSpeedSet: (speed: string) => Promise<boolean>;
      clipboardReadText: () => Promise<string>;
      clipboardWriteText: (text: string) => Promise<boolean>;
      clipboardCopyFiles: (paths: string[]) => Promise<boolean>;
      clipboardReadFiles: () => Promise<string[]>;
      systemBatteryGet: () => Promise<{ percent: number; isCharging: boolean; hasBattery: boolean } | null>;
      toastGetAccessStatus: () => Promise<string>;
      toastRequestAccess: () => Promise<string>;
      toastStart: () => Promise<boolean>;
      toastStop: () => Promise<boolean>;
      onSystemToast: (callback: (data: { appName: string; title: string; body: string; createdAt: number }) => void) => () => void;
      onSystemVolumeChanged: (callback: (data: { volume: number; muted: boolean }) => void) => () => void;
      clipboardUrlMonitorGet: () => Promise<boolean>;
      clipboardUrlMonitorSet: (enabled: boolean) => Promise<boolean>;
      clipboardUrlDetectModeGet: () => Promise<'https-only' | 'http-https' | 'domain-only'>;
      clipboardUrlDetectModeSet: (mode: 'https-only' | 'http-https' | 'domain-only') => Promise<boolean>;
      clipboardUrlBlacklistGet: () => Promise<string[]>;
      clipboardUrlBlacklistSet: (list: string[]) => Promise<boolean>;
      clipboardUrlBlacklistAddDomain: (domain: string) => Promise<boolean>;
      autostartGet: () => Promise<string>;
      autostartSet: (mode: string) => Promise<boolean>;
      navOrderGet: () => Promise<NavOrderPayload>;
      navOrderSet: (payload: NavOrderPayload) => Promise<boolean>;
      updaterCheck: (source?: string, resolvedUrl?: string) => Promise<UpdaterCheckResult>;
      updaterDownload: (source?: string, resolvedUrl?: string) => Promise<boolean>;
      updaterInstall: () => Promise<boolean>;
      updaterVersion: () => Promise<string>;
      guideReset: () => Promise<boolean>;
      onGuideShow: (callback: () => void) => () => void;
      onUpdaterProgress: (callback: (progress: UpdaterProgress) => void) => () => void;
      onUpdaterDownloaded: (callback: (data: UpdaterDownloadedData) => void) => () => void;
      onUpdaterAvailable: (callback: (data: UpdaterAvailableData) => void) => () => void;
      onUpdaterNotAvailable: (callback: (data: UpdaterNotAvailableData) => void) => () => void;
      onUpdaterStartupAutoCheckRequest: (callback: (data: UpdaterStartupAutoCheckRequestData) => void) => () => void;
      onClipboardUrlsDetected: (callback: (data: ClipboardUrlsDetectedData) => void) => () => void;
      clipboardOpenUrl: (url: string) => Promise<boolean>;
    };
  }
}
