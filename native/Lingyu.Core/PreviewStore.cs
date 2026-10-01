/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file PreviewStore.cs @description 首阶段隔离数据的原子保存。 @author 灵屿
 */
namespace Lingyu.Core;

/// <summary>原生预览的数据，不读取或改写旧客户端用户目录。</summary>
public sealed record PreviewState
{
  /// <summary>用户语言。</summary>
  public string Language { get; init; } = "";
  /// <summary>减少动态效果。</summary>
  public bool ReduceMotion { get; init; }
  /// <summary>本地任务。</summary>
  public List<TaskEntry> Tasks { get; init; } = [];
  /// <summary>本地笔记。</summary>
  public List<NoteEntry> Notes { get; init; } = [];
  /// <summary>文件引用。</summary>
  public List<string> Files { get; init; } = [];
  /// <summary>手动选择的天气城市。</summary>
  public WeatherCity? City { get; init; }
  /// <summary>原生预览的模型配置。</summary>
  public AiConnection? Ai { get; init; }
  /// <summary>用户的实际对话历史。</summary>
  public List<ChatConversation> Chats { get; init; } = [];
}
/// <summary>任务保存独立稳定的标识。</summary>
public sealed record TaskEntry(Guid Id, string Text, bool Done, bool Pinned = false);
/// <summary>用户笔记。</summary>
public sealed record NoteEntry(Guid Id, string Title, string Body, DateTimeOffset Updated);
/// <summary>由用户选择的地理位置。</summary>
public sealed record WeatherCity(string Name, string Country, double Latitude, double Longitude);
/// <summary>模型配置中只允许加密后的 Key。</summary>
public sealed record AiConnection(string Provider, string Endpoint, string Model, string ProtectedKey = "");

/// <summary>小型预览数据文件使用原子替换，正式版本将采用数据库迁移。</summary>
public sealed class PreviewStore(string directory)
{
  private readonly string file = Path.Combine(directory, "preview.json");
  /// <summary>读入现有数据。</summary>
  public PreviewState Load() => File.Exists(file)
    ? System.Text.Json.JsonSerializer.Deserialize<PreviewState>(File.ReadAllText(file))
      ?? throw new InvalidDataException("Invalid preview state") : new PreviewState();
  /// <summary>原子保存。</summary>
  public void Save(PreviewState state)
  {
    Directory.CreateDirectory(directory);
    string temporary = file + ".pending";
    File.WriteAllText(temporary, System.Text.Json.JsonSerializer.Serialize(state,
      new System.Text.Json.JsonSerializerOptions { WriteIndented = true }));
    File.Move(temporary, file, true);
  }
}
