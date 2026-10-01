/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file MediaSnapshot.cs @description 系统媒体的不可变显示数据。 @author 灵屿
 */
namespace Lingyu.Core;

/// <summary>只携带系统实际提供的媒体数据和控制能力。</summary>
public sealed record MediaSnapshot(string Title, string Artist, string Source, bool Playing,
  bool CanPlay, bool CanPrevious, bool CanNext, bool CanSeek,
  TimeSpan Position, TimeSpan Duration, DateTimeOffset CapturedAt, byte[]? Artwork)
{
  /// <summary>没有媒体会话时的初始状态。</summary>
  public static MediaSnapshot Empty { get; } = new("", "", "", false, false, false, false, false,
    TimeSpan.Zero, TimeSpan.Zero, DateTimeOffset.UtcNow, null);

  /// <summary>根据采集时间推算进度，并限制在合法区间。</summary>
  public TimeSpan PositionAt(DateTimeOffset now) => TimeSpan.FromSeconds(Math.Clamp(
    Position.TotalSeconds + (Playing ? Math.Max(0, (now - CapturedAt).TotalSeconds) : 0),
    0, Math.Max(0, Duration.TotalSeconds)));
}
