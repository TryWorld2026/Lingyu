/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file AiClient.cs @description Ollama 与 OpenAI 兼容协议的流式连接。 @author 灵屿
 */
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Lingyu.Core;

/// <summary>对话消息只包含用户实际提交的文字与模型的回复。</summary>
public sealed record ChatMessage(string Role, string Content);
/// <summary>本地保存的对话。</summary>
public sealed record ChatConversation(Guid Id, string Title, List<ChatMessage> Messages, DateTimeOffset Updated);

/// <summary>可注入 HTTP 传输以验证协议和取消行为。</summary>
public sealed class AiClient(HttpClient http)
{
  /// <summary>地址规范化，不允许把凭证写入 URL。</summary>
  public static Uri Endpoint(AiConnection connection, string action)
  {
    if (!Uri.TryCreate(connection.Endpoint.TrimEnd('/') + "/", UriKind.Absolute, out var uri) ||
      uri.Scheme is not ("http" or "https") || uri.UserInfo.Length > 0 || uri.Query.Length > 0 || uri.Fragment.Length > 0)
      throw new ArgumentException("Invalid service URL");
    if (connection.Provider is not ("ollama" or "openai")) throw new ArgumentException("Unknown provider");
    string path = connection.Provider == "ollama" ? action == "chat" ? "api/chat" : "api/tags" : action == "chat" ? "chat/completions" : "models";
    return new Uri(uri, path);
  }
  /// <summary>按协议逐块返回文本。</summary>
  public async Task StreamAsync(AiConnection connection, string key, IEnumerable<ChatMessage> messages,
    string systemPrompt, Action<string> onText, CancellationToken cancellationToken)
  {
    cancellationToken.ThrowIfCancellationRequested();
    using var request = Request(connection, "chat", key, HttpMethod.Post);
    var history = new[] { new ChatMessage("system", systemPrompt) }.Concat(messages.TakeLast(20));
    request.Content = JsonContent.Create(new { model = connection.Model, messages = history.Select(message => new { role = message.Role, content = message.Content }), stream = true });
    using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
    response.EnsureSuccessStatusCode();
    using var reader = new StreamReader(await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false));
    bool received = false, done = false;
    while (await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false) is { } line)
    {
      cancellationToken.ThrowIfCancellationRequested();
      if (connection.Provider == "openai")
      {
        if (!line.StartsWith("data:", StringComparison.Ordinal)) continue;
        line = line[5..].Trim();
        if (line == "[DONE]") { done = true; break; }
      }
      if (string.IsNullOrWhiteSpace(line)) continue;
      using var document = JsonDocument.Parse(line); var root = document.RootElement;
      if (root.TryGetProperty("error", out _)) throw new InvalidDataException("Model service error");
      string? token = null;
      if (connection.Provider == "ollama")
      {
        if (root.TryGetProperty("message", out var message) && message.TryGetProperty("content", out var content)) token = content.GetString();
        done = root.TryGetProperty("done", out var finished) && finished.GetBoolean();
      }
      else if (root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
      {
        var choice = choices[0];
        if (choice.TryGetProperty("delta", out var delta) && delta.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.String) token = content.GetString();
        done = choice.TryGetProperty("finish_reason", out var reason) && reason.ValueKind == JsonValueKind.String;
      }
      if (!string.IsNullOrEmpty(token)) { received = true; onText(token); }
      if (done) break;
    }
    if (!received || !done) throw new InvalidDataException("Incomplete model response");
  }
  /// <summary>只获取模型列表，不产生推理费用。</summary>
  public async Task<IReadOnlyList<string>> ModelsAsync(AiConnection connection, string key, CancellationToken cancellationToken)
  {
    using var request = Request(connection, "models", key, HttpMethod.Get);
    using var response = await http.SendAsync(request, cancellationToken).ConfigureAwait(false); response.EnsureSuccessStatusCode();
    using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
    return document.RootElement.GetProperty(connection.Provider == "ollama" ? "models" : "data").EnumerateArray()
      .Select(model => model.GetProperty(connection.Provider == "ollama" ? "name" : "id").GetString() ?? "").ToArray();
  }
  private static HttpRequestMessage Request(AiConnection connection, string action, string key, HttpMethod method)
  {
    Uri uri = Endpoint(connection, action);
    if (key.Length > 0 && uri.Scheme != "https" && !uri.IsLoopback) throw new ArgumentException("API key requires HTTPS");
    var request = new HttpRequestMessage(method, uri);
    if (key.Length > 0) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
    return request;
  }
}
