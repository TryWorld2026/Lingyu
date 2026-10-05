/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file FocusChecks.cs @description 在隔离会话上核实专注恢复、到期与原生提示。 @author 灵屿
 */
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Automation.Provider;
using System.Windows.Controls;
using System.Windows.Interop;
using Lingyu.App.Controls;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.App.Windows;
using Lingyu.Core;

namespace Lingyu.App.Verification;

public static partial class NativeChecks
{
  /// <summary>复现重启与延迟回调，数据只写入指定验收目录。</summary>
  public static async Task RunFocusAsync(App app, string output)
  {
    Directory.CreateDirectory(output); var results = new List<object>(); var errors = new List<string>();
    async Task Check(string name, Func<Task> test)
    { try { await test(); results.Add(new { name, passed = true }); } catch (Exception error) { errors.Add(name + ": " + error.GetBaseException().Message); results.Add(new { name, passed = false }); } }
    void Assert(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
    string Profile() => Path.Combine(output, Guid.NewGuid().ToString("N"));
    await Check("running focus resumes its saved deadline after restart", () => {
      string profile = Profile(); var time = new FocusTime(); using (var first = CreateFocusModel(profile, time)) first.StartFocus(15);
      time.Advance(120); using var restored = CreateFocusModel(profile, time);
      Assert(restored.Clock.IsRunning && restored.Clock.RemainingSeconds == 780 && restored.IslandActivity == "focus", "Restart discarded running session or restarted its duration"); return Task.CompletedTask;
    });
    await Check("paused focus does not elapse while the app is closed", () => {
      string profile = Profile(); var time = new FocusTime();
      using (var first = CreateFocusModel(profile, time)) { first.StartFocus(50); time.Advance(65); first.ToggleFocus(); }
      time.Advance(7200); using var restored = CreateFocusModel(profile, time);
      Assert(!restored.Clock.IsRunning && restored.Clock.RemainingSeconds == 2935 && restored.IslandActivity == "focus", "Paused session was lost or kept counting down while closed");
      restored.ToggleFocus(); time.Advance(5); Assert(restored.Clock.RemainingSeconds == 2930, "Resuming changed paused remainder"); return Task.CompletedTask;
    });
    await Check("completion stays visible and delayed ticks emit only once", () => {
      var time = new FocusTime(); using var model = CreateFocusModel(Profile(), time);
      int notices = 0; model.Notice += text => { if (text == TextCatalog.T("focusDone")) notices++; };
      model.StartFocus(1); time.Advance(400); for (int i = 0; i < 20; i++) model.Tick();
      Assert(notices == 1 && model.IslandActivity == "focus" && model.FocusLabel == TextCatalog.T("focusDone"), "Completed session vanished or was shown as paused instead of completed"); return Task.CompletedTask;
    });
    await Check("focus expiring while closed returns as one pending completion", () => {
      string profile = Profile(); var time = new FocusTime(); using (var first = CreateFocusModel(profile, time)) first.StartFocus(1);
      time.Advance(180); using var restored = CreateFocusModel(profile, time); restored.Tick();
      Assert(!restored.Clock.IsRunning && restored.Clock.RemainingSeconds == 0 && restored.IslandActivity == "focus" && restored.FocusLabel == TextCatalog.T("focusDone"), "Offline completion was lost instead of retained for review"); return Task.CompletedTask;
    });
    await Check("showcase focus never writes sample state", () => {
      string profile = Profile(); using var model = new SessionModel(profile, true, "zh-CN"); model.StartFocus(15); model.ToggleFocus();
      Assert(!File.Exists(Path.Combine(profile, "preview.json")), "Showcase persisted a sample focus session"); return Task.CompletedTask;
    });
    await Check("acknowledgement survives repeated restart without a new completion", () => {
      string profile = Profile(); var time = new FocusTime(); Guid id;
      using (var first = CreateFocusModel(profile, time)) { first.StartFocus(1); id = first.Clock.Snapshot!.Id; }
      time.Advance(90);
      using (var restored = CreateFocusModel(profile, time)) {
        int notices = 0; restored.Notice += _ => notices++; restored.Tick(); restored.Tick();
        Assert(restored.Clock.HasCompletionNotice && restored.Clock.Snapshot!.Id == id && notices == 0, "Offline completion replayed an event or created another round");
        restored.DismissFocusCompletion();
      }
      for (int restart = 0; restart < 3; restart++) {
        using var restored = CreateFocusModel(profile, time); restored.Tick();
        Assert(restored.Clock.IsCompleted && !restored.Clock.HasCompletionNotice && restored.Clock.Snapshot!.Id == id && restored.IslandActivity == "music", "Dismissed reminder reappeared after restart");
      }
      return Task.CompletedTask;
    });
    await Check("timer ticks leave persisted file unchanged until a transition", () => {
      string profile = Profile(); var time = new FocusTime(); using var model = CreateFocusModel(profile, time); model.StartFocus(25);
      string file = Path.Combine(profile, "preview.json"), saved = File.ReadAllText(file); var modified = File.GetLastWriteTimeUtc(file);
      for (int tick = 0; tick < 60; tick++) { time.Advance(1); model.Tick(); }
      Assert(saved == File.ReadAllText(file) && modified == File.GetLastWriteTimeUtc(file), "Display ticks rewrote the profile");
      model.ToggleFocus(); var paused = new PreviewStore(profile).Load().Focus!;
      Assert(paused.Deadline is null && paused.RemainingSeconds == 1440, "Pause did not persist current remainder");
      model.ResetFocus(); using var restored = CreateFocusModel(profile, time);
      Assert(restored.Clock.Snapshot is null && restored.IslandActivity == "music", "Ended session returned after restart"); return Task.CompletedTask;
    });
    await Check("a click at the deadline completes before offering another round", () => {
      var time = new FocusTime(); using var model = CreateFocusModel(Profile(), time); model.StartFocus(1); var id = model.Clock.Snapshot!.Id; time.Advance(60);
      model.ToggleFocus(); Assert(model.Clock.HasCompletionNotice && !model.Clock.IsRunning, "Deadline click silently started another round");
      model.ToggleFocus(); Assert(model.Clock.IsRunning && model.Clock.DurationSeconds == 60 && model.Clock.Snapshot!.Id != id, "Start another did not create the next round"); return Task.CompletedTask;
    });
    foreach (Window existing in app.Windows) existing.Hide();
    GetCursorPos(out var cursor); SetCursorPos(cursor.X, Math.Max(cursor.Y, 900));
    var visualTime = new FocusTime();
    using var visual = new SessionModel(Profile(), true, "zh-CN", visualTime) { Quiet = true };
    var workspace = new WorkspaceWindow(visual, () => { });
    var island = new IslandWindow(visual, page => { workspace.Navigate(page); workspace.Show(); workspace.Activate(); });
    try {
      island.Show(); island.Left = 80; island.Top = 25; island.Width = 680;
      workspace.Show(); workspace.Left = 60; workspace.Top = 290; workspace.Width = 1000; workspace.Height = 640; workspace.Navigate("ai");
      BringToFront(workspace); await Task.Delay(150);
      var input = Find<TextBox>(workspace, "AiInput")!; input.Focus(); input.Text = "Focus completion preserves this draft"; input.Select(6, 10);
      visual.StartFocus(15); visualTime.Advance(185); visual.Tick(); island.SetShape(IslandShape.Expanded); await Task.Delay(400);
      Capture(island, Path.Combine(output, "focus-running-zh-CN.png")); CaptureComposed(island, Path.Combine(output, "desktop-focus-running.png"));
      island.Hide(); visualTime.Advance(1000); visual.Tick(); island.Show(); await Task.Delay(250);
      await Check("completion preserves foreground input and draft while island returns", () => {
        Assert(GetForegroundWindow() == new WindowInteropHelper(workspace).Handle && input.IsKeyboardFocused && input.Text == "Focus completion preserves this draft" && input.SelectionStart == 6 && input.SelectionLength == 10, "Completion stole foreground, replaced input or reset its selection");
        Assert(visual.Clock.HasCompletionNotice && island.IsVisible, "Hidden island lost its pending completion"); return Task.CompletedTask;
      });
      foreach (string language in new[] { "zh-CN", "en-US" }) {
        visual.SetLanguage(language); workspace.Navigate("focus"); workspace.Width = 480; workspace.Height = 740; await Task.Delay(120);
        await Check("workspace exposes completion and dismiss action " + language, () => {
          var end = Find<Button>(workspace, "FocusEnd")!;
          Assert((string)end.Content == TextCatalog.T("focusDismiss") && TextFor(workspace, "FocusLabel").Text == TextCatalog.T("focusDone") && TextFor(workspace, "FocusDetail").Text.Contains("15"), "Completion detail or dismiss action did not localize");
          var ring = Descendants<FocusRing>(workspace).Single(); Assert(!Bounds(end, workspace).IntersectsWith(Bounds(ring, workspace)), "Dismiss action overlaps the completion ring"); return Task.CompletedTask;
        });
        Capture(workspace, Path.Combine(output, "focus-workspace-" + language + "-480.png"));
        foreach (double width in new[] { 680d, 480, 360 }) {
          island.Width = width; island.SetShape(IslandShape.Expanded); await Task.Delay(350); island.UpdateLayout();
          await Check("completed island fits and localizes " + language + "-" + width, () => {
            var panel = (Grid)island.FindName("FocusExpanded"); var ring = Descendants<FocusRing>(panel).Single(); var dial = Bounds(ring, panel);
            Assert(visual.FocusProgress == 1 && TextFor(panel, "FocusRingLabel").Text == TextCatalog.T("focusCompleted"), "Completion ring still reports a paused countdown");
            foreach (var button in Descendants<Button>(panel).Where(button => button.IsVisible)) {
              var rect = Bounds(button, panel); Assert(rect.Left >= 0 && rect.Right <= panel.ActualWidth + 1 && rect.Top >= 0 && rect.Bottom <= panel.ActualHeight + 1 && !rect.IntersectsWith(dial), "Action is clipped or overlaps the ring");
              Assert(!string.IsNullOrEmpty(AutomationProperties.GetName(button)), "Action lacks its accessible name");
            }
            foreach (var text in Descendants<TextBlock>(panel).Where(text => text.IsVisible)) {
              var rect = Bounds(text, panel); Assert(rect.Left >= 0 && rect.Right <= panel.ActualWidth + 1 && rect.Top >= 0 && rect.Bottom <= panel.ActualHeight + 1, "Completed text leaves the capsule");
            }
            return Task.CompletedTask;
          });
          Capture(island, Path.Combine(output, "focus-complete-" + language + "-" + width + ".png"));
          if (width == 680) CaptureComposed(island, Path.Combine(output, "desktop-focus-complete-" + language + ".png"));
        }
        island.Width = 680; island.SetShape(IslandShape.Docked); await Task.Delay(300);
        await Check("docked completion stays visible " + language, () => {
          Assert(TextFor((Grid)island.FindName("Docked"), "IslandLabel").Text == TextCatalog.T("focusCompleted") && ((Glyph)island.FindName("ActivityIcon")).Kind == "check", "Docked completion returned to music or retained the timer glyph"); return Task.CompletedTask;
        });
        Capture(island, Path.Combine(output, "focus-docked-" + language + ".png"));
        island.SetShape(IslandShape.Hover); await Task.Delay(300);
        await Check("hover completion has a discoverable dismiss action " + language, () => {
          var end = Find<Button>(island, "HoverFocusEnd")!;
          Assert(end.IsEnabled && (string)end.ToolTip == TextCatalog.T("focusDismiss") && AutomationProperties.GetName(end) == TextCatalog.T("focusDismiss"), "Hover dismiss action is missing or stale"); return Task.CompletedTask;
        });
        Capture(island, Path.Combine(output, "focus-hover-" + language + ".png"));
      }
      await Check("native hover dismiss returns to underlying activity", async () => {
        InvokeFocusButton(Find<Button>(island, "HoverFocusEnd")!); await Task.Delay(400);
        Assert(visual.IslandActivity == "music" && !visual.Clock.HasCompletionNotice && ((FrameworkElement)island.FindName("HoverFocus")).Visibility == Visibility.Collapsed, "Native dismiss left a stale focus card");
      });
      await Check("workspace starts another round and dismisses it through native controls", async () => {
        var old = visual.Clock.Snapshot!.Id; InvokeFocusButton(Find<Button>(workspace, "FocusToggle")!); await Task.Delay(100);
        Assert(visual.Clock.IsRunning && visual.Clock.DurationSeconds == 900 && visual.Clock.Snapshot!.Id != old, "Workspace did not start another round of the same length");
        visualTime.Advance(901); visual.Tick(); await Task.Delay(50); InvokeFocusButton(Find<Button>(workspace, "FocusEnd")!); await Task.Delay(100);
        Assert(!visual.Clock.HasCompletionNotice && visual.IslandActivity == "music", "Workspace dismiss failed");
      });
    } finally { workspace.Close(); island.Close(); SetCursorPos(cursor.X, cursor.Y); }
    File.WriteAllText(Path.Combine(output, "focus-report.json"), JsonSerializer.Serialize(new { results, errors, simulatedTime = true, physicalSleepVerified = false }, new JsonSerializerOptions { WriteIndented = true }));
    app.Shutdown(errors.Count == 0 ? 0 : 1);
  }
  private static SessionModel CreateFocusModel(string profile, FocusTime time) => new(profile, false, "zh-CN", time) { Quiet = true };
  private static void InvokeFocusButton(Button button) => ((IInvokeProvider)new ButtonAutomationPeer(button).GetPattern(PatternInterface.Invoke)).Invoke();
  private sealed class FocusTime : TimeProvider
  {
    private DateTimeOffset now = DateTimeOffset.UtcNow;
    /// <summary>验收专用时间，不调整系统时钟。</summary>
    public override DateTimeOffset GetUtcNow() => now;
    /// <summary>模拟应用关闭或回调停止期间流逝的时间。</summary>
    public void Advance(int seconds) => now = now.AddSeconds(seconds);
  }
}
