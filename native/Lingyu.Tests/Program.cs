/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file Program.cs @description 原生业务回归测试，无桌面或网络依赖。 @author 灵屿
 */
using Lingyu.Core;

int failed = 0;
void Check(string name, Action run)
{
  try { run(); Console.WriteLine($"PASS {name}"); }
  catch (Exception error) { failed++; Console.WriteLine($"FAIL {name}: {error.Message}"); }
}
void Assert(bool condition, string message)
{
  if (!condition) throw new InvalidOperationException(message);
}

Check("deadline survives delayed callbacks", () => {
  var time = new ManualTime();
  var clock = new FocusClock(time);
  clock.Start(1500);
  time.Advance(137);
  Assert(clock.RemainingSeconds == 1363, "delayed callbacks lost elapsed time");
});
Check("pause retains elapsed time", () => {
  var time = new ManualTime();
  var clock = new FocusClock(time);
  clock.Start(60); time.Advance(17); clock.Pause(); time.Advance(300);
  Assert(!clock.IsRunning && clock.RemainingSeconds == 43, "paused duration changed");
  clock.Resume(); time.Advance(9);
  Assert(clock.IsRunning && clock.RemainingSeconds == 34, "resume lost paused duration");
});
Check("completion happens once", () => {
  var time = new ManualTime();
  var clock = new FocusClock(time); clock.Start(10); time.Advance(80);
  Assert(clock.Tick(), "completion did not fire");
  Assert(!clock.Tick() && !clock.IsRunning && clock.RemainingSeconds == 0, "completion fired twice");
});
Check("reset removes deadline", () => {
  var clock = new FocusClock(); clock.Start(90); clock.Reset();
  Assert(!clock.IsRunning && clock.RemainingSeconds == 1500, "reset retained previous session");
});
Check("invalid duration is rejected", () => {
  try { new FocusClock().Start(0); throw new InvalidOperationException("invalid duration accepted"); }
  catch (ArgumentOutOfRangeException) { }
});
Check("hover can leave", () => {
  var island = new IslandState(); island.Enter();
  Assert(island.Shape == IslandShape.Hover, "hover not shown");
  island.Leave(); Assert(island.Shape == IslandShape.Docked, "hover stuck open");
});
Check("expanded persists across pointer leave", () => {
  var island = new IslandState(); island.Toggle(); island.Leave();
  Assert(island.Shape == IslandShape.Expanded, "pointer closed user-opened panel");
  island.Collapse(); Assert(island.Shape == IslandShape.Docked, "escape did not collapse");
});
Check("click expands from hover", () => {
  var island = new IslandState(); island.Enter(); island.Toggle();
  Assert(island.Shape == IslandShape.Expanded, "click did not expand");
  island.Toggle(); Assert(island.Shape == IslandShape.Docked, "second click did not collapse");
});
Check("media progress stops at duration and pause", () => {
  var now = DateTimeOffset.UtcNow;
  var media = new MediaSnapshot("", "", "", true, true, false, false, false,
    TimeSpan.FromSeconds(9), TimeSpan.FromSeconds(10), now, null);
  Assert(media.PositionAt(now.AddSeconds(30)).TotalSeconds == 10, "progress overflow");
  Assert((media with { Playing = false }).PositionAt(now.AddSeconds(30)).TotalSeconds == 9, "paused progress moves");
});
Check("isolated state survives atomic save", () => {
  string directory = Path.Combine(Path.GetTempPath(), "lingyu-native-test-" + Guid.NewGuid().ToString("N"));
  try {
    var store = new PreviewStore(directory);
    Assert(store.Load().Tasks.Count == 0, "fresh profile has fake tasks");
    var state = new PreviewState { Language = "en-US", Tasks = [new TaskEntry(Guid.NewGuid(), "工作与思考", false)],
      Notes = [new NoteEntry(Guid.NewGuid(), "A thought", "Line one\n第二行", DateTimeOffset.UtcNow)] };
    store.Save(state); var saved = store.Load();
    Assert(saved.Language == "en-US" && saved.Tasks[0].Text == "工作与思考" && saved.Notes[0].Body.Contains("第二行"), "saved data changed");
    store.Save(saved with { Tasks = [] });
    Assert(store.Load().Tasks.Count == 0, "atomic replacement failed");
  } finally {
    string resolved = Path.GetFullPath(directory);
    string temporaryRoot = Path.GetFullPath(Path.GetTempPath());
    if (!resolved.StartsWith(temporaryRoot, StringComparison.OrdinalIgnoreCase) ||
      !Path.GetFileName(resolved).StartsWith("lingyu-native-test-", StringComparison.Ordinal))
      throw new InvalidOperationException("Unexpected test directory");
    if (Directory.Exists(resolved)) Directory.Delete(resolved, true);
  }
});
Check("provider URLs preserve custom paths", () => {
  Assert(AiClient.Endpoint(new("openai", "https://example.test/service/v1/", "test"), "chat").AbsolutePath == "/service/v1/chat/completions", "OpenAI endpoint changed");
  Assert(AiClient.Endpoint(new("ollama", "http://localhost:11434", "test"), "chat").AbsolutePath == "/api/chat", "Ollama endpoint changed");
  try { AiClient.Endpoint(new("openai", "https://secret@example.test", "test"), "chat"); throw new InvalidOperationException("credentials allowed in URL"); }
  catch (ArgumentException) { }
});
Check("stream decoding supports both providers", () => {
  foreach (string provider in new[] { "openai", "ollama" }) {
    string data = provider == "openai" ? "data: {\"choices\":[{\"delta\":{\"content\":\"你好\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"，世界\"}}]}\n\ndata: [DONE]\n\n" : "{\"message\":{\"content\":\"你好\"},\"done\":false}\n{\"message\":{\"content\":\"，世界\"},\"done\":true}\n";
    using var http = new HttpClient(new FixtureHandler(data)); var answer = new System.Text.StringBuilder();
    new AiClient(http).StreamAsync(new(provider, "http://localhost:11434", "test"), "", [new("user", "Hi")], "test", token => answer.Append(token), CancellationToken.None).GetAwaiter().GetResult();
    Assert(answer.ToString() == "你好，世界", provider + " stream corrupted");
  }
});
Check("cancelled model request does not generate text", () => {
  using var cancellation = new CancellationTokenSource(); cancellation.Cancel();
  using var http = new HttpClient(new FixtureHandler("")); bool received = false;
  try { new AiClient(http).StreamAsync(new("ollama", "http://localhost:11434", "test"), "", [], "test", _ => received = true, cancellation.Token).GetAwaiter().GetResult(); throw new InvalidOperationException("cancel ignored"); }
  catch (OperationCanceledException) { Assert(!received, "text after cancel"); }
});
Console.WriteLine($"RESULT failed={failed}");
return failed == 0 ? 0 : 1;

/// <summary>测试时钟只模拟经过的时间，不依赖真实等待。</summary>
sealed class ManualTime : TimeProvider
{
  private DateTimeOffset now = new(2026, 10, 1, 0, 0, 0, TimeSpan.Zero);
  /// <summary>返回固定的测试时间。</summary>
  public override DateTimeOffset GetUtcNow() => now;
  /// <summary>推进测试时间。</summary>
  public void Advance(int seconds) => now = now.AddSeconds(seconds);
}

/// <summary>协议样本不会访问网络或产生云端费用。</summary>
sealed class FixtureHandler(string body) : HttpMessageHandler
{
  /// <summary>提供 UTF-8 分块样本。</summary>
  protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
  { cancellationToken.ThrowIfCancellationRequested(); return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") }); }
}
