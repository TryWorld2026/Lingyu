using System.Text.Json.Serialization;

namespace LingyuWifiHelper;

[JsonSerializable(typeof(WifiInfo))]
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
internal partial class WfJsonContext : JsonSerializerContext
{
}
