/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file AiInteractionChecks.cs @description 隔离的本地协议夹具验证真实 WPF 对话交互；不冒充真实模型验收。 @author 灵屿
 */
using System.Collections.Concurrent;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Lingyu.App.Controls;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.App.Windows;

namespace Lingyu.App.Verification;

/// <summary>使用实际 HTTP 流和原生控件验证生命周期，不发送用户资料或使用付费服务。</summary>
public static class AiInteractionChecks
{
  private static string FixtureLabel => TextCatalog.T("protocolFixtureNotice");
  private const string MarkdownReply = "# Protocol fixture\n\nA **bold** reply with `inline code`.\n\n1. First item\n2. Second item\n\n```csharp\nConsole.WriteLine(\"fixture\");\n```";

  /// <summary>调用方先关闭普通工作台；结果写入共用报告，数据仅保存在输出目录。</summary>
  public static async Task RunAsync(string output, Action<string, Action> check, Action<bool, string> assert)
  {
    string language = TextCatalog.Current.Language;
    string profile = Path.Combine(output, "ai-protocol-fixture", Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(profile);
    using var server = new ProtocolFixture();
    using var model = new SessionModel(profile, false, language);
    WorkspaceWindow? window = null;
    async Task Verify(string name, Func<Task> action)
    {
      try { await action(); check("AI protocol fixture: " + name, () => { }); }
      catch (Exception error) { check("AI protocol fixture: " + name, () => throw new InvalidOperationException(error.Message, error)); }
    }
    WorkspaceWindow Open()
    {
      var next = new WorkspaceWindow(model, () => { });
      next.Title = FixtureLabel;
      var marker = (Border)next.FindName("SampleMarker");
      marker.Visibility = Visibility.Visible; ((TextBlock)marker.Child).Text = FixtureLabel;
      next.Navigate("ai"); next.Show(); next.UpdateLayout(); return next;
    }
    try
    {
      model.SaveConnection("openai", server.Endpoint + "v1", "protocol-fixture", "");
      window = Open();
      await Verify("unsent draft survives navigation and close/reopen", async () => {
        var input = Input(window); input.Text = "Unsent fixture draft"; input.Select(4, 7);
        model.AddTask("Fixture background task");
        assert(ReferenceEquals(input, Input(window)) && input.SelectionStart == 4 && input.SelectionLength == 7, "Background update replaced the composer");
        window.Navigate("notes"); window.Navigate("ai"); window.UpdateLayout();
        assert(Input(window).Text == "Unsent fixture draft", "Navigation lost the draft");
        window.Close(); await Task.Delay(40); window = Open();
        assert(Input(window).Text == "Unsent fixture draft", "Close/reopen lost the draft");
      });

      server.Enqueue(new(["# Protocol fixture\n\n", "A streaming partial answer.", " More text."], HoldOpen: true));
      await Verify("native send submits and clears the draft", () => {
        window!.Navigate("ai"); window.UpdateLayout(); Input(window).Text = "Fixture streaming question";
        var send = Descendants(window).OfType<Button>().Single(value => AutomationProperties.GetName(value) == TextCatalog.T("aiSend"));
        send.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
        assert(model.IsGenerating && Input(window).Text.Length == 0 && model.AiDraft.Length == 0, "Send did not start or clear the submitted draft");
        return Task.CompletedTask;
      });
      await Verify("stream remains visible after generation window closes", async () => {
        await Until(() => model.CurrentChat?.Messages.LastOrDefault()?.Content.Contains("Protocol fixture") == true);
        assert(Input(window!).Text.Length == 0 && model.AiDraft.Length == 0, "Send did not clear the submitted draft");
        assert(model.IsGenerating && Text(window!).Contains("Protocol fixture"), "Stream is absent from the visible native page");
        var closed = Close(window!); window = null; await Task.Delay(40); window = Open();
        GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
        assert(!closed.IsAlive, "Generation retained a closed workbench's visual tree");
        assert(model.IsGenerating && !Input(window).IsEnabled && Text(window).Contains("Protocol fixture"), "Reopened window lost generation or live content");
        Capture(window, Path.Combine(output, "ai-fixture-generating-reopened.png"));
      });
      await Verify("stop retains partial text and permits retry", async () => {
        var stop = Descendants(window!).OfType<Button>().Single(value => AutomationProperties.GetName(value) == TextCatalog.T("aiStop"));
        stop.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent)); await Until(() => !model.IsGenerating);
        assert(!model.IsGenerating && model.CanRetryChat && model.CurrentChat!.Messages[^1].Status == "cancelled", "Stop did not finish as cancelled");
        assert(model.CurrentChat!.Messages[^1].Content.Contains("Protocol fixture"), "Stop discarded already received text");
      });

      server.Enqueue(new(["# Protocol fixture\n\n", "A **bold** reply with `inline code`.\n\n", "1. First item\n2. Second item\n\n", "```csharp\nConsole.WriteLine(\"fixture\");\n```"]));
      await Verify("retry streams into the same visible assistant turn", async () => {
        window!.UpdateLayout();
        var retry = Descendants(window!).OfType<Button>().Single(value => Equals(value.Content, TextCatalog.T("aiRetry")));
        retry.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
        await Until(() => model.IsGenerating && model.CurrentChat!.Messages[^1].Content.Contains("Protocol fixture"));
        window.UpdateLayout();
        assert(Text(window!).Contains("Protocol fixture"), "Retry tokens are hidden behind old Markdown");
        await Until(() => !model.IsGenerating);
        assert(model.CurrentChat!.Messages.Count == 2 && model.CurrentChat.Messages.Count(value => value.Role == "user") == 1, "Retry duplicated the user turn");
        assert(model.CurrentChat.Messages[^1].Content == MarkdownReply && model.CurrentChat.Messages[^1].Status == "complete", "Completed retry differs from transmitted content");
      });
      await Verify("completed Markdown exposes a native code copy button", async () => {
        await Task.Delay(50); window!.UpdateLayout();
        assert(Descendants(window).OfType<MarkdownBody>().Any(), "Completed reply is not native Markdown");
        var code = Descendants(window).OfType<TextBox>().Single(value => value.IsReadOnly && value.Text.Contains("Console.WriteLine"));
        var copy = Descendants(window).OfType<Button>().Single(value => Equals(value.Content, TextCatalog.T("codeCopy")));
        IDataObject? previous = Clipboard.GetDataObject();
        try { copy.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent)); assert(Clipboard.GetText().TrimEnd() == code.Text.TrimEnd(), "Code copy did not write the actual code"); }
        finally { if (previous is not null) Clipboard.SetDataObject(previous, true); else Clipboard.Clear(); }
        Capture(window, Path.Combine(output, "ai-fixture-markdown.png"));
      });

      server.Enqueue(new(["Incomplete fixture reply."], OmitDone: true));
      Task failing = model.SendChatAsync("Fixture failure question");
      await Verify("earlier completed Markdown remains visible during a later stream", () => {
        window!.UpdateLayout();
        assert(model.IsGenerating && Descendants(window!).OfType<MarkdownBody>().Any(), "Starting another reply downgraded earlier Markdown to raw text");
        return Task.CompletedTask;
      });
      await Verify("incomplete stream reports failure with retry", async () => {
        await failing.WaitAsync(TimeSpan.FromSeconds(5));
        window!.UpdateLayout();
        assert(model.CurrentChat!.Messages[^1].Status == "failed" && model.CanRetryChat, "Incomplete stream was reported as complete");
        assert(Descendants(window!).OfType<Button>().Any(value => Equals(value.Content, TextCatalog.T("aiRetry"))), "Failed response has no visible retry button");
      });
      server.Enqueue(new(["Recovered ", "fixture reply."]));
      await Verify("failed retry replaces stale Markdown and preserves history", async () => {
        window!.UpdateLayout();
        var retry = Descendants(window!).OfType<Button>().Single(value => Equals(value.Content, TextCatalog.T("aiRetry")));
        retry.RaiseEvent(new RoutedEventArgs(ButtonBase.ClickEvent));
        await Until(() => model.IsGenerating && model.CurrentChat!.Messages[^1].Content.Contains("Recovered"));
        window.UpdateLayout();
        assert(Text(window!).Contains("Recovered"), "Failed retry's first tokens are not rendered");
        await Until(() => !model.IsGenerating);
        assert(model.CurrentChat!.Messages.Count == 4 && model.CurrentChat.Messages.Count(value => value.Role == "user") == 2, "Failure recovery duplicated history");
      });

      model.SaveConnection("ollama", server.Endpoint, "protocol-fixture", "");
      server.Enqueue(new(["Ollama ", "JSONL fixture reply."]));
      await Verify("Ollama JSONL uses the same real native streaming page", async () => {
        await model.SendChatAsync("Fixture Ollama question").WaitAsync(TimeSpan.FromSeconds(5));
        window!.UpdateLayout();
        assert(model.CurrentChat!.Messages[^1].Content == "Ollama JSONL fixture reply." && model.CurrentChat.Messages[^1].Status == "complete", "JSONL stream was not decoded");
        File.WriteAllText(Path.Combine(output, "ai-fixture-ollama-visible.txt"), Text(window!));
        Capture(window, Path.Combine(output, "ai-fixture-ollama.png"));
        assert(Text(window!).Contains("JSONL fixture reply"), "Completed JSONL reply is absent from the visible window");
      });
      await Verify("finished history round trips in the isolated profile", () => {
        var restored = new Lingyu.Core.PreviewStore(profile).Load();
        assert(restored.Chats.Single().Messages.Count == 6 && restored.Chats.Single().Messages[^1].Status == "complete", "Finished history did not persist");
        assert(server.Requests.All(value => !value.Contains("Authorization:", StringComparison.OrdinalIgnoreCase)), "Fixture unexpectedly used credentials");
        return Task.CompletedTask;
      });
    }
    finally
    {
      model.StopChat(); window?.Close();
      File.WriteAllText(Path.Combine(output, "ai-protocol-fixture.json"), JsonSerializer.Serialize(new {
        label = FixtureLabel, realModelVerified = false, profile, requests = server.Requests.Count,
        requestPaths = server.Requests.Select(value => value.Split("\r\n", 2)[0]).ToArray(),
        messages = model.CurrentChat?.Messages, userDataAccessed = false
      }, new JsonSerializerOptions { WriteIndented = true }));
      TextCatalog.Current.Load(language);
    }
  }
  private static TextBox Input(DependencyObject window) => Descendants(window).OfType<TextBox>().Single(value => AutomationProperties.GetAutomationId(value) == "AiInput");
  private static WeakReference Close(Window window) { var reference = new WeakReference(window); window.Close(); return reference; }
  // Markdown 由 Run / Span 组成；Text 属性可为空，必须读取原生文本范围才能验证实际段落。
  private static string Text(DependencyObject window) => string.Join("\n", Descendants(window).OfType<TextBlock>().Select(value => new TextRange(value.ContentStart, value.ContentEnd).Text));
  private static IEnumerable<DependencyObject> Descendants(DependencyObject parent)
  {
    for (int index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
    {
      var child = VisualTreeHelper.GetChild(parent, index); yield return child;
      foreach (var descendant in Descendants(child)) yield return descendant;
    }
  }
  private static async Task Until(Func<bool> condition)
  {
    using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
    while (!condition()) await Task.Delay(20, timeout.Token);
  }
  private static void Capture(Window window, string path)
  {
    window.UpdateLayout();
    var image = new RenderTargetBitmap((int)Math.Ceiling(window.ActualWidth), (int)Math.Ceiling(window.ActualHeight), 96, 96, PixelFormats.Pbgra32);
    image.Render(window); var png = new PngBitmapEncoder(); png.Frames.Add(BitmapFrame.Create(image));
    using var file = File.Create(path); png.Save(file);
  }
  private sealed record Response(string[] Tokens, bool HoldOpen = false, bool OmitDone = false);
  private sealed class ProtocolFixture : IDisposable
  {
    private readonly TcpListener listener = new(IPAddress.Loopback, 0);
    private readonly CancellationTokenSource stop = new();
    private readonly ConcurrentQueue<Response> responses = new();
    public ConcurrentQueue<string> Requests { get; } = new();
    public string Endpoint => $"http://127.0.0.1:{((IPEndPoint)listener.LocalEndpoint).Port}/";
    public ProtocolFixture() { listener.Start(); _ = Task.Run(ListenAsync); }
    public void Enqueue(Response response) => responses.Enqueue(response);
    private async Task ListenAsync()
    {
      try { while (!stop.IsCancellationRequested) { var client = await listener.AcceptTcpClientAsync(stop.Token); _ = ServeAsync(client); } }
      catch (Exception error) when (error is OperationCanceledException or SocketException or ObjectDisposedException) { }
    }
    private async Task ServeAsync(TcpClient client)
    {
      using (client)
      try
      {
        var stream = client.GetStream(); var header = new List<byte>(); var single = new byte[1];
        while (header.Count < 65536)
        {
          await stream.ReadExactlyAsync(single, stop.Token); header.Add(single[0]);
          if (header.Count > 3 && header[^4] == 13 && header[^3] == 10 && header[^2] == 13 && header[^1] == 10) break;
        }
        string headers = Encoding.ASCII.GetString(header.ToArray());
        byte[] body;
        string? lengthHeader = headers.Split("\r\n").FirstOrDefault(value => value.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase));
        if (lengthHeader is not null)
        {
          int length = int.Parse(lengthHeader.Split(':', 2)[1].Trim(), System.Globalization.CultureInfo.InvariantCulture);
          if (length > 65536) throw new InvalidDataException("Fixture request exceeds expected size");
          body = new byte[length]; await stream.ReadExactlyAsync(body, stop.Token);
        }
        else
        {
          using var combined = new MemoryStream();
          while (true)
          {
            var line = new List<byte>();
            do { await stream.ReadExactlyAsync(single, stop.Token); line.Add(single[0]); } while (line.Count < 2 || line[^2] != 13 || line[^1] != 10);
            int length = int.Parse(Encoding.ASCII.GetString(line.ToArray()).Trim().Split(';')[0], System.Globalization.NumberStyles.HexNumber, System.Globalization.CultureInfo.InvariantCulture);
            if (length == 0) { await stream.ReadExactlyAsync(new byte[2], stop.Token); break; }
            if (combined.Length + length > 65536) throw new InvalidDataException("Fixture request exceeds expected size");
            var chunk = new byte[length]; await stream.ReadExactlyAsync(chunk, stop.Token); combined.Write(chunk);
            await stream.ReadExactlyAsync(new byte[2], stop.Token);
          }
          body = combined.ToArray();
        }
        Requests.Enqueue(headers + Encoding.UTF8.GetString(body));
        if (!responses.TryDequeue(out var response)) throw new InvalidDataException("Fixture response was not queued");
        bool ollama = headers.StartsWith("POST /api/chat", StringComparison.Ordinal);
        await stream.WriteAsync(Encoding.ASCII.GetBytes("HTTP/1.1 200 OK\r\nContent-Type: " + (ollama ? "application/x-ndjson" : "text/event-stream") + "\r\nConnection: close\r\n\r\n"), stop.Token);
        foreach (string token in response.Tokens)
        {
          await Task.Delay(150, stop.Token);
          string json = ollama ? JsonSerializer.Serialize(new { message = new { content = token }, done = false }) : JsonSerializer.Serialize(new { choices = new[] { new { delta = new { content = token }, finish_reason = (string?)null } } });
          await stream.WriteAsync(Encoding.UTF8.GetBytes(ollama ? json + "\n" : "data: " + json + "\n\n"), stop.Token);
        }
        if (response.HoldOpen) { await Task.Delay(Timeout.InfiniteTimeSpan, stop.Token); return; }
        if (!response.OmitDone) await stream.WriteAsync(Encoding.UTF8.GetBytes(ollama ? "{\"done\":true}\n" : "data: [DONE]\n\n"), stop.Token);
      }
      catch (Exception error) when (error is IOException or SocketException or OperationCanceledException or ObjectDisposedException) { }
    }
    public void Dispose() { stop.Cancel(); listener.Stop(); stop.Dispose(); }
  }
}
