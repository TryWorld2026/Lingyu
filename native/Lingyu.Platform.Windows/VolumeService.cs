/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file VolumeService.cs @description 直接使用 Core Audio，事件同步音量。 @author 灵屿
 */
using System.Runtime.InteropServices;

namespace Lingyu.Platform.Windows;

/// <summary>默认输出设备的音量与静音。</summary>
public sealed class VolumeService : IDisposable
{
  private IAudioEndpointVolume? endpoint;
  private readonly VolumeCallback callback;
  /// <summary>音量百分比与静音状态变化。</summary>
  public event Action<double, bool>? Changed;
  /// <summary>当前系统是否提供音量设备。</summary>
  public bool Available => endpoint is not null;

  /// <summary>连接用户当前默认播放设备。</summary>
  public VolumeService()
  {
    callback = new VolumeCallback((value, muted) => Changed?.Invoke(value * 100, muted));
    object? enumeratorObject = null;
    IMMDevice? device = null;
    try
    {
      enumeratorObject = Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E"))!);
      var enumerator = (IMMDeviceEnumerator)enumeratorObject!;
      Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
      var guid = typeof(IAudioEndpointVolume).GUID;
      Marshal.ThrowExceptionForHR(device.Activate(ref guid, 23, IntPtr.Zero, out object result));
      endpoint = (IAudioEndpointVolume)result;
      Marshal.ThrowExceptionForHR(endpoint.RegisterControlChangeNotify(callback));
    }
    catch (COMException) { endpoint = null; }
    finally
    {
      if (device is not null) Marshal.ReleaseComObject(device);
      if (enumeratorObject is not null) Marshal.ReleaseComObject(enumeratorObject);
    }
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
    catch (COMException) { return null; }
  }

  /// <summary>设置真实设备音量。</summary>
  public bool Set(double percent)
  {
    if (endpoint is null) return false;
    var context = Guid.Empty;
    return endpoint.SetMasterVolumeLevelScalar((float)Math.Clamp(percent / 100, 0, 1), ref context) >= 0;
  }

  /// <summary>设置真实设备静音。</summary>
  public bool Mute(bool value)
  {
    if (endpoint is null) return false;
    var context = Guid.Empty;
    return endpoint.SetMute(value, ref context) >= 0;
  }

  /// <summary>解除回调并释放 COM 设备。</summary>
  public void Dispose()
  {
    if (endpoint is null) return;
    endpoint.UnregisterControlChangeNotify(callback);
    Marshal.ReleaseComObject(endpoint); endpoint = null;
  }

  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IMMDeviceEnumerator
  {
    [PreserveSig] int EnumAudioEndpoints(int flow, int state, out IntPtr devices);
    [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice device);
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
  [Guid("657804FA-D6AD-4496-8A60-352752AF4F89"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
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
}
