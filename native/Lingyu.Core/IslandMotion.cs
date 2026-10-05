/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file IslandMotion.cs @description 可反向的岛几何与内容运动，无界面或计时器依赖。 @author 灵屿
 */
namespace Lingyu.Core;

/// <summary>同一帧的轮廓、封面与六个内容层，距离单位为 DIP。</summary>
public sealed record IslandGeometry(double Width, double Height, double Radius,
  double ArtSize, double ArtInset, double ArtTop, double Docked, double Hover,
  double Music, double Focus, double Ai, double ArtOpacity, double Overview = 0);

/// <summary>保留当前位置与速度的有界弹簧；调用方只在运动时订阅呈现。</summary>
public sealed class IslandMotion
{
  private readonly double[] position;
  private readonly double[] velocity = new double[13];
  private double[] target;
  private IslandGeometry destination;
  /// <summary>当前一帧，不要求界面重新创建控件。</summary>
  public IslandGeometry Current => new(position[0], position[1], position[2], position[3], position[4], position[5],
    position[6], position[7], position[8], position[9], position[10], position[11], position[12]);
  /// <summary>所有通道收敛后调用方应停止逐帧订阅。</summary>
  public bool IsMoving { get; private set; }
  /// <summary>从稳定的初始形态建立驱动。</summary>
  public IslandMotion(IslandGeometry initial) { destination = initial; position = Values(initial); target = Values(initial); }
  private static double[] Values(IslandGeometry g) => [g.Width, g.Height, g.Radius, g.ArtSize, g.ArtInset, g.ArtTop, g.Docked, g.Hover, g.Music, g.Focus, g.Ai, g.ArtOpacity, g.Overview];
  /// <summary>改变目标不重置速度；减少动画或恢复可见性时可直接落定。</summary>
  public void SetTarget(IslandGeometry next, bool instant = false)
  {
    if (next != destination) { destination = next; target = Values(next); IsMoving = true; }
    if (instant) Snap();
  }
  /// <summary>按单调时钟的经过秒数推进；暂停超过 250ms 后不补播过期运动。</summary>
  public void Step(double seconds)
  {
    if (!IsMoving || !double.IsFinite(seconds) || seconds <= 0) return;
    if (seconds > .25) { Snap(); return; }
    int steps = (int)Math.Ceiling(seconds * 240); double dt = seconds / steps;
    for (int step = 0; step < steps; step++)
      for (int i = 0; i < position.Length; i++)
      {
        double frequency = i < 6 ? 55 : 70, damping = i < 6 ? .9 : 1;
        velocity[i] += (frequency * frequency * (target[i] - position[i]) - 2 * damping * frequency * velocity[i]) * dt;
        position[i] += velocity[i] * dt;
      }
    bool settled = true;
    for (int i = 0; i < position.Length; i++)
      settled &= Math.Abs(position[i] - target[i]) < (i < 6 ? .15 : .002) && Math.Abs(velocity[i]) < (i < 6 ? 2 : .02);
    if (settled) Snap();
  }
  private void Snap() { Array.Copy(target, position, target.Length); Array.Clear(velocity); IsMoving = false; }
}
