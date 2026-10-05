/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file MediaService.cs @description 直接订阅 Windows SMTC，不启动辅助进程。 @author 灵屿
 */
using Lingyu.Core;
using Windows.Media.Control;
using Windows.Storage.Streams;

namespace Lingyu.Platform.Windows;

/// <summary>事件驱动的系统音乐适配器。</summary>
public sealed class MediaService : IDisposable
{
  private GlobalSystemMediaTransportControlsSessionManager? manager;
  private GlobalSystemMediaTransportControlsSession? session;
  private int revision;
  private bool disposed;
  private byte[]? artwork;
  private string artworkKey = "";
  /// <summary>当前选择；空值跟随系统当前会话。</summary>
  public string SelectedPlayer { get; private set; } = "";
  /// <summary>当前实际存在的系统媒体会话。</summary>
  public IReadOnlyList<string> Players
  {
    get {
      try { return manager?.GetSessions().Select(value => value.SourceAppUserModelId).Distinct().ToArray() ?? []; }
      catch (Exception error) when (error is System.Runtime.InteropServices.COMException or InvalidOperationException) { return []; }
    }
  }
  /// <summary>新的系统快照；接收方负责切到自身界面线程。</summary>
  public event Action<MediaSnapshot>? Changed;
  /// <summary>最新可用数据。</summary>
  public MediaSnapshot Snapshot { get; private set; } = MediaSnapshot.Empty;

  /// <summary>连接当前用户的系统媒体会话。</summary>
  public async Task StartAsync()
  {
    try
    {
      manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
      if (disposed) return;
      manager.CurrentSessionChanged += OnCurrentChanged;
      manager.SessionsChanged += OnSessionsChanged;
      AttachCurrent();
    }
    catch (Exception error) when (error is System.Runtime.InteropServices.COMException or InvalidOperationException)
    { Publish(MediaSnapshot.Empty); }
  }

  private void OnCurrentChanged(GlobalSystemMediaTransportControlsSessionManager sender, CurrentSessionChangedEventArgs args) => AttachCurrent();
  private void OnSessionsChanged(GlobalSystemMediaTransportControlsSessionManager sender, SessionsChangedEventArgs args) => AttachCurrent();
  /// <summary>选择播放器，不存在时发布明确的空状态。</summary>
  public void SelectPlayer(string source) { SelectedPlayer = source; AttachCurrent(); }
  private void OnPropertiesChanged(GlobalSystemMediaTransportControlsSession sender, MediaPropertiesChangedEventArgs args) => _ = RefreshAsync();
  private void OnPlaybackChanged(GlobalSystemMediaTransportControlsSession sender, PlaybackInfoChangedEventArgs args) => _ = RefreshAsync();
  private void OnTimelineChanged(GlobalSystemMediaTransportControlsSession sender, TimelinePropertiesChangedEventArgs args) => _ = RefreshAsync();

  private void AttachCurrent()
  {
    Detach();
    if (disposed) return;
    try { session = SelectedPlayer.Length == 0 ? manager?.GetCurrentSession() : manager?.GetSessions().FirstOrDefault(value => value.SourceAppUserModelId == SelectedPlayer); }
    catch (Exception error) when (error is System.Runtime.InteropServices.COMException or InvalidOperationException) { Publish(MediaSnapshot.Empty); return; }
    if (session is null) { Publish(MediaSnapshot.Empty); return; }
    session.MediaPropertiesChanged += OnPropertiesChanged;
    session.PlaybackInfoChanged += OnPlaybackChanged;
    session.TimelinePropertiesChanged += OnTimelineChanged;
    _ = RefreshAsync();
  }

  private async Task RefreshAsync()
  {
    var current = session;
    int ticket = Interlocked.Increment(ref revision);
    if (current is null || disposed) return;
    try
    {
      var info = await current.TryGetMediaPropertiesAsync();
      var playback = current.GetPlaybackInfo();
      var timeline = current.GetTimelineProperties();
      string key = $"{current.SourceAppUserModelId}|{info.Title}|{info.Artist}";
      if (key != artworkKey || artwork is null && info.Thumbnail is not null)
      {
        byte[]? next = null;
        if (info.Thumbnail is not null)
        {
          using var stream = await info.Thumbnail.OpenReadAsync();
          if (stream.Size is > 0 and <= 4 * 1024 * 1024)
          {
            using var reader = new DataReader(stream.GetInputStreamAt(0));
            uint loaded = await reader.LoadAsync((uint)stream.Size);
            next = new byte[loaded]; reader.ReadBytes(next);
          }
        }
        if (ticket != revision || disposed) return;
        artwork = next; artworkKey = key;
      }
      if (ticket != revision || disposed) return;
      var controls = playback.Controls;
      Publish(new MediaSnapshot(info.Title, info.Artist, current.SourceAppUserModelId,
        playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,
        controls.IsPlayPauseToggleEnabled || (playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing ? controls.IsPauseEnabled : controls.IsPlayEnabled), controls.IsPreviousEnabled, controls.IsNextEnabled,
        controls.IsPlaybackPositionEnabled, timeline.Position, timeline.EndTime,
        timeline.LastUpdatedTime, artwork));
    }
    catch (Exception error) when (error is System.Runtime.InteropServices.COMException or InvalidOperationException)
    { if (ticket == revision && !disposed) Publish(MediaSnapshot.Empty); }
  }

  private void Publish(MediaSnapshot value)
  {
    if (disposed) return;
    Snapshot = value;
    Changed?.Invoke(value);
  }

  /// <summary>发送系统支持的媒体操作，并返回真实结果。</summary>
  public async Task<bool> ControlAsync(string action, double fraction = 0)
  {
    var current = session;
    if (current is null || disposed) return false;
    try
    {
      return action switch
      {
        "toggle" when Snapshot.CanPlay && current.GetPlaybackInfo().Controls.IsPlayPauseToggleEnabled => await current.TryTogglePlayPauseAsync(),
        "toggle" when Snapshot.CanPlay && Snapshot.Playing => await current.TryPauseAsync(),
        "toggle" when Snapshot.CanPlay => await current.TryPlayAsync(),
        "previous" when Snapshot.CanPrevious => await current.TrySkipPreviousAsync(),
        "next" when Snapshot.CanNext => await current.TrySkipNextAsync(),
        "seek" when Snapshot.CanSeek => await current.TryChangePlaybackPositionAsync(
          (long)(Snapshot.Duration.Ticks * Math.Clamp(fraction, 0, 1))),
        _ => false,
      };
    }
    catch (System.Runtime.InteropServices.COMException) { return false; }
  }

  private void Detach()
  {
    Interlocked.Increment(ref revision);
    if (session is null) return;
    session.MediaPropertiesChanged -= OnPropertiesChanged;
    session.PlaybackInfoChanged -= OnPlaybackChanged;
    session.TimelinePropertiesChanged -= OnTimelineChanged;
    session = null;
  }

  /// <summary>解除所有系统订阅。</summary>
  public void Dispose()
  {
    disposed = true;
    if (manager is not null) { manager.CurrentSessionChanged -= OnCurrentChanged; manager.SessionsChanged -= OnSessionsChanged; }
    Detach(); manager = null; artwork = null;
  }
}
