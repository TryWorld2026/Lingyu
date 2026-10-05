/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file SessionModel.Weather.cs @description 选择城市后获取实际天气，避免默认假数据。 @author 灵屿
 */
using System.Net.Http;
using System.Globalization;
using System.Text.Json;
using Lingyu.App.Localization;
using Lingyu.Core;

namespace Lingyu.App.Models;

public sealed partial class SessionModel
{
  private readonly HttpClient http = new() { Timeout = TimeSpan.FromSeconds(12) };
  private int? temperature;
  private int weatherCode;
  private int? high;
  private int? low;
  private string weatherStatus = "weatherNotSet";
  private DateTimeOffset weatherFetched;
  private DateTimeOffset weatherNextAttempt;
  private CancellationTokenSource? weatherRequest;
  private int weatherRevision;
  private int weatherViews;
  private List<(string Time, int Temperature, int Code)> forecast = [];
  /// <summary>用户选择或已明确标注的样例城市。</summary>
  public string WeatherCityName => Showcase ? TextCatalog.T("demoCity") : City?.Name ?? TextCatalog.T("weatherChoose");
  /// <summary>真实温度。</summary>
  public string Temperature => Showcase ? "18°" : temperature is { } value ? $"{value}°" : "—";
  /// <summary>高低温。</summary>
  public string HighLow => Showcase ? "↑ 22°   ↓ 14°" : high is { } h && low is { } l ? $"↑ {h}°   ↓ {l}°" : "";
  /// <summary>真实天气说明。</summary>
  public string WeatherDescription => temperature.HasValue || Showcase ? TextCatalog.T(WeatherKey(Showcase ? 2 : weatherCode)) : TextCatalog.T(weatherStatus);
  /// <summary>天气图标。</summary>
  public string WeatherGlyph => !Showcase && temperature.HasValue && weatherCode == 0 ? "sun" : "cloud";
  /// <summary>刷新或缓存失败状态与天气本身分别呈现。</summary>
  public string WeatherUpdateStatus => Showcase || City is null ? "" : weatherRequest is not null ? temperature.HasValue ? TextCatalog.T("weatherLoading") : ""
    : weatherStatus == "weatherOffline" && temperature.HasValue ? string.Format(CultureInfo.CurrentCulture, TextCatalog.T("weatherStale"), WeatherFetchedLabel)
    : weatherFetched == default ? "" : string.Format(CultureInfo.CurrentCulture, TextCatalog.T("weatherUpdated"), WeatherFetchedLabel);
  /// <summary>完整更新时间供提示和辅助技术读取。</summary>
  public string WeatherUpdatedAt => weatherFetched == default ? "" : weatherFetched.ToLocalTime().ToString("g", CultureInfo.GetCultureInfo(TextCatalog.Current.Language));
  /// <summary>真实城市可主动刷新，重复请求期间禁用按钮。</summary>
  public bool CanRefreshWeather => !Showcase && City is not null && weatherRequest is null && !disposed;
  private string WeatherFetchedLabel => weatherFetched.LocalDateTime.Date == DateTime.Now.Date ? weatherFetched.ToLocalTime().ToString("HH:mm", CultureInfo.InvariantCulture) : WeatherUpdatedAt;
  /// <summary>小时预报列表。</summary>
  public IReadOnlyList<(string Time, int Temperature, int Code)> Forecast => Showcase
    ? [(TextCatalog.T("weatherCurrent"), 18, 2), ("11:00", 20, 1), ("14:00", 22, 1), ("17:00", 21, 2), ("20:00", 17, 0)] : forecast;
  private static string WeatherKey(int code) => code switch
    { 0 => "weatherClear", <= 3 => "weatherCloudy", <= 48 => "weatherFog", <= 67 => "weatherRain", <= 77 => "weatherSnow", <= 82 => "weatherRain", <= 86 => "weatherSnow", _ => "weatherStorm" };

