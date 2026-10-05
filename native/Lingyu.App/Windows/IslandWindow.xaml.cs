/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file IslandWindow.xaml.cs @description 有界宿主中的连续轮廓、共享封面与被动交互。 @author 灵屿
 */
using System.ComponentModel;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.Core;
using Lingyu.Platform.Windows;
using Microsoft.Win32;

namespace Lingyu.App.Windows;

/// <summary>小岛只保留即时活动；固定宿主的可见区域随运动变化。</summary>
public partial class IslandWindow : Window
{
  private readonly SessionModel model;
  private readonly Action<string> open;
  private readonly IslandState island = new();
  private readonly MusicPresence musicPresence = new();
  private IslandExpandedView expandedView;
  private readonly IslandMotion motion = new(new(280, 44, 22, 26, 18, 9, 1, 0, 0, 0, 0, 0));
  private readonly DispatcherTimer intent = new() { Interval = TimeSpan.FromMilliseconds(15) };
  private readonly DispatcherTimer progress = new() { Interval = TimeSpan.FromMilliseconds(100) };
  private readonly DispatcherTimer musicExpiry = new();
  private readonly Stopwatch clock = Stopwatch.StartNew();
  private readonly List<double> frameIntervals = [];
  private readonly ScaleTransform artworkScale = new(26d / 132, 26d / 132);
  private readonly TranslateTransform artworkLocation = new();
  private readonly TranslateTransform activityLocation = new();
  private readonly TranslateTransform sampleLocation = new();
  private readonly RectangleGeometry artworkClip = new(new Rect(0, 0, 132, 132), 12, 12);
  private readonly SolidColorBrush musicAccent = new(Color.FromRgb(195, 170, 255));
  private Color? accentTarget;
  private int accentRevision;
  private Point? pointer;
  private Point startLocation;
  private bool dragged, adjusting, rendering, closed, seeking;
  private Slider? activeSeek;
  private bool committingSeek;
  private double lastFrame;
  private string activity = "music";
  private (int X, int Width, int Height, int Radius) region;
  /// <summary>业务形态，不与宿主 HWND 尺寸绑定。</summary>
  public IslandShape Shape => island.Shape;
  /// <summary>同一展开中的内容选择，临时活动不会将它重置。</summary>
  public IslandExpandedView ExpandedView => expandedView;
  /// <summary>可见轮廓供窗口验收，不把宿主尺寸当成画面尺寸。</summary>
  public IslandGeometry Geometry => motion.Current;
  /// <summary>帧驱动是否仍订阅。</summary>
  public bool IsAnimating => rendering;
  /// <summary>呈现回调间隔；不能冒充屏幕实际呈现。</summary>
  public IReadOnlyList<double> FrameIntervals => frameIntervals;
  /// <summary>真实状态变更次数。</summary>
  public int ShapeChangeCount { get; private set; }
  /// <summary>建立独立岛，不主动取得键盘焦点。</summary>
  public IslandWindow(SessionModel session, Action<string> workspace)
  {
    model = session; open = workspace;
    InitializeComponent(); DataContext = model;
    Resources["MusicAccent"] = musicAccent;
    musicPresence.Update(model.MediaIdentity, model.IsPlaying, clock.Elapsed.TotalSeconds);
    // 封面只测量一次；形变通过渲染变换推进，避免每帧重新解析矢量封面和排列其子树。
    SharedArtwork.Width = SharedArtwork.Height = 132; SharedArtwork.Clip = artworkClip;
    var artworkTransform = new TransformGroup(); artworkTransform.Children.Add(artworkScale); artworkTransform.Children.Add(artworkLocation);
    SharedArtwork.RenderTransform = artworkTransform; ActivityIcon.RenderTransform = activityLocation; SampleTag.RenderTransform = sampleLocation;
    SampleArt.Visibility = model.Showcase ? Visibility.Visible : Visibility.Collapsed;
    FallbackArt.Visibility = model.Showcase ? Visibility.Collapsed : Visibility.Visible;
    SampleTag.Visibility = model.Showcase ? Visibility.Visible : Visibility.Collapsed;
    DrawForecast();
    Lingyu.App.Views.Ui.WatchWeather(Expanded, model);
    Left = SystemParameters.WorkArea.Left + (SystemParameters.WorkArea.Width - Width) / 2; Top = SystemParameters.WorkArea.Top;
    SourceInitialized += (_, _) => { region = default; WindowEnvironment.KeepInactive(this); ConfigureHost(); };
    Loaded += (_, _) => RenderShape(true);
    SizeChanged += (_, e) => { if (e.WidthChanged) { ArrangeContent(); RenderShape(true); } };
    DpiChanged += (_, _) => Dispatcher.BeginInvoke(ConfigureHost);
    IsVisibleChanged += (_, _) => { if (!IsVisible) { intent.Stop(); StopRendering(); progress.Stop(); musicExpiry.Stop(); UpdateMusicAccent(true); } else if (IsLoaded) { ConfigureHost(); RenderShape(true); } };
    intent.Tick += (_, _) => {
      if (island.PollIntent(clock.Elapsed.TotalSeconds, Protected)) RenderShape();
      if (!island.HasPendingIntent) intent.Stop();
    };
    progress.Tick += (_, _) => { if (!Protected) model.TickMedia(); };
    musicExpiry.Tick += (_, _) => { musicExpiry.Stop(); if (!Protected) RenderShape(); };
    LostMouseCapture += (_, _) => { if (!Protected) RenderShape(); };
    model.PropertyChanged += OnModelChanged;
    model.StructureChanged += OnAreaChanged;
    SystemEvents.DisplaySettingsChanged += OnDisplayChanged;
    Closed += (_, _) => {
      closed = true; intent.Stop(); progress.Stop(); musicExpiry.Stop(); StopRendering();
      accentRevision++; musicAccent.BeginAnimation(SolidColorBrush.ColorProperty, null);
      model.PropertyChanged -= OnModelChanged; model.StructureChanged -= OnAreaChanged; SystemEvents.DisplaySettingsChanged -= OnDisplayChanged;
    };
    RenderShape(true);
  }
  private bool Protected => seeking || pointer is not null || IsMouseCaptureWithin || ContextMenu?.IsOpen == true;
  private void OnDisplayChanged(object? sender, EventArgs args) => Dispatcher.BeginInvoke(() => { if (!closed) ConfigureHost(); });
  private void ConfigureHost()
  {
    if (closed) return;
    var area = WindowEnvironment.WorkArea(this);
    double center = Left + Width / 2; Width = Math.Max(280, Math.Min(1000, area.Width - 48)); Height = 340;
    Left = Math.Clamp(center - Width / 2, area.Left, Math.Max(area.Left, area.Right - Width));
    Top = Math.Clamp(Top, area.Top, Math.Max(area.Top, area.Bottom - Height));
    ArrangeContent();
    RenderShape(true);
  }
  private void ArrangeContent()
  {
    Expanded.Width = Width; FocusExpanded.Width = Math.Min(680, Width); AiExpanded.Width = Math.Min(460, Width); Hover.Width = Math.Min(500, Width);
    MusicDetails.Width = Math.Min(420, Width); MusicDetails.Height = MusicDetails.Width < 360 ? 284 : 248;
    DetailsArtworkColumn.Width = new GridLength(MusicDetails.Width < 360 ? 80 : 104);
    bool wide = Width >= 960, narrow = Width < 760;
    Expanded.Height = narrow ? 340 : 280; ExpandedLayout.Margin = narrow ? new Thickness(24) : new Thickness(34, 32, 34, 28);
    ExpandedLayout.ColumnDefinitions[0].Width = new GridLength(wide ? 4.4 : 1, GridUnitType.Star);
    ExpandedLayout.ColumnDefinitions[1].Width = new GridLength(wide ? 1 : 0);
    ExpandedLayout.ColumnDefinitions[2].Width = wide ? new GridLength(2.7, GridUnitType.Star) : new GridLength(0);
    ExpandedLayout.ColumnDefinitions[3].Width = new GridLength(narrow ? 0 : 1);
    ExpandedLayout.ColumnDefinitions[4].Width = wide ? new GridLength(2.5, GridUnitType.Star) : new GridLength(narrow ? 0 : 224);
    WeatherPanel.Visibility = WeatherDivider.Visibility = wide ? Visibility.Visible : Visibility.Collapsed; QuickDivider.Visibility = narrow ? Visibility.Collapsed : Visibility.Visible;
    MusicPanel.Margin = narrow ? new Thickness(0) : new Thickness(0, 0, 22, 0); MusicArtworkColumn.Width = new GridLength(Width < 480 ? 112 : 148);
    Grid.SetRow(QuickPanel, narrow ? 1 : 0); Grid.SetColumn(QuickPanel, narrow ? 0 : 4); Grid.SetColumnSpan(QuickPanel, narrow ? 5 : 1);
    QuickPanel.Margin = narrow ? new Thickness(0, 20, 0, 0) : new Thickness(25, 0, 0, 0);
    QuickDate.Visibility = QuickTime.Visibility = narrow ? Visibility.Collapsed : Visibility.Visible;
    QuickCaption.Visibility = wide ? Visibility.Visible : Visibility.Collapsed; WeatherSummary.Visibility = wide ? Visibility.Collapsed : Visibility.Visible;
    Grid.SetRow(VolumePanel, narrow ? 0 : 2); VolumePanel.Margin = narrow ? new Thickness(0, 0, 12, 0) : new Thickness(0);
    Grid.SetRow(QuickActions, narrow ? 0 : 3); Grid.SetColumn(QuickActions, narrow ? 1 : 0); QuickActions.VerticalAlignment = VerticalAlignment.Bottom;
    bool compactFocus = FocusExpanded.Width < 620;
    FocusLayout.Margin = new Thickness(compactFocus ? 24 : 36, 25, compactFocus ? 24 : 36, 25);
    FocusLayout.ColumnDefinitions[0].Width = new GridLength(compactFocus ? 0 : 155); FocusCaption.Visibility = compactFocus ? Visibility.Collapsed : Visibility.Visible;
    FocusActions.Orientation = Width < 440 ? Orientation.Vertical : Orientation.Horizontal;
    Hover.ColumnDefinitions[2].Width = new GridLength(Width < 420 ? 84 : 144);
    HoverMusic.Children[0].Visibility = HoverMusic.Children[2].Visibility = Width < 420 ? Visibility.Collapsed : Visibility.Visible;
  }
  private void OnAreaChanged(ChangeArea area) { if (area is ChangeArea.Weather or ChangeArea.Language) DrawForecast(); if (area is ChangeArea.Settings or ChangeArea.Language or ChangeArea.Tasks) { if (!Protected) RenderShape(); } }
  private void DrawForecast()
  {
    ForecastPanel.Children.Clear();
    foreach (var item in model.Forecast)
    {
      var column = new StackPanel();
      column.Children.Add(new TextBlock { Text = item.Time, FontSize = 9, Foreground = (Brush)FindResource("Muted"), HorizontalAlignment = HorizontalAlignment.Center });
      column.Children.Add(new Controls.Glyph { Kind = item.Code == 0 ? "sun" : "cloud", Width = 19, Height = 19, Margin = new Thickness(0, 7, 0, 5), Foreground = (Brush)FindResource("Ink") });
      column.Children.Add(new TextBlock { Text = item.Temperature + "°", FontSize = 10, HorizontalAlignment = HorizontalAlignment.Center }); ForecastPanel.Children.Add(column);
    }
  }
  private void OnModelChanged(object? sender, PropertyChangedEventArgs e)
  {
    if (e.PropertyName == nameof(SessionModel.MediaAccentColor)) UpdateMusicAccent();
    if (e.PropertyName is nameof(SessionModel.IsPlaying) or nameof(SessionModel.MediaIdentity))
    {
      musicPresence.Update(model.MediaIdentity, model.IsPlaying, clock.Elapsed.TotalSeconds); ScheduleMusicExpiry();
      if (!Protected) RenderShape();
    }
    if (e.PropertyName is nameof(SessionModel.IslandActivity) or nameof(SessionModel.IsGenerating) or nameof(SessionModel.ReduceMotion) or nameof(SessionModel.HasMedia))
    { if (!Protected) RenderShape(); }
  }
  private void UpdateMusicAccent(bool instant = false)
  {
    Color target = model.MediaAccentColor;
    bool direct = instant || model.ReduceMotion || !IsVisible;
    if (!direct && accentTarget == target) return;
    Color current = musicAccent.Color; accentTarget = target; int revision = ++accentRevision;
    musicAccent.BeginAnimation(SolidColorBrush.ColorProperty, null); musicAccent.Color = target;
    if (direct || current == target) return;
    var animation = new ColorAnimation(current, target, TimeSpan.FromMilliseconds(350)) { FillBehavior = FillBehavior.Stop };
    animation.Completed += (_, _) => { if (revision == accentRevision) musicAccent.BeginAnimation(SolidColorBrush.ColorProperty, null); };
    musicAccent.BeginAnimation(SolidColorBrush.ColorProperty, animation);
  }
  private void OnEnter(object sender, MouseEventArgs e) { island.PointerEnter(clock.Elapsed.TotalSeconds); intent.Start(); Shell.SetResourceReference(Border.BorderBrushProperty, "IslandHoverEdge"); }
  private void OnLeave(object sender, MouseEventArgs e) { island.PointerLeave(clock.Elapsed.TotalSeconds); intent.Start(); Shell.SetResourceReference(Border.BorderBrushProperty, "IslandEdge"); }
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
    if (!dragged) { island.Toggle(); if (island.Shape == IslandShape.Docked) expandedView = IslandExpandedView.Music; RenderShape(); } else ConfigureHost();
  }
  private static T? FindAncestor<T>(DependencyObject? value) where T : DependencyObject
  { while (value is not null) { if (value is T result) return result; value = value is ContentElement ? LogicalTreeHelper.GetParent(value) : VisualTreeHelper.GetParent(value); } return null; }
  /// <summary>显式收起；鼠标离开不会覆盖手动展开。</summary>
  public void Collapse() { island.Collapse(); expandedView = IslandExpandedView.Music; RenderShape(); }
  /// <summary>真实键盘或验收入口。</summary>
  public void SetShape(IslandShape shape)
  { island.Collapse(); expandedView = IslandExpandedView.Music; if (shape == IslandShape.Hover) island.Enter(); else if (shape == IslandShape.Expanded) island.Toggle(); RenderShape(); }
  /// <summary>只切换展开内容，不新建窗口或清除临时活动。</summary>
  public void SetExpandedView(IslandExpandedView view) { expandedView = view; if (island.Shape != IslandShape.Expanded) island.Toggle(); RenderShape(); }
  private void ShowOverview(object sender, RoutedEventArgs e) => SetExpandedView(IslandExpandedView.Overview);
  private void ShowMusic(object sender, RoutedEventArgs e) => SetExpandedView(IslandExpandedView.Music);
  private void CollapseMusic(object sender, RoutedEventArgs e) => Collapse();
  private void ScheduleMusicExpiry()
  {
    musicExpiry.Stop();
    if (!closed && IsVisible && musicPresence.Deadline is { } deadline && deadline > clock.Elapsed.TotalSeconds)
    { musicExpiry.Interval = TimeSpan.FromSeconds(Math.Max(.01, deadline - clock.Elapsed.TotalSeconds)); musicExpiry.Start(); }
  }
  private void RenderShape(bool instant = false)
  {
    if (closed) return;
    UpdateMusicAccent(instant);
    activity = model.IslandActivity;
    var shape = island.Shape;
    bool music = activity == "music", compact = music && !model.HasPinnedTask;
    bool idle = compact && !musicPresence.IsVisible(clock.Elapsed.TotalSeconds);
    bool details = shape == IslandShape.Expanded && music && expandedView == IslandExpandedView.Music;
    bool overview = shape == IslandShape.Expanded && music && !details;
    Docked.Width = compact ? idle ? 64 : 192 : 280; Docked.Height = idle ? 40 : 44;
    DockedLabel.Visibility = DockedExpand.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
    CompactPulse.Visibility = compact && !idle && shape == IslandShape.Docked ? Visibility.Visible : Visibility.Collapsed;
    Docked.ToolTip = TextCatalog.T(idle ? "islandIdleHint" : "musicCompactHint");
    Hover.Width = Math.Min(music ? 340 : 500, Width); Hover.Height = music ? 64 : 72;
    Hover.ColumnDefinitions[0].Width = new GridLength(music ? 68 : 76);
    Hover.ColumnDefinitions[2].Width = new GridLength(music ? 44 : Width < 420 ? 84 : 144);
    HoverMusic.Children[0].Visibility = HoverMusic.Children[2].Visibility = Visibility.Collapsed;
    double width = shape == IslandShape.Docked ? Docked.Width : shape == IslandShape.Hover ? Hover.Width : activity == "focus" ? FocusExpanded.Width : activity == "ai" ? AiExpanded.Width : details ? MusicDetails.Width : Expanded.Width;
    double height = shape == IslandShape.Docked ? Docked.Height : shape == IslandShape.Hover ? Hover.Height : activity == "focus" ? 232 : activity == "ai" ? 160 : details ? MusicDetails.Height : Expanded.Height;
    var target = new IslandGeometry(width, height, shape == IslandShape.Expanded && activity != "focus" ? 32 : height / 2,
      details ? width < 360 ? 64 : 88 : shape == IslandShape.Expanded ? Width < 480 ? 96 : 132 : shape == IslandShape.Hover ? 36 : compact ? 28 : 26,
      details ? 24 : shape == IslandShape.Expanded ? Width < 760 ? 24 : 34 : shape == IslandShape.Hover ? 20 : idle ? 20 : 18,
      details ? 24 : shape == IslandShape.Expanded ? Width < 760 ? 24 : 32 : shape == IslandShape.Hover ? (height - 36) / 2 : 8,
      shape == IslandShape.Docked ? 1 : 0, shape == IslandShape.Hover ? 1 : 0,
      details ? 1 : 0,
      shape == IslandShape.Expanded && activity == "focus" ? 1 : 0,
      shape == IslandShape.Expanded && activity == "ai" ? 1 : 0,
      music && model.HasMedia && (shape != IslandShape.Docked || compact && !idle) ? 1 : 0, overview ? 1 : 0);
    ActivityIcon.Kind = shape == IslandShape.Docked && music ? model.HasPinnedTask ? "pin" : idle ? "logo" : model.IslandGlyph : model.IslandGlyph;
    motion.SetTarget(target, instant || model.ReduceMotion || !IsVisible); ShapeChangeCount++;
    HoverMusic.Visibility = activity == "music" ? Visibility.Visible : Visibility.Collapsed;
    HoverFocus.Visibility = activity == "focus" ? Visibility.Visible : Visibility.Collapsed;
    HoverAi.Visibility = activity == "ai" ? Visibility.Visible : Visibility.Collapsed;
    if (IsVisible && activity == "music" && shape != IslandShape.Docked) progress.Start(); else progress.Stop();
    ScheduleMusicExpiry();
    ApplyFrame();
    if (motion.IsMoving && !rendering) { lastFrame = clock.Elapsed.TotalSeconds; rendering = true; CompositionTarget.Rendering += OnRender; }
    if (!motion.IsMoving) StopRendering();
  }
  private void OnRender(object? sender, EventArgs args)
  {
    double now = clock.Elapsed.TotalSeconds, delta = now - lastFrame; lastFrame = now;
    if (delta > 0 && frameIntervals.Count < 2048) frameIntervals.Add(delta * 1000);
    motion.Step(delta); ApplyFrame(); if (!motion.IsMoving || !IsVisible) StopRendering();
  }
  private void StopRendering() { if (rendering) CompositionTarget.Rendering -= OnRender; rendering = false; }
  private void ApplyFrame()
  {
    var frame = motion.Current; double left = (Width - frame.Width) / 2;
    Shell.Width = frame.Width; Shell.Height = frame.Height; Shell.CornerRadius = new CornerRadius(frame.Radius); Canvas.SetLeft(Shell, left);
    Place(Docked, frame.Docked); Place(Hover, frame.Hover); Place(MusicDetails, frame.Music); Place(Expanded, frame.Overview); Place(FocusExpanded, frame.Focus); Place(AiExpanded, frame.Ai);
    double artScale = frame.ArtSize / 132;
    artworkScale.ScaleX = artworkScale.ScaleY = artScale; SharedArtwork.Opacity = Math.Clamp(frame.ArtOpacity, 0, 1);
    artworkLocation.X = left + frame.ArtInset; artworkLocation.Y = frame.ArtTop;
    artworkClip.RadiusX = artworkClip.RadiusY = Math.Min(12, frame.ArtSize / 3) / artScale;
    ActivityIcon.Opacity = frame.Docked + frame.Hover > .01 ? 1 - SharedArtwork.Opacity : 0;
    activityLocation.X = left + frame.ArtInset; activityLocation.Y = (frame.Height - 24) / 2;
    sampleLocation.X = left + 38; sampleLocation.Y = Math.Max(0, frame.Height - 16); SampleTag.Opacity = Math.Clamp(frame.Music + frame.Overview, 0, 1);
    var dpi = VisualTreeHelper.GetDpi(this);
    var physical = ((int)Math.Round(left * dpi.DpiScaleX), (int)Math.Round(frame.Width * dpi.DpiScaleX), (int)Math.Round(frame.Height * dpi.DpiScaleY), (int)Math.Round(frame.Radius * dpi.DpiScaleX));
    if (physical != region) { WindowEnvironment.Capsule(this, new Rect(left, 0, frame.Width, frame.Height), frame.Radius); region = physical; }
  }
  private void Place(FrameworkElement content, double opacity)
  {
    content.Opacity = Math.Clamp(opacity, 0, 1);
    content.IsHitTestVisible = opacity > .85;
    content.Visibility = opacity < .001 ? Visibility.Hidden : Visibility.Visible;
    Canvas.SetLeft(content, (Width - content.Width) / 2);
  }
  private void OnKeyDown(object sender, KeyEventArgs e) { if (e.Key == Key.Escape) { Collapse(); e.Handled = true; } }
  private async void Play(object sender, RoutedEventArgs e) => await model.MediaActionAsync("toggle");
  private async void Previous(object sender, RoutedEventArgs e) => await model.MediaActionAsync("previous");
  private async void Next(object sender, RoutedEventArgs e) => await model.MediaActionAsync("next");
  private void BeginSeek(object sender, MouseEventArgs e)
  {
    if (seeking || sender is not Slider slider || !slider.IsEnabled) return;
    double value = slider.Value; seeking = true; activeSeek = slider;
    BindingOperations.ClearBinding(slider, Slider.ValueProperty); slider.Value = value;
  }
  private async void EndSeek(object sender, MouseEventArgs e)
  {
    if (!seeking || committingSeek || sender is not Slider slider || !ReferenceEquals(slider, activeSeek) || slider.IsMouseCaptureWithin) return;
    committingSeek = true; double fraction = slider.Value / 100;
    try { if (model.CanSeek) await model.MediaActionAsync("seek", fraction); }
    finally { committingSeek = false; seeking = false; activeSeek = null; slider.SetBinding(Slider.ValueProperty, new Binding(nameof(SessionModel.MediaProgress)) { Mode = BindingMode.OneWay }); RenderShape(); }
  }
  private void VolumeChanged(object sender, RoutedPropertyChangedEventArgs<double> e)
  { if (adjusting || sender is not Slider slider || Math.Abs(e.NewValue - model.Volume) < .001 || (!slider.IsMouseCaptureWithin && !slider.IsKeyboardFocusWithin)) return; adjusting = true; model.SetVolume(e.NewValue); adjusting = false; }
  private void Players(object sender, RoutedEventArgs e)
  {
    var menu = new ContextMenu(); ContextMenu = menu;
    var automatic = new MenuItem { Header = TextCatalog.T("playerAutomatic"), IsCheckable = true, IsChecked = model.SelectedPlayer.Length == 0 }; automatic.Click += (_, _) => model.SelectPlayer(""); menu.Items.Add(automatic);
    var players = model.Players;
    foreach (string player in players) { var item = new MenuItem { Header = player, IsCheckable = true, IsChecked = player == model.SelectedPlayer }; item.Click += (_, _) => model.SelectPlayer(player); menu.Items.Add(item); }
    if (model.SelectedPlayer.Length > 0 && !players.Contains(model.SelectedPlayer)) menu.Items.Add(new MenuItem { Header = string.Format(System.Globalization.CultureInfo.CurrentCulture, TextCatalog.T("playerUnavailable"), model.SelectedPlayer), IsCheckable = true, IsChecked = true, IsEnabled = false });
    menu.Items.Add(new Separator()); var lyrics = new MenuItem { Header = TextCatalog.T("lyricsOpen") }; lyrics.Click += (_, _) => open("music"); menu.Items.Add(lyrics);
    menu.Closed += (_, _) => { if (!Protected) RenderShape(); if (!IsMouseOver) OnLeave(this, new MouseEventArgs(Mouse.PrimaryDevice, 0)); }; menu.IsOpen = true;
  }
  private void ToggleFocus(object sender, RoutedEventArgs e) => model.ToggleFocus();
  private void EndFocus(object sender, RoutedEventArgs e) => model.EndFocus();
  private void StopAi(object sender, RoutedEventArgs e) => model.StopChat();
  private void AiWorkspace(object sender, RoutedEventArgs e) => open("ai");
  private void Mute(object sender, RoutedEventArgs e) => model.ToggleMute();
  private void Workspace(object sender, RoutedEventArgs e) => open(activity == "ai" ? "ai" : activity == "focus" ? "focus" : "today");
  private void Settings(object sender, RoutedEventArgs e) => open("settings");
  private void Weather(object sender, RoutedEventArgs e) => open("settings");
  private void Focus(object sender, RoutedEventArgs e) => open("focus");
}
