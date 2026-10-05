/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file Ui.cs @description 原生页面共用的小型控件构造方法。 @author 灵屿
 */
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;
using Lingyu.App.Controls;
using Lingyu.App.Localization;
using Lingyu.App.Models;

namespace Lingyu.App.Views;

/// <summary>统一布局和交互资源，不复制每页样式。</summary>
internal static class Ui
{
  /// <summary>共享色彩资源。</summary>
  public static Brush Brush(string name) => (Brush)System.Windows.Application.Current.FindResource(name);
  /// <summary>本地化文字。</summary>
  public static TextBlock Label(string key, double size = 14, string color = "Ink") => new()
  { Text = TextCatalog.T(key), FontSize = size, Foreground = Brush(color), TextWrapping = TextWrapping.Wrap };
  /// <summary>实际业务属性绑定。</summary>
  public static TextBlock BoundText(string property, double size = 14, string color = "Ink")
  { var text = new TextBlock { FontSize = size, Foreground = Brush(color), TextWrapping = TextWrapping.Wrap }; text.SetBinding(TextBlock.TextProperty, property); return text; }
  /// <summary>统一矢量图标。</summary>
  public static Glyph Icon(string name, double size = 22, string color = "Ink") => new()
  { Kind = name, Width = size, Height = size, Foreground = Brush(color), VerticalAlignment = VerticalAlignment.Center };
  /// <summary>实际点击操作。</summary>
  public static Button Button(object content, Action action, string style = "Button")
  { var button = new Button { Content = content, Style = (Style)System.Windows.Application.Current.FindResource(style) }; button.Click += (_, _) => action(); return button; }
  /// <summary>可访问的图标按钮。</summary>
  public static Button IconButton(string icon, string label, Action action, string style = "IconButton")
  {
    var button = Button(Icon(icon), action, style); button.ToolTip = TextCatalog.T(label);
    button.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, TextCatalog.T(label)); return button;
  }
  /// <summary>页面的大标题及副文案。</summary>
  public static StackPanel Header(string title, string subtitle)
  {
    var panel = new StackPanel(); var heading = Label(title, 30); heading.FontWeight = FontWeights.SemiBold; heading.Margin = new Thickness(0, 0, 0, 8);
    panel.Children.Add(heading); var description = Label(subtitle, 13, "Muted"); description.Margin = new Thickness(0, 0, 0, 25); panel.Children.Add(description); return panel;
  }
  /// <summary>克制的单层内容面，避免套叠卡片。</summary>
  public static Border Surface(UIElement content, Thickness? padding = null) => new()
  { Background = new LinearGradientBrush(Color.FromRgb(26, 27, 33), Color.FromRgb(15, 16, 20), 90), BorderBrush = Brush("Line"), BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(12), Padding = padding ?? new Thickness(22), Child = content };
  /// <summary>窄页将相邻内容移到下一行，保留控件实例与输入状态。</summary>
  public static Grid AdaptiveColumns(FrameworkElement first, FrameworkElement second, double breakpoint, double firstWeight = 1, double secondWeight = 1)
  {
    var grid = new Grid();
    grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(firstWeight, GridUnitType.Star) });
    grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(18) });
    grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(secondWeight, GridUnitType.Star) });
    grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
    grid.Children.Add(first); Grid.SetColumn(second, 2); grid.Children.Add(second); bool stacked = false;
    grid.SizeChanged += (_, e) => {
      bool next = e.NewSize.Width < breakpoint; if (next == stacked) return; stacked = next;
      Grid.SetColumnSpan(first, stacked ? 3 : 1); Grid.SetColumnSpan(second, stacked ? 3 : 1);
      Grid.SetColumn(second, stacked ? 0 : 2); Grid.SetRow(second, stacked ? 1 : 0); second.Margin = new Thickness(0, stacked ? 18 : 0, 0, 0);
    };
    return grid;
  }
  /// <summary>点击键盘 Enter 与按钮具有相同效果。</summary>
  public static TextBox Input(string label, string id)
  {
    var input = new TextBox { ToolTip = TextCatalog.T(label), Tag = TextCatalog.T(label) };
    input.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, TextCatalog.T(label)); input.SetValue(System.Windows.Automation.AutomationProperties.AutomationIdProperty, id); return input;
  }
  /// <summary>把页面放入可滚动区域。</summary>
  public static ScrollViewer Scroll(UIElement element) => new() { Content = element, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled };
  /// <summary>只在天气视图实际显示时持有刷新需求，隐藏和卸载立即释放。</summary>
  public static void WatchWeather(FrameworkElement element, SessionModel model)
  {
    IDisposable? view = null; Window? window = null;
    void Update()
    {
      if (element.IsLoaded && element.IsVisible && window is not null && window.WindowState != WindowState.Minimized) view ??= model.WatchWeather();
      else { view?.Dispose(); view = null; }
    }
    void StateChanged(object? sender, EventArgs args) => Update();
    element.Loaded += (_, _) => { window = Window.GetWindow(element); if (window is not null) window.StateChanged += StateChanged; Update(); };
    element.IsVisibleChanged += (_, _) => Update();
    element.Unloaded += (_, _) => { if (window is not null) window.StateChanged -= StateChanged; window = null; view?.Dispose(); view = null; };
  }
}
