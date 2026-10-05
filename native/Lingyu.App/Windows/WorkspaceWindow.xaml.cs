/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WorkspaceWindow.xaml.cs @description 页面按需构建，关闭解除会话订阅。 @author 灵屿
 */
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.App.Views;
using Lingyu.Platform.Windows;

namespace Lingyu.App.Windows;

/// <summary>完整任务的独立窗口，不嵌进胶囊。</summary>
public partial class WorkspaceWindow : Window
{
  private readonly SessionModel model;
  private readonly Action returnIsland;
  private string currentPage = "today";
  private Action? flush;
  private string recentState = "";
  private bool compactNavigation;
  /// <summary>当前页面，供验证实际导航。</summary>
  public string CurrentPage => currentPage;
  /// <summary>建立工作台，但不启动第二份后台服务。</summary>
  public WorkspaceWindow(SessionModel session, Action returnToIsland)
  {
    model = session; returnIsland = returnToIsland;
    InitializeComponent(); DataContext = model;
    Height = Math.Min(740, SystemParameters.WorkArea.Height - 24);
    Width = Math.Min(1120, SystemParameters.WorkArea.Width - 24);
    SampleMarker.Visibility = model.Showcase ? Visibility.Visible : Visibility.Collapsed;
    model.StructureChanged += Refresh;
    model.Notice += OnNotice;
    model.ChatChanged += RefreshRecent;
    WindowEnvironment.NativeFrame(this, true);
    SourceInitialized += (_, _) => FitWorkArea();
    DpiChanged += (_, _) => Dispatcher.BeginInvoke(FitWorkArea);
    SizeChanged += (_, _) => UpdateLayoutDensity();
    Closing += (_, _) => { flush?.Invoke(); flush = null; };
    Closed += (_, _) => { model.StructureChanged -= Refresh; model.Notice -= OnNotice; model.ChatChanged -= RefreshRecent; Page.Content = null; Navigation.Children.Clear(); Recent.Children.Clear(); };
    Navigate("today");
  }
  private void FitWorkArea()
  {
    var area = WindowEnvironment.WorkArea(this);
    MinWidth = Math.Min(480, area.Width); MinHeight = Math.Min(400, area.Height);
    if (WindowState != WindowState.Normal) return;
    Width = Math.Min(Width, Math.Max(MinWidth, area.Width - 24)); Height = Math.Min(Height, Math.Max(MinHeight, area.Height - 24));
    Left = Math.Clamp(Left, area.Left, Math.Max(area.Left, area.Right - Width)); Top = Math.Clamp(Top, area.Top, Math.Max(area.Top, area.Bottom - Height));
  }
  private void UpdateLayoutDensity()
  {
    PreviewLabel.Visibility = ActualWidth < 560 ? Visibility.Collapsed : Visibility.Visible;
    bool compact = ActualWidth < 900; if (compact == compactNavigation) return; compactNavigation = compact;
    SidebarColumn.Width = new GridLength(compact ? 72 : 202); SidebarBody.Margin = compact ? new Thickness(10, 16, 10, 14) : new Thickness(15, 24, 15, 22);
    PageLayout.Margin = compact ? new Thickness(16, 20, 16, 16) : new Thickness(32, 28, 32, 22);
    SettingsLabel.Visibility = ReturnLabel.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
    foreach (var button in new[] { SettingsButton, ReturnToIsland }) { button.HorizontalContentAlignment = compact ? HorizontalAlignment.Center : HorizontalAlignment.Left; button.Padding = new Thickness(compact ? 8 : 14, 11, compact ? 8 : 14, 11); }
    RebuildNavigation();
  }
  /// <summary>导航前保存编辑内容；每次仅有当前页面的视觉树。</summary>
  public void Navigate(string page)
  {
    flush?.Invoke(); flush = null;
    currentPage = page;
    Page.Content = page switch
    {
      "focus" => WorkspacePages.Focus(model),
      "music" => WorkspacePages.MusicDetails(model),
      "notes" => WorkspacePages.Notes(model, save => flush = save),
      "files" => WorkspacePages.Files(model),
      "ai" => WorkspacePages.Ai(model, Navigate),
      "settings" => WorkspacePages.Settings(model),
      _ => WorkspacePages.Today(model, Navigate),
    };
    RebuildNavigation();
  }
  private void Refresh(ChangeArea area) { if (area == ChangeArea.Language) Navigate(currentPage); }
  private void RebuildNavigation()
  {
    recentState = string.Join("|", model.Chats.Take(5).Select(chat => chat.Id)) + ":" + model.IsGenerating;
    Navigation.Children.Clear(); Recent.Children.Clear();
    foreach (var item in new[] { ("today", "home"), ("focus", "focus"), ("notes", "note"), ("files", "folder"), ("ai", "ai") })
    {
      var label = new StackPanel { Orientation = Orientation.Horizontal };
      label.Children.Add(Ui.Icon(item.Item2, 19, "Muted"));
      if (!compactNavigation) label.Children.Add(new TextBlock { Text = TextCatalog.T(item.Item1), FontSize = 13, Margin = new Thickness(13, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center });
      var button = Ui.Button(label, () => Navigate(item.Item1), "NavButton");
      button.ToolTip = TextCatalog.T(item.Item1); button.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, TextCatalog.T(item.Item1));
      if (compactNavigation) { button.HorizontalContentAlignment = HorizontalAlignment.Center; button.Padding = new Thickness(8, 11, 8, 11); }
      button.SetValue(System.Windows.Automation.AutomationProperties.AutomationIdProperty, "Nav-" + item.Item1);
      if (currentPage == item.Item1) { button.Background = new SolidColorBrush(Color.FromRgb(39, 37, 50)); button.BorderBrush = new SolidColorBrush(Color.FromRgb(63, 55, 78)); }
      Navigation.Children.Add(button);
    }
    if (currentPage == "ai")
    {
      if (!compactNavigation) Recent.Children.Add(Ui.Label("aiHistory", 11, "Faint"));
      foreach (var chat in model.Chats.Take(5))
      {
        var text = new TextBlock { Text = chat.Title, FontSize = 11, TextTrimming = TextTrimming.CharacterEllipsis };
        var button = Ui.Button(compactNavigation ? Ui.Icon("ai", 17, "Muted") : text, () => model.OpenChat(chat.Id), "NavButton"); button.ToolTip = chat.Title; button.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, chat.Title);
        if (compactNavigation) { button.HorizontalContentAlignment = HorizontalAlignment.Center; button.Padding = new Thickness(8, 11, 8, 11); }
        button.IsEnabled = !model.IsGenerating; Recent.Children.Add(button);
      }
    }
    Status.Text = model.Showcase ? TextCatalog.T("sampleNotice") : "";
  }
  private void RefreshRecent()
  { if (currentPage == "ai" && recentState != string.Join("|", model.Chats.Take(5).Select(chat => chat.Id)) + ":" + model.IsGenerating) RebuildNavigation(); }
  private void OnNotice(string text) => Dispatcher.InvokeAsync(() => Status.Text = text);
  private void DragTitle(object sender, MouseButtonEventArgs e)
  {
    if (e.OriginalSource is not DependencyObject source || FindButton(source)) return;
    if (e.ClickCount == 2) { ToggleMaximize(); return; }
    if (e.ButtonState == MouseButtonState.Pressed) DragMove();
  }
  private static bool FindButton(DependencyObject source)
  { while (source is not null) { if (source is Button) return true; source = source is ContentElement ? LogicalTreeHelper.GetParent(source) : VisualTreeHelper.GetParent(source); } return false; }
  private void CloseWindow(object sender, RoutedEventArgs e) => Close();
  private void Minimize(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
  private void Maximize(object sender, RoutedEventArgs e) => ToggleMaximize();
  private void ToggleMaximize() => WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
  private void Settings(object sender, RoutedEventArgs e) => Navigate("settings");
  private void ReturnIsland(object sender, RoutedEventArgs e) { returnIsland(); Close(); }
}
