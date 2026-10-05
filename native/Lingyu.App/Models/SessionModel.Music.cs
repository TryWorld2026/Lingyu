/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file SessionModel.Music.cs @description 播放器选择和用户明确导入的本地歌词。 @author 灵屿
 */
using System.IO;
using Lingyu.App.Localization;
using Lingyu.Core;

namespace Lingyu.App.Models;

public sealed partial class SessionModel
{
  private LrcDocument? lyrics;
  private string lyricTrack = "";
  private double lyricOffset;
  /// <summary>系统实际提供的播放器标识。</summary>
  public IReadOnlyList<string> Players => media.Players;
  /// <summary>当前播放器；空值表示跟随系统。</summary>
  public string SelectedPlayer => media.SelectedPlayer;
  /// <summary>可见歌词，切歌后不显示上一首的文字。</summary>
  public string CurrentLyric => lyrics is not null && lyricTrack == snapshot.Source + "|" + snapshot.Title
    ? !HasTimeline ? TextCatalog.T("mediaTimelineUnavailable") : ActiveLyric?.Text ?? TextCatalog.T("lyricsWaiting") : TextCatalog.T("lyricsHint");
  /// <summary>音乐小岛仅显示已导入的当前歌词，不长期占用空间提示导入。</summary>
  public string MusicLyric => ActiveLyric?.Text ?? "";
  /// <summary>当前行对象用于工作台同步定位，不通过文本比较重复歌词。</summary>
  public LyricLine? ActiveLyric => HasTimeline && lyricTrack == snapshot.Source + "|" + snapshot.Title ? lyrics?.At(MediaPosition, lyricOffset) : null;
  /// <summary>本地歌词行供同步、定位与跳转。</summary>
  public IReadOnlyList<LyricLine> Lyrics => lyricTrack == snapshot.Source + "|" + snapshot.Title ? lyrics?.Lines ?? [] : [];
  /// <summary>用户延迟秒数。</summary>
  public double LyricOffset => lyricOffset;
  /// <summary>明确选择系统媒体会话，退出播放器后保持选择并显示空状态。</summary>
  public void SelectPlayer(string source) => media.SelectPlayer(source);
  /// <summary>后台读取有限大小的本地文件；不会联网查找歌词。</summary>
  public async Task LoadLyricsAsync(string path)
  {
    try {
      if (new FileInfo(path).Length > 1024 * 1024) { Emit("lyricsFailed"); return; }
      string track = snapshot.Source + "|" + snapshot.Title;
      var parsed = await Task.Run(async () => LrcDocument.Parse(await File.ReadAllTextAsync(path)));
      if (disposed || track != snapshot.Source + "|" + snapshot.Title) return;
      if (parsed.Lines.Count == 0) { Emit("lyricsFailed"); return; }
      lyrics = parsed; lyricTrack = track; lyricOffset = 0; Notify(nameof(CurrentLyric), nameof(MusicLyric), nameof(Lyrics), nameof(LyricOffset)); Emit("lyricsLoaded");
    } catch (Exception error) when (error is IOException or UnauthorizedAccessException or ArgumentException) { Emit("lyricsFailed"); }
  }
  /// <summary>以秒为单位延迟歌词，限制在正负十秒。</summary>
  public void SetLyricOffset(double seconds) { double next = Math.Clamp(seconds, -10, 10); if (next == lyricOffset) return; lyricOffset = next; Notify(nameof(LyricOffset), nameof(CurrentLyric), nameof(MusicLyric)); }
  /// <summary>点击歌词时跳转到含两种偏移的实际位置。</summary>
  public async Task SeekLyricAsync(LyricLine line)
  {
    if (snapshot.Duration.TotalSeconds <= 0) return;
    await MediaActionAsync("seek", (line.Time.TotalSeconds + (lyrics?.OffsetSeconds ?? 0) + lyricOffset) / snapshot.Duration.TotalSeconds);
  }
}
