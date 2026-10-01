/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file SessionModel.cs @description 原生界面共享的轻量会话状态。 @author 灵屿
 */
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Lingyu.App.Localization;
using Lingyu.Core;
using Lingyu.Platform.Windows;

namespace Lingyu.App.Models;

/// <summary>窗口被释放后，业务状态仍由应用会话保留。</summary>
public sealed partial class SessionModel : INotifyPropertyChanged, IDisposable
{
  private readonly PreviewStore store;
  private readonly MediaService media = new();
  private readonly VolumeService volume = new();
  private readonly System.Windows.Threading.Dispatcher dispatcher;
  private MediaSnapshot snapshot = MediaSnapshot.Empty;
  private PreviewState state;
  private DateTimeOffset now = DateTimeOffset.Now;
  private double volumeValue;
  private bool muted;
  private bool disposed;
  private int focusLength = 1500;
  /// <summary>展示样例与真实数据不能混用。</summary>
  public bool Showcase { get; }
  /// <summary>窗口可绑定轻量属性。</summary>
  public event PropertyChangedEventHandler? PropertyChanged;
  /// <summary>列表或语言变更时重建当前页面，避免常驻加载所有页面。</summary>
  public event Action? StructureChanged;
  /// <summary>明确的操作反馈。</summary>
  public event Action<string>? Notice;
  /// <summary>跨窗口共享的计时。</summary>
  public FocusClock Clock { get; } = new();
  /// <summary>最新任务。</summary>
  public IReadOnlyList<TaskEntry> Tasks => state.Tasks;
  /// <summary>最新笔记。</summary>
  public IReadOnlyList<NoteEntry> Notes => state.Notes;
  /// <summary>文件引用。</summary>
  public IReadOnlyList<string> Files => state.Files;
  /// <summary>关闭装饰动效。</summary>
  public bool ReduceMotion => state.ReduceMotion;
  /// <summary>免打扰只控制本应用提示声。</summary>
  public bool Quiet { get; set; }
  /// <summary>天气城市。</summary>
  public WeatherCity? City => state.City;
  /// <summary>模型连接配置。</summary>
  public AiConnection? Connection => state.Ai;
  /// <summary>真实播放器封面。</summary>
  public ImageSource? Artwork { get; private set; }
  /// <summary>歌曲标题或明确空状态。</summary>
  public string TrackTitle => Showcase ? TextCatalog.T("demoTrack") : string.IsNullOrWhiteSpace(snapshot.Title) ? TextCatalog.T("musicEmpty") : snapshot.Title;
  /// <summary>歌手或连接说明。</summary>
  public string TrackArtist => Showcase ? TextCatalog.T("demoArtist") : string.IsNullOrWhiteSpace(snapshot.Artist) ? TextCatalog.T("musicSource") : snapshot.Artist;
  /// <summary>是否存在真实歌曲。</summary>
  public bool HasMedia => Showcase || !string.IsNullOrWhiteSpace(snapshot.Title);
  /// <summary>播放图标。</summary>
  public string PlayGlyph => !Showcase && snapshot.Playing ? "pause" : "play";
  /// <summary>可用系统控制。</summary>
  public bool CanPlay => !Showcase && snapshot.CanPlay;
  /// <summary>上一首能力。</summary>
  public bool CanPrevious => !Showcase && snapshot.CanPrevious;
  /// <summary>下一首能力。</summary>
  public bool CanNext => !Showcase && snapshot.CanNext;
  /// <summary>拖动进度能力。</summary>
  public bool CanSeek => !Showcase && snapshot.CanSeek;
  /// <summary>歌曲的实际进度比例。</summary>
  public double MediaProgress => Showcase ? 34 : snapshot.Duration.TotalSeconds > 0 ? snapshot.PositionAt(now).TotalSeconds / snapshot.Duration.TotalSeconds * 100 : 0;
  /// <summary>当前播放时间。</summary>
  public string MediaTime => Showcase ? "01:43" : snapshot.PositionAt(now).ToString(@"mm\:ss");
  /// <summary>歌曲长度。</summary>
  public string MediaDuration => Showcase ? "04:26" : snapshot.Duration.ToString(@"mm\:ss");
  /// <summary>系统音量。</summary>
  public double Volume => volumeValue;
  /// <summary>显示系统音量。</summary>
  public string VolumeText => Math.Round(volumeValue).ToString(CultureInfo.InvariantCulture);
  /// <summary>有可控制的真实音频设备。</summary>
  public bool VolumeAvailable => volume.Available;
  /// <summary>时钟。</summary>
  public string Time => now.ToString("HH:mm", CultureInfo.InvariantCulture);
  /// <summary>短日期。</summary>
  public string Date => now.ToString(TextCatalog.T("dateFormat"), CultureInfo.GetCultureInfo(TextCatalog.Current.Language));
  /// <summary>问候语。</summary>
  public string Greeting => TextCatalog.T(now.Hour < 12 ? "morning" : now.Hour < 18 ? "afternoon" : "evening");
  /// <summary>剩余专注时间。</summary>
  public string FocusTime => $"{Clock.RemainingSeconds / 60:00}:{Clock.RemainingSeconds % 60:00}";
  /// <summary>专注进度。</summary>
  public double FocusProgress => Clock.RemainingSeconds / (double)focusLength;
  /// <summary>专注状态文字。</summary>
  public string FocusLabel => TextCatalog.T(Clock.IsRunning ? "focusRunning" : Clock.RemainingSeconds < focusLength ? "focusPaused" : "focusIdle");
  /// <summary>专注按钮文字。</summary>
  public string FocusAction => TextCatalog.T(Clock.IsRunning ? "focusPause" : Clock.RemainingSeconds is > 0 && Clock.RemainingSeconds < focusLength ? "focusResume" : "focusStart");
  /// <summary>岛上展示正在关注的任务。</summary>
  public string IslandLabel => Clock.IsRunning ? FocusTime : IsGenerating ? TextCatalog.T("aiThinking") : state.Tasks.FirstOrDefault(task => task.Pinned && !task.Done)?.Text ?? (HasMedia ? TrackTitle : Time);
  /// <summary>岛上的状态图标。</summary>
  public string IslandGlyph => Clock.IsRunning ? "focus" : IsGenerating ? "ai" : HasMedia ? "music" : "logo";
  /// <summary>构造独立预览会话。</summary>
  public SessionModel(string dataDirectory, bool showcase, string? language)
  {
    dispatcher = System.Windows.Threading.Dispatcher.CurrentDispatcher;
    Showcase = showcase;
    store = new PreviewStore(dataDirectory); state = store.Load();
    TextCatalog.Current.Load(language ?? (string.IsNullOrEmpty(state.Language) ? null : state.Language));
    if (showcase)
      state = new PreviewState { Tasks = [new(Guid.NewGuid(), TextCatalog.T("demoTask1"), false, true), new(Guid.NewGuid(), TextCatalog.T("demoTask2"), false), new(Guid.NewGuid(), TextCatalog.T("demoTask3"), true)],
        Notes = [new(Guid.NewGuid(), TextCatalog.T("demoNoteTitle"), TextCatalog.T("demoNoteBody"), now)] };
    media.Changed += OnMedia;
    volume.Changed += OnVolume;
    if (volume.Read() is { } current) { volumeValue = current.Value; muted = current.Muted; }
  }

