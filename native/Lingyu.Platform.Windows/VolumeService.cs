/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file VolumeService.cs @description 直接使用 Core Audio，事件同步音量。 @author 灵屿
 */
using System.Runtime.InteropServices;
using System.Windows.Threading;

namespace Lingyu.Platform.Windows;

/// <summary>默认输出设备的音量与静音；公开操作由创建服务的界面线程调用。</summary>
public sealed class VolumeService : IDisposable
{
  private IAudioEndpointVolume? endpoint;
  private IMMDeviceEnumerator? enumerator;
  private VolumeCallback? callback;
  private readonly DeviceCallback deviceCallback;
  private readonly Dispatcher dispatcher = Dispatcher.CurrentDispatcher;
  private int revision;
  private int rebindQueued;
  private bool disposed;
  /// <summary>音量、静音或可用性变化；无设备时发布零音量并使 Available 为 false。</summary>
  public event Action<double, bool>? Changed;
  /// <summary>当前系统是否提供音量设备。</summary>
  public bool Available => endpoint is not null;

  /// <summary>连接用户当前默认播放设备。</summary>
  public VolumeService() : this(CreateEnumerator()) { }
  private VolumeService(IMMDeviceEnumerator? enumerator)
  {
    this.enumerator = enumerator; deviceCallback = new DeviceCallback(QueueRebind);
    try { if (enumerator is not null) Marshal.ThrowExceptionForHR(enumerator.RegisterEndpointNotificationCallback(deviceCallback)); }
    catch (COMException) { Release(enumerator); this.enumerator = null; }
    Rebind();
  }
  private static IMMDeviceEnumerator? CreateEnumerator()
  {
    try { return (IMMDeviceEnumerator?)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"))!); }
    catch (COMException) { return null; }
  }
  private void QueueRebind()
  {
    if (disposed || dispatcher.HasShutdownStarted || Interlocked.Exchange(ref rebindQueued, 1) != 0) return;
    // Core Audio 回调不能等待或释放 COM 对象；转到持有服务的界面线程处理。
    _ = dispatcher.BeginInvoke(() => { Interlocked.Exchange(ref rebindQueued, 0); if (!disposed) Rebind(); });
  }
  private void Rebind()
  {
    Detach();
    if (disposed) return;
    IMMDevice? device = null;
    try
    {
      if (enumerator is not null)
      {
        Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
        var guid = typeof(IAudioEndpointVolume).GUID;
        Marshal.ThrowExceptionForHR(device.Activate(ref guid, 23, IntPtr.Zero, out object result));
        endpoint = (IAudioEndpointVolume)result; int ticket = revision;
        callback = new VolumeCallback((value, muted) => {
          if (disposed || dispatcher.HasShutdownStarted) return;
          _ = dispatcher.BeginInvoke(() => { if (!disposed && ticket == revision) Changed?.Invoke(value * 100, muted); });
        });
        Marshal.ThrowExceptionForHR(endpoint.RegisterControlChangeNotify(callback));
      }
    }
    catch (COMException) { Detach(); }
    finally { Release(device); }
    if (endpoint is null) Changed?.Invoke(0, false);
    else if (Read() is { } current) Changed?.Invoke(current.Value, current.Muted);
  }

  /// <summary>读取当前音量；设备不可用时返回空。</summary>
  public (double Value, bool Muted)? Read()
  {
    if (endpoint is null) return null;
    try
    {
      Marshal.ThrowExceptionForHR(endpoint.GetMasterVolumeLevelScalar(out float scalar));
      Marshal.ThrowExceptionForHR(endpoint.GetMute(out bool muted));
      return (scalar * 100, muted);
    }
    catch (COMException) { Failed(); return null; }
  }

  /// <summary>设置真实设备音量。</summary>
  public bool Set(double percent)
  {
    if (endpoint is null) return false;
    try { var context = Guid.Empty; Marshal.ThrowExceptionForHR(endpoint.SetMasterVolumeLevelScalar((float)Math.Clamp(percent / 100, 0, 1), ref context)); return true; }
    catch (COMException) { Failed(); return false; }
  }

  /// <summary>设置真实设备静音。</summary>
  public bool Mute(bool value)
  {
    if (endpoint is null) return false;
    try { var context = Guid.Empty; Marshal.ThrowExceptionForHR(endpoint.SetMute(value, ref context)); return true; }
    catch (COMException) { Failed(); return false; }
  }

  private void Failed() { Detach(); if (!disposed) Changed?.Invoke(0, false); }
  private void Detach()
  {
    revision++; var previous = endpoint; var previousCallback = callback; endpoint = null; callback = null;
    if (previous is null) return;
    try { if (previousCallback is not null) previous.UnregisterControlChangeNotify(previousCallback); }
    catch (COMException) { }
    finally { Release(previous); }
  }
  private static void Release(object? value) { if (value is not null && Marshal.IsComObject(value)) Marshal.ReleaseComObject(value); }

  /// <summary>解除回调并释放 COM 设备。</summary>
  public void Dispose()
  {
    if (disposed) return; disposed = true;
    try { enumerator?.UnregisterEndpointNotificationCallback(deviceCallback); }
    catch (COMException) { }
    finally { Detach(); Release(enumerator); enumerator = null; }
  }

  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IMMDeviceEnumerator
  {
    [PreserveSig] int EnumAudioEndpoints(int flow, int state, out IntPtr devices);
    [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice device);
    [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
    [PreserveSig] int RegisterEndpointNotificationCallback(IMMNotificationClient callback);
    [PreserveSig] int UnregisterEndpointNotificationCallback(IMMNotificationClient callback);
  }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IMMDevice
  {
    [PreserveSig] int Activate(ref Guid iid, uint context, IntPtr activation, [MarshalAs(UnmanagedType.IUnknown)] out object result);
  }
  [ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IAudioEndpointVolume
  {
    [PreserveSig] int RegisterControlChangeNotify(IAudioEndpointVolumeCallback callback);
    [PreserveSig] int UnregisterControlChangeNotify(IAudioEndpointVolumeCallback callback);
    [PreserveSig] int GetChannelCount(out uint count);
    [PreserveSig] int SetMasterVolumeLevel(float value, ref Guid context);
    [PreserveSig] int SetMasterVolumeLevelScalar(float value, ref Guid context);
    [PreserveSig] int GetMasterVolumeLevel(out float value);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float value);
    [PreserveSig] int SetChannelVolumeLevel(uint channel, float value, ref Guid context);
    [PreserveSig] int SetChannelVolumeLevelScalar(uint channel, float value, ref Guid context);
    [PreserveSig] int GetChannelVolumeLevel(uint channel, out float value);
    [PreserveSig] int GetChannelVolumeLevelScalar(uint channel, out float value);
    [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool value, ref Guid context);
    [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool value);
  }
  [ComVisible(true), Guid("657804FA-D6AD-4496-8A60-352752AF4F89"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IAudioEndpointVolumeCallback
  {
    [PreserveSig] int OnNotify(IntPtr notification);
  }
  [StructLayout(LayoutKind.Sequential)]
  private struct VolumeData
  {
    public Guid Context;
    [MarshalAs(UnmanagedType.Bool)] public bool Muted;
    public float Volume;
    public uint Channels;
  }
  [ComVisible(true), ClassInterface(ClassInterfaceType.None)]
  private sealed class VolumeCallback(Action<float, bool> changed) : IAudioEndpointVolumeCallback
  {
    public int OnNotify(IntPtr notification)
    {
      var data = Marshal.PtrToStructure<VolumeData>(notification);
      changed(data.Volume, data.Muted);
      return 0;
    }
  }
  [ComVisible(true), Guid("7991EEC9-7E89-4D85-8390-6C703CEC60C0"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IMMNotificationClient
  {
    [PreserveSig] int OnDeviceStateChanged([MarshalAs(UnmanagedType.LPWStr)] string id, uint state);
    [PreserveSig] int OnDeviceAdded([MarshalAs(UnmanagedType.LPWStr)] string id);
    [PreserveSig] int OnDeviceRemoved([MarshalAs(UnmanagedType.LPWStr)] string id);
    [PreserveSig] int OnDefaultDeviceChanged(int flow, int role, [MarshalAs(UnmanagedType.LPWStr)] string? id);
    [PreserveSig] int OnPropertyValueChanged([MarshalAs(UnmanagedType.LPWStr)] string id, PropertyKey key);
  }
  [StructLayout(LayoutKind.Sequential)]
  private struct PropertyKey { public Guid Format; public uint Id; }
  [ComVisible(true), ClassInterface(ClassInterfaceType.None)]
  private sealed class DeviceCallback(Action changed) : IMMNotificationClient
  {
    public int OnDeviceStateChanged(string id, uint state) { changed(); return 0; }
    public int OnDeviceAdded(string id) { changed(); return 0; }
    public int OnDeviceRemoved(string id) { changed(); return 0; }
    public int OnDefaultDeviceChanged(int flow, int role, string? id) { if (flow == 0 && role == 1) changed(); return 0; }
    public int OnPropertyValueChanged(string id, PropertyKey key) => 0;
  }
}
