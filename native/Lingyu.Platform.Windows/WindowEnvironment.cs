/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WindowEnvironment.cs @description Windows 原生圆角、焦点与前台全屏感知。 @author 灵屿
 */
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Threading;

namespace Lingyu.Platform.Windows;

/// <summary>由系统事件驱动，不为前台窗口启动持续轮询。</summary>
public sealed class WindowEnvironment : IDisposable
{
  private readonly Dispatcher dispatcher;
  private readonly WinEvent callback;
  private readonly IntPtr foregroundHook;
  private readonly IntPtr locationHook;
  private bool queued;
  private bool disposed;
  /// <summary>前台的全屏状态。</summary>
  public event Action<bool>? FullScreenChanged;
  /// <summary>订阅前台和位置变更，合并密集拖动事件。</summary>
  public WindowEnvironment(Dispatcher uiDispatcher)
  {
    dispatcher = uiDispatcher; callback = OnEvent;
    foregroundHook = SetWinEventHook(3, 3, IntPtr.Zero, callback, 0, 0, 0);
    locationHook = SetWinEventHook(0x800B, 0x800B, IntPtr.Zero, callback, 0, 0, 0);
  }
  private void OnEvent(IntPtr hook, uint type, IntPtr window, int objectId, int childId, uint thread, uint time)
  {
    if (disposed || objectId != 0 || window != GetForegroundWindow() || queued) return;
    queued = true;
    _ = dispatcher.InvokeAsync(() => { queued = false; if (!disposed) FullScreenChanged?.Invoke(IsForegroundFullScreen()); }, DispatcherPriority.Background);
  }
  /// <summary>真实覆盖整个显示器的前台窗口才被视为全屏。</summary>
  public static bool IsForegroundFullScreen()
  {
    IntPtr foreground = GetForegroundWindow(); if (foreground == IntPtr.Zero) return false;
    GetWindowThreadProcessId(foreground, out uint owner);
    if (owner == Environment.ProcessId) return false;
    if (!GetWindowRect(foreground, out var rect)) return false;
    var monitor = new MonitorInfo { Size = Marshal.SizeOf<MonitorInfo>() };
    if (!GetMonitorInfo(MonitorFromWindow(foreground, 2), ref monitor)) return false;
    return Math.Abs(rect.Left - monitor.Bounds.Left) <= 2 && Math.Abs(rect.Top - monitor.Bounds.Top) <= 2 &&
      Math.Abs(rect.Right - monitor.Bounds.Right) <= 2 && Math.Abs(rect.Bottom - monitor.Bounds.Bottom) <= 2;
  }
  /// <summary>Windows 11 原生圆角由 DWM 完成，不使用大面积软件阴影。</summary>
  public static void Round(Window window)
  { var handle = new WindowInteropHelper(window).Handle; int preference = 2; _ = DwmSetWindowAttribute(handle, 33, ref preference, sizeof(int)); }
  /// <summary>小岛鼠标操作不激活窗口，也不夺取当前程序的输入。</summary>
  public static void KeepInactive(Window window)
  {
    var handle = new WindowInteropHelper(window).Handle;
    long style = GetWindowLongPtr(handle, -20).ToInt64(); SetWindowLongPtr(handle, -20, new IntPtr(style | 0x08000000L));
  }
  /// <summary>解除 WinEvent 回调。</summary>
  public void Dispose() { disposed = true; if (foregroundHook != IntPtr.Zero) UnhookWinEvent(foregroundHook); if (locationHook != IntPtr.Zero) UnhookWinEvent(locationHook); }
  private delegate void WinEvent(IntPtr hook, uint type, IntPtr window, int objectId, int childId, uint thread, uint time);
  [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] private struct MonitorInfo { public int Size; public Rect Bounds, Work; public uint Flags; }
  [DllImport("user32.dll")] private static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr module, WinEvent callback, uint process, uint thread, uint flags);
  [DllImport("user32.dll")] private static extern bool UnhookWinEvent(IntPtr hook);
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);
  [DllImport("user32.dll")] private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] private static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] private static extern IntPtr SetWindowLongPtr(IntPtr window, int index, IntPtr value);
  [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int length);
}
