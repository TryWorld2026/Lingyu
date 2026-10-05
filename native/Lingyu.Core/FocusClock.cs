/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file FocusClock.cs @description 可在后台继续计时的专注时钟。 @author 灵屿
 */
namespace Lingyu.Core;

/// <summary>一轮专注的持久状态；截止时间用 UTC，关闭提醒不会删除完成记录。</summary>
public sealed record FocusSession(Guid Id, int DurationSeconds, int RemainingSeconds,
  DateTimeOffset? Deadline, DateTimeOffset? CompletedAt = null, bool CompletionDismissed = false);

/// <summary>专注时钟以截止时间为准，避免把回调次数当作经过的时间。</summary>
public sealed class FocusClock(TimeProvider? time = null)
{
  private readonly TimeProvider timeProvider = time ?? TimeProvider.System;
  private FocusSession? session;
  /// <summary>供原子保存使用的会话快照，运行时仍以截止时间为准。</summary>
  public FocusSession? Snapshot => session is null ? null : session with { RemainingSeconds = RemainingSeconds };
  /// <summary>本轮时长，尚未开始时为 25 分钟。</summary>
  public int DurationSeconds => session?.DurationSeconds ?? 1500;
  /// <summary>运行或暂停中的会话。</summary>
  public bool IsActive => session is { CompletedAt: null };
  /// <summary>本轮是否已经结束。</summary>
  public bool IsCompleted => session?.CompletedAt is not null;
  /// <summary>完成后保留一条提醒，直到用户关闭或开始下一轮。</summary>
  public bool HasCompletionNotice => IsCompleted && !session!.CompletionDismissed;
  /// <summary>是否正在计时。</summary>
  public bool IsRunning => session?.Deadline is not null;
  /// <summary>距离截止时间的剩余秒数。</summary>
  public int RemainingSeconds => session?.Deadline is { } end
    ? (int)Math.Clamp(Math.Ceiling((end - timeProvider.GetUtcNow()).TotalSeconds), 0, DurationSeconds)
    : session?.RemainingSeconds ?? 1500;
  /// <summary>恢复有效快照；旧配置没有专注字段，损坏的专注记录也回到待开始状态。</summary>
  public void Restore(FocusSession? saved)
  {
    session = null;
    if (saved is null || saved.Id == Guid.Empty || saved.DurationSeconds is < 1 or > 86400 ||
      saved.RemainingSeconds < 0 || saved.RemainingSeconds > saved.DurationSeconds) return;
    if (saved.CompletedAt is not null)
    { if (saved.Deadline is not null || saved.RemainingSeconds != 0) return; }
    else if (saved.CompletionDismissed || (saved.Deadline is null && saved.RemainingSeconds == 0)) return;
    session = saved;
  }
  /// <summary>开始指定秒数的专注。</summary>
  public void Start(int seconds)
  {
    if (seconds is < 1 or > 86400) throw new ArgumentOutOfRangeException(nameof(seconds));
    session = new(Guid.NewGuid(), seconds, seconds, timeProvider.GetUtcNow().AddSeconds(seconds));
  }
  /// <summary>保留剩余时间并暂停。</summary>
  public void Pause()
  {
    if (!IsRunning || Tick()) return;
    session = session! with { RemainingSeconds = RemainingSeconds, Deadline = null };
  }
  /// <summary>继续暂停的专注。</summary>
  public void Resume()
  {
    if (session is null) Start(1500);
    else if (IsActive && !IsRunning) session = session with { Deadline = timeProvider.GetUtcNow().AddSeconds(RemainingSeconds) };
  }
  /// <summary>检测到期；每一轮最多返回一次完成事件。</summary>
  public bool Tick()
  {
    if (!IsRunning || RemainingSeconds > 0) return false;
    session = session! with { CompletedAt = session!.Deadline, Deadline = null, RemainingSeconds = 0 };
    return true;
  }
  /// <summary>确认本轮完成；重启不会再次展示已关闭的提醒。</summary>
  public void DismissCompletion() { if (HasCompletionNotice) session = session! with { CompletionDismissed = true }; }
  /// <summary>结束并恢复默认时长。</summary>
  public void Reset() => session = null;
}
