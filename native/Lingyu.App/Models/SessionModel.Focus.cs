/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file SessionModel.Focus.cs @description 专注恢复与只确认一次的完成提醒。 @author 灵屿
 */
using System.Globalization;
using Lingyu.App.Localization;

namespace Lingyu.App.Models;

public sealed partial class SessionModel
{
  private bool FocusPresented => Clock.IsActive || Clock.HasCompletionNotice;
  /// <summary>剩余专注时间。</summary>
  public string FocusTime => $"{Clock.RemainingSeconds / 60:00}:{Clock.RemainingSeconds % 60:00}";
  /// <summary>运行时显示剩余比例，完成后闭合圆环。</summary>
  public double FocusProgress => Clock.IsCompleted ? 1 : Clock.RemainingSeconds / (double)Clock.DurationSeconds;
  /// <summary>专注状态文字。</summary>
  public string FocusLabel => TextCatalog.T(Clock.IsCompleted ? "focusDone" : Clock.IsRunning ? "focusRunning" : Clock.IsActive ? "focusPaused" : "focusIdle");
  /// <summary>圆环内的简短状态，避免长句越过环边。</summary>
  public string FocusRingLabel => Clock.IsCompleted ? TextCatalog.T("focusCompleted") : FocusLabel;
  /// <summary>完成时间来自本轮截止时间，退出后回来也不冒充刚刚完成。</summary>
  public string FocusDetail => Clock.Snapshot?.CompletedAt is { } completed
    ? string.Format(CultureInfo.GetCultureInfo(TextCatalog.Current.Language), TextCatalog.T("focusCompletedDetail"), completed.ToLocalTime(), Clock.DurationSeconds / 60)
    : TextCatalog.T("timeCaption");
  /// <summary>专注按钮文字。</summary>
  public string FocusAction => TextCatalog.T(Clock.IsCompleted ? "focusAgain" : Clock.IsRunning ? "focusPause" : Clock.IsActive ? "focusResume" : "focusStart");
  /// <summary>完成提醒可关闭；运行中的会话可结束。</summary>
  public string FocusEndAction => TextCatalog.T(Clock.IsCompleted ? "focusDismiss" : "focusReset");
  /// <summary>专注的实际状态图标。</summary>
  public string FocusPlayGlyph => Clock.IsRunning ? "pause" : "play";
  /// <summary>完成时使用关闭图标，与结束计时区分。</summary>
  public string FocusEndGlyph => Clock.IsCompleted ? "close" : "stop";
  /// <summary>开始、暂停或继续；恰好到期的点击先显示完成提醒。</summary>
  public void ToggleFocus()
  {
    if (CompleteFocus()) return;
    if (Clock.IsRunning) Clock.Pause(); else if (Clock.IsActive) Clock.Resume(); else Clock.Start(Clock.DurationSeconds);
    SaveFocus(); NotifyFocus();
  }
  /// <summary>选择本轮专注时长，新会话替换上一轮提醒。</summary>
  public void StartFocus(int minutes = 25)
  { Clock.Start(Math.Clamp(minutes, 1, 180) * 60); SaveFocus(); NotifyFocus(); }
  /// <summary>结束本轮并清除恢复状态。</summary>
  public void ResetFocus() { Clock.Reset(); SaveFocus(); NotifyFocus(); }
  /// <summary>关闭完成提醒，保留已确认记录；重启不再显示。</summary>
  public void DismissFocusCompletion() { Clock.DismissCompletion(); SaveFocus(); NotifyFocus(); }
  /// <summary>次要操作根据当前状态关闭提醒或结束计时。</summary>
  public void EndFocus() { if (Clock.IsCompleted) DismissFocusCompletion(); else ResetFocus(); }
  private bool CompleteFocus()
  {
    if (!Clock.Tick()) return false;
    SaveFocus(); NotifyFocus(); Emit("focusDone");
    if (!Quiet) System.Media.SystemSounds.Asterisk.Play();
    return true;
  }
  private void SaveFocus() { state = state with { Focus = Clock.Snapshot }; Persist(); }
  private void NotifyFocus() => Notify(nameof(FocusTime), nameof(FocusProgress), nameof(FocusLabel), nameof(FocusRingLabel), nameof(FocusDetail),
    nameof(FocusAction), nameof(FocusEndAction), nameof(FocusPlayGlyph), nameof(FocusEndGlyph), nameof(IslandLabel), nameof(IslandHoverLabel), nameof(IslandGlyph), nameof(IslandActivity), nameof(IslandSubLabel));
}
