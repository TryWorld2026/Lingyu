/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WorkspacePages.Settings.cs @description 精简的原生偏好和明确的模型连接。 @author 灵屿
 */
using System.Windows;
using System.Windows.Controls;
using System.Security.Cryptography;
using Lingyu.App.Localization;
using Lingyu.App.Models;

namespace Lingyu.App.Views;

internal static partial class WorkspacePages
{
  /// <summary>模型和天气均由用户明确选择，不自行启动其他程序。</summary>
  public static UIElement Settings(SessionModel model)
  {
    var root = new StackPanel(); root.Children.Add(Ui.Header("settingsHeading", "settingsSubtitle"));
    var appearance = new StackPanel(); appearance.Children.Add(Ui.Label("appearance", 16)); var languages = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 15, 0, 17) };
    languages.Children.Add(Ui.Label("language", 13, "Muted"));
    foreach (var option in new[] { ("zh-CN", "languageChinese"), ("en-US", "languageEnglish") })
    { var button = Ui.Button(TextCatalog.T(option.Item2), () => model.SetLanguage(option.Item1)); button.Margin = new Thickness(16, 0, 0, 0); button.Padding = new Thickness(14, 7, 14, 7); if (TextCatalog.Current.Language == option.Item1) button.BorderBrush = Ui.Brush("Accent"); languages.Children.Add(button); }
    appearance.Children.Add(languages);
    var motion = new CheckBox { Content = TextCatalog.T("reduceMotion"), IsChecked = model.ReduceMotion, FontSize = 13 }; motion.Click += (_, _) => model.SetReduceMotion(motion.IsChecked == true); appearance.Children.Add(motion); root.Children.Add(Ui.Surface(appearance));
    var columns = new Grid { Margin = new Thickness(0, 18, 0, 18) }; columns.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) }); columns.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(16) }); columns.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
    var weather = new StackPanel(); weather.Children.Add(Ui.Label("weatherCity", 16)); weather.Children.Add(new TextBlock { Text = model.City?.Name ?? TextCatalog.T("weatherNotSet"), Foreground = Ui.Brush("Muted"), FontSize = 12, Margin = new Thickness(0, 10, 0, 15), TextWrapping = TextWrapping.Wrap });
    var city = Ui.Input("weatherSearchHint", "CityInput"); weather.Children.Add(city); var results = new StackPanel { Margin = new Thickness(0, 10, 0, 0) }; var search = Ui.Button(TextCatalog.T("weatherSearch"), () => { }); search.Margin = new Thickness(0, 10, 0, 0); weather.Children.Add(search); weather.Children.Add(results);
    async void Search()
    {
      if (string.IsNullOrWhiteSpace(city.Text)) return; search.IsEnabled = false; results.Children.Clear();
      try
      {
        foreach (var candidate in await model.SearchCitiesAsync(city.Text))
        {
          var choose = Ui.Button(candidate.Name + " · " + candidate.Country, () => { _ = model.SelectCityAsync(candidate); }, "NavButton"); choose.ToolTip = TextCatalog.T("weatherSelect"); results.Children.Add(choose);
        }
        if (results.Children.Count == 0) results.Children.Add(Ui.Label("weatherNoResults", 12, "Muted"));
      }
      catch (Exception error) when (error is System.Net.Http.HttpRequestException or OperationCanceledException or System.Text.Json.JsonException) { model.Emit("weatherOffline"); }
      finally { search.IsEnabled = true; }
    }
    search.Click += (_, _) => Search(); city.KeyDown += (_, e) => { if (e.Key == System.Windows.Input.Key.Enter) { Search(); e.Handled = true; } };
    var credit = Ui.Label("weatherAttribution", 10, "Faint"); credit.Margin = new Thickness(0, 15, 0, 0); weather.Children.Add(credit); columns.Children.Add(Ui.Surface(weather));
    var ai = new StackPanel(); ai.Children.Add(Ui.Label("aiConfigure", 16)); string provider = model.Connection?.Provider ?? "ollama";
    var modes = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 15, 0, 14) }; var local = Ui.Button(TextCatalog.T("aiLocal"), () => { }); var cloud = Ui.Button(TextCatalog.T("aiCloud"), () => { }); local.Padding = cloud.Padding = new Thickness(10, 7, 10, 7); cloud.Margin = new Thickness(8, 0, 0, 0); modes.Children.Add(local); modes.Children.Add(cloud); ai.Children.Add(modes);
    var endpoint = Ui.Input("aiEndpoint", "AiEndpoint"); endpoint.Text = model.Connection?.Endpoint ?? "http://localhost:11434";
    var modelInput = Ui.Input("aiModel", "AiModel"); modelInput.Text = model.Connection?.Model ?? "";
    var password = new PasswordBox { Background = Ui.Brush("Surface"), Foreground = Ui.Brush("Ink"), BorderBrush = Ui.Brush("Line"), Padding = new Thickness(12), FontSize = 13 }; password.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, TextCatalog.T("aiKey"));
    foreach (var field in new[] { ("aiEndpoint", (Control)endpoint), ("aiModel", (Control)modelInput), ("aiKey", (Control)password) })
    { var label = Ui.Label(field.Item1, 11, "Muted"); label.Margin = new Thickness(0, 8, 0, 7); ai.Children.Add(label); ai.Children.Add(field.Item2); }
    var hint = Ui.Label(model.Connection?.ProtectedKey.Length > 0 ? "aiKeySaved" : "aiKeyHint", 10, "Muted"); hint.Margin = new Thickness(0, 10, 0, 0); ai.Children.Add(hint);
    void Select(string value)
    {
      provider = value; local.BorderBrush = Ui.Brush(value == "ollama" ? "Accent" : "Line"); cloud.BorderBrush = Ui.Brush(value == "openai" ? "Accent" : "Line"); password.IsEnabled = value != "ollama";
    }
    local.Click += (_, _) => { endpoint.Text = "http://localhost:11434"; Select("ollama"); };
    cloud.Click += (_, _) => { if (provider == "ollama") endpoint.Text = "https://api.openai.com/v1"; Select("openai"); }; Select(provider);
    var connect = Ui.Button(TextCatalog.T("aiSaveTest"), () => { }, "Primary"); connect.Margin = new Thickness(0, 17, 0, 12);
    connect.Click += async (_, _) => {
      connect.IsEnabled = false;
      try { model.SaveConnection(provider, endpoint.Text, modelInput.Text, password.Password); password.Clear(); bool connected = await model.TestConnectionAsync(); model.Emit(connected ? "aiConnected" : "aiFailed"); }
      catch (Exception error) when (error is ArgumentException or CryptographicException) { model.Emit("aiFailed"); }
      finally { connect.IsEnabled = true; }
    };
    ai.Children.Add(connect); ai.Children.Add(Ui.Label("aiCost", 10, "Muted")); var aiSurface = Ui.Surface(ai); Grid.SetColumn(aiSurface, 2); columns.Children.Add(aiSurface); root.Children.Add(columns);
    var scope = Ui.Label("previewScope", 11, "Muted"); scope.Margin = new Thickness(0, 0, 0, 10); root.Children.Add(scope); return Ui.Scroll(root);
  }
}
