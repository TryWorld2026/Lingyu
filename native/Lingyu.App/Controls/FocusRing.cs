/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file FocusRing.cs @description 专注圆环只在剩余时间变化时重绘。 @author 灵屿
 */
using System.Windows;
using System.Windows.Media;

namespace Lingyu.App.Controls;

/// <summary>轻量的实际专注进度环。</summary>
public sealed class FocusRing : FrameworkElement
{
  /// <summary>亮弧比例。</summary>
  public static readonly DependencyProperty ProgressProperty = DependencyProperty.Register(nameof(Progress), typeof(double), typeof(FocusRing), new FrameworkPropertyMetadata(0d, FrameworkPropertyMetadataOptions.AffectsRender));
  /// <summary>亮弧比例，限制为零到一；一表示闭合圆环。</summary>
  public double Progress { get => (double)GetValue(ProgressProperty); set => SetValue(ProgressProperty, value); }
  /// <summary>使用矢量绘制底环与进度。</summary>
  protected override void OnRender(DrawingContext drawing)
  {
    double radius = Math.Min(ActualWidth, ActualHeight) / 2 - 7;
    if (radius <= 0) return;
    var center = new Point(ActualWidth / 2, ActualHeight / 2);
    drawing.DrawEllipse(null, new Pen((Brush)FindResource("Line"), 8), center, radius, radius);
    double progress = double.IsFinite(Progress) ? Math.Clamp(Progress, 0, 1) : 0;
    if (progress == 0) return;
    var pen = new Pen((Brush)FindResource("FocusProgress"), 8) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round };
    if (progress == 1) { drawing.DrawEllipse(null, pen, center, radius, radius); return; }
    double angle = progress * Math.PI * 2;
    var geometry = new StreamGeometry();
    using (var context = geometry.Open())
    {
      context.BeginFigure(new Point(center.X, center.Y - radius), false, false);
      context.ArcTo(new Point(center.X + Math.Sin(angle) * radius, center.Y - Math.Cos(angle) * radius),
        new Size(radius, radius), 0, angle > Math.PI, SweepDirection.Clockwise, true, false);
    }
    drawing.DrawGeometry(null, pen, geometry);
  }
}
