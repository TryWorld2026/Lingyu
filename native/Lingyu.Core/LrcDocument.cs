/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file LrcDocument.cs @description 本地时间戳歌词、文件偏移与用户延迟。 @author 灵屿
 */
using System.Globalization;
using System.Text.RegularExpressions;

namespace Lingyu.Core;

/// <summary>一行歌词的原始时间与文字。</summary>
public sealed record LyricLine(TimeSpan Time, string Text);
/// <summary>本地歌词不会联网匹配或发送文件内容。</summary>
public sealed class LrcDocument
{
  /// <summary>按时间排序的歌词。</summary>
  public IReadOnlyList<LyricLine> Lines { get; }
  /// <summary>LRC 声明的毫秒偏移。</summary>
  public double OffsetSeconds { get; }
  private LrcDocument(List<LyricLine> lines, double offset) { Lines = lines; OffsetSeconds = offset; }
  /// <summary>解析重复时间戳、毫秒偏移；不显示元数据和无时间文字。</summary>
  public static LrcDocument Parse(string text)
  {
    var lines = new List<LyricLine>(); double offset = 0;
    foreach (string row in text.Split('\n'))
    {
      var declaration = Regex.Match(row, @"\[offset:([+-]?[0-9]+)\]", RegexOptions.IgnoreCase);
      if (declaration.Success && double.TryParse(declaration.Groups[1].Value, CultureInfo.InvariantCulture, out double ms) && double.IsFinite(ms)) offset = ms / 1000;
      var stamps = Regex.Matches(row, @"\[([0-9]{1,3}):([0-5][0-9](?:\.[0-9]{1,3})?)\]");
      if (stamps.Count == 0) continue;
      string lyric = row[(stamps[^1].Index + stamps[^1].Length)..].Trim();
      foreach (Match stamp in stamps)
        lines.Add(new(TimeSpan.FromSeconds(int.Parse(stamp.Groups[1].Value, CultureInfo.InvariantCulture) * 60 + double.Parse(stamp.Groups[2].Value, CultureInfo.InvariantCulture)), lyric));
    }
    return new(lines.OrderBy(line => line.Time).ToList(), offset);
  }
  /// <summary>正偏移表示延迟显示；可在同步歌曲时间轴上寻找当前行。</summary>
  public LyricLine? At(TimeSpan position, double userOffsetSeconds) => Lines.LastOrDefault(line =>
    line.Time.TotalSeconds + OffsetSeconds + userOffsetSeconds <= position.TotalSeconds);
}
