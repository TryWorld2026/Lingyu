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
Check("running snapshot keeps identity and absolute deadline", () => {
  var time = new ManualTime(); var original = new FocusClock(time); original.Start(900); time.Advance(70);
  var saved = System.Text.Json.JsonSerializer.Deserialize<FocusSession>(System.Text.Json.JsonSerializer.Serialize(original.Snapshot))!;
  time.Advance(50); var restored = new FocusClock(time); restored.Restore(saved);
  Assert(restored.IsRunning && restored.RemainingSeconds == 780 && restored.DurationSeconds == 900 && restored.Snapshot!.Id == saved.Id && restored.Snapshot.Deadline == saved.Deadline, "restart altered session or deadline");
});
Check("paused snapshot survives a long offline interval", () => {
  var time = new ManualTime(); var original = new FocusClock(time); original.Start(3000); time.Advance(65); original.Pause();
  var saved = original.Snapshot; time.Advance(86400); var restored = new FocusClock(time); restored.Restore(saved);
  Assert(restored.IsActive && !restored.IsRunning && restored.RemainingSeconds == 2935 && !restored.Tick(), "paused session elapsed offline");
  restored.Resume(); time.Advance(5); Assert(restored.RemainingSeconds == 2930 && restored.Snapshot!.Id == saved!.Id, "resume changed the saved remainder or identity");
});
Check("offline completion retains deadline and survives dismissal", () => {
  var time = new ManualTime(); var original = new FocusClock(time); original.Start(60); var saved = original.Snapshot!;
  time.Advance(3600); var restored = new FocusClock(time); restored.Restore(saved);
  Assert(restored.Tick() && restored.HasCompletionNotice && restored.Snapshot!.CompletedAt == saved.Deadline, "offline completion was lost or assigned the restart time");
  var completed = restored.Snapshot; restored.Restore(completed);
  Assert(!restored.Tick() && restored.HasCompletionNotice && restored.Snapshot!.Id == saved.Id, "completed session emitted a new event after restore");
  restored.DismissCompletion(); restored.Restore(restored.Snapshot);
  Assert(!restored.Tick() && !restored.HasCompletionNotice && restored.IsCompleted, "dismissed completion reappeared");
  restored.Start(60); Assert(restored.IsActive && restored.Snapshot!.Id != saved.Id, "new round retained completed identity");
  restored.Reset(); Assert(restored.Snapshot is null && !restored.IsActive, "ended round could be restored");
});
Check("pause exactly at deadline completes instead of storing zero paused time", () => {
  var time = new ManualTime(); var clock = new FocusClock(time); clock.Start(10); time.Advance(10); clock.Pause();
  Assert(clock.IsCompleted && clock.HasCompletionNotice && !clock.IsActive && !clock.Tick(), "deadline pause created an invalid or repeatable completion");
});
Check("invalid focus snapshots cannot become active sessions", () => {
  var time = new ManualTime(); var valid = new FocusSession(Guid.NewGuid(), 60, 50, time.GetUtcNow().AddSeconds(50));
  foreach (var invalid in new[] { valid with { Id = Guid.Empty }, valid with { DurationSeconds = 0 }, valid with { RemainingSeconds = -1 }, valid with { RemainingSeconds = 61 }, valid with { CompletedAt = time.GetUtcNow() }, valid with { CompletionDismissed = true }, valid with { Deadline = null, RemainingSeconds = 0 } }) {
    var clock = new FocusClock(time); clock.Restore(invalid); Assert(!clock.IsActive && clock.Snapshot is null && clock.RemainingSeconds == 1500, "invalid focus state was accepted");
  }
  var legacy = System.Text.Json.JsonSerializer.Deserialize<PreviewState>("{\"Language\":\"en-US\"}")!;
  Assert(legacy.Focus is null && legacy.Language == "en-US", "legacy preview profile is incompatible");
});
Check("backwards wall clock never overflows the configured focus duration", () => {
  var time = new ManualTime(); var clock = new FocusClock(time); clock.Start(60); time.Advance(-3600);
  Assert(clock.RemainingSeconds == 60 && !clock.Tick(), "clock change overflowed progress or completed early");
});
Check("music pause expires without repeated snapshots extending it", () => {
  var presence = new MusicPresence();
  presence.Update("player|track-a", true, 0); presence.Update("player|track-a", false, 10);
  presence.Update("player|track-a", false, 50);
  Assert(presence.IsVisible(69.9), "paused song disappeared too early");
  Assert(!presence.IsVisible(70), "duplicate snapshot extended pause");
});
Check("music resume and session removal replace the pending deadline", () => {
  var presence = new MusicPresence();
  presence.Update("player|track-a", false, 0); presence.Update("player|track-a", true, 59);
  Assert(presence.IsVisible(120) && presence.Deadline is null, "resumed song expired");
  presence.Update("", false, 121);
  Assert(!presence.IsVisible(121) && presence.Deadline is null, "removed session retained artwork state");
});
Check("a different paused song receives its own grace period", () => {
  var presence = new MusicPresence();
  presence.Update("player|track-a", false, 0); presence.Update("player|track-b", false, 50);
  Assert(presence.IsVisible(109.9) && !presence.IsVisible(110), "new song inherited old deadline");
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
Check("missing player timestamp does not jump to song end", () => {
  var media = new MediaSnapshot("", "", "", true, true, false, false, true,
    TimeSpan.FromSeconds(40), TimeSpan.FromSeconds(180), DateTimeOffset.FromFileTime(0), null);
  Assert(media.PositionAt(DateTimeOffset.UtcNow).TotalSeconds == 40, "Unknown timestamp fabricated a completed song");
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
Check("morph reverses without jumping or discarding velocity", () => {
  var start = new IslandGeometry(280, 44, 22, 26, 18, 9, 1, 0, 0, 0, 0, 1);
  var end = start with { Width = 1000, Height = 280, Music = 1, Docked = 0 };
  var motion = new IslandMotion(start); motion.SetTarget(end); motion.Step(.04);
  Assert(motion.Current.Width > 280 && motion.Current.Width < 1000, "no intermediate width");
  var before = motion.Current; motion.SetTarget(start);
  Assert(motion.Current == before, "retarget jumped");
  motion.Step(.00001); Assert(motion.Current.Width > before.Width, "retarget discarded forward velocity");
  for (int i = 0; i < 60; i++) motion.Step(1d / 60);
  Assert(!motion.IsMoving && motion.Current == start, "reverse did not settle");
});
Check("motion stops and survives reduced motion and sleep", () => {
  var start = new IslandGeometry(280, 44, 22, 26, 18, 9, 1, 0, 0, 0, 0, 1);
  var motion = new IslandMotion(start); var end = start with { Width = 1000 };
  motion.SetTarget(end, true); Assert(!motion.IsMoving && motion.Current == end, "reduced motion animates");
  motion.SetTarget(start); motion.Step(2); Assert(!motion.IsMoving && motion.Current == start, "sleep replayed stale frames");
});
Check("hover intent cancels and protects active controls", () => {
  var island = new IslandState(); island.PointerEnter(0); island.PollIntent(.1);
  Assert(island.Shape == IslandShape.Docked, "opened before intent delay");
  island.PointerLeave(.1); island.PollIntent(.3); Assert(island.Shape == IslandShape.Docked, "cancelled hover opened");
  island.PointerEnter(1); island.PollIntent(1.15); Assert(island.Shape == IslandShape.Hover, "hover did not open");
  island.PointerLeave(2); island.PollIntent(2.2, true); Assert(island.Shape == IslandShape.Hover, "active control collapsed");
  island.PointerEnter(2.2); island.PollIntent(3); Assert(island.Shape == IslandShape.Hover, "stale leave closed hover");
});
Check("LRC supports repeated timestamps and global offset", () => {
  var lyrics = LrcDocument.Parse("[offset:500]\n[00:01.00][00:03.500]Repeated\n[00:02.10]Second\n[ar:Artist]\ninvalid");
  Assert(lyrics.Lines.Count == 3 && lyrics.Lines[1].Text == "Second", "timestamps not sorted");
  Assert(lyrics.At(TimeSpan.FromSeconds(1.49), 0) is null, "offset ignored");
  Assert(lyrics.At(TimeSpan.FromSeconds(1.5), 0)?.Text == "Repeated", "synchronized line missing");
  Assert(lyrics.At(TimeSpan.FromSeconds(3.8), .2)?.Text == "Second", "user delay ignored");
});
Check("LRC ignores non-ASCII numeric metadata without crashing", () => {
  Assert(LrcDocument.Parse("[١:00]Not a supported timestamp\n[00:02]Valid").Lines.Count == 1, "Unsupported timestamp did not get ignored");
});
Check("rapid pointer return keeps its pending deadline", () => {
  var island = new IslandState(); island.PointerEnter(0); island.PointerLeave(.04); island.PointerEnter(.08);
  Assert(!island.PollIntent(.15) && island.HasPendingIntent && island.Shape == IslandShape.Docked, "early timer lost renewed intent");
  Assert(island.PollIntent(.23) && !island.HasPendingIntent && island.Shape == IslandShape.Hover, "renewed hover never opened");
});
Check("native prompt accurately names preview interaction capabilities", () => {
  Assert(NativePrompt.Build("zh-CN").Contains("本地 LRC") && NativePrompt.Build("zh-CN").Contains("重试"), "native Chinese prompt omits new music or AI capability");
  Assert(NativePrompt.Build("en-US").Contains("local LRC") && NativePrompt.Build("en-US").Contains("retry"), "native English prompt omits new music or AI capability");
});
Check("native prompt explains responsive layout and pinned task scope", () => {
  Assert(NativePrompt.Build("zh-CN").Contains("窄窗口") && NativePrompt.Build("zh-CN").Contains("固定待办") && NativePrompt.Build("zh-CN").Contains("悬停"), "native Chinese prompt omits responsive layout or activity separation");
  Assert(NativePrompt.Build("en-US").Contains("narrow windows") && NativePrompt.Build("en-US").Contains("pinned tasks") && NativePrompt.Build("en-US").Contains("hover"), "native English prompt omits responsive layout or activity separation");
});
Check("native prompt explains weather refresh and stale data", () => {
  Assert(NativePrompt.Build("zh-CN").Contains("天气界面可见") && NativePrompt.Build("zh-CN").Contains("更新时间") && NativePrompt.Build("zh-CN").Contains("旧城市"), "native Chinese prompt omits weather reliability behavior");
  Assert(NativePrompt.Build("en-US").Contains("weather is visible") && NativePrompt.Build("en-US").Contains("update time") && NativePrompt.Build("en-US").Contains("previous city"), "native English prompt omits weather reliability behavior");
});
Check("native prompt explains default output and unavailable player behavior", () => {
  Assert(NativePrompt.Build("zh-CN").Contains("默认输出设备") && NativePrompt.Build("zh-CN").Contains("未运行"), "native Chinese prompt omits audio recovery or missing player state");
  Assert(NativePrompt.Build("en-US").Contains("default output device") && NativePrompt.Build("en-US").Contains("not running"), "native English prompt omits audio recovery or missing player state");
});
Check("native prompt scopes persisted focus reminders in both languages", () => {
  string zh = NativePrompt.Build("zh-CN"), en = NativePrompt.Build("en-US");
  Assert(zh.Contains("暂停状态") && zh.Contains("退出期间到期") && zh.Contains("关闭提醒") && zh.Contains("通用定时提醒"), "Chinese prompt omits focus recovery or reminder boundary");
  Assert(en.Contains("paused state") && en.Contains("expires while closed") && en.Contains("dismiss") && en.Contains("General scheduled reminders"), "English prompt omits focus recovery or reminder boundary");
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
