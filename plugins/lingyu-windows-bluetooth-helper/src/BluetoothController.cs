/*
 * Lingyu - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
 * https://github.com/JNTMTMTM/Lingyu
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM[](https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Devices.Enumeration;

namespace LingyuBluetoothHelper;

/// <summary>
/// 蓝牙设备查询控制器
/// </summary>
public static class BluetoothController
{
    /// <summary>
    /// 查询经典蓝牙 + BLE 设备，合并去重
    /// </summary>
    private static DeviceInformation[] FindAllBluetoothDevices(string? extraFilter = null)
    {
        var results = new Dictionary<string, DeviceInformation>();

        // 经典蓝牙
        try
        {
            var selector = BluetoothDevice.GetDeviceSelector();
            if (extraFilter != null) selector = $"({selector}) AND ({extraFilter})";
            var devices = DeviceInformation.FindAllAsync(selector).GetAwaiter().GetResult();
            foreach (var d in devices) results.TryAdd(d.Id, d);
        }
        catch { /* 忽略 */ }

        // BLE
        try
        {
            var selector = BluetoothLEDevice.GetDeviceSelector();
            if (extraFilter != null) selector = $"({selector}) AND ({extraFilter})";
            var devices = DeviceInformation.FindAllAsync(selector).GetAwaiter().GetResult();
            foreach (var d in devices) results.TryAdd(d.Id, d);
        }
        catch { /* 忽略 */ }

        return results.Values.ToArray();
    }

    /// <summary>
    /// 获取所有已配对的蓝牙设备
    /// </summary>
    public static BluetoothDeviceInfo[] GetPairedDevices()
    {
        try
        {
            return FindAllBluetoothDevices(PairedFilter)
                .Select(d => BuildDeviceInfo(d, pairedByQuery: true)).ToArray();
        }
        catch
        {
            return [];
        }
    }

    /// <summary>
    /// 获取所有已连接的蓝牙设备
    /// </summary>
    public static BluetoothDeviceInfo[] GetConnectedDevices()
    {
        try
        {
            return FindAllBluetoothDevices("System.Devices.Aep.IsConnected:=System.StructuredQueryType.Boolean#True")
                .Select(d => BuildDeviceInfo(d)).ToArray();
        }
        catch
        {
            return [];
        }
    }

    /// <summary>
    /// 获取所有可见蓝牙设备（已配对 + 附近 BLE 广播）
    /// </summary>
    public static BluetoothDeviceInfo[] GetAllDevices()
    {
        try
        {
            // isPaired 是设备属性，不该随接口而变：已配对但不在附近的设备读不到
            // IsPaired 属性，用配对 ID 集合补齐，使 getAllDevices 与 getPairedDevices 一致。
            RememberPairedIds();
            return FindAllBluetoothDevices().Select(d => BuildDeviceInfo(d)).ToArray();
        }
        catch
        {
            return [];
        }
    }

    /// <summary>
    /// 已配对设备的 AQL 过滤条件。
    /// FindAllAsync(selector) 的默认属性里没有 System.Devices.Aep.IsPaired，
    /// Pairing.IsPaired 在本机实测同样为 False，只有按此条件枚举才能读到系统配对记录。
    /// 不能改用 FindAllAsync(selector, additionalProperties)：原生 AOT 下该重载会抛
    /// COMException 且被外层 catch 静默吞掉，导致整表为空。
    /// </summary>
    private const string PairedFilter = "System.Devices.Aep.IsPaired:=System.StructuredQueryType.Boolean#True";

    // 已配对设备 ID 快照，带短期失效：用户取消配对后不应该长期显示 isPaired=true。
    // 过期时间较短，因为每次 getPairedDevices 都会重算，这里只补其他入口读不到的情形。
    private static readonly TimeSpan PairedCacheTtl = TimeSpan.FromSeconds(10);
    private static HashSet<string>? pairedIdCache;
    private static DateTime pairedCacheFetchedAt = DateTime.MinValue;

    /// <summary>
    /// 订阅已配对设备 ID 集合，用于缩放读不到 IsPaired 属性的设备。
    /// </summary>
    private static void RememberPairedIds()
    {
        // 超时重新获取；获取失败时保留旧值，不要因一次失败就把所有设备的配对状态清空。
        if (DateTime.UtcNow - pairedCacheFetchedAt < PairedCacheTtl) return;
        var ids = FindAllBluetoothDevices(PairedFilter).Select(d => d.Id).ToHashSet();
        pairedIdCache = ids;
        pairedCacheFetchedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// 获取单个设备快照
    /// </summary>
    /// <param name="deviceId">Windows DeviceInformation ID</param>
    public static BluetoothDeviceInfo? GetDevice(string deviceId)
    {
        try
        {
            var device = DeviceInformation.CreateFromIdAsync(deviceId).GetAwaiter().GetResult();
            return device != null ? BuildDeviceInfo(device) : null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// 获取经典蓝牙设备的 AQS 选择器（用于 DeviceWatcher）
    /// </summary>
    public static string GetClassicSelector() => BluetoothDevice.GetDeviceSelector();

    /// <summary>
    /// 获取 BLE 设备的 AQS 选择器（用于 DeviceWatcher）
    /// </summary>
    public static string GetBleSelector() => BluetoothLEDevice.GetDeviceSelector();

    /// <summary>
    /// 从 DeviceInformation 构建 BluetoothDeviceInfo
    /// </summary>
    /// <param name="pairedByQuery">设备由配对 AQL 枚举得出，属性读不到时也应标记为已配对。</param>
    public static BluetoothDeviceInfo BuildDeviceInfo(DeviceInformation device, bool pairedByQuery = false)
    {
        // 基础属性（FindAllAsync 默认返回）
        string? address = null;
        int? rssi = null;
        int? deviceClass = null;
        int? appearance = null;
        string[] serviceUuids = [];
        bool isConnected = false;
        bool isPaired = false;
        int? batteryLevel = null;

        // 尝试从 Properties 读取（需要 ExtraProperties 才有值）
        try { if (device.Properties["System.Devices.Aep.DeviceAddress"] is string addr && !string.IsNullOrEmpty(addr)) address = addr; } catch { }
        try { if (device.Properties["System.Devices.Aep.SignalStrength"] is int signal) rssi = signal; } catch { }
        try { if (device.Properties["System.Devices.Aep.IsConnected"] is bool conn) isConnected = conn; } catch { }
        try { if (device.Properties["System.Devices.Aep.IsPaired"] is bool paired) isPaired = paired; } catch { }

        // FindAllAsync(selector) 不返回配对状态，Pairing.IsPaired 在本机实测同样为 False；
        // 只有按配对 AQL 枚举出来的记录才应标记为已配对，避免把附近未配对设备算进来。
        if (!isPaired && (pairedByQuery || (pairedIdCache?.Contains(device.Id) ?? false))) isPaired = true;

        // CoD、Appearance、ServiceGuids 不支持 FindAllAsync 的规范名，通过 EnrichFromBluetoothDevice 补充
        EnrichFromBluetoothDevice(device.Id, ref isConnected, ref isPaired, ref address, ref rssi,
            ref deviceClass, ref appearance, ref serviceUuids, ref batteryLevel);

        return new BluetoothDeviceInfo
        {
            DeviceId = device.Id,
            Name = device.Name,
            BluetoothAddress = address,
            IsConnected = isConnected,
            IsPaired = isPaired,
            SignalStrength = rssi,
            DeviceClass = deviceClass,
            Appearance = appearance,
            ServiceUuids = serviceUuids,
            DeviceType = DeviceTypeMapper.DeriveDeviceType(deviceClass, appearance),
            BatteryLevel = batteryLevel,
        };
    }

    /// <summary>
    /// 通过 BluetoothDevice / BluetoothLEDevice 对象补充属性；BLE 设备同时读取电量
    /// </summary>
    private static void EnrichFromBluetoothDevice(
        string deviceId,
        ref bool isConnected,
        ref bool isPaired,
        ref string? address,
        ref int? rssi,
        ref int? deviceClass,
        ref int? appearance,
        ref string[] serviceUuids,
        ref int? batteryLevel)
    {
        // 尝试 BLE（优先，可获取电量、Appearance、ServiceUuids）
        try
        {
            var ble = BluetoothLEDevice.FromIdAsync(deviceId).GetAwaiter().GetResult();
            if (ble != null)
            {
                isConnected = ble.ConnectionStatus == BluetoothConnectionStatus.Connected;
                isPaired = true;
                address = ble.BluetoothAddress.ToString("X12");

                // BLE Appearance（BluetoothLEAppearance）
                try { if (ble.Appearance != null) appearance = ble.Appearance.RawValue; } catch { }

                // GATT Service UUIDs
                try
                {
                    var svcResult = ble.GetGattServicesAsync(BluetoothCacheMode.Cached).GetAwaiter().GetResult();
                    if (svcResult.Status == GattCommunicationStatus.Success && svcResult.Services.Count > 0)
                        serviceUuids = svcResult.Services.Select(s => s.Uuid.ToString()).ToArray();
                }
                catch { }

                batteryLevel = ReadBleBatteryLevel(ble);
                return;
            }
        }
        catch { /* 非 BLE 设备，忽略 */ }

        // 尝试经典蓝牙
        try
        {
            var bt = BluetoothDevice.FromIdAsync(deviceId).GetAwaiter().GetResult();
            if (bt != null)
            {
                isConnected = bt.ConnectionStatus == BluetoothConnectionStatus.Connected;
                isPaired = true;
                address = bt.BluetoothAddress.ToString("X12");

                // 经典蓝牙 Class of Device
                try { if (bt.ClassOfDevice != null) deviceClass = (int)bt.ClassOfDevice.RawValue; } catch { }

                return;
            }
        }
        catch { /* 忽略 */ }
    }

    /// <summary>
    /// 通过 GATT Battery Service (0x180F) 读取 BLE 设备电量百分比
    /// </summary>
    private static int? ReadBleBatteryLevel(BluetoothLEDevice ble)
    {
        GattDeviceService? service = null;
        try
        {
            var result = ble.GetGattServicesAsync(BluetoothCacheMode.Cached).GetAwaiter().GetResult();
            if (result.Status != GattCommunicationStatus.Success) return null;

            // 查找 Battery Service (UUID 0x180F)
            service = result.Services.FirstOrDefault(s =>
                s.Uuid == GattServiceUuids.Battery);
            if (service == null) return null;

            var characteristics = service.GetCharacteristicsAsync(BluetoothCacheMode.Cached).GetAwaiter().GetResult();
            if (characteristics.Status != GattCommunicationStatus.Success) return null;

            // Battery Level characteristic (UUID 0x2A19)
            var batteryChar = characteristics.Characteristics.FirstOrDefault(c =>
                c.Uuid == GattCharacteristicUuids.BatteryLevel);
            if (batteryChar == null) return null;

            if (!batteryChar.CharacteristicProperties.HasFlag(GattCharacteristicProperties.Read))
                return null;

            var valueResult = batteryChar.ReadValueAsync().GetAwaiter().GetResult();
            if (valueResult.Status != GattCommunicationStatus.Success) return null;

            var reader = Windows.Storage.Streams.DataReader.FromBuffer(valueResult.Value);
            return reader.ReadByte(); // 0–100
        }
        catch
        {
            return null;
        }
        finally
        {
            service?.Dispose();
        }
    }
}
