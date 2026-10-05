/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WorkspacePages.Today.cs @description 今日页以实际音乐与正在做的事组织。 @author 灵屿
 */
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using Lingyu.App.Controls;
using Lingyu.App.Localization;
using Lingyu.App.Models;

namespace Lingyu.App.Views;

/// <summary>工作台的页面构建器只创建用户当前需要的内容。</summary>
internal static partial class WorkspacePages
{
  /// <summary>今日入口连接音乐、天气、专注与任务。</summary>
  public static UIElement Today(SessionModel model, Action<string> navigate)
  {
    var root = new StackPanel();
    var date = Ui.BoundText("Date", 11, "Faint"); date.Margin = new Thickness(0, 0, 0, 14); root.Children.Add(date);
    root.Children.Add(Ui.Header("todayTitle", "todaySubtitle"));
    var music = Music(model);
    var weatherBody = new StackPanel();
    Ui.WatchWeather(weatherBody, model);
    weatherBody.Children.Add(Ui.Label("weather", 11, "Muted"));
    var city = Ui.BoundText("WeatherCityName", 17); city.Margin = new Thickness(0, 14, 0, 8); weatherBody.Children.Add(city);
    var temperature = Ui.BoundText("Temperature", 44); weatherBody.Children.Add(temperature);
    weatherBody.Children.Add(Ui.BoundText("WeatherDescription", 12, "Muted"));
    var weatherStatus = Ui.BoundText("WeatherUpdateStatus", 11, "Muted"); weatherStatus.Margin = new Thickness(0, 6, 0, 0); weatherStatus.SetBinding(ToolTipService.ToolTipProperty, "WeatherUpdatedAt"); weatherBody.Children.Add(weatherStatus);
    var weatherActions = new WrapPanel { Margin = new Thickness(0, 13, 0, 0) };
    var select = Ui.Button(TextCatalog.T("weatherChoose"), () => navigate("settings")); select.Padding = new Thickness(10, 6, 10, 6); select.Margin = new Thickness(0, 0, 8, 8); weatherActions.Children.Add(select);
    var refresh = Ui.Button(TextCatalog.T("weatherRefresh"), async () => await model.RefreshWeatherAsync(true)); refresh.Padding = new Thickness(10, 6, 10, 6); refresh.Margin = new Thickness(0, 0, 0, 8); refresh.SetBinding(UIElement.IsEnabledProperty, "CanRefreshWeather"); refresh.SetValue(System.Windows.Automation.AutomationProperties.AutomationIdProperty, "WeatherRefresh"); weatherActions.Children.Add(refresh); weatherBody.Children.Add(weatherActions);
    var top = Ui.AdaptiveColumns(music, Ui.Surface(weatherBody), 740, 2.2, 1); top.Margin = new Thickness(0, 0, 0, 18); root.Children.Add(top);
    var focusBody = new StackPanel(); focusBody.Children.Add(Ui.Label("focus", 12, "Muted")); var focusTime = Ui.BoundText("FocusTime", 39); focusTime.Margin = new Thickness(0, 13, 0, 3); focusBody.Children.Add(focusTime); focusBody.Children.Add(Ui.BoundText("FocusLabel", 11, "Muted"));
    var focusAction = Ui.Button("", () => model.ToggleFocus(), "Primary"); focusAction.SetBinding(ContentControl.ContentProperty, "FocusAction"); focusAction.HorizontalAlignment = HorizontalAlignment.Left; focusAction.Margin = new Thickness(0, 18, 0, 0); focusAction.SetValue(System.Windows.Automation.AutomationProperties.AutomationIdProperty, "TodayFocus"); focusBody.Children.Add(focusAction);
    root.Children.Add(Ui.AdaptiveColumns(Ui.Surface(focusBody), Ui.Surface(TaskList(model, true)), 650, 1.1, 1.9));
    return Ui.Scroll(root);
  }
  private static Border Music(SessionModel model)
  {
    var root = new Grid(); root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
    root.Children.Add(Ui.Label("music", 11, "Muted"));
    var detail = new Grid { Margin = new Thickness(0, 14, 0, 6) }; detail.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(96) }); detail.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
    var cover = new Grid { Width = 82, Height = 82 }; cover.Children.Add(model.Showcase ? new AlbumArt() : Ui.Icon("music", 36, "Accent")); var image = new Image { Stretch = Stretch.UniformToFill, Clip = new RectangleGeometry(new Rect(0, 0, 82, 82), 10, 10) }; image.SetBinding(Image.SourceProperty, "Artwork"); cover.Children.Add(image); detail.Children.Add(cover);
    var info = new StackPanel { VerticalAlignment = VerticalAlignment.Center }; var title = Ui.BoundText("TrackTitle", 19); title.FontWeight = FontWeights.SemiBold; title.TextTrimming = TextTrimming.CharacterEllipsis; title.TextWrapping = TextWrapping.NoWrap; info.Children.Add(title);
    var artist = Ui.BoundText("TrackArtist", 12, "Muted"); artist.Margin = new Thickness(0, 7, 0, 8); info.Children.Add(artist);
    info.Children.Add(new MediaSeekBar(model)); Grid.SetColumn(info, 1); detail.Children.Add(info); Grid.SetRow(detail, 1); root.Children.Add(detail);
    var controls = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
    var previous = Ui.IconButton("previous", "previous", async () => await model.MediaActionAsync("previous")); previous.SetBinding(UIElement.IsEnabledProperty, "CanPrevious");
    var play = Ui.IconButton("play", "playPause", async () => await model.MediaActionAsync("toggle"), "RoundButton"); ((Glyph)play.Content).SetBinding(Glyph.KindProperty, "PlayGlyph"); play.SetBinding(UIElement.IsEnabledProperty, "CanPlay"); play.Width = play.Height = 42; play.Padding = new Thickness(11);
    var next = Ui.IconButton("next", "next", async () => await model.MediaActionAsync("next")); next.SetBinding(UIElement.IsEnabledProperty, "CanNext"); controls.Children.Add(previous); controls.Children.Add(play); controls.Children.Add(next); Grid.SetRow(controls, 2); root.Children.Add(controls);
    return Ui.Surface(root);
  }
}
