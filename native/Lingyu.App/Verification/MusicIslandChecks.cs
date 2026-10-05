/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file MusicIslandChecks.cs @description 在独立资料目录验证音乐形态、操作保护与真实视觉树。 @author 灵屿
 */
using System.IO;
using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Lingyu.App.Models;
using Lingyu.App.Windows;
using Lingyu.Core;

namespace Lingyu.App.Verification;

/// <summary>受控快照不接入真实播放器，断言依然作用于实际 WPF 窗口。</summary>
public static class MusicIslandChecks
{
  /// <summary>所有夹具和报告只写入调用方指定的验收目录。</summary>
  public static async Task RunAsync(App app, string output)
  {
    Directory.CreateDirectory(output); var results = new List<object>(); var errors = new List<string>();
    foreach (Window existing in app.Windows) existing.Hide();
    async Task Check(string name, Func<Task> test)
    { try { await test(); results.Add(new { name, passed = true }); } catch (Exception error) { errors.Add(name + ": " + error.GetBaseException().Message); results.Add(new { name, passed = false }); } }
    var time = new FixtureTime();
    using var model = new SessionModel(Path.Combine(output, Guid.NewGuid().ToString("N")), false, "zh-CN", time) { Quiet = true };
    Apply(model, Track()); model.SetReduceMotion(true);
    var island = new IslandWindow(model, _ => { }); island.Show(); island.Left = 20; island.Top = 400;
    try {
      await Check("out-of-order artwork completes as an atomic image-accent pair", async () => {
        var decoderField = typeof(SessionModel).GetField("artworkDecoder", BindingFlags.Instance | BindingFlags.NonPublic)!;
        var decode = (Func<byte[], Task<(BitmapSource? Image, MediaAccent Accent)>>)decoderField.GetValue(model)!;
        byte[] red = Cover(220, 35, 50), blue = Cover(35, 140, 220);
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously); int decodes = 0;
        Func<byte[], Task<(BitmapSource?, MediaAccent)>> delayed = async bytes => { decodes++; if (ReferenceEquals(bytes, red)) await gate.Task; return await decode(bytes); };
        decoderField.SetValue(model, delayed);
        try {
          Apply(model, Track() with { Title = "A", Artwork = red }); Apply(model, Track() with { Title = "B", Artwork = blue });
          await WaitFor(() => model.Artwork is not null); var imageB = model.Artwork; var colorB = model.MediaAccentColor;
          Assert(colorB.B > colorB.R && colorB.G > colorB.R, "Blue cover did not supply the accent");
          gate.SetResult(); await Task.Delay(140);
          Assert(ReferenceEquals(imageB, model.Artwork) && model.MediaAccentColor == colorB, "Late A replaced B's image or accent");
          Apply(model, Track() with { Title = "B", Artwork = blue }); await Task.Delay(50);
          Assert(decodes == 2 && ReferenceEquals(imageB, model.Artwork), "Same artwork was decoded again");
          Apply(model, Track() with { Artwork = [1, 2, 3] }); await Task.Delay(140);
          Assert(model.Artwork is null && model.MediaAccentColor == FallbackColor, "Broken art retained stale image or color");
          Apply(model, Track() with { Artwork = blue }); await WaitFor(() => model.Artwork is not null);
          Apply(model, MediaSnapshot.Empty);
          Assert(model.Artwork is null && model.MediaAccentColor == FallbackColor && model.MediaIdentity.Length == 0, "Removed session retained previous artwork");
          Apply(model, Track());
          Assert(model.MediaAccentColor == FallbackColor, "A song without art retained the previous color");
        } finally { gate.TrySetResult(); decoderField.SetValue(model, decode); }
      });
      await Check("closed model ignores a late artwork result", async () => {
        using var late = new SessionModel(Path.Combine(output, Guid.NewGuid().ToString("N")), false, "zh-CN");
        var gate = new TaskCompletionSource<(BitmapSource?, MediaAccent)>(TaskCreationOptions.RunContinuationsAsynchronously);
        typeof(SessionModel).GetField("artworkDecoder", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(late, (Func<byte[], Task<(BitmapSource?, MediaAccent)>>)(_ => gate.Task));
        Apply(late, Track() with { Artwork = [1] }); int notifications = 0; late.PropertyChanged += (_, _) => notifications++;
        late.Dispose(); gate.SetResult((null, new(255, 0, 0))); await Task.Delay(50);
        Assert(notifications == 0 && late.MediaAccentColor == FallbackColor, "Disposed model accepted artwork completion");
      });
      await Check("music accents leave global theme untouched and release animation clocks", async () => {
        var global = (SolidColorBrush)app.FindResource("Accent"); Color original = global.Color;
        model.SetReduceMotion(false); Apply(model, Track() with { Artwork = Cover(220, 35, 50) });
        await WaitFor(() => model.Artwork is not null); await Task.Delay(400);
        var local = (SolidColorBrush)island.FindResource("MusicAccent");
        Assert(local.Color == model.MediaAccentColor && !local.HasAnimatedProperties && global.Color == original, "Accent escaped its window or kept an animation clock");
        model.SetReduceMotion(true); Apply(model, Track() with { Artwork = Cover(35, 140, 220) }); await WaitFor(() => model.Artwork is not null);
        Assert(local.Color == model.MediaAccentColor && !local.HasAnimatedProperties, "Reduced motion animated the palette");
      });
      await Check("music expands to 420 DIP instead of opening the dashboard", async () => {
        island.SetShape(IslandShape.Expanded); await Task.Delay(80);
        Assert(island.Geometry.Width == 420 && island.Geometry.Height == 248, "Music detail did not use its own geometry");
        Assert(island.FindName("MusicDetails") is FrameworkElement { IsVisible: true }, "Missing music layer");
      });
      await Check("overview keeps the same window and returns to music after collapse", async () => {
        var entry = (Button?)island.FindName("MusicOverview"); Assert(entry is not null, "Missing overview button");
        entry!.RaiseEvent(new RoutedEventArgs(Button.ClickEvent)); await Task.Delay(80);
        Assert(island.Geometry.Width == 1000 && ((FrameworkElement)island.FindName("Expanded")).IsVisible, "Overview did not open");
        island.Collapse(); island.SetShape(IslandShape.Expanded); await Task.Delay(80);
        Assert(island.Geometry.Width == 420, "A new expansion retained overview");
      });
      await Check("pinned task remains confined to docked presentation", async () => {
        model.AddTask("Music verification pinned task"); model.PinTask(model.Tasks.Last().Id);
        island.Collapse(); await Task.Delay(60); Assert(island.Geometry.Width == 280 && model.HasPinnedTask, "Pinned task lost its docked view");
        island.SetShape(IslandShape.Hover); await Task.Delay(60); Assert(model.IslandHoverLabel == model.TrackTitle, "Hover mixed task and song");
        model.DeleteTask(model.Tasks.Last().Id);
      });
      await Check("focus completion waits for new seek capture to release", async () => {
        island.SetShape(IslandShape.Expanded); await Task.Delay(60);
        var seek = (Slider?)island.FindName("MusicDetailsSeek"); Assert(seek is not null, "Missing detail slider");
        Assert(seek!.CaptureMouse(), "Cannot capture detail slider");
        model.StartFocus(1); time.Advance(61); model.Tick(); await Task.Delay(60);
        Assert(model.Clock.HasCompletionNotice && island.Geometry.Width == 420, "Focus interrupted seek or completion disappeared");
        seek.ReleaseMouseCapture(); await Task.Delay(100);
        Assert(model.Clock.HasCompletionNotice && island.Geometry.Width == 680, "Release failed to show retained completion");
        model.DismissFocusCompletion();
      });
      await Check("detail and overview hold only the actively dragged seek value", async () => {
        foreach (var view in new[] { IslandExpandedView.Music, IslandExpandedView.Overview }) {
          island.SetExpandedView(view); await Task.Delay(60);
          var active = (Slider)island.FindName(view == IslandExpandedView.Music ? "MusicDetailsSeek" : "MediaSeek");
          var other = (Slider)island.FindName(view == IslandExpandedView.Music ? "MediaSeek" : "MusicDetailsSeek");
          Assert(active.CaptureMouse(), "Cannot capture active seek");
          try { active.SetCurrentValue(Slider.ValueProperty, 73d); model.TickMedia(); Assert(active.Value == 73 && other.Value < 73, "A snapshot replaced the drag or changed the other slider"); }
          finally { active.ReleaseMouseCapture(); }
          await Task.Delay(60); Assert(active.Value < 73, "Released seek did not regain its live binding");
        }
      });
      await Check("paused deadline contracts idle only after protected interaction ends", async () => {
        Apply(model, Track() with { Playing = false }); island.Collapse(); await Task.Delay(40);
        Assert(island.Geometry.Width == 192, "Pause immediately removed compact music");
        var presence = (MusicPresence)typeof(IslandWindow).GetField("musicPresence", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(island)!;
        var clock = (Stopwatch)typeof(IslandWindow).GetField("clock", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(island)!;
        presence.Update("fixture-deadline", false, clock.Elapsed.TotalSeconds - 59.85);
        island.Collapse(); await Task.Delay(300); Assert(island.Geometry.Width == 64, "Deadline failed to shrink idle music");
        island.SetShape(IslandShape.Expanded); await Task.Delay(40); Assert(island.Geometry.Width == 420, "Expired music blocked manual detail");
        Apply(model, Track()); island.Collapse(); await Task.Delay(40); Assert(island.Geometry.Width == 192, "Resume did not restore compact music");
        Apply(model, MediaSnapshot.Empty); await Task.Delay(40); Assert(island.Geometry.Width == 64, "Removed session retained compact music");
        Apply(model, Track());
      });
      foreach (string language in new[] { "zh-CN", "en-US" }) {
        model.SetLanguage(language);
        Apply(model, Track() with { Title = language == "zh-CN" ? "夜色里的很长一首歌 · 沿着月光走到山海的另一边" : "A very long song for the journey beyond the quiet mountains", Artist = "Lingyu Music Verification — a very long artist name" });
        foreach (int width in new[] { 420, 360, 320, 280 }) await Check("detail layout " + language + "-" + width, async () => {
          island.Width = width; island.SetShape(IslandShape.Expanded); await Task.Delay(60); island.UpdateLayout();
          var detail = (FrameworkElement?)island.FindName("MusicDetails"); Assert(detail is not null, "Missing detail layer");
          Assert(island.Geometry.Width == width && island.Geometry.Height == (width < 360 ? 284 : 248), "Unexpected responsive geometry");
          foreach (var button in Descendants(detail!).OfType<Button>().Where(b => b.IsVisible)) {
            var bounds = button.TransformToAncestor(detail!).TransformBounds(new Rect(button.RenderSize));
            Assert(button.ActualWidth >= 40 && button.ActualHeight >= 40 && bounds.Left >= 0 && bounds.Right <= width && bounds.Bottom <= detail!.ActualHeight, "Clipped or undersized action");
          }
          Capture(island, Path.Combine(output, "music-" + language + "-" + width + ".png"));
        });
      }
    } finally { island.Close(); }
    File.WriteAllText(Path.Combine(output, "music-report.json"), JsonSerializer.Serialize(new { results, errors, fixture = "controlled snapshots; no real media commands", dpi = VisualTreeHelper.GetDpi(island).DpiScaleX }, new JsonSerializerOptions { WriteIndented = true }));
    app.Shutdown(errors.Count == 0 ? 0 : 1);
  }
  private static void Assert(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
  private static Color FallbackColor => Color.FromRgb(MediaPalette.Fallback.R, MediaPalette.Fallback.G, MediaPalette.Fallback.B);
  private static async Task WaitFor(Func<bool> condition)
  { var watch = Stopwatch.StartNew(); while (!condition() && watch.ElapsedMilliseconds < 3000) await Task.Delay(10); Assert(condition(), "Timed out waiting for artwork"); }
  private static byte[] Cover(byte r, byte g, byte b)
  {
    byte[] pixels = new byte[16 * 16 * 4]; for (int i = 0; i < pixels.Length; i += 4) { pixels[i] = b; pixels[i + 1] = g; pixels[i + 2] = r; pixels[i + 3] = 255; }
    var bitmap = BitmapSource.Create(16, 16, 96, 96, PixelFormats.Bgra32, null, pixels, 64); var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap)); using var stream = new MemoryStream(); encoder.Save(stream); return stream.ToArray();
  }
  private static MediaSnapshot Track() => new("Moonlight · test fixture", "Lingyu verification", "fixture", true, true, true, true, true, TimeSpan.FromSeconds(42), TimeSpan.FromSeconds(180), DateTimeOffset.UtcNow, null);
  private static void Apply(SessionModel model, MediaSnapshot value) => typeof(SessionModel).GetMethod("ApplyMedia", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(model, [value]);
  private static IEnumerable<DependencyObject> Descendants(DependencyObject root)
  { for (int i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++) { var child = VisualTreeHelper.GetChild(root, i); yield return child; foreach (var nested in Descendants(child)) yield return nested; } }
  private static void Capture(IslandWindow window, string path)
  {
    window.UpdateLayout(); var bitmap = new RenderTargetBitmap((int)Math.Ceiling(window.ActualWidth), (int)Math.Ceiling(window.ActualHeight), 96, 96, PixelFormats.Pbgra32); bitmap.Render(window);
    var g = window.Geometry; var crop = new CroppedBitmap(bitmap, new Int32Rect((int)((window.Width - g.Width) / 2), 0, (int)g.Width, (int)g.Height));
    var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(crop)); using var file = File.Create(path); encoder.Save(file);
  }
  private sealed class FixtureTime : TimeProvider
  {
    private DateTimeOffset now = DateTimeOffset.UtcNow;
    public override DateTimeOffset GetUtcNow() => now;
    public void Advance(int seconds) => now = now.AddSeconds(seconds);
  }
}
