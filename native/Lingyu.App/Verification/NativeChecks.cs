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
using System.Runtime.InteropServices;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.App.Windows;
using Lingyu.Core;
using Lingyu.Platform.Windows;

namespace Lingyu.App.Verification;

/// <summary>验证截图直接渲染可操作窗口，不使用宣传图片代替界面。</summary>
public static class NativeChecks
{
  /// <summary>输出实测报告。验证进程结束后不保留后台实例。</summary>
  public static async Task RunAsync(App app, SessionModel model, IslandWindow island,
    Action<string> openWorkspace, Func<WorkspaceWindow?> getWorkspace, string output, bool capture = true)
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
    foreach (var shape in new[] { IslandShape.Docked, IslandShape.Hover, IslandShape.Expanded })
    {
      island.SetShape(shape); await Task.Delay(500);
      Check("island layout " + shape, () => {
        double expectedHeight = shape switch { IslandShape.Docked => 76, IslandShape.Hover => 104, _ => 312 };
        Assert(island.Shape == shape && Math.Abs(island.ActualHeight - expectedHeight) < 2,
          $"Expected {shape} height {expectedHeight}, actual {island.Shape} height {island.ActualHeight}");
      });
      if (capture) Capture(island, Path.Combine(output, "island-" + shape.ToString().ToLowerInvariant() + ".png"));
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
          if (page == "ai" && language == "zh-CN") CaptureDesktop(window, Path.Combine(output, "desktop-workspace-ai.png"));
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
    openWorkspace("today"); await Task.Delay(1000); Collect(); var workspaceMemory = Measure();
    getWorkspace()?.Close(); island.Collapse(); await Task.Delay(1000); Collect();
    var baseline = Measure(); var references = new List<WeakReference>();
    for (int index = 0; index < 20; index++)
    {
      openWorkspace(index % 2 == 0 ? "today" : "ai"); await Task.Delay(25);
      CloseWorkspace(getWorkspace, references); await Task.Delay(25);
    }
    await Task.Delay(1000); Collect(); var after = Measure();
    Check("workspace is released after twenty open-close cycles", () => Assert(app.Windows.Count == 1 && references.All(reference => !reference.IsAlive), "A closed workspace is still retained"));
    // 高频开关和截图之后留出恢复时间；空闲占用另用正常进程复核。
    await Task.Delay(10000);
    using var process = Process.GetCurrentProcess(); var cpuSamplesOneCore = new List<double>();
    for (int index = 0; index < 3; index++)
    {
      process.Refresh(); var cpuStart = process.TotalProcessorTime; var clock = Stopwatch.StartNew();
      await Task.Delay(5000); process.Refresh();
      cpuSamplesOneCore.Add((process.TotalProcessorTime - cpuStart).TotalMilliseconds / clock.Elapsed.TotalMilliseconds * 100);
    }
    var report = new { timestamp = DateTimeOffset.Now, showcase = model.Showcase, screenshotsEnabled = capture, results, errors, workspaceMemory, baseline, afterTwentyCycles = after, cpuSamplesOneCore, logicalProcessors = Environment.ProcessorCount, island.ShapeChangeCount, nativeWindows = app.Windows.Count, renderingMode = RenderOptions.ProcessRenderMode.ToString(), renderingTier = RenderCapability.Tier >> 16, framework = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription };
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
    var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap)); using var stream = File.Create(file); encoder.Save(stream);
  }
  private static T? Find<T>(DependencyObject root, string id) where T : DependencyObject
  {
    if (root is T typed && AutomationProperties.GetAutomationId(typed) == id) return typed;
    for (int index = 0; index < VisualTreeHelper.GetChildrenCount(root); index++) if (Find<T>(VisualTreeHelper.GetChild(root, index), id) is { } found) return found;
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
  [StructLayout(LayoutKind.Sequential)] private struct WindowRect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out WindowRect rect);
  [DllImport("user32.dll")] private static extern bool PrintWindow(IntPtr window, IntPtr dc, uint flags);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] private static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
}
