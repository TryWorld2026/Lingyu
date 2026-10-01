/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file AlbumArt.cs @description 无封面时的品牌矢量画面，避免下载装饰资源。 @author 灵屿
 */
using System.Windows;
using System.Windows.Media;

namespace Lingyu.App.Controls;

/// <summary>湖面与山屿构成的静态矢量封面。</summary>
public sealed class AlbumArt : FrameworkElement
{
  /// <summary>按实际显示尺寸绘制，无动画和后台工作。</summary>
  protected override void OnRender(DrawingContext drawing)
  {
    var sky = new LinearGradientBrush(Color.FromRgb(64, 53, 96), Color.FromRgb(178, 152, 182), 90);
    drawing.PushClip(new RectangleGeometry(new Rect(0, 0, ActualWidth, ActualHeight), 10, 10));
    drawing.DrawRectangle(sky, null, new Rect(0, 0, ActualWidth, ActualHeight));
    drawing.PushTransform(new ScaleTransform(ActualWidth / 100, ActualHeight / 100));
    drawing.DrawEllipse(new SolidColorBrush(Color.FromArgb(200, 229, 220, 248)), null, new Point(72, 28), 6, 6);
    drawing.DrawGeometry(new SolidColorBrush(Color.FromRgb(72, 66, 90)), null, Geometry.Parse("M0,68 L22,58 L36,62 L59,42 L77,60 L100,64 L100,100 L0,100 Z"));
    drawing.DrawGeometry(new SolidColorBrush(Color.FromRgb(18, 21, 30)), null, Geometry.Parse("M0,88 L26,80 L42,69 L60,78 L70,65 L89,79 L100,86 L100,100 L0,100 Z"));
    drawing.DrawRectangle(new LinearGradientBrush(Color.FromArgb(180, 23, 24, 40), Color.FromArgb(240, 10, 12, 18), 90), null, new Rect(0, 83, 100, 17));
    for (int i = 0; i < 7; i++) drawing.DrawLine(new Pen(new SolidColorBrush(Color.FromArgb((byte)(60 - i * 6), 202, 177, 249)), .6), new Point(57 - i * 3, 86 + i * 2), new Point(82 + i, 86 + i * 2));
    drawing.Pop(); drawing.Pop();
  }
}
