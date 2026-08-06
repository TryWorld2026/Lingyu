using System.Text.Json.Serialization;

namespace LingyuBluetoothHelper;

[JsonSerializable(typeof(BluetoothDeviceInfo))]
[JsonSerializable(typeof(BluetoothDeviceInfo[]))]
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
internal partial class BtJsonContext : JsonSerializerContext
{
}
