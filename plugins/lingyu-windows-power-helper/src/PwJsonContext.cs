using System.Text.Json.Serialization;

namespace LingyuPowerHelper;

[JsonSerializable(typeof(PowerInfo))]
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
internal partial class PwJsonContext : JsonSerializerContext
{
}
