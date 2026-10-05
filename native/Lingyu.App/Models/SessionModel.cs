/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file SessionModel.cs @description 原生界面共享的轻量会话状态。 @author 灵屿
 */
using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Lingyu.App.Localization;
using Lingyu.Core;
using Lingyu.Platform.Windows;

namespace Lingyu.App.Models;

/// <summary>精确通知变化区域，不重建正在编辑的页面。</summary>
public enum ChangeArea { Tasks, Notes, Files, Weather, Settings, Language }

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
  private long playbackAnchor;
  private TimeSpan anchorPosition;
  private byte[]? decodedArtwork;
  private Func<byte[], Task<(BitmapSource? Image, MediaAccent Accent)>> artworkDecoder = DecodeArtworkAsync;
  /// <summary>展示样例与真实数据不能混用。</summary>
  public bool Showcase { get; }
  /// <summary>窗口可绑定轻量属性。</summary>
  public event PropertyChangedEventHandler? PropertyChanged;
  /// <summary>订阅方只更新相应控件。</summary>
  public event Action<ChangeArea>? StructureChanged;
  /// <summary>明确的操作反馈。</summary>
  public event Action<string>? Notice;
  /// <summary>跨窗口共享的计时。</summary>
  public FocusClock Clock { get; }
  /// <summary>最新任务。</summary>
  public IReadOnlyList<TaskEntry> Tasks => state.Tasks;
  /// <summary>最新笔记。</summary>
  public IReadOnlyList<NoteEntry> Notes => state.Notes;
  /// <summary>文件引用。</summary>
  public IReadOnlyList<string> Files => state.Files;
  /// <summary>关闭装饰动效。</summary>
  public bool ReduceMotion => state.ReduceMotion || !System.Windows.SystemParameters.ClientAreaAnimation;
  /// <summary>免打扰只控制本应用提示声。</summary>
  public bool Quiet { get; set; }
  /// <summary>天气城市。</summary>
  public WeatherCity? City => state.City;
  /// <summary>模型连接配置。</summary>
  public AiConnection? Connection => state.Ai;
  /// <summary>真实播放器封面。</summary>
  public ImageSource? Artwork { get; private set; }
  /// <summary>仅供音乐进度与播放状态使用，不修改全局主题。</summary>
  public Color MediaAccentColor { get; private set; } = Color.FromRgb(MediaPalette.Fallback.R, MediaPalette.Fallback.G, MediaPalette.Fallback.B);
  /// <summary>歌曲标题或明确空状态。</summary>
  public string TrackTitle => Showcase ? TextCatalog.T("demoTrack") : string.IsNullOrWhiteSpace(snapshot.Title) ? TextCatalog.T("musicEmpty") : snapshot.Title;
  /// <summary>歌手或连接说明。</summary>
  public string TrackArtist => Showcase ? TextCatalog.T("demoArtist") : string.IsNullOrWhiteSpace(snapshot.Artist) ? TextCatalog.T("musicSource") : snapshot.Artist;
  /// <summary>是否存在真实歌曲。</summary>
  public bool HasMedia => Showcase || !string.IsNullOrWhiteSpace(snapshot.Title);
  /// <summary>播放状态；仅明确的样例模式展示样例播放。</summary>
  public bool IsPlaying => Showcase || (HasMedia && snapshot.Playing);
  /// <summary>歌曲和来源的稳定身份；没有会话时为空。</summary>
  public string MediaIdentity => Showcase ? "showcase" : HasMedia ? snapshot.Source + "|" + snapshot.Title + "|" + snapshot.Artist : "";
  /// <summary>播放图标。</summary>
  public string PlayGlyph => IsPlaying ? "pause" : "play";
  /// <summary>可用系统控制。</summary>
  public bool CanPlay => !Showcase && snapshot.CanPlay;
  /// <summary>上一首能力。</summary>
  public bool CanPrevious => !Showcase && snapshot.CanPrevious;
  /// <summary>下一首能力。</summary>
  public bool CanNext => !Showcase && snapshot.CanNext;
  /// <summary>不把缺失的媒体时间轴显示成零秒歌曲。</summary>
  public bool HasTimeline => Showcase || snapshot.Duration > TimeSpan.Zero;
  /// <summary>拖动进度能力。</summary>
  public bool CanSeek => !Showcase && HasTimeline && snapshot.CanSeek;
  /// <summary>用户可见的时间轴能力或跳转说明。</summary>
  public string MediaSeekHint => TextCatalog.T(!HasMedia ? "musicSource" : !HasTimeline ? "mediaTimelineUnavailable" : !CanSeek ? "mediaSeekUnavailable" : "mediaSeek");
  /// <summary>歌曲的实际进度比例。</summary>
  public double MediaProgress => Showcase ? 34 : snapshot.Duration.TotalSeconds > 0 ? MediaPosition.TotalSeconds / snapshot.Duration.TotalSeconds * 100 : 0;
  /// <summary>单调时钟插值，系统采样重新校准。</summary>
  public TimeSpan MediaPosition => Showcase ? TimeSpan.FromSeconds(103) : TimeSpan.FromSeconds(Math.Clamp(anchorPosition.TotalSeconds + (snapshot.Playing ? Stopwatch.GetElapsedTime(playbackAnchor).TotalSeconds : 0), 0, Math.Max(0, snapshot.Duration.TotalSeconds)));
  /// <summary>当前播放时间。</summary>
  public string MediaTime => Showcase ? "01:43" : HasTimeline ? MediaPosition.ToString(@"mm\:ss") : "—";
  /// <summary>歌曲长度。</summary>
  public string MediaDuration => Showcase ? "04:26" : HasTimeline ? snapshot.Duration.ToString(@"mm\:ss") : "—";
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
  /// <summary>暂停及未关闭的完成提醒保留专注布局。</summary>
  public string IslandActivity => FocusPresented ? "focus" : IsGenerating ? "ai" : "music";
  /// <summary>紧凑活动的次级说明。</summary>
  public string IslandSubLabel => FocusPresented ? FocusLabel : IsGenerating ? TextCatalog.T("ai") : TrackArtist;
  /// <summary>悬停标题始终与当前活动的说明和控制一致。</summary>
  public string IslandHoverLabel => FocusPresented ? Clock.IsCompleted ? FocusRingLabel : FocusTime : IsGenerating ? TextCatalog.T("aiThinking") : TrackTitle;
  /// <summary>固定待办只占用收起状态，不借用歌曲封面。</summary>
  public bool HasPinnedTask => state.Tasks.Any(task => task.Pinned && !task.Done);
  /// <summary>岛上展示正在关注的任务。</summary>
  public string IslandLabel => FocusPresented ? Clock.IsCompleted ? FocusRingLabel : FocusTime : IsGenerating ? TextCatalog.T("aiThinking") : state.Tasks.FirstOrDefault(task => task.Pinned && !task.Done)?.Text ?? (HasMedia ? TrackTitle : Time);
  /// <summary>岛上的状态图标。</summary>
  public string IslandGlyph => FocusPresented ? Clock.IsCompleted ? "check" : "focus" : IsGenerating ? "ai" : HasMedia ? "music" : "logo";
  /// <summary>构造独立预览会话。</summary>
  public SessionModel(string dataDirectory, bool showcase, string? language, TimeProvider? focusTime = null)
  {
    dispatcher = System.Windows.Threading.Dispatcher.CurrentDispatcher;
    Showcase = showcase;
    store = new PreviewStore(dataDirectory); state = store.Load();
    TextCatalog.Current.Load(language ?? (string.IsNullOrEmpty(state.Language) ? null : state.Language));
    if (showcase)
      state = new PreviewState { Tasks = [new(Guid.NewGuid(), TextCatalog.T("demoTask1"), false, true), new(Guid.NewGuid(), TextCatalog.T("demoTask2"), false), new(Guid.NewGuid(), TextCatalog.T("demoTask3"), true)],
        Notes = [new(Guid.NewGuid(), TextCatalog.T("demoNoteTitle"), TextCatalog.T("demoNoteBody"), now)] };
    Clock = new FocusClock(focusTime); Clock.Restore(state.Focus);
    // 启动时补记退出期间的完成，只保留可见提醒，不补播提示声。
    if (Clock.Tick()) SaveFocus();
    media.Changed += OnMedia;
    volume.Changed += OnVolume;
    if (volume.Read() is { } current) { volumeValue = current.Value; muted = current.Muted; }
  }

  /// <summary>异步连接系统媒体；天气按可见视图获取。</summary>
  public async Task StartAsync()
  {
    if (!Showcase) await media.StartAsync();
  }
  private void OnMedia(MediaSnapshot value) => Dispatch(() => ApplyMedia(value));
  private async void ApplyMedia(MediaSnapshot value)
  {
    if (disposed) return;
    snapshot = value; playbackAnchor = Stopwatch.GetTimestamp(); anchorPosition = value.PositionAt(DateTimeOffset.UtcNow);
    Notify(nameof(TrackTitle), nameof(TrackArtist), nameof(HasMedia), nameof(IsPlaying), nameof(MediaIdentity), nameof(PlayGlyph), nameof(CanPlay), nameof(CanPrevious), nameof(CanNext), nameof(CanSeek), nameof(HasTimeline), nameof(MediaSeekHint), nameof(MediaDuration), nameof(IslandLabel), nameof(IslandHoverLabel), nameof(IslandGlyph), nameof(IslandSubLabel), nameof(Lyrics), nameof(Players), nameof(SelectedPlayer)); TickMedia();
    var bytes = HasMedia ? value.Artwork : null;
    if (!ReferenceEquals(decodedArtwork, bytes))
    {
      decodedArtwork = bytes; Artwork = null;
      MediaAccentColor = Color.FromRgb(MediaPalette.Fallback.R, MediaPalette.Fallback.G, MediaPalette.Fallback.B);
      Notify(nameof(Artwork), nameof(MediaAccentColor));
      if (bytes is { Length: > 0 })
      {
        var prepared = await artworkDecoder(bytes);
        if (disposed || !ReferenceEquals(decodedArtwork, bytes)) return;
        Artwork = prepared.Image; MediaAccentColor = Color.FromRgb(prepared.Accent.R, prepared.Accent.G, prepared.Accent.B);
        Notify(nameof(Artwork), nameof(MediaAccentColor));
      }
    }
  }
  private static Task<(BitmapSource? Image, MediaAccent Accent)> DecodeArtworkAsync(byte[] bytes) => Task.Run<(BitmapSource?, MediaAccent)>(() => {
    try {
      using var stream = new MemoryStream(bytes); var image = new BitmapImage(); image.BeginInit(); image.CacheOption = BitmapCacheOption.OnLoad; image.DecodePixelWidth = 320; image.StreamSource = stream; image.EndInit(); image.Freeze();
      var scaled = new TransformedBitmap(image, new ScaleTransform(16d / image.PixelWidth, 16d / image.PixelHeight));
      var sample = new FormatConvertedBitmap(scaled, PixelFormats.Bgra32, null, 0); byte[] pixels = new byte[sample.PixelWidth * sample.PixelHeight * 4];
      sample.CopyPixels(pixels, sample.PixelWidth * 4, 0);
      return (image, MediaPalette.Extract(pixels));
    } catch (Exception error) when (error is NotSupportedException or IOException or ArgumentException or FormatException) { return (null, MediaPalette.Fallback); }
  });
  private void OnVolume(double value, bool isMuted) => Dispatch(() => { volumeValue = value; muted = isMuted; Notify(nameof(Volume), nameof(VolumeText), nameof(VolumeAvailable)); });
  private void Dispatch(Action action)
  {
    if (disposed || dispatcher.HasShutdownStarted) return;
    _ = dispatcher.BeginInvoke(() => { if (!disposed) action(); });
  }

  /// <summary>显示变化时只通知必要属性。</summary>
  public void Tick()
  {
    now = DateTimeOffset.Now;
    CompleteFocus();
    Notify(nameof(Time), nameof(Date), nameof(Greeting), nameof(IslandLabel), nameof(IslandHoverLabel), nameof(IslandSubLabel));
    TickMedia();
    if (Clock.IsRunning) Notify(nameof(FocusTime), nameof(FocusProgress));
    if (weatherViews > 0) _ = RefreshWeatherAsync();
  }
  /// <summary>可见音乐界面刷新进度，不刷新页面结构。</summary>
  public void TickMedia() => Notify(nameof(MediaProgress), nameof(MediaTime), nameof(CurrentLyric), nameof(MusicLyric));
  /// <summary>控制真实系统音量。</summary>
  public void SetVolume(double value) { if (!volume.Set(value)) Emit("operationFailed"); }
  /// <summary>切换真实静音。</summary>
  public void ToggleMute() { if (!volume.Mute(!muted)) Emit("operationFailed"); }
  /// <summary>请求实际播放器控制。</summary>
  public async Task MediaActionAsync(string action, double fraction = 0)
  { if (action == "seek" && !CanSeek) { Emit(HasTimeline ? "mediaSeekUnavailable" : "mediaTimelineUnavailable"); return; } if (!await media.ControlAsync(action, fraction)) Emit("mediaFailed"); }
  /// <summary>添加真实用户任务。</summary>
  public void AddTask(string text)
  { if (string.IsNullOrWhiteSpace(text)) return; state.Tasks.Add(new(Guid.NewGuid(), text.Trim(), false)); Changed(ChangeArea.Tasks); Notify(nameof(IslandLabel), nameof(IslandHoverLabel)); }
  /// <summary>修改任务状态。</summary>
  public void ToggleTask(Guid id)
  { int index = state.Tasks.FindIndex(task => task.Id == id); if (index < 0) return; var task = state.Tasks[index]; state.Tasks[index] = task with { Done = !task.Done }; Changed(ChangeArea.Tasks); Notify(nameof(IslandLabel), nameof(IslandHoverLabel)); }
  /// <summary>任务固定到岛上。</summary>
  public void PinTask(Guid id)
  {
    state = state with { Tasks = state.Tasks.Select(task => task with { Pinned = task.Id == id && !task.Pinned }).ToList() };
    Changed(ChangeArea.Tasks); Notify(nameof(IslandLabel), nameof(IslandHoverLabel));
  }
  /// <summary>删除指定任务。</summary>
  public void DeleteTask(Guid id) { state.Tasks.RemoveAll(task => task.Id == id); Changed(ChangeArea.Tasks); Notify(nameof(IslandLabel), nameof(IslandHoverLabel)); }
  /// <summary>保存用户笔记。</summary>
  public Guid SaveNote(Guid? id, string title, string body)
  {
    var note = new NoteEntry(id ?? Guid.NewGuid(), title.Trim(), body, DateTimeOffset.Now);
    int index = state.Notes.FindIndex(value => value.Id == note.Id);
    if (index < 0) state.Notes.Insert(0, note); else state.Notes[index] = note;
    Changed(ChangeArea.Notes); return note.Id;
  }
  /// <summary>删除笔记。</summary>
  public void DeleteNote(Guid id) { state.Notes.RemoveAll(note => note.Id == id); Changed(ChangeArea.Notes); }
  /// <summary>保存实际文件引用。</summary>
  public void AddFiles(IEnumerable<string> paths)
  { foreach (string path in paths) if (File.Exists(path) && !state.Files.Contains(path, StringComparer.OrdinalIgnoreCase)) state.Files.Add(path); Changed(ChangeArea.Files); }
  /// <summary>移除引用，不删除文件。</summary>
  public void RemoveFile(string path) { state.Files.Remove(path); Changed(ChangeArea.Files); }
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
    Changed(ChangeArea.Language); NotifyFocus(); Notify(nameof(Date), nameof(Greeting), nameof(TrackTitle), nameof(TrackArtist), nameof(MediaSeekHint), nameof(WeatherCityName), nameof(WeatherDescription), nameof(WeatherUpdateStatus), nameof(WeatherUpdatedAt));
  }
  /// <summary>保存动态效果偏好。</summary>
  public void SetReduceMotion(bool value) { state = state with { ReduceMotion = value }; Changed(ChangeArea.Settings); Notify(nameof(ReduceMotion)); }
  private void Changed(ChangeArea area) { Persist(); StructureChanged?.Invoke(area); }
  private void Persist() { if (!Showcase) store.Save(state); }
  /// <summary>输出本地化的操作反馈。</summary>
  public void Emit(string key) => Notice?.Invoke(TextCatalog.T(key));
  private void Notify(params string[] names) { foreach (string name in names) PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name)); }
  /// <summary>应用退出时解除系统事件。</summary>
  public void Dispose() { disposed = true; weatherRevision++; weatherRequest?.Cancel(); generation?.Cancel(); media.Changed -= OnMedia; volume.Changed -= OnVolume; media.Dispose(); volume.Dispose(); http.Dispose(); aiHttp.Dispose(); }
}
