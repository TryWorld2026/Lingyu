/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file SessionModel.Ai.cs @description 实际模型连接、流式回复与本地对话历史。 @author 灵屿
 */
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Lingyu.App.Localization;
using Lingyu.Core;
using Lingyu.Platform.Windows;

namespace Lingyu.App.Models;

public sealed partial class SessionModel
{
  private readonly HttpClient aiHttp = new(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = Timeout.InfiniteTimeSpan };
  private CancellationTokenSource? generation;
  private Guid? currentChat;
  private int streamRevision;
  /// <summary>未发送的输入保留在会话，关闭窗口和刷新不会清空。</summary>
  public string AiDraft { get; set; } = "";
  /// <summary>失败或已停止的最后一条回复可重新请求，不重复添加用户消息。</summary>
  public bool CanRetryChat => !IsGenerating && CurrentChat?.Messages.LastOrDefault() is { Role: "assistant", Status: "failed" or "cancelled" };
  /// <summary>只在可见的对话页面订阅。</summary>
  public event Action? ChatChanged;
  /// <summary>已有真实对话。</summary>
  public IReadOnlyList<ChatConversation> Chats => state.Chats;
  /// <summary>当前对话。</summary>
  public ChatConversation? CurrentChat => state.Chats.FirstOrDefault(chat => chat.Id == currentChat);
  /// <summary>生成任务与窗口独立，可随时停止。</summary>
  public bool IsGenerating => generation is not null;
  /// <summary>加密保存当前连接。空白 Key 只在相同服务下保留。</summary>
  public void SaveConnection(string provider, string endpoint, string modelName, string key)
  {
    var next = new AiConnection(provider, endpoint.Trim(), modelName.Trim());
    _ = AiClient.Endpoint(next, "chat");
    if (string.IsNullOrWhiteSpace(next.Model)) throw new ArgumentException("Model is required");
    string protectedKey = key.Length > 0 ? SecretProtection.Protect(key) : state.Ai is { } previous && previous.Endpoint == next.Endpoint && previous.Provider == next.Provider ? previous.ProtectedKey : "";
    state = state with { Ai = next with { ProtectedKey = protectedKey } }; Persist();
  }
  /// <summary>不会发送付费推理，只验证模型列表。</summary>
  public async Task<bool> TestConnectionAsync()
  {
    if (state.Ai is not { } connection) return false;
    using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(12));
    try
    {
      var models = await new AiClient(aiHttp).ModelsAsync(connection, SecretProtection.Unprotect(connection.ProtectedKey), cancellation.Token);
      return models.Contains(connection.Model, StringComparer.Ordinal) || connection.Provider == "ollama" && models.Contains(connection.Model + ":latest", StringComparer.Ordinal);
    }
    catch (Exception error) when (IsAiFailure(error)) { return false; }
  }
  /// <summary>建立新对话；不遗失正在生成的内容。</summary>
  public void NewChat() { if (IsGenerating) return; currentChat = null; ChatChanged?.Invoke(); }
  /// <summary>打开历史。</summary>
  public void OpenChat(Guid id) { if (IsGenerating) return; currentChat = id; ChatChanged?.Invoke(); }
  /// <summary>删除本地对话。</summary>
  public void DeleteChat() { if (IsGenerating || currentChat is null) return; state.Chats.RemoveAll(chat => chat.Id == currentChat); currentChat = null; Persist(); ChatChanged?.Invoke(); }
  /// <summary>提交真实请求，停止和错误均保留已收到的文字。</summary>
  public async Task SendChatAsync(string question)
  {
    if (IsGenerating || string.IsNullOrWhiteSpace(question)) return;
    if (Showcase) { Emit("sampleNotice"); return; }
    if (state.Ai is not { } connection) { Emit("aiNotConnected"); return; }
    var chat = CurrentChat;
    if (chat is null)
    {
      chat = new ChatConversation(Guid.NewGuid(), question.Length > 32 ? question[..32] + "…" : question, [], DateTimeOffset.Now);
      state.Chats.Insert(0, chat); currentChat = chat.Id;
    }
    chat.Messages.Add(new("user", question.Trim()));
    var history = chat.Messages.Where(message => !string.IsNullOrWhiteSpace(message.Content)).ToArray();
    int answerIndex = chat.Messages.Count; chat.Messages.Add(new("assistant", "", "streaming"));
    await GenerateReplyAsync(chat, history, answerIndex, connection);
  }
  /// <summary>对同一用户消息重试，保留对话位置和之前的历史。</summary>
  public async Task RetryChatAsync()
  {
    if (!CanRetryChat || CurrentChat is not { } chat || state.Ai is not { } connection) return;
    int index = chat.Messages.Count - 1;
    var history = chat.Messages.Take(index).Where(message => !string.IsNullOrWhiteSpace(message.Content)).ToArray();
    chat.Messages[index] = new("assistant", "", "streaming");
    await GenerateReplyAsync(chat, history, index, connection);
  }
  private async Task GenerateReplyAsync(ChatConversation chat, ChatMessage[] history, int answerIndex, AiConnection connection)
  {
    int revision = ++streamRevision; string status = "complete";
    generation = new CancellationTokenSource(TimeSpan.FromMinutes(5));
    Notify(nameof(IsGenerating), nameof(IslandLabel), nameof(IslandHoverLabel), nameof(IslandGlyph), nameof(IslandActivity), nameof(IslandSubLabel)); ChatChanged?.Invoke();
    var answer = new StringBuilder(); var update = Stopwatch.StartNew();
    try
    {
      await new AiClient(aiHttp).StreamAsync(connection, SecretProtection.Unprotect(connection.ProtectedKey), history,
        NativePrompt.Build(TextCatalog.Current.Language), token => {
          answer.Append(token);
          if (update.ElapsedMilliseconds < 65) return;
          string text = answer.ToString(); update.Restart();
          Dispatch(() => { if (revision != streamRevision || generation is null) return; chat.Messages[answerIndex] = new("assistant", text, "streaming"); ChatChanged?.Invoke(); });
        }, generation.Token);
    }
    catch (OperationCanceledException) { status = "cancelled"; Emit("aiCancelled"); }
    catch (Exception error) when (IsAiFailure(error)) { status = "failed"; Emit("aiFailed"); }
    finally
    {
      streamRevision++; chat.Messages[answerIndex] = new("assistant", answer.ToString(), status);
      generation?.Dispose(); generation = null;
      Persist(); Notify(nameof(IsGenerating), nameof(IslandLabel), nameof(IslandHoverLabel), nameof(IslandGlyph), nameof(IslandActivity), nameof(IslandSubLabel), nameof(CanRetryChat)); ChatChanged?.Invoke();
    }
  }
  /// <summary>取消真实网络流和推理请求。</summary>
  public void StopChat() => generation?.Cancel();
  private static bool IsAiFailure(Exception error) => error is HttpRequestException or TaskCanceledException or JsonException or IOException or InvalidDataException or ArgumentException or CryptographicException or FormatException or InvalidOperationException;
}
