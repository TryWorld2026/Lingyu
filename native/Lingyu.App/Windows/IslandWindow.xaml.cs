/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file IslandWindow.xaml.cs @description 胶囊形态、拖动与真实系统操作。 @author 灵屿
 */
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using Lingyu.App.Controls;
using Lingyu.App.Models;
using Lingyu.Core;
using Lingyu.Platform.Windows;

namespace Lingyu.App.Windows;

/// <summary>只展示即时状态与快捷操作的独立岛。</summary>
public partial class IslandWindow : Window
{
  private readonly SessionModel model;
  private readonly Action<string> open;
  private readonly IslandState island = new();
  private readonly DispatcherTimer leaveTimer = new() { Interval = TimeSpan.FromMilliseconds(300) };
  private Point? pointer;
  private Point startLocation;
  private bool dragged;
  private bool adjusting;
  /// <summary>当前形态，供真实窗口验收使用。</summary>
  public IslandShape Shape => island.Shape;
  /// <summary>验证形态切换是否出现意外循环。</summary>
  public int ShapeChangeCount { get; private set; }
  /// <summary>建立轻量岛。</summary>
  public IslandWindow(SessionModel session, Action<string> workspace)
  {
    model = session; open = workspace;
    InitializeComponent(); DataContext = model;
    SourceInitialized += (_, _) => { WindowEnvironment.KeepInactive(this); UpdateRegion(); };
    SizeChanged += (_, _) => UpdateRegion();
    Left = SystemParameters.WorkArea.Left + (SystemParameters.WorkArea.Width - Width) / 2; Top = SystemParameters.WorkArea.Top;
    leaveTimer.Tick += (_, _) => { leaveTimer.Stop(); island.Leave(); RenderShape(); };
    model.StructureChanged += UpdateForecast;
    Closed += (_, _) => { leaveTimer.Stop(); model.StructureChanged -= UpdateForecast; };
    UpdateForecast();
  }
  private void OnEnter(object sender, MouseEventArgs e) { leaveTimer.Stop(); if (island.Shape != IslandShape.Docked) return; island.Enter(); RenderShape(); }
  private void OnLeave(object sender, MouseEventArgs e) { if (island.Shape == IslandShape.Hover) leaveTimer.Start(); }
  private void OnPointerDown(object sender, MouseButtonEventArgs e)
  {
    if (FindAncestor<Button>(e.OriginalSource as DependencyObject) is not null || FindAncestor<Slider>(e.OriginalSource as DependencyObject) is not null) return;
    pointer = PointToScreen(e.GetPosition(this)); startLocation = new Point(Left, Top); dragged = false;
  }
  private void OnPointerMove(object sender, MouseEventArgs e)
  {
    if (pointer is not { } origin || e.LeftButton != MouseButtonState.Pressed) return;
    Point screen = PointToScreen(e.GetPosition(this)); var dpi = VisualTreeHelper.GetDpi(this);
    if (!dragged && (screen - origin).Length > 6) { dragged = true; CaptureMouse(); }
    if (dragged) { Left = startLocation.X + (screen.X - origin.X) / dpi.DpiScaleX; Top = startLocation.Y + (screen.Y - origin.Y) / dpi.DpiScaleY; }
  }
  private void OnPointerUp(object sender, MouseButtonEventArgs e)
  {
    if (pointer is null) return;
    pointer = null; ReleaseMouseCapture();
    if (!dragged) { island.Toggle(); RenderShape(); }
  }
  private static T? FindAncestor<T>(DependencyObject? value) where T : DependencyObject
  { while (value is not null) { if (value is T result) return result; value = value is ContentElement ? LogicalTreeHelper.GetParent(value) : VisualTreeHelper.GetParent(value); } return null; }
  /// <summary>显式收起，展开不被鼠标离开覆盖。</summary>
  public void Collapse() { island.Collapse(); RenderShape(); }
  /// <summary>验收或键盘操作切换指定形态。</summary>
  public void SetShape(IslandShape shape)
  {
    island.Collapse(); if (shape == IslandShape.Hover) island.Enter(); else if (shape == IslandShape.Expanded) island.Toggle(); RenderShape();
  }
  private void RenderShape()
  {
    ShapeChangeCount++;
    leaveTimer.Stop();
    double center = Left + Width / 2;
    double width = island.Shape switch { IslandShape.Docked => 280, IslandShape.Hover => 500, _ => Math.Min(1000, SystemParameters.WorkArea.Width - 48) };
    double height = island.Shape switch { IslandShape.Docked => 44, IslandShape.Hover => 72, _ => 280 };
    Width = width; Height = height;
    Left = Math.Clamp(center - Width / 2, SystemParameters.WorkArea.Left, SystemParameters.WorkArea.Right - Width);
    Docked.Visibility = island.Shape == IslandShape.Docked ? Visibility.Visible : Visibility.Collapsed;
    Hover.Visibility = island.Shape == IslandShape.Hover ? Visibility.Visible : Visibility.Collapsed;
    Expanded.Visibility = island.Shape == IslandShape.Expanded ? Visibility.Visible : Visibility.Collapsed;
    if (!model.ReduceMotion && IsLoaded)
    {
      // 原生窗口尺寸直接落定；只动画内容，避免 HWND 回写尺寸后持续重排。
      Shell.BeginAnimation(OpacityProperty, new DoubleAnimation(.6, 1, TimeSpan.FromMilliseconds(180)) { FillBehavior = FillBehavior.Stop });
      var scale = new ScaleTransform(.97, .96); Shell.RenderTransformOrigin = new Point(.5, 0); Shell.RenderTransform = scale;
      scale.BeginAnimation(ScaleTransform.ScaleXProperty, new DoubleAnimation(.97, 1, TimeSpan.FromMilliseconds(220)) { FillBehavior = FillBehavior.Stop, EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } });
      scale.BeginAnimation(ScaleTransform.ScaleYProperty, new DoubleAnimation(.96, 1, TimeSpan.FromMilliseconds(220)) { FillBehavior = FillBehavior.Stop, EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } });
      scale.ScaleX = scale.ScaleY = 1;
    }
    UpdateForecast();
    UpdateRegion();
  }
  private void UpdateRegion() => WindowEnvironment.Capsule(this, island.Shape == IslandShape.Expanded ? 32 : ActualHeight / 2);
  private void UpdateForecast()
  {
    ForecastPanel.Children.Clear();
    var entries = model.Forecast; ChooseWeather.Visibility = entries.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
    foreach (var entry in entries)
    {
      var panel = new StackPanel { Width = 43, Margin = new Thickness(0, 0, 3, 0) };
      panel.Children.Add(new TextBlock { Text = entry.Time, FontSize = 10, Foreground = (Brush)FindResource("Muted"), HorizontalAlignment = HorizontalAlignment.Center });
      panel.Children.Add(new Glyph { Kind = entry.Code <= 1 ? "sun" : "cloud", Width = 22, Height = 22, Margin = new Thickness(0, 9, 0, 7), Foreground = (Brush)FindResource(entry.Code <= 1 ? "Accent" : "Ink"), HorizontalAlignment = HorizontalAlignment.Center });
      panel.Children.Add(new TextBlock { Text = $"{entry.Temperature}°", FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center }); ForecastPanel.Children.Add(panel);
    }
  }
  private void OnKeyDown(object sender, KeyEventArgs e) { if (e.Key == Key.Escape) { Collapse(); e.Handled = true; } }
  private async void Play(object sender, RoutedEventArgs e) => await model.MediaActionAsync("toggle");
  private async void Previous(object sender, RoutedEventArgs e) => await model.MediaActionAsync("previous");
  private async void Next(object sender, RoutedEventArgs e) => await model.MediaActionAsync("next");
  private async void Seek(object sender, MouseButtonEventArgs e) { if (sender is Slider slider && slider.IsEnabled) await model.MediaActionAsync("seek", slider.Value / 100); }
  private void VolumeChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
  { if (adjusting || sender is not Slider slider || (!slider.IsMouseCaptureWithin && !slider.IsKeyboardFocusWithin)) return; adjusting = true; model.SetVolume(e.NewValue); adjusting = false; }
  private void Mute(object sender, RoutedEventArgs e) => model.ToggleMute();
  private void Quiet(object sender, RoutedEventArgs e) => model.Quiet = !model.Quiet;
  private void Workspace(object sender, RoutedEventArgs e) => open("today");
  private void Settings(object sender, RoutedEventArgs e) => open("settings");
  private void Weather(object sender, RoutedEventArgs e) => open("settings");
  private void Focus(object sender, RoutedEventArgs e) => open("focus");
}
