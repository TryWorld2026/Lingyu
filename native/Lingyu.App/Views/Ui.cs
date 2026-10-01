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
  { Background = new LinearGradientBrush(Color.FromRgb(26, 27, 33), Color.FromRgb(15, 16, 20), 90), BorderBrush = Brush("Line"), BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(17), Padding = padding ?? new Thickness(22), Child = content };
  /// <summary>点击键盘 Enter 与按钮具有相同效果。</summary>
  public static TextBox Input(string label, string id)
  {
    var input = new TextBox { ToolTip = TextCatalog.T(label), Tag = TextCatalog.T(label) };
    input.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, TextCatalog.T(label)); input.SetValue(System.Windows.Automation.AutomationProperties.AutomationIdProperty, id); return input;
  }
  /// <summary>把页面放入可滚动区域。</summary>
  public static ScrollViewer Scroll(UIElement element) => new() { Content = element, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled };
}
