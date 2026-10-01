/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file IslandState.cs @description 岛形态与前后台切换的业务约束。 @author 灵屿
 */
namespace Lingyu.Core;

/// <summary>三种有明确用途的岛形态。</summary>
public enum IslandShape { Docked, Hover, Expanded }

/// <summary>用户展开的面板不会被鼠标离开事件意外关闭。</summary>
public sealed class IslandState
{
  /// <summary>当前岛形态。</summary>
  public IslandShape Shape { get; private set; } = IslandShape.Docked;
  /// <summary>进入时显示快捷控制。</summary>
  public void Enter() { if (Shape == IslandShape.Docked) Shape = IslandShape.Hover; }
  /// <summary>离开悬停态时收起。</summary>
  public void Leave() { if (Shape == IslandShape.Hover) Shape = IslandShape.Docked; }
  /// <summary>切换完整面板。</summary>
  public void Toggle() => Shape = Shape == IslandShape.Expanded ? IslandShape.Docked : IslandShape.Expanded;
  /// <summary>显式返回安静的常驻态。</summary>
  public void Collapse() => Shape = IslandShape.Docked;
}
