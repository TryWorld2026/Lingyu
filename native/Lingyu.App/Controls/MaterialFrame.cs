/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file MaterialFrame.cs @description 用矢量分层构造胶囊边缘与曲面反光。 @author 灵屿
 */
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace Lingyu.App.Controls;

/// <summary>材质是可缩放绘制；内容始终为真实控件。</summary>
public sealed class MaterialFrame : Border
{
  /// <summary>圆角半径，胶囊使用半高度。</summary>
  public double Radius { get; set; } = 24;
  private static readonly LinearGradientBrush Edge = Gradient("#93959E", "#363842", "#101116", "#4B4D59");
  private static readonly LinearGradientBrush Body = Gradient("#14161B", "#090A0D", "#08090B", "#101115");
  private static readonly LinearGradientBrush Inner = Gradient("#282B33", "#090A0D", "#060709", "#17181E");
  private static readonly LinearGradientBrush Reflection = Gradient("#09FFFFFF", "#00FFFFFF", "#00FFFFFF", "#02FFFFFF");
  private static LinearGradientBrush Gradient(params string[] colors)
  {
    var brush = new LinearGradientBrush { StartPoint = new Point(0, 0), EndPoint = new Point(.65, 1) };
    for (int i = 0; i < colors.Length; i++)
      brush.GradientStops.Add(new GradientStop((Color)ColorConverter.ConvertFromString(colors[i]), i / (double)(colors.Length - 1)));
    brush.Freeze(); return brush;
  }

  /// <summary>绘制边缘、内侧压暗和有限的表面反光。</summary>
  protected override void OnRender(DrawingContext drawing)
  {
    double width = ActualWidth, height = ActualHeight;
    if (width < 10 || height < 10) return;
    double radius = Math.Min(Radius, height / 2);
    drawing.DrawRoundedRectangle(Edge, null, new Rect(0, 0, width, height), radius, radius);
    drawing.DrawRoundedRectangle(Inner, null, new Rect(1.5, 1.5, width - 3, height - 3), Math.Max(0, radius - 1.5), Math.Max(0, radius - 1.5));
    drawing.DrawRoundedRectangle(Body, null, new Rect(3, 3, width - 6, height - 6), Math.Max(0, radius - 3), Math.Max(0, radius - 3));
    drawing.DrawRoundedRectangle(Reflection, null, new Rect(3, 3, width - 6, height - 6), Math.Max(0, radius - 3), Math.Max(0, radius - 3));
    base.OnRender(drawing);
  }
}