  /// <summary>异步连接系统与选择过的天气服务。</summary>
  public async Task StartAsync()
  {
    if (!Showcase) { await media.StartAsync(); await RefreshWeatherAsync(); }
  }
  private void OnMedia(MediaSnapshot value) => Dispatch(() => {
    snapshot = value; Artwork = null;
    if (value.Artwork is { Length: > 0 } bytes)
    {
      try {
        using var stream = new MemoryStream(bytes);
        var image = new BitmapImage(); image.BeginInit(); image.CacheOption = BitmapCacheOption.OnLoad;
        image.DecodePixelWidth = 180; image.StreamSource = stream; image.EndInit(); image.Freeze(); Artwork = image;
      } catch (Exception error) when (error is NotSupportedException or IOException or ArgumentException) { }
    }
    Notify(nameof(TrackTitle), nameof(TrackArtist), nameof(HasMedia), nameof(Artwork), nameof(PlayGlyph), nameof(CanPlay), nameof(CanPrevious), nameof(CanNext), nameof(CanSeek), nameof(MediaDuration), nameof(IslandLabel), nameof(IslandGlyph));
  });
  private void OnVolume(double value, bool isMuted) => Dispatch(() => { volumeValue = value; muted = isMuted; Notify(nameof(Volume), nameof(VolumeText)); });
  private void Dispatch(Action action)
  {
    if (disposed || dispatcher.HasShutdownStarted) return;
    _ = dispatcher.BeginInvoke(() => { if (!disposed) action(); });
  }

