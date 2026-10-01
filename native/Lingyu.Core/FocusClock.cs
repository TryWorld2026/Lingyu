/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file FocusClock.cs @description 可在后台继续计时的专注时钟。 @author 灵屿
 */
namespace Lingyu.Core;

/// <summary>专注时钟以截止时间为准，避免把回调次数当作经过的时间。</summary>
public sealed class FocusClock(TimeProvider? time = null)
{
  private readonly TimeProvider timeProvider = time ?? TimeProvider.System;
  private DateTimeOffset? deadline;
  private int remaining = 1500;
  /// <summary>是否正在计时。</summary>
  public bool IsRunning => deadline.HasValue;
  /// <summary>距离截止时间的剩余秒数。</summary>
  public int RemainingSeconds => deadline is { } end
    ? Math.Max(0, (int)Math.Ceiling((end - timeProvider.GetUtcNow()).TotalSeconds)) : remaining;
  /// <summary>开始指定秒数的专注。</summary>
  public void Start(int seconds)
  {
    if (seconds is < 1 or > 86400) throw new ArgumentOutOfRangeException(nameof(seconds));
    remaining = seconds;
    deadline = timeProvider.GetUtcNow().AddSeconds(seconds);
  }
  /// <summary>保留剩余时间并暂停。</summary>
  public void Pause()
  {
    if (!IsRunning) return;
    remaining = RemainingSeconds;
    deadline = null;
  }
  /// <summary>继续暂停的专注。</summary>
  public void Resume()
  {
    if (!IsRunning && remaining > 0) deadline = timeProvider.GetUtcNow().AddSeconds(remaining);
  }
  /// <summary>检测到期；每一轮最多返回一次完成事件。</summary>
  public bool Tick()
  {
    if (!IsRunning || RemainingSeconds > 0) return false;
    deadline = null;
    remaining = 0;
    return true;
  }
  /// <summary>结束并恢复默认时长。</summary>
  public void Reset() { deadline = null; remaining = 1500; }
}
