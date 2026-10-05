/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file MediaPalette.cs @description 小尺寸封面的局部强调色，不依赖图像框架。 @author 灵屿
 */
namespace Lingyu.Core;

/// <summary>不依赖 WPF 的 RGB 强调色。</summary>
public readonly record struct MediaAccent(byte R, byte G, byte B);

/// <summary>从封面样本提取适合暗色表面的颜色。</summary>
public static class MediaPalette
{
  /// <summary>没有有效封面时保持品牌紫色。</summary>
  public static readonly MediaAccent Fallback = new(195, 170, 255);
  /// <summary>读取完整 BGRA 像素，过滤透明和接近黑白的背景。</summary>
  public static MediaAccent Extract(ReadOnlySpan<byte> bgra)
  {
    if (bgra.Length % 4 != 0) throw new ArgumentException("Incomplete BGRA sample", nameof(bgra));
    double red = 0, green = 0, blue = 0, weightSum = 0;
    for (int i = 0; i < bgra.Length; i += 4) {
      double b = bgra[i], g = bgra[i + 1], r = bgra[i + 2], brightness = (r + g + b) / 3;
      if (bgra[i + 3] < 128 || brightness < 30 || brightness > 240) continue;
      double high = Math.Max(r, Math.Max(g, b)), low = Math.Min(r, Math.Min(g, b));
      double weight = 1 + 2 * (high - low) / high;
      red += r * weight; green += g * weight; blue += b * weight; weightSum += weight;
    }
    if (weightSum == 0) return Fallback;
    red /= weightSum; green /= weightSum; blue /= weightSum;
    double luminance = .299 * red + .587 * green + .114 * blue;
    if (luminance < 100) {
      double blend = (100 - luminance) / (255 - luminance);
      red += (255 - red) * blend; green += (255 - green) * blend; blue += (255 - blue) * blend;
    }
    return new(Channel(red), Channel(green), Channel(blue));
  }
  private static byte Channel(double value) => (byte)Math.Clamp(Math.Round(value), 0, 255);
}
