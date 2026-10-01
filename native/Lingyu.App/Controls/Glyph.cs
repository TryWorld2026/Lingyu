/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file Glyph.cs @description 统一线宽的矢量操作图标。 @author 灵屿
 */
using System.Windows;
using System.Windows.Media;
using System.Windows.Documents;

namespace Lingyu.App.Controls;

/// <summary>无需图标字体或图片滤镜的可缩放图标。</summary>
public sealed class Glyph : FrameworkElement
{
  /// <summary>要显示的图标。</summary>
  public static readonly DependencyProperty KindProperty = DependencyProperty.Register(nameof(Kind), typeof(string), typeof(Glyph), new FrameworkPropertyMetadata("logo", FrameworkPropertyMetadataOptions.AffectsRender));
  /// <summary>绘制颜色。</summary>
  public static readonly DependencyProperty ForegroundProperty = TextElement.ForegroundProperty.AddOwner(typeof(Glyph), new FrameworkPropertyMetadata(Brushes.White, FrameworkPropertyMetadataOptions.AffectsRender | FrameworkPropertyMetadataOptions.Inherits));
  /// <summary>图标名称。</summary>
  public string Kind { get => (string)GetValue(KindProperty); set => SetValue(KindProperty, value); }
  /// <summary>图标颜色。</summary>
  public Brush Foreground { get => (Brush)GetValue(ForegroundProperty); set => SetValue(ForegroundProperty, value); }
  private static readonly Dictionary<string, Geometry> Paths = new()
  {
    ["logo"] = Parse("M6,6.5 L18,6.5 C25,6.5 25,18 18,18 L6,18 C-1,18 -1,6.5 6,6.5 M3.5,13.5 L17,13.5 C19,13.5 20,12.6 21,11.5"),
    ["play"] = Parse("M9,5 L19,12 L9,19 Z"),
    ["pause"] = Parse("M8,6 L8,18 M16,6 L16,18"),
    ["previous"] = Parse("M6,6 L6,18 M18,5 L9,12 L18,19 Z"),
    ["next"] = Parse("M18,6 L18,18 M6,5 L15,12 L6,19 Z"),
    ["stop"] = Parse("M7,7 L17,7 L17,17 L7,17 Z"),
    ["close"] = Parse("M6,6 L18,18 M18,6 L6,18"),
    ["minimize"] = Parse("M5,12 L19,12"),
    ["maximize"] = Parse("M6,6 L18,6 L18,18 L6,18 Z"),
    ["expand"] = Parse("M5,9 L12,16 L19,9"),
    ["arrow"] = Parse("M4,12 L20,12 M14,6 L20,12 L14,18"),
    ["plus"] = Parse("M12,5 L12,19 M5,12 L19,12"),
    ["check"] = Parse("M5,12 L10,17 L20,7"),
    ["home"] = Parse("M3,11 L12,4 L21,11 M6,10 L6,20 L18,20 L18,10 M10,20 L10,14 L14,14 L14,20"),
    ["focus"] = Parse("M9,2 L15,2 M12,2 L12,5 M18,5 L21,8 M12,7 A7,7 0 1 1 11.99,7 M12,9 L12,13 L15,15"),
    ["note"] = Parse("M6,3 L15,3 L20,8 L20,21 L6,21 Z M14,3 L14,9 L20,9 M9,13 L16,13 M9,17 L15,17"),
    ["folder"] = Parse("M3,6 L9,6 L11,9 L21,9 L21,20 L3,20 Z"),
    ["ai"] = Parse("M12,2 C12,9 9,12 2,12 C9,12 12,15 12,22 C12,15 15,12 22,12 C15,12 12,9 12,2 Z"),
    ["settings"] = Parse("M12,8 A4,4 0 1 1 11.99,8 M9,3 L15,3 L16,6 L19,7 L22,10 L20,13 L20,16 L17,19 L14,19 L12,22 L9,20 L6,20 L3,17 L4,14 L2,11 L5,8 L8,7 Z"),
    ["volume"] = Parse("M3,9 L7,9 L12,5 L12,19 L7,15 L3,15 Z M16,8 C19,10 19,14 16,16 M19,5 C24,9 24,15 19,19"),
    ["moon"] = Parse("M19,15 A8,8 0 1 1 9,3 C6,12 12,18 19,15 Z"),
    ["cloud"] = Parse("M6,18 C-1,18 -1,10 5,10 C5,2 17,1 18,10 C25,10 25,18 18,18 Z"),
    ["sun"] = Parse("M12,7 A5,5 0 1 1 11.99,7 M12,1 L12,3 M12,21 L12,23 M1,12 L3,12 M21,12 L23,12 M4,4 L6,6 M18,18 L20,20 M4,20 L6,18 M18,6 L20,4"),
    ["pin"] = Parse("M8,3 L17,3 L16,10 L20,14 L14,15 L11,22 L10,15 L4,13 L8,9 Z"),
    ["trash"] = Parse("M4,6 L20,6 M9,3 L15,3 M6,6 L7,21 L17,21 L18,6 M10,10 L10,17 M14,10 L14,17"),
    ["copy"] = Parse("M8,8 L21,8 L21,21 L8,21 Z M16,4 L4,4 L4,16"),
    ["send"] = Parse("M3,3 L22,12 L3,21 L6,12 Z M6,12 L15,12"),
    ["music"] = Parse("M9,17 L9,5 L21,3 L21,15 M9,8 L21,6 M9,17 C9,23 1,23 1,19 C1,16 6,15 9,17 M21,15 C21,21 13,21 13,17 C13,14 18,13 21,15"),
    ["monitor"] = Parse("M3,4 L21,4 L21,17 L3,17 Z M8,21 L16,21 M12,17 L12,21"),
  };
  private static Geometry Parse(string path) { var value = Geometry.Parse(path); value.Freeze(); return value; }
  /// <summary>作为按钮内容时也保留明确尺寸，避免框架元素被测量为零。</summary>
  protected override Size MeasureOverride(Size availableSize) => new(Math.Min(24, availableSize.Width), Math.Min(24, availableSize.Height));
  /// <summary>按当前颜色与大小绘制图标。</summary>
  protected override void OnRender(DrawingContext drawing)
  {
    if (!Paths.TryGetValue(Kind, out var geometry)) return;
    var pen = new Pen(Foreground, Kind == "logo" ? 1.6 : 1.65)
      { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round, LineJoin = PenLineJoin.Round };
    drawing.PushTransform(new ScaleTransform(ActualWidth / 24, ActualHeight / 24));
    drawing.DrawGeometry(Kind is "play" or "stop" or "send" ? Foreground : null, pen, geometry);
    drawing.Pop();
  }
}
