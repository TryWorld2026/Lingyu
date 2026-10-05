/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WeatherChecks.cs @description 隔离天气传输验证城市切换、异步结果与可见性。 @author 灵屿
 */
using System.IO;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.App.Windows;
using Lingyu.Core;

namespace Lingyu.App.Verification;

/// <summary>协议响应来自受控夹具，不把它们标记为真实天气。</summary>
public static class WeatherChecks
{
  private static readonly WeatherCity First = new("City A", "Fixture", 31, 121);
  private static readonly WeatherCity Second = new("City B", "Fixture", 40, 116);
  /// <summary>在实际会话及窗口上复现天气状态错误，数据留在指定目录。</summary>
  public static async Task RunAsync(App app, string output, bool verifyLive = false)
  {
    Directory.CreateDirectory(output); var results = new List<object>(); var errors = new List<string>();
    bool liveWeatherVerified = false;
    async Task Check(string name, Func<Task> test)
    { try { await test(); results.Add(new { name, passed = true }); } catch (Exception error) { results.Add(new { name, passed = false }); errors.Add(name + ": " + error.Message); } }
    void Assert(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
    SessionModel Create(ResponseQueue handler)
    {
      var session = new SessionModel(Path.Combine(output, "profile-" + Guid.NewGuid().ToString("N")), false, "zh-CN");
      var field = typeof(SessionModel).GetField("http", BindingFlags.Instance | BindingFlags.NonPublic)!;
      ((HttpClient)field.GetValue(session)!).Dispose(); field.SetValue(session, new HttpClient(handler)); return session;
    }
    await Check("switching cities clears prior weather while loading and after failure", async () => {
      using var handler = new ResponseQueue(); handler.Enqueue(Reply(26)); var pending = handler.Hold(); using var session = Create(handler);
      await session.SelectCityAsync(First); var selecting = session.SelectCityAsync(Second);
      bool clearedWhileLoading = session.Temperature == "—" && session.Forecast.Count == 0;
      pending.SetResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)); await selecting;
      Assert(clearedWhileLoading && session.WeatherCityName == Second.Name && session.Temperature == "—" && session.Forecast.Count == 0 && session.WeatherDescription == TextCatalog.T("weatherOffline"), "Old city's temperature or forecast remains under the new city");
    });
    await Check("late first city response cannot replace second city", async () => {
      using var handler = new ResponseQueue(); var first = handler.Hold(); handler.Enqueue(Reply(5)); using var session = Create(handler);
      var old = session.SelectCityAsync(First); await session.SelectCityAsync(Second); first.SetResult(Reply(26)); await old;
      Assert(session.WeatherCityName == Second.Name && session.Temperature == "5°", "Late City A replaced City B weather");
    });
    await Check("visible weather refreshes after cache expiry", async () => {
      using var handler = new ResponseQueue(); handler.Enqueue(Reply(26)); handler.Enqueue(Reply(8)); using var session = Create(handler);
      await session.SelectCityAsync(First);
      typeof(SessionModel).GetField("weatherFetched", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(session, DateTimeOffset.Now.AddMinutes(-31));
      var window = new WorkspaceWindow(session, () => { }); window.Show();
      try { session.Tick(); await Task.Delay(150); Assert(handler.Requests == 2 && session.Temperature == "8°", "Visible weather kept expired cache without a request"); }
      finally { window.Close(); }
    });
    await Check("fresh cache and hidden weather do not trigger requests", async () => {
      using var handler = new ResponseQueue(); handler.Enqueue(Reply(26)); using var session = Create(handler);
      await session.SelectCityAsync(First); var window = new WorkspaceWindow(session, () => { }); window.Show();
      try { session.Tick(); await Task.Delay(80); Assert(handler.Requests == 1, "Fresh cache was fetched again"); }
      finally { window.Close(); }
      typeof(SessionModel).GetField("weatherFetched", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(session, DateTimeOffset.Now.AddMinutes(-31));
      session.Tick(); await Task.Delay(80); Assert(handler.Requests == 1, "Closed weather page kept polling");
    });
    await Check("minimized workspace pauses automatic refresh and resumes when restored", async () => {
      using var handler = new ResponseQueue(); handler.Enqueue(Reply(26)); handler.Enqueue(Reply(8)); using var session = Create(handler); await session.SelectCityAsync(First);
      var window = new WorkspaceWindow(session, () => { }); window.Show(); await Task.Delay(80);
      try
      {
        window.WindowState = WindowState.Minimized; await Task.Delay(80);
        typeof(SessionModel).GetField("weatherFetched", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(session, DateTimeOffset.Now.AddMinutes(-31));
        session.Tick(); await Task.Delay(80); Assert(handler.Requests == 1, "Minimized workspace still refreshed weather");
        window.WindowState = WindowState.Normal; await Task.Delay(100); session.Tick(); await Task.Delay(80);
        Assert(handler.Requests == 2 && session.Temperature == "8°", "Restoring workspace did not refresh expired weather");
      }
      finally { window.Close(); }
    });
    await Check("island refreshes in expanded weather and pauses when docked or hidden", async () => {
      using var handler = new ResponseQueue(); handler.Enqueue(Reply(26)); handler.Enqueue(Reply(8)); handler.Enqueue(Reply(9)); using var session = Create(handler); await session.SelectCityAsync(First);
      var island = new IslandWindow(session, _ => { }); island.Show(); await Task.Delay(80);
      try
      {
        typeof(SessionModel).GetField("weatherFetched", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(session, DateTimeOffset.Now.AddMinutes(-31));
        session.Tick(); await Task.Delay(80); Assert(handler.Requests == 1, "Docked island requested invisible weather");
        island.SetShape(IslandShape.Expanded); await Task.Delay(350); session.Tick(); await Task.Delay(80);
        Assert(handler.Requests == 2 && session.Temperature == "8°", "Expanded weather failed to refresh");
        island.Hide(); typeof(SessionModel).GetField("weatherFetched", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(session, DateTimeOffset.Now.AddMinutes(-31));
        session.Tick(); await Task.Delay(80); Assert(handler.Requests == 2, "Hidden island kept requesting weather");
        island.Show(); await Task.Delay(100); session.Tick(); await Task.Delay(80); Assert(handler.Requests == 3 && session.Temperature == "9°", "Showing expanded weather did not resume refresh");
      }
      finally { island.Close(); }
    });
    await Check("repeated ticks do not duplicate a pending refresh", async () => {
      using var handler = new ResponseQueue(); handler.Enqueue(Reply(26)); var pending = handler.Hold(); using var session = Create(handler);
      await session.SelectCityAsync(First);
      typeof(SessionModel).GetField("weatherFetched", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(session, DateTimeOffset.Now.AddMinutes(-31));
      var window = new WorkspaceWindow(session, () => { }); window.Show();
      try
      {
        for (int index = 0; index < 10; index++) session.Tick(); await Task.Delay(80);
        Assert(handler.Requests == 2, "Refresh did not start once for the visible expired cache");
      }
      finally { pending.SetResult(Reply(8)); await Task.Delay(80); window.Close(); }
    });
    await Check("malformed response cannot partially overwrite cached weather", async () => {
      using var handler = new ResponseQueue(); handler.Enqueue(Reply(26)); using var session = Create(handler);
      await session.SelectCityAsync(First);
      handler.Enqueue(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"current\":{\"time\":\"2026-10-04T14:00\",\"temperature_2m\":5,\"weather_code\":2},\"daily\":{\"temperature_2m_max\":[9],\"temperature_2m_min\":[1]},\"hourly\":{\"time\":[\"not-a-date\"],\"temperature_2m\":[5],\"weather_code\":[2]}}") });
      typeof(SessionModel).GetField("weatherFetched", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(session, DateTimeOffset.Now.AddMinutes(-31));
      await session.RefreshWeatherAsync();
      Assert(session.Temperature == "26°" && session.Forecast.Count > 0, "Invalid response partially changed the cache");
    });
    await Check("disposed session ignores a late response", async () => {
      using var handler = new ResponseQueue(); var pending = handler.Hold(); var session = Create(handler);
      var selecting = session.SelectCityAsync(First); int notifications = 0;
      session.PropertyChanged += (_, _) => notifications++; session.StructureChanged += _ => notifications++;
      session.Dispose(); pending.SetResult(Reply(26)); await selecting;
      Assert(notifications == 0 && session.Temperature == "—", "Disposed session still published a weather result");
    });
    await Check("same-city failure labels retained cache and allows manual retry", async () => {
      using var handler = new ResponseQueue(); handler.Enqueue(Reply(26)); using var session = Create(handler); await session.SelectCityAsync(First);
      handler.Enqueue(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)); handler.Enqueue(Reply(8));
      var window = new WorkspaceWindow(session, () => { }); MarkFixture(window); window.Show(); await Task.Delay(80);
      try
      {
        typeof(SessionModel).GetField("weatherFetched", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(session, DateTimeOffset.Now.AddMinutes(-31));
        session.Tick(); await Task.Delay(80);
        for (int index = 0; index < 20; index++) session.Tick();
        Assert(handler.Requests == 2 && session.Temperature == "26°" && session.Forecast.Count > 0, "Failure discarded same-city cache or retried on every tick");
        var status = TextFor(window, "WeatherUpdateStatus");
        Assert(status.Text == session.WeatherUpdateStatus && status.Text != session.WeatherDescription && status.Text.Length > 0 && status.ToolTip as string == session.WeatherUpdatedAt && !string.IsNullOrEmpty(session.WeatherUpdatedAt), "Stale data has no visible status and update time");
        Capture(window, Path.Combine(output, "weather-stale-zh-CN.png"));
        var refresh = Descendants(window).OfType<Button>().Single(button => AutomationProperties.GetAutomationId(button) == "WeatherRefresh");
        refresh.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent)); await Task.Delay(80);
        Assert(handler.Requests == 3 && session.Temperature == "8°" && session.WeatherUpdateStatus == TextFor(window, "WeatherUpdateStatus").Text, "Manual retry did not replace stale cache");
      }
      finally { window.Close(); }
    });
    foreach (string language in new[] { "zh-CN", "en-US" })
      await Check("loading and failure are visible in native windows " + language, async () => {
        using var handler = new ResponseQueue(); handler.Enqueue(Reply(26)); var pending = handler.Hold(); using var session = Create(handler); session.SetLanguage(language); await session.SelectCityAsync(First);
        var window = new WorkspaceWindow(session, () => { }); MarkFixture(window); window.Show(); await Task.Delay(80);
        var island = new IslandWindow(session, _ => { }); var marker = (TextBlock)island.FindName("SampleTag"); marker.Text = TextCatalog.T("weatherFixtureNotice"); marker.Visibility = Visibility.Visible;
        try
        {
          var selecting = session.SelectCityAsync(Second); await Task.Delay(50); window.Width = 480; window.UpdateLayout();
          var description = TextFor(window, "WeatherDescription"); await Task.Delay(50); window.UpdateLayout();
          var pageScroll = (ScrollViewer)((ContentControl)window.FindName("Page")).Content;
          var weatherBody = (FrameworkElement)description.Parent; pageScroll.ScrollToVerticalOffset(weatherBody.TranslatePoint(new Point(), (UIElement)pageScroll.Content).Y - 32); await Task.Delay(50);
          Assert(TextFor(window, "WeatherCityName").Text == Second.Name && TextFor(window, "Temperature").Text == "—" && description.Text == TextCatalog.T("weatherLoading"), "Loading window mixes old weather and selected city");
          var refresh = Descendants(window).OfType<Button>().Single(button => AutomationProperties.GetAutomationId(button) == "WeatherRefresh");
          Assert(!refresh.IsEnabled, "Loading allows duplicate refresh clicks");
          Capture(window, Path.Combine(output, "weather-loading-" + language + ".png"));
          pending.SetResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)); await selecting; await Task.Delay(50);
          Assert(description.Text == TextCatalog.T("weatherOffline") && TextFor(window, "Temperature").Text == "—" && refresh.IsEnabled, "Failure state lacks clear weather and retry");
          Capture(window, Path.Combine(output, "weather-offline-" + language + ".png"));
          island.Show(); island.SetShape(IslandShape.Expanded); await Task.Delay(350); island.UpdateLayout();
          Assert(TextFor(island, "WeatherDescription").Text == TextCatalog.T("weatherOffline") && TextFor(island, "Temperature").Text == "—" && ((Panel)island.FindName("ForecastPanel")).Children.Count == 0, "Island retains previous forecast on failure");
          Capture(island, Path.Combine(output, "weather-island-offline-" + language + ".png"));
        }
        finally { pending.TrySetResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)); island.Close(); window.Close(); }
      });
    if (verifyLive) await Check("live Open-Meteo response renders in the native workspace", async () => {
      using var session = new SessionModel(Path.Combine(output, "live-profile"), false, "zh-CN");
      await session.SelectCityAsync(new WeatherCity(TextCatalog.T("demoCity"), "China", 31.23, 121.47));
      Assert(session.Temperature != "—" && session.Forecast.Count > 0 && !string.IsNullOrEmpty(session.WeatherUpdatedAt), "Live weather service did not return usable data");
      var window = new WorkspaceWindow(session, () => { }); window.Title = TextCatalog.T("weatherLiveNotice");
      var marker = (Border)window.FindName("SampleMarker"); marker.Visibility = Visibility.Visible; ((TextBlock)marker.Child).Text = TextCatalog.T("weatherLiveNotice");
      window.Show(); await Task.Delay(100);
      try
      {
        Assert(TextFor(window, "Temperature").Text == session.Temperature && TextFor(window, "WeatherUpdateStatus").Text == session.WeatherUpdateStatus, "Live service data is absent from native controls");
        Capture(window, Path.Combine(output, "weather-live-zh-CN.png")); liveWeatherVerified = true;
      }
      finally { window.Close(); }
    });
    File.WriteAllText(Path.Combine(output, "weather-report.json"), JsonSerializer.Serialize(new { results, errors, liveWeatherAttempted = verifyLive, liveWeatherVerified }, new JsonSerializerOptions { WriteIndented = true }));
    app.Shutdown(errors.Count == 0 ? 0 : 1);
  }
  private static IEnumerable<DependencyObject> Descendants(DependencyObject root)
  { for (int index = 0; index < VisualTreeHelper.GetChildrenCount(root); index++) { var child = VisualTreeHelper.GetChild(root, index); yield return child; foreach (var next in Descendants(child)) yield return next; } }
  private static TextBlock TextFor(DependencyObject root, string property) => Descendants(root).OfType<TextBlock>().First(text => BindingOperations.GetBindingExpression(text, TextBlock.TextProperty)?.ParentBinding.Path?.Path == property);
  private static void MarkFixture(WorkspaceWindow window)
  {
    window.Title = TextCatalog.T("weatherFixtureNotice"); var marker = (Border)window.FindName("SampleMarker"); marker.Visibility = Visibility.Visible; ((TextBlock)marker.Child).Text = TextCatalog.T("weatherFixtureNotice");
  }
  private static void Capture(Window window, string path)
  {
    window.UpdateLayout(); var bitmap = new RenderTargetBitmap((int)Math.Ceiling(window.ActualWidth), (int)Math.Ceiling(window.ActualHeight), 96, 96, PixelFormats.Pbgra32); bitmap.Render(window);
    BitmapSource visible = bitmap;
    if (window is IslandWindow island) { var geometry = island.Geometry; visible = new CroppedBitmap(bitmap, new Int32Rect((int)Math.Round((window.ActualWidth - geometry.Width) / 2), 0, (int)Math.Round(geometry.Width), (int)Math.Round(geometry.Height))); }
    var png = new PngBitmapEncoder(); png.Frames.Add(BitmapFrame.Create(visible)); using var file = File.Create(path); png.Save(file);
  }
  private static HttpResponseMessage Reply(int temperature) => new(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(new {
    current = new { time = "2026-10-04T14:00", temperature_2m = temperature, weather_code = 2 },
    daily = new { temperature_2m_max = new[] { temperature + 4 }, temperature_2m_min = new[] { temperature - 4 } },
    hourly = new { time = new[] { "2026-10-04T14:00", "2026-10-04T17:00" }, temperature_2m = new[] { temperature, temperature + 1 }, weather_code = new[] { 2, 0 } }
  })) };
  private sealed class ResponseQueue : HttpMessageHandler
  {
    private readonly Queue<Task<HttpResponseMessage>> responses = new();
    public int Requests { get; private set; }
    public void Enqueue(HttpResponseMessage response) => responses.Enqueue(Task.FromResult(response));
    public TaskCompletionSource<HttpResponseMessage> Hold()
    { var pending = new TaskCompletionSource<HttpResponseMessage>(TaskCreationOptions.RunContinuationsAsynchronously); responses.Enqueue(pending.Task); return pending; }
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    { Requests++; return responses.Count > 0 ? responses.Dequeue() : Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)); }
  }
}
