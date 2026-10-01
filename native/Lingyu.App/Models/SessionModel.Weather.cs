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
  public string WeatherGlyph => (!Showcase && weatherCode == 0) ? "sun" : "cloud";
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
  public async Task SelectCityAsync(WeatherCity city) { state = state with { City = city }; Persist(); weatherFetched = default; await RefreshWeatherAsync(); StructureChanged?.Invoke(); }
  /// <summary>天气请求有明确超时与缓存；失败不伪造预报。</summary>
  public async Task RefreshWeatherAsync()
  {
    if (City is not { } city || Showcase || DateTimeOffset.Now - weatherFetched < TimeSpan.FromMinutes(30)) return;
    weatherStatus = "weatherLoading"; Notify(nameof(WeatherDescription));
    try
    {
      string coordinates = "latitude=" + city.Latitude.ToString(CultureInfo.InvariantCulture) + "&longitude=" + city.Longitude.ToString(CultureInfo.InvariantCulture);
      using var document = JsonDocument.Parse(await http.GetStringAsync("https://api.open-meteo.com/v1/forecast?" + coordinates + "&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=auto"));
      var root = document.RootElement; var current = root.GetProperty("current");
      temperature = (int)Math.Round(current.GetProperty("temperature_2m").GetDouble()); weatherCode = current.GetProperty("weather_code").GetInt32();
      high = (int)Math.Round(root.GetProperty("daily").GetProperty("temperature_2m_max")[0].GetDouble()); low = (int)Math.Round(root.GetProperty("daily").GetProperty("temperature_2m_min")[0].GetDouble());
      var hourly = root.GetProperty("hourly"); var times = hourly.GetProperty("time");
      var target = DateTime.Parse(current.GetProperty("time").GetString()!, CultureInfo.InvariantCulture);
      forecast = []; int index = 0;
      while (index < times.GetArrayLength() - 1 && DateTime.Parse(times[index].GetString()!, CultureInfo.InvariantCulture) < target) index++;
      for (int i = index; i < Math.Min(index + 15, times.GetArrayLength()); i += 3)
        forecast.Add((DateTime.Parse(times[i].GetString()!, CultureInfo.InvariantCulture).ToString("HH:mm"), (int)Math.Round(hourly.GetProperty("temperature_2m")[i].GetDouble()), hourly.GetProperty("weather_code")[i].GetInt32()));
      weatherFetched = DateTimeOffset.Now;
    }
    catch (Exception error) when (error is HttpRequestException or TaskCanceledException or JsonException) { weatherStatus = "weatherOffline"; }
    Notify(nameof(WeatherCityName), nameof(Temperature), nameof(HighLow), nameof(WeatherDescription), nameof(WeatherGlyph));
    StructureChanged?.Invoke();
  }
}
