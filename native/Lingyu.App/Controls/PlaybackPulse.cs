/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file PlaybackPulse.cs @description 五柱播放状态动效，仅可见播放期间以低频驱动。 @author 灵屿
 */
using System.Diagnostics;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;

namespace Lingyu.App.Controls;

/// <summary>表达播放状态，不录音或假装为真实音频频谱。</summary>
public sealed class PlaybackPulse : FrameworkElement
{
  /// <summary>由实际媒体状态或明确展示模式提供。</summary>
  public static readonly DependencyProperty IsPlayingProperty = DependencyProperty.Register(nameof(IsPlaying), typeof(bool), typeof(PlaybackPulse), new PropertyMetadata(false, Changed));
  /// <summary>减少动效时显示静止柱。</summary>
  public static readonly DependencyProperty ReduceMotionProperty = DependencyProperty.Register(nameof(ReduceMotion), typeof(bool), typeof(PlaybackPulse), new PropertyMetadata(false, Changed));
  /// <summary>窗口本地封面强调色。</summary>
  public static readonly DependencyProperty AccentProperty = DependencyProperty.Register(nameof(Accent), typeof(Brush), typeof(PlaybackPulse), new FrameworkPropertyMetadata(Brushes.White, FrameworkPropertyMetadataOptions.AffectsRender));
  private readonly DispatcherTimer timer = new(DispatcherPriority.Background) { Interval = TimeSpan.FromMilliseconds(34) };
  private readonly Stopwatch clock = Stopwatch.StartNew();
  private bool subscribed;
  /// <summary>当前歌曲正在播放。</summary>
  public bool IsPlaying { get => (bool)GetValue(IsPlayingProperty); set => SetValue(IsPlayingProperty, value); }
  /// <summary>用户或系统要求减少动效。</summary>
  public bool ReduceMotion { get => (bool)GetValue(ReduceMotionProperty); set => SetValue(ReduceMotionProperty, value); }
  /// <summary>五柱颜色。</summary>
  public Brush Accent { get => (Brush)GetValue(AccentProperty); set => SetValue(AccentProperty, value); }
  /// <summary>真实计时器状态供生命周期验收。</summary>
  public bool IsRunning => timer.IsEnabled;
  /// <summary>实际回调次数，区别于绑定属性的声明状态。</summary>
  public long TickCount { get; private set; }
  /// <summary>加载时订阅一次，卸载时同时解除订阅与计时。</summary>
  public PlaybackPulse()
  {
    IsHitTestVisible = false;
    Loaded += (_, _) => { if (!subscribed) { timer.Tick += Tick; subscribed = true; } Update(); };
    Unloaded += (_, _) => { timer.Stop(); timer.Tick -= Tick; subscribed = false; InvalidateVisual(); };
    IsVisibleChanged += (_, _) => Update();
  }
  private static void Changed(DependencyObject sender, DependencyPropertyChangedEventArgs args) => ((PlaybackPulse)sender).Update();
  private void Update()
  {
    if (subscribed && IsLoaded && IsVisible && IsPlaying && !ReduceMotion) timer.Start(); else timer.Stop();
    InvalidateVisual();
  }
  private void Tick(object? sender, EventArgs args) { TickCount++; InvalidateVisual(); }
  /// <summary>单次绘制五条圆头柱，不创建逐柱动画时钟。</summary>
  protected override void OnRender(DrawingContext drawing)
  {
    double unit = ActualWidth / 9, width = Math.Min(4, unit), seconds = clock.Elapsed.TotalSeconds;
    for (int i = 0; i < 5; i++) {
      double level = IsRunning ? .22 + .68 * (.5 + .5 * Math.Sin(seconds * (5.2 + i * .65) + i * 1.1)) : .3 + .2 * (2 - Math.Abs(2 - i));
      double height = Math.Max(width, level * ActualHeight);
      drawing.DrawRoundedRectangle(Accent, null, new Rect(i * unit * 2 + (unit - width) / 2, (ActualHeight - height) / 2, width, height), width / 2, width / 2);
    }
  }
}
