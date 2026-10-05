/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WorkspacePages.Music.cs @description 真实播放器与本地歌词的独立编辑区域。 @author 灵屿
 */
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.Core;

namespace Lingyu.App.Views;

internal static partial class WorkspacePages
{
  /// <summary>系统会话、用户导入与歌词跳转，不自动下载或读取其他文件。</summary>
  public static UIElement MusicDetails(SessionModel model)
  {
    var root = new StackPanel(); root.Children.Add(Ui.Header("musicHeading", "musicSubtitle")); root.Children.Add(Music(model));
    var options = new StackPanel { Margin = new Thickness(0, 20, 0, 20) };
    options.Children.Add(Ui.Label("playerSelect", 12, "Muted"));
    var players = new ComboBox { Margin = new Thickness(0, 8, 0, 16), MinHeight = 36 };
    players.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, TextCatalog.T("playerSelect"));
    string[] sources = []; bool loadingPlayers = false;
    void DrawPlayers()
    {
      var available = model.Players;
      var next = new[] { "" }.Concat(available).Concat(model.SelectedPlayer.Length > 0 && !available.Contains(model.SelectedPlayer) ? [model.SelectedPlayer] : Array.Empty<string>()).ToArray();
      var labels = next.Select(source => source.Length == 0 ? TextCatalog.T("playerAutomatic") : available.Contains(source) ? source : string.Format(System.Globalization.CultureInfo.CurrentCulture, TextCatalog.T("playerUnavailable"), source)).ToArray();
      if (next.SequenceEqual(sources) && players.ItemsSource is string[] previous && labels.SequenceEqual(previous) && players.SelectedIndex == Math.Max(0, Array.IndexOf(next, model.SelectedPlayer))) return;
      loadingPlayers = true; sources = next;
      players.ItemsSource = labels;
      players.SelectedIndex = Math.Max(0, Array.IndexOf(sources, model.SelectedPlayer)); loadingPlayers = false;
    }
    DrawPlayers(); players.DropDownOpened += (_, _) => DrawPlayers();
    players.SelectionChanged += (_, _) => { if (!loadingPlayers && players.SelectedIndex >= 0) model.SelectPlayer(sources[players.SelectedIndex]); }; options.Children.Add(players);
    var import = Ui.Button(TextCatalog.T("lyricsOpen"), () => {
      var dialog = new Microsoft.Win32.OpenFileDialog { Filter = TextCatalog.T("lyricsFilter"), Title = TextCatalog.T("lyricsOpen") };
      if (dialog.ShowDialog() == true) _ = model.LoadLyricsAsync(dialog.FileName);
    }); options.Children.Add(import);
    options.Children.Add(Ui.Label("lyricsOffset", 12, "Muted"));
    var offset = new Slider { Minimum = -10, Maximum = 10, TickFrequency = .1, IsSnapToTickEnabled = true, Value = model.LyricOffset, Margin = new Thickness(0, 10, 0, 8) };
    var delay = new TextBlock { Foreground = Ui.Brush("Muted"), FontSize = 11 };
    void UpdateDelay() { delay.Text = model.LyricOffset.ToString("+0.0;-0.0;0.0", System.Globalization.CultureInfo.InvariantCulture) + " " + TextCatalog.T("seconds"); }
    offset.ValueChanged += (_, _) => { model.SetLyricOffset(offset.Value); UpdateDelay(); }; options.Children.Add(offset); options.Children.Add(delay); UpdateDelay(); root.Children.Add(Ui.Surface(options));
    var current = Ui.BoundText("CurrentLyric", 19); current.Margin = new Thickness(0, 20, 0, 12); root.Children.Add(current);
    var lines = new ListBox { Height = 240, Background = Ui.Brush("Surface"), Foreground = Ui.Brush("Ink"), BorderBrush = Ui.Brush("Line"), DisplayMemberPath = "Text", ItemsSource = model.Lyrics };
    lines.MouseDoubleClick += async (_, _) => { if (lines.SelectedItem is LyricLine line && model.CanSeek) await model.SeekLyricAsync(line); };
    void Changed(object? sender, PropertyChangedEventArgs e)
    {
      if (e.PropertyName is nameof(SessionModel.Players) or nameof(SessionModel.SelectedPlayer)) DrawPlayers();
      if (e.PropertyName == nameof(SessionModel.Lyrics)) lines.ItemsSource = model.Lyrics;
      if (e.PropertyName == nameof(SessionModel.CurrentLyric) && !lines.IsMouseOver && !lines.IsKeyboardFocusWithin)
      {
        var selected = model.ActiveLyric; if (!Equals(selected, lines.SelectedItem)) { lines.SelectedItem = selected; if (selected is not null) lines.ScrollIntoView(selected); }
      }
      if (e.PropertyName == nameof(SessionModel.LyricOffset)) { offset.Value = model.LyricOffset; UpdateDelay(); }
    }
    root.Loaded += (_, _) => model.PropertyChanged += Changed; root.Unloaded += (_, _) => model.PropertyChanged -= Changed; root.Children.Add(lines); root.Children.Add(Ui.Label("lyricsJumpHint", 11, "Muted"));
    return Ui.Scroll(root);
  }
}
