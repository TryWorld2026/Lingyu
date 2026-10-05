/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file IslandState.cs @description 岛形态与前后台切换的业务约束。 @author 灵屿
 */
namespace Lingyu.Core;

/// <summary>三种有明确用途的岛形态。</summary>
public enum IslandShape { Docked, Hover, Expanded }

/// <summary>展开形态内的内容选择，不增加窗口形态。</summary>
public enum IslandExpandedView { Music, Overview }

/// <summary>用户展开的面板不会被鼠标离开事件意外关闭。</summary>
public sealed class IslandState
{
  private IslandShape? pending;
  private double deadline;
  /// <summary>当前岛形态。</summary>
  public IslandShape Shape { get; private set; } = IslandShape.Docked;
  /// <summary>调度器在截止时间之前不能丢弃仍然有效的意图。</summary>
  public bool HasPendingIntent => pending is not null;
  /// <summary>进入时显示快捷控制。</summary>
  public void Enter() { if (Shape == IslandShape.Docked) Shape = IslandShape.Hover; }
  /// <summary>离开悬停态时收起。</summary>
  public void Leave() { if (Shape == IslandShape.Hover) Shape = IslandShape.Docked; }
  /// <summary>切换完整面板。</summary>
  public void Toggle() { pending = null; Shape = Shape == IslandShape.Expanded ? IslandShape.Docked : IslandShape.Expanded; }
  /// <summary>显式返回安静的常驻态。</summary>
  public void Collapse() { pending = null; Shape = IslandShape.Docked; }
  /// <summary>单调时钟秒数；重新进入撤销此前的离开意图。</summary>
  public void PointerEnter(double seconds) { pending = Shape == IslandShape.Docked ? IslandShape.Hover : null; deadline = seconds + .14; }
  /// <summary>离开撤销尚未完成的进入，已悬停则保留 150ms 容错。</summary>
  public void PointerLeave(double seconds) { pending = Shape == IslandShape.Hover ? IslandShape.Docked : null; deadline = seconds + .15; }
  /// <summary>驱动意图；鼠标捕获与编辑中的控件不会被自动收起。</summary>
  public bool PollIntent(double seconds, bool protectedControl = false)
  {
    if (pending is null || seconds < deadline || protectedControl) return false;
    var next = pending.Value; pending = null;
    if (Shape == IslandShape.Expanded || Shape == next) return false;
    Shape = next; return true;
  }
}
