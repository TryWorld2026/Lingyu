/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file NativeChecks.cs @description 在实际 WPF 窗口中执行交互、截屏与生命周期验证。 @author 灵屿
 */
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Interop;
using System.Windows.Input;
using System.Runtime.InteropServices;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.App.Windows;
using Lingyu.Core;
using Lingyu.Platform.Windows;

namespace Lingyu.App.Verification;

/// <summary>验证截图直接渲染可操作窗口，不使用宣传图片代替界面。</summary>
public static partial class NativeChecks
{
  /// <summary>输出实测报告。验证进程结束后不保留后台实例。</summary>
  public static async Task RunAsync(App app, SessionModel model, IslandWindow island,
    Action<string> openWorkspace, Func<WorkspaceWindow?> getWorkspace, string output, bool capture = true, bool frameOnly = false)
  {
    Directory.CreateDirectory(output); var results = new List<object>(); var errors = new List<string>();
    void Check(string name, Action action)
    { try { action(); results.Add(new { name, passed = true }); } catch (Exception error) { errors.Add(name + ": " + error.Message); results.Add(new { name, passed = false }); } }
    void Assert(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
    Check("DPAPI current-user protection", () => { string protectedValue = SecretProtection.Protect("native-test-value"); Assert(!protectedValue.Contains("native-test-value") && SecretProtection.Unprotect(protectedValue) == "native-test-value", "Protection round trip failed"); });
    Check("island window does not activate", () => {
      long style = GetWindowLongPtr(new WindowInteropHelper(island).Handle, -20).ToInt64();
      Assert((style & 0x08000000L) != 0 && !island.ShowActivated, "Island activation policy is missing");
    });
    Check("island uses an opaque native window region", () => {
      IntPtr handle = new WindowInteropHelper(island).Handle;
      Assert((GetWindowLongPtr(handle, -20).ToInt64() & 0x80000L) == 0, "Island still uses per-pixel transparency");
      IntPtr region = CreateRectRgn(0, 0, 0, 0);
      try { Assert(GetWindowRgn(handle, region) > 1, "Native capsule region is missing"); }
      finally { DeleteObject(region); }
    });
    Check("capsule has no rectangular system border", () => {
      long style = GetWindowLongPtr(new WindowInteropHelper(island).Handle, -16).ToInt64();
      Assert((style & 0x00C40000L) == 0, "A rectangular native frame still surrounds the capsule");
    });
    GetCursorPos(out var initialCursor);
    SetCursorPos(initialCursor.X, Math.Max(initialCursor.Y, 500));
    island.SetShape(IslandShape.Docked); await Task.Delay(300);
    island.SetShape(IslandShape.Expanded); await Task.Delay(45);
    var reversing = island.Geometry;
    island.SetShape(IslandShape.Docked);
    Check("rapid reversal preserves current geometry", () => Assert(island.Geometry == reversing, "Reversal jumped to a new position"));
    await Task.Delay(300);
    Check("settled animation releases frame subscription", () => Assert(!island.IsAnimating, "Idle island still renders every frame"));
    island.SetShape(IslandShape.Expanded); await Task.Delay(300);
    Check("seek drag survives a background progress update", () => {
      var slider = (Slider)island.FindName("MusicDetailsSeek"); slider.IsEnabled = true;
      try { Mouse.Capture(slider); slider.SetCurrentValue(Slider.ValueProperty, 73d); model.TickMedia(); Assert(Math.Abs(slider.Value - 73) < .01, "A media update moved the dragged thumb"); }
      finally { Mouse.Capture(null); slider.SetBinding(UIElement.IsEnabledProperty, "CanSeek"); }
    });
    island.SetShape(IslandShape.Docked); await Task.Delay(300);
    island.SetShape(IslandShape.Expanded); await Task.Delay(35);
    Check("island morph has intermediate geometry", () => {
      var shell = (Border)island.FindName("Shell");
      Assert(shell.ActualHeight > 44 && shell.ActualHeight < 280, "Geometry jumped directly to its final size");
    });
    island.SetShape(IslandShape.Docked); await Task.Delay(300);
    try
    {
      foreach (var shape in new[] { IslandShape.Docked, IslandShape.Hover, IslandShape.Expanded })
      {
        island.SetShape(shape); island.UpdateLayout();
        var pointer = shape == IslandShape.Hover ? island.PointToScreen(new Point(island.ActualWidth / 2, island.Geometry.Height / 2)) : new Point(initialCursor.X, Math.Max(initialCursor.Y, 500));
        SetCursorPos((int)pointer.X, (int)pointer.Y); await Task.Delay(500);
        Check("island layout " + shape, () => {
          double expectedHeight = shape switch { IslandShape.Docked => 44, IslandShape.Hover => 64, _ => 248 };
          Assert(island.Shape == shape && Math.Abs(island.Geometry.Height - expectedHeight) < 2,
            $"Expected {shape} height {expectedHeight}, actual {island.Shape} height {island.Geometry.Height}");
        });
        Check("pointer feedback preserves themed edge " + shape, () => {
          var shell = (Border)island.FindName("Shell");
          var expected = island.FindResource(shape == IslandShape.Hover ? "IslandHoverEdge" : "IslandEdge");
          Assert(ReferenceEquals(shell.BorderBrush, expected), "Pointer feedback discarded the theme resource");
        });
        if (capture)
        {
          string name = "island-" + shape.ToString().ToLowerInvariant();
          Capture(island, Path.Combine(output, name + ".png"));
          CaptureComposed(island, Path.Combine(output, "desktop-" + name + ".png"));
        }
      }
    }
    finally { SetCursorPos(initialCursor.X, initialCursor.Y); }
    island.Collapse();
    openWorkspace("music"); await Task.Delay(80);
    Check("workspace music exposes a seek slider", () => Assert(Find<Slider>(getWorkspace()!, "WorkspaceMediaSeek") is not null, "Music card only has a read-only progress bar"));
    openWorkspace("ai"); await Task.Delay(100);
    Check("unrelated task update preserves AI draft and cursor", () => {
      var window = getWorkspace()!; var input = Find<TextBox>(window, "AiInput")!;
      input.Text = "Unsent input draft"; input.Select(3, 4);
      model.AddTask("Background update fixture");
      var task = model.Tasks.Single(value => value.Text == "Background update fixture");
      try { Assert(ReferenceEquals(input, Find<TextBox>(window, "AiInput")) && input.Text == "Unsent input draft" && input.SelectionStart == 3 && input.SelectionLength == 4, "Background update replaced the editor"); }
      finally { model.DeleteTask(task.Id); }
    });
    openWorkspace("today"); await Task.Delay(250);
    await CheckFrameAsync(getWorkspace()!, output, Check, Assert);
    if (model.Showcase)
    {
      openWorkspace("ai"); await Task.Delay(100);
      var draftButton = Find<Button>(getWorkspace()!, TextCatalog.T("aiToTask"), true);
      if (draftButton is null) Check("native task dialog fits its content", () => Assert(false, "Draft button is missing"));
      else
      {
        var opening = app.Dispatcher.InvokeAsync(() => draftButton.RaiseEvent(new RoutedEventArgs(System.Windows.Controls.Primitives.ButtonBase.ClickEvent)));
        await Task.Delay(300);
        var dialog = app.Windows.OfType<Window>().FirstOrDefault(window => Find<TextBox>(window, "AiTaskDraft") is not null);
        try
        {
          Check("native task dialog fits its content", () => {
            Assert(dialog is not null, "Draft dialog did not open");
            long style = GetWindowLongPtr(new WindowInteropHelper(dialog!).Handle, -16).ToInt64();
            Assert(!dialog!.AllowsTransparency && (style & 0x00C00000L) == 0x00C00000L, "Dialog has no native caption");
            dialog.UpdateLayout();
            var root = (Border)dialog.Content; var stack = (StackPanel)root.Child; var add = stack.Children.OfType<Button>().Single();
            double bottom = add.TranslatePoint(new Point(0, add.ActualHeight), root).Y;
            Assert(bottom <= root.ActualHeight - root.Padding.Bottom + 1, $"Dialog action extends beyond content: {bottom:0.0} / {root.ActualHeight:0.0}");
          });
          if (dialog is not null && capture)
          {
            CaptureDesktop(dialog, Path.Combine(output, "task-dialog-native.png"));
            CaptureComposed(dialog, Path.Combine(output, "desktop-task-dialog.png"));
          }
        }
        finally { dialog?.Close(); }
        await opening.Task;
      }
    }
    if (frameOnly)
    {
      File.WriteAllText(Path.Combine(output, "report.json"), JsonSerializer.Serialize(new { timestamp = DateTimeOffset.Now, frameOnly, results, errors }, new JsonSerializerOptions { WriteIndented = true }));
      app.Shutdown(errors.Count == 0 ? 0 : 1); return;
    }
    foreach (string language in new[] { "zh-CN", "en-US" })
    {
      model.SetLanguage(language);
      foreach (string page in new[] { "today", "focus", "notes", "files", "ai", "settings" })
      {
        openWorkspace(page); await Task.Delay(80); var window = getWorkspace()!;
        if (capture)
        {
          Capture(window, Path.Combine(output, "workspace-" + page + "-" + language + ".png"));
          if (page == "ai" && language == "zh-CN")
          {
            CaptureDesktop(window, Path.Combine(output, "desktop-workspace-ai.png"));
            CaptureComposed(window, Path.Combine(output, "composed-workspace-ai.png"));
          }
        }
        Check("navigation " + page + " " + language, () => Assert(window.CurrentPage == page && window.ActualWidth > 0, "Page did not load"));
      }
    }
    model.SetLanguage("zh-CN"); openWorkspace("focus"); await Task.Delay(60);
    Check("real focus button start and pause", () => {
      var button = Find<Button>(getWorkspace()!, "FocusToggle") ?? throw new InvalidOperationException("Missing focus control");
      button.RaiseEvent(new RoutedEventArgs(System.Windows.Controls.Primitives.ButtonBase.ClickEvent)); Assert(model.Clock.IsRunning, "Focus did not start");
      button.RaiseEvent(new RoutedEventArgs(System.Windows.Controls.Primitives.ButtonBase.ClickEvent)); Assert(!model.Clock.IsRunning, "Focus did not pause"); model.ResetFocus();
    });
    island.SetShape(IslandShape.Expanded); model.StartFocus(); await Task.Delay(300);
    Check("focus uses its own expanded layout", () => Assert(model.IslandActivity == "focus" && Math.Abs(island.Geometry.Width - 680) < 2 && Math.Abs(island.Geometry.Height - 232) < 2, "Focus layout did not replace music"));
    if (capture) Capture(island, Path.Combine(output, "island-focus.png"));
    model.ToggleFocus(); await Task.Delay(300);
    Check("paused focus retains its layout", () => Assert(model.IslandActivity == "focus" && !model.Clock.IsRunning && Math.Abs(island.Geometry.Height - 232) < 2, "Pausing discarded focus"));
    model.ResetFocus(); await Task.Delay(300);
    Check("ending focus restores previous content", () => Assert(model.IslandActivity == "music" && Math.Abs(island.Geometry.Height - 248) < 2, "Music was not restored"));
    Check("task CRUD and pinned island", () => {
      string text = "Native verification task"; model.AddTask(text); var task = model.Tasks.Single(task => task.Text == text); model.PinTask(task.Id);
      Assert(model.IslandLabel == text, "Pin not reflected on island"); model.ToggleTask(task.Id); Assert(model.Tasks.Single(value => value.Id == task.Id).Done, "Completion not saved"); model.DeleteTask(task.Id); Assert(model.Tasks.All(value => value.Text != text), "Delete failed");
    });
    openWorkspace("notes"); await Task.Delay(60);
    Check("note editor flushes on navigation", () => {
      var window = getWorkspace()!; Find<TextBox>(window, "NoteTitle")!.Text = "Verification note"; Find<TextBox>(window, "NoteBody")!.Text = "Native text\n第二行";
      window.Navigate("today"); var note = model.Notes.Single(note => note.Title == "Verification note"); Assert(note.Body.Contains("第二行"), "Editor not saved"); model.DeleteNote(note.Id);
    });
    string fixture = Path.Combine(output, "file-verification.txt"); File.WriteAllText(fixture, "Native file reference");
    Check("shelf removes reference without deleting original", () => { model.AddFiles([fixture]); Assert(model.Files.Contains(fixture), "Reference not added"); model.RemoveFile(fixture); Assert(File.Exists(fixture) && !model.Files.Contains(fixture), "Original file affected"); });
    openWorkspace("today"); await Task.Delay(1000); var workspaceMemory = Measure();
    getWorkspace()?.Close(); island.Collapse(); await Task.Delay(1000);
    await AiInteractionChecks.RunAsync(output, Check, Assert);
    var baseline = Measure(); var references = new List<WeakReference>();
    for (int index = 0; index < 100; index++)
    {
      openWorkspace(index % 2 == 0 ? "today" : "ai"); await Task.Delay(25);
      CloseWorkspace(getWorkspace, references); await Task.Delay(25);
    }
    await Task.Delay(1000); var after = Measure(); Collect();
    Check("workspace is released after one hundred open-close cycles", () => Assert(app.Windows.Count == 1 && references.All(reference => !reference.IsAlive), "A closed workspace is still retained"));
    // 高频开关和截图之后留出恢复时间；空闲占用另用正常进程复核。
    await Task.Delay(10000);
    using var process = Process.GetCurrentProcess(); var cpuSamplesOneCore = new List<double>();
    for (int index = 0; index < 3; index++)
    {
      process.Refresh(); var cpuStart = process.TotalProcessorTime; var clock = Stopwatch.StartNew();
      await Task.Delay(5000); process.Refresh();
      cpuSamplesOneCore.Add((process.TotalProcessorTime - cpuStart).TotalMilliseconds / clock.Elapsed.TotalMilliseconds * 100);
    }
    var intervals = island.FrameIntervals.OrderBy(value => value).ToArray();
    var report = new { timestamp = DateTimeOffset.Now, showcase = model.Showcase, screenshotsEnabled = capture, results, errors, workspaceMemory, baseline, afterHundredCycles = after, cpuSamplesOneCore, logicalProcessors = Environment.ProcessorCount, island.ShapeChangeCount, nativeWindows = app.Windows.Count, renderingMode = RenderOptions.ProcessRenderMode.ToString(), renderingTier = RenderCapability.Tier >> 16, animationCallbackCount = intervals.Length, callbackP95Ms = intervals.Length == 0 ? 0 : intervals[(int)Math.Floor((intervals.Length - 1) * .95)], callbackMaxMs = intervals.LastOrDefault(), framework = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription };
    File.WriteAllText(Path.Combine(output, "report.json"), JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
    app.Shutdown(errors.Count == 0 ? 0 : 1);
  }
  private static void CloseWorkspace(Func<WorkspaceWindow?> getWorkspace, List<WeakReference> references)
  { var window = getWorkspace()!; references.Add(new WeakReference(window)); window.Close(); }
  private static void Collect() { GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); }
  private static object Measure()
  { using var process = Process.GetCurrentProcess(); process.Refresh(); return new { privateMiB = Math.Round(process.PrivateMemorySize64 / 1048576d, 2), workingSetMiB = Math.Round(process.WorkingSet64 / 1048576d, 2), handles = process.HandleCount, threads = process.Threads.Count, managedMiB = Math.Round(GC.GetTotalMemory(false) / 1048576d, 2) }; }
  private static void Capture(Window window, string file)
  {
    window.UpdateLayout(); var bitmap = new RenderTargetBitmap((int)Math.Ceiling(window.ActualWidth), (int)Math.Ceiling(window.ActualHeight), 96, 96, PixelFormats.Pbgra32); bitmap.Render(window);
    BitmapSource visible = bitmap;
    if (window is IslandWindow island) { var g = island.Geometry; visible = new CroppedBitmap(bitmap, new Int32Rect((int)Math.Round((island.ActualWidth - g.Width) / 2), 0, (int)Math.Round(g.Width), (int)Math.Round(g.Height))); }
    var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(visible)); using var stream = File.Create(file); encoder.Save(stream);
  }
  private static T? Find<T>(DependencyObject root, string id, bool byName = false) where T : DependencyObject
  {
    if (root is T typed && (byName ? AutomationProperties.GetName(typed) : AutomationProperties.GetAutomationId(typed)) == id) return typed;
    for (int index = 0; index < VisualTreeHelper.GetChildrenCount(root); index++) if (Find<T>(VisualTreeHelper.GetChild(root, index), id, byName) is { } found) return found;
    return null;
  }
  private static void CaptureDesktop(Window window, string file)
  {
    IntPtr handle = new WindowInteropHelper(window).Handle;
    if (!GetWindowRect(handle, out var rect)) throw new InvalidOperationException("Window bounds unavailable");
    using var bitmap = new System.Drawing.Bitmap(rect.Right - rect.Left, rect.Bottom - rect.Top);
    using var graphics = System.Drawing.Graphics.FromImage(bitmap); IntPtr dc = graphics.GetHdc();
    try { if (!PrintWindow(handle, dc, 2)) throw new InvalidOperationException("Desktop capture failed"); }
    finally { graphics.ReleaseHdc(dc); }
    bitmap.Save(file, System.Drawing.Imaging.ImageFormat.Png);
  }
  private static void CaptureComposed(Window window, string file)
  {
    GetWindowRect(new WindowInteropHelper(window).Handle, out var bounds);
    int left = Math.Max(0, bounds.Left - 16), top = Math.Max(0, bounds.Top - 16);
    using var bitmap = new System.Drawing.Bitmap(bounds.Right - left + 16, bounds.Bottom - top + 16);
    using var graphics = System.Drawing.Graphics.FromImage(bitmap);
    graphics.CopyFromScreen(left, top, 0, 0, bitmap.Size);
    bitmap.Save(file, System.Drawing.Imaging.ImageFormat.Png);
  }
  private static async Task CheckFrameAsync(WorkspaceWindow window, string output, Action<string, Action> check, Action<bool, string> assert)
  {
    bool wasTopmost = window.Topmost; window.Topmost = true; window.Activate();
    BringToFront(window); await Task.Delay(150);
    IntPtr handle = new WindowInteropHelper(window).Handle;
    check("workspace has no reserved native title strip", () => {
      GetWindowRect(handle, out var outer); var clientOrigin = new NativePoint(); ClientToScreen(handle, ref clientOrigin);
      assert(Math.Abs(clientOrigin.Y - outer.Top) <= 1, $"Reserved top strip is {clientOrigin.Y - outer.Top}px");
    });
    check("workspace top edge has no white strip", () => {
      GetWindowRect(handle, out var bounds);
      using var bitmap = new System.Drawing.Bitmap(bounds.Right - bounds.Left, bounds.Bottom - bounds.Top);
      using var graphics = System.Drawing.Graphics.FromImage(bitmap); IntPtr dc = graphics.GetHdc();
      try { assert(PrintWindow(handle, dc, 2), "Native frame capture failed"); } finally { graphics.ReleaseHdc(dc); }
      int bright = Enumerable.Range(0, 8).Count(y => { var pixel = bitmap.GetPixel(bitmap.Width / 2, y); return pixel.R > 140 && pixel.G > 140 && pixel.B > 140; });
      assert(bright == 0, $"White frame occupies {bright} of the first eight rows");
      bitmap.Save(Path.Combine(output, "workspace-native-frame.png"), System.Drawing.Imaging.ImageFormat.Png);
    });
    GetCursorPos(out var cursor);
    try
    {
      foreach (string id in new[] { "ReturnToIsland", "TodayFocus" })
      {
        Button? button = id == "ReturnToIsland" ? window.FindName(id) as Button : Find<Button>(window, id);
        if (button is null) { check("button hover " + id, () => assert(false, "Button is missing")); continue; }
        var center = button.PointToScreen(new Point(button.ActualWidth / 2, button.ActualHeight / 2));
        SetCursorPos((int)center.X, (int)center.Y); await Task.Delay(100);
        check("button hover " + id, () => {
          GetCursorPos(out var actualCursor);
          assert(button.IsMouseOver, $"Pointer did not reach the button: target {center.X:0},{center.Y:0}; actual {actualCursor.X},{actualCursor.Y}; hit {WindowFromPoint(actualCursor)}; window {handle}");
          var surface = button.Template.FindName("Body", button) as Border;
          assert(surface?.Background is SolidColorBrush, "Button surface is unavailable");
          var color = ((SolidColorBrush)surface!.Background).Color;
          assert(id == "TodayFocus" ? color.R > 180 && color.G > 180 && color.B > 180 : color.R < 40 && color.G < 40 && color.B < 40,
            $"Incorrect hover surface: {color}");
        });
      }
      CaptureComposed(window, Path.Combine(output, "composed-workspace-frame.png"));
    }
    finally { SetCursorPos(cursor.X, cursor.Y); window.Topmost = wasTopmost; }
  }
  private static void BringToFront(Window window)
  {
    IntPtr handle = new WindowInteropHelper(window).Handle;
    uint foregroundThread = GetWindowThreadProcessId(GetForegroundWindow(), out _);
    uint currentThread = GetCurrentThreadId();
    bool attached = currentThread != foregroundThread && AttachThreadInput(currentThread, foregroundThread, true);
    // 后台启动的验收进程不能仅依赖 Activate；只在实机检查期间接入前台输入队列。
    try { SetForegroundWindow(handle); BringWindowToTop(handle); }
    finally { if (attached) AttachThreadInput(currentThread, foregroundThread, false); }
  }
  [StructLayout(LayoutKind.Sequential)] private struct NativePoint { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] private struct WindowRect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out WindowRect rect);
  [DllImport("user32.dll")] private static extern bool PrintWindow(IntPtr window, IntPtr dc, uint flags);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] private static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
  [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr window, ref NativePoint point);
  [DllImport("user32.dll")] private static extern bool GetCursorPos(out NativePoint point);
  [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(NativePoint point);
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint current, uint target, bool attach);
  [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr window);
  [DllImport("user32.dll")] private static extern int GetWindowRgn(IntPtr window, IntPtr region);
  [DllImport("gdi32.dll")] private static extern IntPtr CreateRectRgn(int left, int top, int right, int bottom);
  [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr value);
}