  /// <summary>显示变化时只通知必要属性。</summary>
  public void Tick()
  {
    now = DateTimeOffset.Now;
    if (Clock.Tick()) { Emit("focusDone"); if (!Quiet) System.Media.SystemSounds.Asterisk.Play(); }
    Notify(nameof(Time), nameof(Date), nameof(Greeting), nameof(IslandLabel));
    if (snapshot.Playing) Notify(nameof(MediaProgress), nameof(MediaTime));
    if (Clock.IsRunning || Clock.RemainingSeconds == 0) Notify(nameof(FocusTime), nameof(FocusProgress), nameof(FocusAction), nameof(FocusLabel));
  }
  /// <summary>控制真实系统音量。</summary>
  public void SetVolume(double value) { if (!volume.Set(value)) Emit("operationFailed"); }
  /// <summary>切换真实静音。</summary>
  public void ToggleMute() { if (!volume.Mute(!muted)) Emit("operationFailed"); }
  /// <summary>请求实际播放器控制。</summary>
  public async Task MediaActionAsync(string action, double fraction = 0)
  { if (!await media.ControlAsync(action, fraction)) Emit("mediaFailed"); }
  /// <summary>开始、暂停或继续专注。</summary>
  public void ToggleFocus()
  {
    if (Clock.IsRunning) Clock.Pause(); else if (Clock.RemainingSeconds == 0) Clock.Start(focusLength); else Clock.Resume();
    Notify(nameof(FocusTime), nameof(FocusProgress), nameof(FocusLabel), nameof(FocusAction), nameof(IslandLabel), nameof(IslandGlyph));
  }
  /// <summary>选择本轮专注时长。</summary>
  public void StartFocus(int minutes = 25)
  {
    focusLength = Math.Clamp(minutes, 1, 180) * 60; Clock.Start(focusLength);
    Notify(nameof(FocusTime), nameof(FocusProgress), nameof(FocusLabel), nameof(FocusAction), nameof(IslandLabel), nameof(IslandGlyph));
  }
  /// <summary>结束本轮。</summary>
  public void ResetFocus() { focusLength = 1500; Clock.Reset(); Notify(nameof(FocusTime), nameof(FocusProgress), nameof(FocusLabel), nameof(FocusAction), nameof(IslandLabel), nameof(IslandGlyph)); }
  /// <summary>添加真实用户任务。</summary>
  public void AddTask(string text)
  { if (string.IsNullOrWhiteSpace(text)) return; state.Tasks.Add(new(Guid.NewGuid(), text.Trim(), false)); Changed(); Notify(nameof(IslandLabel)); }
  /// <summary>修改任务状态。</summary>
  public void ToggleTask(Guid id)
  { int index = state.Tasks.FindIndex(task => task.Id == id); if (index < 0) return; var task = state.Tasks[index]; state.Tasks[index] = task with { Done = !task.Done }; Changed(); Notify(nameof(IslandLabel)); }
  /// <summary>任务固定到岛上。</summary>
  public void PinTask(Guid id)
  {
    state = state with { Tasks = state.Tasks.Select(task => task with { Pinned = task.Id == id && !task.Pinned }).ToList() };
    Changed(); Notify(nameof(IslandLabel));
  }
  /// <summary>删除指定任务。</summary>
  public void DeleteTask(Guid id) { state.Tasks.RemoveAll(task => task.Id == id); Changed(); Notify(nameof(IslandLabel)); }
  /// <summary>保存用户笔记。</summary>
  public Guid SaveNote(Guid? id, string title, string body)
  {
    var note = new NoteEntry(id ?? Guid.NewGuid(), title.Trim(), body, DateTimeOffset.Now);
    int index = state.Notes.FindIndex(value => value.Id == note.Id);
    if (index < 0) state.Notes.Insert(0, note); else state.Notes[index] = note;
    Persist(); return note.Id;
  }
  /// <summary>删除笔记。</summary>
  public void DeleteNote(Guid id) { state.Notes.RemoveAll(note => note.Id == id); Changed(); }
  /// <summary>保存实际文件引用。</summary>
  public void AddFiles(IEnumerable<string> paths)
  { foreach (string path in paths) if (File.Exists(path) && !state.Files.Contains(path, StringComparer.OrdinalIgnoreCase)) state.Files.Add(path); Changed(); }
  /// <summary>移除引用，不删除文件。</summary>
  public void RemoveFile(string path) { state.Files.Remove(path); Changed(); }
  /// <summary>保存用户语言。</summary>
  public void SetLanguage(string language)
  {
    var previous = Showcase ? new[] { "demoTask1", "demoTask2", "demoTask3", "demoNoteTitle", "demoNoteBody" }.ToDictionary(key => key, TextCatalog.T) : null;
    TextCatalog.Current.SetLanguage(language); state = state with { Language = language };
    if (previous is not null)
    {
      state = state with { Tasks = state.Tasks.Select(task => task with { Text = previous.FirstOrDefault(entry => entry.Value == task.Text).Key is { } key ? TextCatalog.T(key) : task.Text }).ToList(),
        Notes = state.Notes.Select(note => note.Title == previous["demoNoteTitle"] ? note with { Title = TextCatalog.T("demoNoteTitle"), Body = TextCatalog.T("demoNoteBody") } : note).ToList() };
    }
    Changed(); Notify(nameof(Date), nameof(Greeting), nameof(TrackTitle), nameof(TrackArtist), nameof(FocusLabel), nameof(FocusAction), nameof(IslandLabel));
  }
  /// <summary>保存动态效果偏好。</summary>
  public void SetReduceMotion(bool value) { state = state with { ReduceMotion = value }; Persist(); }
  private void Changed() { Persist(); StructureChanged?.Invoke(); }
  private void Persist() { if (!Showcase) store.Save(state); }
  /// <summary>输出本地化的操作反馈。</summary>
  public void Emit(string key) => Notice?.Invoke(TextCatalog.T(key));
  private void Notify(params string[] names) { foreach (string name in names) PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name)); }
  /// <summary>应用退出时解除系统事件。</summary>
  public void Dispose() { disposed = true; generation?.Cancel(); media.Changed -= OnMedia; volume.Changed -= OnVolume; media.Dispose(); volume.Dispose(); http.Dispose(); aiHttp.Dispose(); }
}