  /// <summary>搜索城市并返回可选位置，避免静默选择同名城市。</summary>
  public async Task<IReadOnlyList<WeatherCity>> SearchCitiesAsync(string query)
  {
    if (string.IsNullOrWhiteSpace(query)) return [];
    using var document = JsonDocument.Parse(await http.GetStringAsync("https://geocoding-api.open-meteo.com/v1/search?count=5&language=" + (TextCatalog.Current.Language == "zh-CN" ? "zh" : "en") + "&name=" + Uri.EscapeDataString(query.Trim())));
    if (!document.RootElement.TryGetProperty("results", out var results)) return [];
    return results.EnumerateArray().Select(city => new WeatherCity(city.GetProperty("name").GetString()!,
      city.TryGetProperty("country", out var country) ? country.GetString()! : "",
      city.GetProperty("latitude").GetDouble(), city.GetProperty("longitude").GetDouble())).ToList();
  }
  /// <summary>保存用户明确选择的城市并获取天气。</summary>
  public async Task SelectCityAsync(WeatherCity city)
  {
    if (disposed || Showcase) return;
    if (City != city)
    {
      state = state with { City = city }; Persist();
      weatherRevision++; weatherRequest?.Cancel(); weatherRequest = null;
      temperature = high = low = null; weatherCode = 0; forecast = []; weatherFetched = default; weatherNextAttempt = default; weatherStatus = "weatherLoading";
      NotifyWeather();
    }
    await RefreshWeatherAsync(true);
  }
  /// <summary>可见视图持有刷新需求；释放后不再因定时回调请求天气。</summary>
  public IDisposable WatchWeather()
  {
    weatherViews++; _ = RefreshWeatherAsync(); return new WeatherView(this);
  }
  /// <summary>单次请求与当前城市绑定；有效缓存和失败退避不会重复请求。</summary>
  public async Task RefreshWeatherAsync(bool force = false)
  {
    if (disposed || Showcase || City is not { } city || weatherRequest is not null) return;
    if (!force && (DateTimeOffset.Now - weatherFetched < TimeSpan.FromMinutes(30) || DateTimeOffset.Now < weatherNextAttempt)) return;
    int revision = ++weatherRevision; using var request = new CancellationTokenSource(); weatherRequest = request;
    weatherStatus = "weatherLoading"; NotifyWeather();
    try
    {
      string coordinates = "latitude=" + city.Latitude.ToString(CultureInfo.InvariantCulture) + "&longitude=" + city.Longitude.ToString(CultureInfo.InvariantCulture);
      using var document = JsonDocument.Parse(await http.GetStringAsync("https://api.open-meteo.com/v1/forecast?" + coordinates + "&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=auto", request.Token));
      if (disposed || revision != weatherRevision || City != city) return;
      var root = document.RootElement; var current = root.GetProperty("current");
      int nextTemperature = checked((int)Math.Round(current.GetProperty("temperature_2m").GetDouble())); int nextCode = current.GetProperty("weather_code").GetInt32();
      int nextHigh = checked((int)Math.Round(root.GetProperty("daily").GetProperty("temperature_2m_max")[0].GetDouble())); int nextLow = checked((int)Math.Round(root.GetProperty("daily").GetProperty("temperature_2m_min")[0].GetDouble()));
      var hourly = root.GetProperty("hourly"); var times = hourly.GetProperty("time");
      var temperatures = hourly.GetProperty("temperature_2m"); var codes = hourly.GetProperty("weather_code");
      if (times.GetArrayLength() == 0 || times.GetArrayLength() != temperatures.GetArrayLength() || times.GetArrayLength() != codes.GetArrayLength()) throw new JsonException("Inconsistent hourly weather arrays");
      var target = DateTime.Parse(current.GetProperty("time").GetString()!, CultureInfo.InvariantCulture);
      var nextForecast = new List<(string Time, int Temperature, int Code)>(); int index = 0;
      while (index < times.GetArrayLength() - 1 && DateTime.Parse(times[index].GetString()!, CultureInfo.InvariantCulture) < target) index++;
      for (int i = index; i < Math.Min(index + 15, times.GetArrayLength()); i += 3)
        nextForecast.Add((DateTime.Parse(times[i].GetString()!, CultureInfo.InvariantCulture).ToString("HH:mm", CultureInfo.InvariantCulture), checked((int)Math.Round(temperatures[i].GetDouble())), codes[i].GetInt32()));
      // 全部解析成功后再替换缓存，异常不能留下半份新数据。
      temperature = nextTemperature; weatherCode = nextCode; high = nextHigh; low = nextLow; forecast = nextForecast;
      weatherFetched = DateTimeOffset.Now; weatherNextAttempt = default; weatherStatus = "";
    }
    catch (Exception error) when (error is HttpRequestException or OperationCanceledException or JsonException or InvalidOperationException or KeyNotFoundException or FormatException or ArgumentException or IndexOutOfRangeException or OverflowException)
    {
      if (disposed || revision != weatherRevision || City != city) return;
      weatherStatus = "weatherOffline"; weatherNextAttempt = DateTimeOffset.Now.AddMinutes(1);
    }
    finally { if (revision == weatherRevision) { weatherRequest = null; if (!disposed) NotifyWeather(); } }
  }
  private void NotifyWeather()
  {
    Notify(nameof(WeatherCityName), nameof(Temperature), nameof(HighLow), nameof(WeatherDescription), nameof(WeatherGlyph), nameof(WeatherUpdateStatus), nameof(WeatherUpdatedAt), nameof(CanRefreshWeather));
    StructureChanged?.Invoke(ChangeArea.Weather);
  }
  private sealed class WeatherView(SessionModel owner) : IDisposable
  {
    private SessionModel? session = owner;
    /// <summary>每个可见视图只释放一次计数，不持有窗口对象。</summary>
    public void Dispose() { if (session is null) return; session.weatherViews--; session = null; }
  }
}
