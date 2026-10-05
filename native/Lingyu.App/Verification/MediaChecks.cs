/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file MediaChecks.cs @description 在 Core Audio 边界重放设备事件，并核实原生播放器状态。 @author 灵屿
 */
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.App.Views;
using Lingyu.App.Windows;
using Lingyu.Platform.Windows;
using Windows.Media;
using Windows.Media.Control;

namespace Lingyu.App.Verification;

/// <summary>设备夹具只替换 COM 边界，不修改真实默认设备或系统音量。</summary>
public static class MediaChecks
{
  /// <summary>运行受控设备事件和实际窗口检查，输出可重跑的报告。</summary>
  public static async Task RunAsync(App app, string output)
  {
    Directory.CreateDirectory(output); var results = new List<object>(); var errors = new List<string>(); bool smtcVerified = false;
    var externalPlayers = new List<object>();
    async Task Check(string name, Func<Task> test)
    { try { await test(); results.Add(new { name, passed = true }); } catch (Exception error) { results.Add(new { name, passed = false }); errors.Add(name + ": " + error.GetBaseException().Message); } }
    void Assert(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
    await Check("default output change redirects reads and controls", async () => {
      using var audio = new AudioFixture(); var service = audio.Create();
      audio.Change("B"); await Task.Delay(80);
      Assert(service.Read() is { Value: > 69 and < 71, Muted: true }, "Still reading device A after switching the default to B");
      Assert(service.Set(35) && service.Mute(false) && audio.B.Volume == .35f && !audio.B.Muted && audio.A.Volume == .2f, "Controls targeted the previous endpoint");
    });
    await Check("no output disables controls and reconnection recovers", async () => {
      using var audio = new AudioFixture(); var service = audio.Create(); var available = new List<bool>(); service.Changed += (_, _) => available.Add(service.Available);
      audio.Change(null); await Task.Delay(80);
      Assert(!service.Available && service.Read() is null && !service.Set(45) && !service.Mute(true), "Removed default output remains controllable");
      audio.Change("B"); await Task.Delay(80);
      Assert(service.Available && service.Read() is { Value: > 69 } && available.SequenceEqual(new[] { false, true }), "Reconnection did not publish availability and current volume");
    });
    await Check("capture and communications changes do not replace multimedia output", async () => {
      using var audio = new AudioFixture(); var service = audio.Create();
      audio.Change("B", 1, 1); audio.Change("B", 0, 2); await Task.Delay(80);
      Assert(service.Read() is { Value: > 19 and < 21 }, "Unrelated device role replaced the output");
    });
    await Check("background device callbacks coalesce and publish on the owning thread", async () => {
      using var audio = new AudioFixture(); var service = audio.Create(); int thread = Environment.CurrentManagedThreadId; bool wrongThread = false;
      service.Changed += (_, _) => wrongThread |= Environment.CurrentManagedThreadId != thread;
      await Task.Run(() => { for (int i = 0; i < 30; i++) audio.Change(i % 2 == 0 ? "A" : "B"); });
      await Task.Delay(80); Assert(!wrongThread && service.Read() is { Value: > 69 }, "Background device event lost its final selection or invoked UI listeners on a worker");
    });
    await Check("late old endpoint notifications cannot overwrite the new output", async () => {
      using var audio = new AudioFixture(); var service = audio.Create(); var values = new List<double>(); service.Changed += (value, _) => values.Add(value);
      object? old = audio.A.Callback; audio.Change("B"); await Task.Delay(80); values.Clear();
      AudioFixture.Notify(old, .99f, false); await Task.Delay(80);
      Assert(values.Count == 0, "Old endpoint notification was published after replacement");
      AudioFixture.Notify(audio.B.Callback, .45f, false); await Task.Delay(80);
      Assert(values.Count == 1 && Math.Abs(values[0] - 45) < .01, "Current endpoint callback was lost");
    });
    await Check("read failure clears availability and later device event recovers", async () => {
      using var audio = new AudioFixture(); var service = audio.Create(); audio.A.Fail = true;
      Assert(service.Read() is null && !service.Available, "Unreadable endpoint stayed available");
      audio.Change("B"); await Task.Delay(80); Assert(service.Available && service.Read() is { Value: > 69 }, "Failed endpoint prevented recovery");
    });
    await Check("dispose unregisters callbacks and ignores queued device changes", async () => {
      using var audio = new AudioFixture(); var service = audio.Create(); int changes = 0; service.Changed += (_, _) => changes++;
      audio.Change("B"); audio.Dispose(); await Task.Delay(80); audio.Change("A"); await Task.Delay(80);
      Assert(changes == 0 && !service.Available && audio.Listener is null && audio.A.Callback is null && audio.B.Callback is null, "Disposed service retained a callback or reconnected");
      service.Dispose();
    });
    await Check("native volume binding follows removal and reconnection", async () => {
      using var audio = new AudioFixture(); var service = audio.Create(); using var model = new SessionModel(Path.Combine(output, "volume-profile"), false, "zh-CN");
      var field = typeof(SessionModel).GetField("volume", BindingFlags.Instance | BindingFlags.NonPublic)!; ((VolumeService)field.GetValue(model)!).Dispose(); field.SetValue(model, service);
      service.Changed += (Action<double, bool>)Delegate.CreateDelegate(typeof(Action<double, bool>), model, "OnVolume");
      var island = new IslandWindow(model, _ => { }); var tag = (TextBlock)island.FindName("SampleTag"); tag.Text = TextCatalog.T("mediaFixtureNotice"); tag.Visibility = Visibility.Visible;
      island.Show(); island.SetShape(Lingyu.Core.IslandShape.Expanded); island.SetExpandedView(Lingyu.Core.IslandExpandedView.Overview); await Task.Delay(300);
      try
      {
        var slider = Descendants(island).OfType<Slider>().First(control => System.Windows.Data.BindingOperations.GetBindingExpression(control, UIElement.IsEnabledProperty)?.ParentBinding.Path?.Path == "VolumeAvailable");
        Assert(System.Windows.Input.Mouse.Capture(slider), "Could not capture volume control for the device-change check");
        try { audio.Change("B"); await Task.Delay(80); Assert(audio.B.Writes == 0, "Binding a new device's volume wrote back to the system while the slider was captured"); }
        finally { System.Windows.Input.Mouse.Capture(null); }
        audio.Change(null); await Task.Delay(80); Assert(!slider.IsEnabled, "Volume slider stayed enabled without an output");
        var mute = Descendants(island).OfType<Button>().First(control => System.Windows.Automation.AutomationProperties.GetName(control) == TextCatalog.T("mute"));
        Assert(!mute.IsEnabled, "Mute button stayed enabled without an output");
        Capture(island, Path.Combine(output, "audio-unavailable-zh-CN.png"));
        audio.Change("B"); await Task.Delay(80); Assert(slider.IsEnabled && slider.Value > 69 && slider.Value < 71, "Volume slider did not recover with device B");
        Capture(island, Path.Combine(output, "audio-reconnected-zh-CN.png"));
      }
      finally { island.Close(); audio.Dispose(); }
    });
    await Check("unavailable selected player stays explicit in native selector", async () => {
      using var model = new SessionModel(Path.Combine(output, "player-profile"), false, "en-US"); model.SelectPlayer("Lingyu.Missing.Fixture");
      var window = new WorkspaceWindow(model, () => { }); window.Navigate("music"); window.Show(); await Task.Delay(80);
      try { var players = Descendants(window).OfType<ComboBox>().First(); Assert(players.SelectedItem?.ToString()?.Contains("Lingyu.Missing.Fixture", StringComparison.Ordinal) == true, "UI shows automatic selection while service is pinned to a missing player"); }
      finally { window.Close(); }
    });
    await Check("island menu shows the unavailable pinned player", async () => {
      using var model = new SessionModel(Path.Combine(output, "island-player-profile"), false, "en-US"); model.SelectPlayer("Lingyu.Missing.Fixture");
      var island = new IslandWindow(model, _ => { }); island.Show(); await Task.Delay(80);
      try
      {
        typeof(IslandWindow).GetMethod("Players", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(island, [island, new RoutedEventArgs()]);
        Assert(island.ContextMenu.Items.OfType<MenuItem>().Any(item => item.IsChecked && !item.IsEnabled && item.Header.ToString()!.Contains("Lingyu.Missing.Fixture", StringComparison.Ordinal)), "Island menu lost the unavailable pinned player");
      }
      finally { if (island.ContextMenu is not null) island.ContextMenu.IsOpen = false; island.Close(); }
    });
    await Check("real default output can be read without altering system settings", () => {
      using var volume = new VolumeService(); Assert(volume.Available && volume.Read() is { Value: >= 0 and <= 100 }, "Current real output could not be read"); return Task.CompletedTask;
    });
    await Check("available external players report capabilities without receiving commands", async () => {
      using var media = new MediaService(); await media.StartAsync(); await Task.Delay(150);
      foreach (string source in media.Players.ToArray()) {
        media.SelectPlayer(source);
        for (int i = 0; i < 30 && media.Snapshot.Source != source; i++) await Task.Delay(50);
        var snapshot = media.Snapshot;
        externalPlayers.Add(new { source, available = snapshot.Source == source, snapshot.Playing, snapshot.CanPlay, snapshot.CanPrevious, snapshot.CanNext, snapshot.CanSeek, hasTimeline = snapshot.Duration > TimeSpan.Zero, hasArtwork = snapshot.Artwork is { Length: > 0 }, commandsIssued = false });
      }
    });
    await Check("real SMTC session reaches the native media adapter", async () => {
      var owner = new Window { Title = TextCatalog.T("mediaFixtureNotice"), Width = 380, Height = 90, Content = Ui.Label("mediaFixtureNotice") }; owner.Show();
      var controls = SystemMediaTransportControlsInterop.GetForWindow(new WindowInteropHelper(owner).Handle);
      using var media = new MediaService();
      try
      {
        controls.IsEnabled = true; controls.IsPlayEnabled = true; controls.IsPauseEnabled = true; controls.PlaybackStatus = MediaPlaybackStatus.Paused;
        controls.DisplayUpdater.Type = MediaPlaybackType.Music; controls.DisplayUpdater.MusicProperties.Title = "LINGYU MEDIA FIXTURE"; controls.DisplayUpdater.MusicProperties.Artist = "Fixture"; controls.DisplayUpdater.Update();
        controls.UpdateTimelineProperties(new SystemMediaTransportControlsTimelineProperties { StartTime = TimeSpan.Zero, EndTime = TimeSpan.FromSeconds(180), Position = TimeSpan.FromSeconds(30), MinSeekTime = TimeSpan.Zero, MaxSeekTime = TimeSpan.FromSeconds(180) });
        await media.StartAsync();
        var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync(); string source = "";
        for (int attempt = 0; attempt < 40 && source.Length == 0; attempt++)
        {
          foreach (var session in manager.GetSessions()) if ((await session.TryGetMediaPropertiesAsync()).Title == "LINGYU MEDIA FIXTURE") { source = session.SourceAppUserModelId; break; }
          if (source.Length == 0) await Task.Delay(100);
        }
        Assert(source.Length > 0, "Own SMTC fixture was not registered with Windows"); media.SelectPlayer(source);
        for (int i = 0; i < 40 && media.Snapshot.Title != "LINGYU MEDIA FIXTURE"; i++) await Task.Delay(100);
        Assert(media.Snapshot.Title == "LINGYU MEDIA FIXTURE" && media.Snapshot.Duration.TotalSeconds == 180 && media.Snapshot.CanPlay, "Own SMTC session was not discovered: " + media.Snapshot.Title);
        string requested = "";
        controls.ButtonPressed += (_, args) => requested = args.Button.ToString();
        Assert(await media.ControlAsync("toggle"), "Own SMTC session rejected play");
        for (int i = 0; i < 20 && requested.Length == 0; i++) await Task.Delay(50);
        Assert(requested == "Play", "Play command did not reach the selected test session: " + requested);
        controls.PlaybackStatus = MediaPlaybackStatus.Playing;
        for (int i = 0; i < 20 && !media.Snapshot.Playing; i++) await Task.Delay(50);
        Assert(media.Snapshot.Playing, "Playback status event was not reflected");
        controls.IsEnabled = false;
        for (int i = 0; i < 40 && media.Snapshot.Title.Length > 0; i++) await Task.Delay(50);
        Assert(media.Snapshot.Title.Length == 0 && !media.Snapshot.CanPlay && media.SelectedPlayer == source, "Removed selected player left an old song or enabled control");
        foreach (string language in new[] { "zh-CN", "en-US" })
        {
          using var model = new SessionModel(Path.Combine(output, "smtc-ui-" + language), false, language); model.SelectPlayer(source); await model.StartAsync();
          var window = new WorkspaceWindow(model, () => { }) { Width = language == "en-US" ? 480 : 1000 }; window.Navigate("music"); var marker = (Border)window.FindName("SampleMarker"); marker.Visibility = Visibility.Visible; ((TextBlock)marker.Child).Text = TextCatalog.T("mediaFixtureNotice"); window.Show(); await Task.Delay(100);
          try
          {
            var players = Descendants(window).OfType<ComboBox>().First(); string unavailable = string.Format(System.Globalization.CultureInfo.CurrentCulture, TextCatalog.T("playerUnavailable"), source);
            Assert(players.SelectedItem?.ToString() == unavailable, "Missing player label is not localized: " + language);
            controls.IsEnabled = true;
            for (int i = 0; i < 40 && model.TrackTitle != "LINGYU MEDIA FIXTURE"; i++) await Task.Delay(50);
            Assert(model.TrackTitle == "LINGYU MEDIA FIXTURE" && players.SelectedItem?.ToString() == source, "Returning player left a stale unavailable label: " + language);
            Capture(window, Path.Combine(output, "player-connected-" + language + ".png"));
            controls.IsEnabled = false;
            for (int i = 0; i < 40 && model.Players.Contains(source); i++) await Task.Delay(50);
            await Task.Delay(100); Assert(!model.CanPlay && !model.CanSeek && players.SelectedItem?.ToString() == unavailable, "Closed player kept active controls or lost selection: " + language);
            Capture(window, Path.Combine(output, "player-unavailable-" + language + ".png"));
            Assert(players.Focus(), "Player selector cannot receive keyboard focus"); players.IsDropDownOpen = true; await Task.Delay(80);
            var popup = (System.Windows.Controls.Primitives.Popup)players.Template.FindName("PART_Popup", players);
            Assert(popup.IsOpen && popup.Child.IsVisible, "Native player selector did not open"); Capture((FrameworkElement)popup.Child, Path.Combine(output, "player-menu-" + language + ".png"));
            var peer = new System.Windows.Automation.Peers.ComboBoxAutomationPeer(players).GetChildren().First(child => child.GetName() == TextCatalog.T("playerAutomatic"));
            ((System.Windows.Automation.Provider.ISelectionItemProvider)peer.GetPattern(System.Windows.Automation.Peers.PatternInterface.SelectionItem)!).Select(); players.IsDropDownOpen = false;
            Assert(model.SelectedPlayer.Length == 0, "Selecting follow-system did not reach the native model");
          }
          finally { window.Close(); controls.IsEnabled = false; }
        }
        smtcVerified = true;
      }
      finally { controls.IsEnabled = false; controls.DisplayUpdater.ClearAll(); owner.Close(); }
    });
    File.WriteAllText(Path.Combine(output, "media-report.json"), JsonSerializer.Serialize(new { results, errors, smtcVerified, externalPlayers, physicalDeviceSwitchVerified = false }, new JsonSerializerOptions { WriteIndented = true }));
    app.Shutdown(errors.Count == 0 ? 0 : 1);
  }
  private static IEnumerable<DependencyObject> Descendants(DependencyObject root)
  { for (int index = 0; index < VisualTreeHelper.GetChildrenCount(root); index++) { var child = VisualTreeHelper.GetChild(root, index); yield return child; foreach (var next in Descendants(child)) yield return next; } }
  private static void Capture(FrameworkElement window, string path)
  {
    window.UpdateLayout(); var bitmap = new RenderTargetBitmap((int)Math.Ceiling(window.ActualWidth), (int)Math.Ceiling(window.ActualHeight), 96, 96, PixelFormats.Pbgra32); bitmap.Render(window); BitmapSource visible = bitmap;
    if (window is IslandWindow island) { var geometry = island.Geometry; visible = new CroppedBitmap(bitmap, new Int32Rect((int)Math.Round((window.ActualWidth - geometry.Width) / 2), 0, (int)Math.Round(geometry.Width), (int)Math.Round(geometry.Height))); }
    var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(visible)); using var file = File.Create(path); encoder.Save(file);
  }

  private sealed class AudioFixture : IDisposable
  {
    internal sealed class Endpoint(float volume, bool muted)
    { public float Volume = volume; public bool Muted = muted; public bool Fail; public int Writes; public object? Callback; }
    public Endpoint A { get; } = new(.2f, false);
    public Endpoint B { get; } = new(.7f, true);
    public object? Listener { get; private set; }
    private string? current = "A";
    private VolumeService? owned;
    private static Type Contract(string name) => typeof(VolumeService).GetNestedType(name, BindingFlags.NonPublic)!;
    private static object Proxy(string name, Func<string, object?[], object?> call)
    { var proxy = DispatchProxy.Create(Contract(name), typeof(AudioProxy)); ((AudioProxy)proxy).Call = call; return proxy; }
    private object Device(Endpoint item) => Proxy("IMMDevice", (method, args) => {
      if (method != "Activate") throw new InvalidOperationException(method);
      args[3] = EndpointProxy(item); return 0;
    });
    private object EndpointProxy(Endpoint item) => Proxy("IAudioEndpointVolume", (method, args) => {
      switch (method)
      {
        case "RegisterControlChangeNotify": item.Callback = args[0]; return 0;
        case "UnregisterControlChangeNotify": item.Callback = null; return 0;
        case "GetMasterVolumeLevelScalar": args[0] = item.Volume; return item.Fail ? unchecked((int)0x88890004) : 0;
        case "GetMute": args[0] = item.Muted; return item.Fail ? unchecked((int)0x88890004) : 0;
        case "SetMasterVolumeLevelScalar": item.Writes++; item.Volume = (float)args[0]!; return 0;
        case "SetMute": item.Muted = (bool)args[0]!; return 0;
        default: throw new InvalidOperationException(method);
      }
    });
    public VolumeService Create()
    {
      var enumerator = Proxy("IMMDeviceEnumerator", (method, args) => {
        switch (method)
        {
          case "GetDefaultAudioEndpoint": args[2] = current is null ? null : Device(current == "A" ? A : B); return current is null ? unchecked((int)0x80070490) : 0;
          case "RegisterEndpointNotificationCallback": Listener = args[0]; return 0;
          case "UnregisterEndpointNotificationCallback": Listener = null; return 0;
          default: throw new InvalidOperationException(method);
        }
      });
      var constructor = typeof(VolumeService).GetConstructor(BindingFlags.Instance | BindingFlags.NonPublic, null, [Contract("IMMDeviceEnumerator")], null);
      return owned = (VolumeService)constructor!.Invoke([enumerator]);
    }
    public void Change(string? name, int flow = 0, int role = 1)
    { current = name; Listener?.GetType().GetMethod("OnDefaultDeviceChanged")!.Invoke(Listener, [flow, role, name]); }
    public static void Notify(object? callback, float value, bool muted)
    {
      if (callback is null) return;
      IntPtr data = Marshal.AllocHGlobal(32);
      try { Marshal.Copy(new byte[32], 0, data, 32); Marshal.WriteInt32(data, 16, muted ? 1 : 0); Marshal.Copy(new[] { value }, 0, data + 20, 1); Marshal.WriteInt32(data, 24, 2); callback.GetType().GetMethod("OnNotify")!.Invoke(callback, [data]); }
      finally { Marshal.FreeHGlobal(data); }
    }
    public void Dispose() => owned?.Dispose();
  }
  /// <summary>仅在验收模式代替 COM 调用，业务状态仍由真实服务维护。</summary>
  public class AudioProxy : DispatchProxy
  {
    /// <summary>夹具提供的 COM 方法结果。</summary>
    public Func<string, object?[], object?> Call { get; set; } = null!;
    /// <summary>转发实际接口调用。</summary>
    protected override object? Invoke(MethodInfo? method, object?[]? args) => Call(method!.Name, args!);
  }
}
