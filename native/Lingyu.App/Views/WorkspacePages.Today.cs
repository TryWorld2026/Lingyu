/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WorkspacePages.Today.cs @description 今日页以实际音乐与正在做的事组织。 @author 灵屿
 */
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
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
    var top = new Grid { Margin = new Thickness(0, 0, 0, 18) };
    top.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(2.2, GridUnitType.Star) }); top.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(18) }); top.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
    var music = Music(model); music.Height = 220; top.Children.Add(music);
    var weatherBody = new StackPanel();
    weatherBody.Children.Add(Ui.Label("weather", 11, "Muted"));
    var city = Ui.BoundText("WeatherCityName", 17); city.Margin = new Thickness(0, 14, 0, 8); weatherBody.Children.Add(city);
    var temperature = Ui.BoundText("Temperature", 44); weatherBody.Children.Add(temperature);
    weatherBody.Children.Add(Ui.BoundText("WeatherDescription", 12, "Muted"));
    var select = Ui.Button(TextCatalog.T("weatherChoose"), () => navigate("settings")); select.Margin = new Thickness(0, 13, 0, 0); select.HorizontalAlignment = HorizontalAlignment.Left; select.Padding = new Thickness(10, 6, 10, 6); weatherBody.Children.Add(select);
    var weather = Ui.Surface(weatherBody); Grid.SetColumn(weather, 2); top.Children.Add(weather); root.Children.Add(top);
    var bottom = new Grid(); bottom.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.1, GridUnitType.Star) }); bottom.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(18) }); bottom.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.9, GridUnitType.Star) });
    var focusBody = new StackPanel(); focusBody.Children.Add(Ui.Label("focus", 12, "Muted")); var focusTime = Ui.BoundText("FocusTime", 39); focusTime.Margin = new Thickness(0, 13, 0, 3); focusBody.Children.Add(focusTime); focusBody.Children.Add(Ui.BoundText("FocusLabel", 11, "Muted"));
    var focusAction = Ui.Button("", () => model.ToggleFocus(), "Primary"); focusAction.SetBinding(ContentControl.ContentProperty, "FocusAction"); focusAction.HorizontalAlignment = HorizontalAlignment.Left; focusAction.Margin = new Thickness(0, 18, 0, 0); focusAction.SetValue(System.Windows.Automation.AutomationProperties.AutomationIdProperty, "TodayFocus"); focusBody.Children.Add(focusAction);
    bottom.Children.Add(Ui.Surface(focusBody));
    var tasks = TaskList(model, true); var taskSurface = Ui.Surface(tasks); Grid.SetColumn(taskSurface, 2); bottom.Children.Add(taskSurface); root.Children.Add(bottom);
    return Ui.Scroll(root);
  }
  private static Border Music(SessionModel model)
  {
    var root = new Grid(); root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
    root.Children.Add(Ui.Label("music", 11, "Muted"));
    var detail = new Grid { Margin = new Thickness(0, 20, 0, 16) }; detail.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(96) }); detail.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
    var cover = new Grid { Width = 82, Height = 82 }; cover.Children.Add(new AlbumArt()); var image = new Image { Stretch = Stretch.UniformToFill, Clip = new RectangleGeometry(new Rect(0, 0, 82, 82), 10, 10) }; image.SetBinding(Image.SourceProperty, "Artwork"); cover.Children.Add(image); detail.Children.Add(cover);
    var info = new StackPanel { VerticalAlignment = VerticalAlignment.Center }; var title = Ui.BoundText("TrackTitle", 19); title.FontWeight = FontWeights.SemiBold; title.TextTrimming = TextTrimming.CharacterEllipsis; title.TextWrapping = TextWrapping.NoWrap; info.Children.Add(title);
    var artist = Ui.BoundText("TrackArtist", 12, "Muted"); artist.Margin = new Thickness(0, 7, 0, 13); info.Children.Add(artist);
    var progress = new ProgressBar { Minimum = 0, Maximum = 100, Height = 3, BorderThickness = new Thickness(0), Background = Ui.Brush("Line"), Foreground = Ui.Brush("Accent") }; progress.SetBinding(System.Windows.Controls.Primitives.RangeBase.ValueProperty, new Binding("MediaProgress") { Mode = BindingMode.OneWay }); info.Children.Add(progress); Grid.SetColumn(info, 1); detail.Children.Add(info); Grid.SetRow(detail, 1); root.Children.Add(detail);
    var controls = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
    var previous = Ui.IconButton("previous", "previous", async () => await model.MediaActionAsync("previous")); previous.SetBinding(UIElement.IsEnabledProperty, "CanPrevious");
    var play = Ui.IconButton("play", "playPause", async () => await model.MediaActionAsync("toggle"), "RoundButton"); ((Glyph)play.Content).SetBinding(Glyph.KindProperty, "PlayGlyph"); play.SetBinding(UIElement.IsEnabledProperty, "CanPlay"); play.Width = play.Height = 42; play.Padding = new Thickness(11);
    var next = Ui.IconButton("next", "next", async () => await model.MediaActionAsync("next")); next.SetBinding(UIElement.IsEnabledProperty, "CanNext"); controls.Children.Add(previous); controls.Children.Add(play); controls.Children.Add(next); Grid.SetRow(controls, 2); root.Children.Add(controls);
    return Ui.Surface(root);
  }
}
