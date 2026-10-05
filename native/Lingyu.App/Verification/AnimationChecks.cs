/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file AnimationChecks.cs @description 隔离截图与开关负载，测量实际窗口的连续运动。 @author 灵屿
 */
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Media;
using Lingyu.App.Windows;
using Lingyu.Core;

namespace Lingyu.App.Verification;

/// <summary>只输出呈现回调诊断，不将回调冒充屏幕帧。</summary>
public static class AnimationChecks
{
  /// <summary>在正常桌面驱动轮廓；没有截图、录像、显式 GC 或隐藏的工作台。</summary>
  public static async Task RunAsync(App app, IslandWindow island, string output)
  {
    Directory.CreateDirectory(output);
    for (int i = 0; i < 6; i++) { island.SetShape(i % 2 == 0 ? IslandShape.Expanded : IslandShape.Docked); await Task.Delay(350); }
    var intervals = new List<double>(); var latency = new List<double>(); var durations = new List<double>();
    using var process = Process.GetCurrentProcess(); process.Refresh();
    long before = process.PrivateMemorySize64; var cpu = process.TotalProcessorTime; var elapsed = Stopwatch.StartNew();
    var scenarios = new List<object>();
    foreach (var view in new[] { IslandExpandedView.Music, IslandExpandedView.Overview })
    {
    int firstInterval = intervals.Count, firstDuration = durations.Count;
    foreach (var shape in Enumerable.Range(0, 36).Select(i => (IslandShape)(i % 3)))
    {
      int count = island.FrameIntervals.Count; var transition = Stopwatch.StartNew(); island.SetShape(shape);
      if (shape == IslandShape.Expanded) island.SetExpandedView(view);
      while (island.IsAnimating && transition.ElapsedMilliseconds < 1000) await Task.Delay(5);
      durations.Add(transition.Elapsed.TotalMilliseconds);
      var frames = island.FrameIntervals.Skip(count).ToArray(); if (frames.Length > 0) latency.Add(frames[0]); intervals.AddRange(frames.Skip(1));
      await Task.Delay(100);
    }
    scenarios.Add(new { view = view.ToString(), transitions = durations.Count - firstDuration, callbackP95Ms = Percentile(intervals.Skip(firstInterval).Order().ToArray(), .95), settlingP95Ms = Percentile(durations.Skip(firstDuration).Order().ToArray(), .95) });
    }
    island.Collapse(); await Task.Delay(350);
    process.Refresh(); var sorted = intervals.Order().ToArray();
    var report = new {
      timestamp = DateTimeOffset.Now, diagnostic = "WPF rendering callbacks, NOT display presentation",
      renderingMode = RenderOptions.ProcessRenderMode.ToString(), dpi = VisualTreeHelper.GetDpi(island).PixelsPerInchX,
      transitions = durations.Count, callbackCount = sorted.Length, callbackP95Ms = Percentile(sorted, .95), callbackMaxMs = sorted.LastOrDefault(),
      scenarios,
      firstCallbackP95Ms = Percentile(latency.Order().ToArray(), .95), settlingP95Ms = Percentile(durations.Order().ToArray(), .95),
      privateBeforeMiB = before / 1048576d, privateAfterMiB = process.PrivateMemorySize64 / 1048576d,
      activeCpuWholeMachinePercent = (process.TotalProcessorTime - cpu).TotalMilliseconds / elapsed.Elapsed.TotalMilliseconds * 100 / Environment.ProcessorCount,
      idleFrameSubscriptionReleased = !island.IsAnimating, actualPresentation = "Separate recording or ETW measurement required"
    };
    File.WriteAllText(Path.Combine(output, "animation-report.json"), JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
    app.Shutdown();
  }
  private static double Percentile(double[] values, double p) => values.Length == 0 ? 0 : values[(int)Math.Floor((values.Length - 1) * p)];
}
