/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WindowEnvironment.cs @description Windows 原生圆角、焦点与前台全屏感知。 @author 灵屿
 */
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Threading;
using System.Windows.Shell;

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
  /// <summary>把内容扩展到窗口边界，系统负责缩放、阴影和圆角。</summary>
  public static void NativeFrame(Window window, bool resizable)
  {
    WindowChrome.SetWindowChrome(window, new WindowChrome {
      CaptionHeight = 0, ResizeBorderThickness = new Thickness(resizable ? 6 : 0),
      GlassFrameThickness = new Thickness(1), CornerRadius = new CornerRadius(0),
      NonClientFrameEdges = NonClientFrameEdges.None, UseAeroCaptionButtons = false,
    });
    window.SourceInitialized += (_, _) => Round(window);
  }
  /// <summary>使用 Windows 11 深色边框、圆角及原生阴影。</summary>
  public static void Round(Window window)
  {
    var handle = new WindowInteropHelper(window).Handle;
    int preference = 2, dark = 1, border = 0x003C3935, caption = 0x00100C0B;
    _ = DwmSetWindowAttribute(handle, 20, ref dark, sizeof(int));
    _ = DwmSetWindowAttribute(handle, 33, ref preference, sizeof(int));
    _ = DwmSetWindowAttribute(handle, 34, ref border, sizeof(int));
    _ = DwmSetWindowAttribute(handle, 35, ref caption, sizeof(int));
  }
  /// <summary>胶囊由 Win32 区域裁切，不使用透明窗口或贴图外壳。</summary>
  public static void Capsule(Window window, double radius)
  {
    IntPtr handle = new WindowInteropHelper(window).Handle;
    if (handle == IntPtr.Zero || !GetWindowRect(handle, out var bounds)) return;
    int squareBorder = -2, customRegion = 1;
    _ = DwmSetWindowAttribute(handle, 34, ref squareBorder, sizeof(int));
    _ = DwmSetWindowAttribute(handle, 33, ref customRegion, sizeof(int));
    var dpi = System.Windows.Media.VisualTreeHelper.GetDpi(window);
    int diameter = Math.Max(1, (int)Math.Round(radius * 2 * dpi.DpiScaleX));
    IntPtr region = CreateRoundRectRgn(0, 0, bounds.Right - bounds.Left + 1, bounds.Bottom - bounds.Top + 1, diameter, diameter);
    // SetWindowRgn 成功后系统接管区域；失败时由调用方释放。
    if (region != IntPtr.Zero && SetWindowRgn(handle, region, true) == 0) DeleteObject(region);
  }
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
  [DllImport("gdi32.dll")] private static extern IntPtr CreateRoundRectRgn(int left, int top, int right, int bottom, int width, int height);
  [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr region);
  [DllImport("user32.dll")] private static extern int SetWindowRgn(IntPtr window, IntPtr region, bool redraw);
}
