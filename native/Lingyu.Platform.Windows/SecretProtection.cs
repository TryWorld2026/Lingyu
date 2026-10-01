/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file SecretProtection.cs @description 使用 Windows 当前用户 DPAPI 保护凭证。 @author 灵屿
 */
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace Lingyu.Platform.Windows;

/// <summary>加密内容只可由同一 Windows 用户解密，不写入日志或 URL。</summary>
public static class SecretProtection
{
  /// <summary>保存前加密 Key。</summary>
  public static string Protect(string text) => text.Length == 0 ? "" : Convert.ToBase64String(Transform(Encoding.UTF8.GetBytes(text), true));
  /// <summary>请求时短暂解密 Key。</summary>
  public static string Unprotect(string text)
  {
    if (text.Length == 0) return "";
    byte[] plain = Transform(Convert.FromBase64String(text), false);
    try { return Encoding.UTF8.GetString(plain); } finally { CryptographicOperations.ZeroMemory(plain); }
  }
  private static byte[] Transform(byte[] bytes, bool encrypt)
  {
    var input = new Blob { Length = bytes.Length, Data = Marshal.AllocHGlobal(bytes.Length) };
    Blob output = default;
    try
    {
      Marshal.Copy(bytes, 0, input.Data, bytes.Length);
      bool success = encrypt ? CryptProtectData(ref input, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 1, out output)
        : CryptUnprotectData(ref input, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, 1, out output);
      if (!success) throw new CryptographicException(Marshal.GetLastWin32Error());
      byte[] result = new byte[output.Length]; Marshal.Copy(output.Data, result, 0, result.Length); return result;
    }
    finally
    {
      byte[] zero = new byte[bytes.Length]; Marshal.Copy(zero, 0, input.Data, zero.Length);
      Marshal.FreeHGlobal(input.Data); CryptographicOperations.ZeroMemory(bytes);
      if (output.Data != IntPtr.Zero) LocalFree(output.Data);
    }
  }
  [StructLayout(LayoutKind.Sequential)] private struct Blob { public int Length; public IntPtr Data; }
  [DllImport("crypt32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool CryptProtectData(ref Blob input, IntPtr description, IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out Blob output);
  [DllImport("crypt32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool CryptUnprotectData(ref Blob input, IntPtr description, IntPtr entropy, IntPtr reserved, IntPtr prompt, int flags, out Blob output);
  [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
}
