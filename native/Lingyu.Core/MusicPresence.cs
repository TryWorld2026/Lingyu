/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file MusicPresence.cs @description 音乐暂停缓冲与空闲收敛，使用调用方的单调时钟。 @author 灵屿
 */
namespace Lingyu.Core;

/// <summary>暂停后保留一分钟；重复快照不延长缓冲。</summary>
public sealed class MusicPresence
{
  private string key = "";
  private bool playing;
  private double? pausedUntil;
  /// <summary>下一次需要重新检查呈现的单调时间；播放或无会话时没有截止时间。</summary>
  public double? Deadline => pausedUntil;
  /// <summary>应用当前会话身份和播放状态；移除会话会立即清空。</summary>
  public void Update(string mediaKey, bool isPlaying, double seconds)
  {
    if (mediaKey.Length == 0) { key = ""; playing = false; pausedUntil = null; return; }
    if (isPlaying) pausedUntil = null;
    else if (key != mediaKey || playing) pausedUntil = seconds + 60;
    key = mediaKey; playing = isPlaying;
  }
  /// <summary>是否仍应显示音乐紧凑态；操作保护由窗口处理。</summary>
  public bool IsVisible(double seconds) => key.Length > 0 && (playing || pausedUntil is { } end && seconds < end);
}
