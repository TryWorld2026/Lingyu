/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file LayoutChecks.cs @description 用实际布局边界验证窄窗、文案完整性与编辑状态。 @author 灵屿
 */
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;
using Lingyu.App.Controls;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.App.Windows;
using Lingyu.Core;

namespace Lingyu.App.Verification;

public static partial class NativeChecks
{
  /// <summary>改变真实窗口尺寸；不把窗口宽度验收冒充系统 DPI 切换测试。</summary>
  public static async Task RunLayoutAsync(App app, SessionModel model, IslandWindow island,
    Action<string> openWorkspace, Func<WorkspaceWindow?> getWorkspace, string output)
  {
    Directory.CreateDirectory(output); var results = new List<object>(); var errors = new List<string>();
    void Check(string name, Action action)
    { try { action(); results.Add(new { name, passed = true }); } catch (Exception error) { errors.Add(name + ": " + error.Message); results.Add(new { name, passed = false }); } }
    void Assert(bool condition, string message) { if (!condition) throw new InvalidOperationException(message); }
    GetCursorPos(out var cursor); SetCursorPos(cursor.X, Math.Max(cursor.Y, 900));
    try
    {
      foreach (string language in new[] { "zh-CN", "en-US" })
      {
        model.SetLanguage(language);
        openWorkspace("today"); var window = getWorkspace()!; window.Left = 20; window.Top = 60;
        foreach (double width in new[] { 1120d, 800, 640, 480 })
        {
          window.Width = width; window.Height = 740; await Task.Delay(100); window.UpdateLayout();
          string tag = language + "-" + width;
          Check("workspace fits requested width " + tag, () => Assert(Math.Abs(window.ActualWidth - width) < 2, $"Requested {width}, actual {window.ActualWidth}"));
          Check("music capability text clears playback actions " + tag, () => {
            var hint = TextFor(window, "MediaSeekHint"); var card = Ancestor<Border>(hint)!;
            var play = Descendants<Button>(card).Single(button => AutomationProperties.GetName(button) == TextCatalog.T("playPause"));
            var rect = Bounds(hint, card); var action = Bounds(play, card);
            Assert(rect.Bottom <= action.Top + 1 && rect.Bottom <= card.ActualHeight - card.Padding.Bottom + 1, $"Hint bottom {rect.Bottom:0.0}, action top {action.Top:0.0}, card height {card.ActualHeight:0.0}");
            for (var parent = VisualTreeHelper.GetParent(hint); parent != card; parent = VisualTreeHelper.GetParent(parent))
              if (parent is FrameworkElement element) Assert(Bounds(hint, element).Bottom <= element.ActualHeight + 1, "Capability text is clipped by its layout parent");
          });
          Check("today cards keep usable content width " + tag, () => Assert(Find<Slider>(window, "WorkspaceMediaSeek")!.ActualWidth >= 150, "Timeline compressed below usable width"));
          Capture(window, Path.Combine(output, "today-" + tag + ".png"));
        }
        foreach (string page in new[] { "focus", "notes", "settings", "files", "music", "ai" })
        {
          openWorkspace(page); window.Width = 480; window.Height = 640; await Task.Delay(100); window.UpdateLayout();
          Check("narrow page content remains usable " + language + "-" + page, () => {
            if (page == "focus")
            {
              var ring = Descendants<FocusRing>(window).Single(); var button = Find<Button>(window, "FocusToggle")!;
              var dial = Bounds(ring, window); var action = Bounds(button, window);
              Assert(!dial.IntersectsWith(action) && action.Width >= 100 && action.Right <= window.ActualWidth, "Focus controls overlap or leave the window");
            }
            else if (page == "notes")
            {
              Assert(Find<TextBox>(window, "NoteBody")!.ActualWidth >= 240, "Note editor is squeezed by its list");
              var title = Find<TextBox>(window, "NoteTitle")!; var end = title.GetRectFromCharacterIndex(title.Text.Length - 1, true);
              Assert(!end.IsEmpty && end.Right <= title.ActualWidth - title.Padding.Right + 1, "Note title ends outside the editor");
            }
            else if (page == "settings") Assert(Find<TextBox>(window, "AiEndpoint")!.ActualWidth >= 260, "Connection form is squeezed by weather settings");
            else if (page == "music") Assert(Find<Slider>(window, "WorkspaceMediaSeek")!.ActualWidth >= 150, "Music timeline is too narrow");
            else if (page == "files") Assert(Descendants<Button>(window).Any(button => button.Content as string == TextCatalog.T("fileAdd") && button.ActualWidth >= 80), "File picker is unavailable");
            else Assert(Find<TextBox>(window, "AiInput")!.ActualWidth >= 240, "Chat input is too narrow");
          });
          Capture(window, Path.Combine(output, page + "-" + language + "-480.png"));
        }
        var input = Find<TextBox>(window, "AiInput")!; input.Focus(); input.Text = "Draft survives narrow and wide layouts"; input.Select(6, 8);
        window.Width = 1120; await Task.Delay(80); window.Width = 480; window.Height = 400; await Task.Delay(80);
        Check("resize preserves draft selection " + language, () => Assert(ReferenceEquals(input, Find<TextBox>(window, "AiInput")) && input.IsKeyboardFocused && input.Text == "Draft survives narrow and wide layouts" && input.SelectionStart == 6 && input.SelectionLength == 8, "Resize rebuilt the editor or lost input focus"));
        Check("short window keeps navigation reachable " + language, () => {
          var back = Find<Button>(window, "ReturnToIsland")!; var rect = Bounds(back, window);
          Assert(Math.Abs(window.ActualHeight - 400) < 2 && rect.Top >= 58 && rect.Bottom <= window.ActualHeight && rect.Width >= 36, "Navigation does not fit short window");
          Assert(Descendants<Button>(window).Where(button => AutomationProperties.GetAutomationId(button).StartsWith("Nav-", StringComparison.Ordinal)).All(button => !string.IsNullOrEmpty(AutomationProperties.GetName(button)) && button.ToolTip is not null), "Compact navigation lacks accessible labels");
        });
        Capture(window, Path.Combine(output, "ai-" + language + "-480x400.png"));
        openWorkspace("settings"); await Task.Delay(80); var endpoint = Find<TextBox>(window, "AiEndpoint")!; endpoint.Text = "http://localhost:11434/unsaved"; endpoint.Select(7, 9);
        window.Width = 1120; await Task.Delay(80); window.Width = 480; await Task.Delay(80);
        Check("resize preserves settings draft " + language, () => Assert(ReferenceEquals(endpoint, Find<TextBox>(window, "AiEndpoint")) && endpoint.Text.EndsWith("/unsaved", StringComparison.Ordinal) && endpoint.SelectionStart == 7 && endpoint.SelectionLength == 9, "Resize discarded connection settings"));
        window.Close();
        Check("island weather follows language change " + language, () => Assert(TextFor(island, "WeatherCityName").Text == model.WeatherCityName && TextFor(island, "WeatherDescription").Text == model.WeatherDescription, "Island weather kept the previous language"));
        foreach (double width in new[] { 1000d, 820, 640, 480, 360 })
        {
          island.Width = width; island.SetShape(IslandShape.Expanded); island.SetExpandedView(IslandExpandedView.Overview); await Task.Delay(350); island.UpdateLayout();
          string tag = language + "-" + width;
          Check("expanded island content fits " + tag, () => {
            var expanded = (Grid)island.FindName("Expanded"); var seek = (Slider)island.FindName("MediaSeek");
            Assert(island.Geometry.Width <= width + 1 && seek.ActualWidth >= 130, $"Shell {island.Geometry.Width:0.0}, timeline {seek.ActualWidth:0.0}, available {width}");
            foreach (var button in Descendants<Button>(expanded).Where(button => button.IsVisible))
            {
              var rect = Bounds(button, expanded);
              Assert(rect.Left >= 0 && rect.Right <= expanded.ActualWidth + 1 && rect.Top >= 0 && rect.Bottom <= expanded.ActualHeight + 1, "Expanded action is outside its capsule: " + AutomationProperties.GetName(button));
            }
          });
          if (island.Geometry.Width <= island.ActualWidth && island.Geometry.Height <= island.ActualHeight) Capture(island, Path.Combine(output, "island-" + tag + ".png"));
          if (width is 1000 or 480) CaptureComposed(island, Path.Combine(output, "desktop-island-" + tag + ".png"));
        }
        model.StartFocus();
        foreach (double width in new[] { 680d, 480, 360 })
        {
          island.Width = width; island.SetShape(IslandShape.Expanded); island.SetExpandedView(IslandExpandedView.Overview); await Task.Delay(300); island.UpdateLayout();
          Check("focus island fits " + language + "-" + width, () => {
            var expanded = (Grid)island.FindName("FocusExpanded"); var ring = Descendants<FocusRing>(expanded).Single(); var dial = Bounds(ring, expanded);
            Assert(expanded.ActualWidth <= width + 1, "Focus layout is wider than host");
            foreach (var button in Descendants<Button>(expanded).Where(button => button.IsVisible))
            {
              var rect = Bounds(button, expanded);
              Assert(!rect.IntersectsWith(dial) && rect.Right <= expanded.ActualWidth + 1 && rect.Left >= 0 && rect.Bottom <= expanded.ActualHeight + 1, "Focus action overlaps timer or leaves capsule");
            }
          });
          if (island.Geometry.Width <= island.ActualWidth && island.Geometry.Height <= island.ActualHeight) Capture(island, Path.Combine(output, "focus-island-" + language + "-" + width + ".png"));
        }
        model.ResetFocus();
        foreach (double width in new[] { 420d, 360, 320, 280 }) {
          island.Width = width; island.SetShape(IslandShape.Expanded); await Task.Delay(300); island.UpdateLayout();
          Check("music detail has separate responsive geometry " + language + "-" + width, () => {
            var details = (Grid)island.FindName("MusicDetails"); var seek = (Slider)island.FindName("MusicDetailsSeek");
            Assert(island.Geometry.Width == width && details.IsVisible && seek.ActualWidth >= 230, "Detail geometry or seek width is invalid");
            Assert(((Grid)island.FindName("Expanded")).Visibility == Visibility.Hidden, "Overview is still visible behind music");
          });
          Capture(island, Path.Combine(output, "music-detail-" + language + "-" + width + ".png"));
        }
        island.Width = 1000;
        island.SetShape(IslandShape.Docked); await Task.Delay(300);
        Check("pinned task has task identity " + language, () => {
          var pinned = model.Tasks.First(task => task.Pinned && !task.Done);
          Assert(TextFor((Grid)island.FindName("Docked"), "IslandLabel").Text == pinned.Text && ((Glyph)island.FindName("ActivityIcon")).Kind == "pin" && ((Grid)island.FindName("SharedArtwork")).Opacity < .01, "Pinned task is presented with song artwork or icon");
        });
        Capture(island, Path.Combine(output, "docked-" + language + ".png"));
        var pinnedTask = model.Tasks.First(task => task.Pinned && !task.Done); model.ToggleTask(pinnedTask.Id); await Task.Delay(300);
        Check("completing pinned task restores media " + language, () => Assert(TextFor((Grid)island.FindName("Docked"), "IslandLabel").Text == model.TrackTitle && ((Grid)island.FindName("SharedArtwork")).Opacity > .99, "Completed task still occupies the compact island"));
        Capture(island, Path.Combine(output, "compact-music-" + language + ".png"));
        model.ToggleTask(pinnedTask.Id); await Task.Delay(300);
        island.SetShape(IslandShape.Hover); await Task.Delay(300);
        Check("music hover keeps title and artist together " + language, () => {
          var title = Descendants<TextBlock>((Grid)island.FindName("Hover")).First(text => text.FontSize == 14);
          Assert(title.Text == model.TrackTitle && TextFor((Grid)island.FindName("Hover"), "IslandSubLabel").Text == model.TrackArtist, "Hover combines a task title and music metadata");
        });
        Capture(island, Path.Combine(output, "hover-" + language + ".png"));
        model.ToggleFocus(); await Task.Delay(300);
        Check("focus hover updates title and subtitle immediately " + language, () => Assert(Descendants<TextBlock>((Grid)island.FindName("Hover")).First(text => text.FontSize == 14).Text == model.FocusTime && TextFor((Grid)island.FindName("Hover"), "IslandSubLabel").Text == model.FocusLabel, "Focus hover kept music metadata"));
        model.ResetFocus();
      }
    }
    catch (Exception error) { errors.Add("Layout verification aborted: " + error.Message); }
    finally
    {
      SetCursorPos(cursor.X, cursor.Y);
      File.WriteAllText(Path.Combine(output, "layout-report.json"), JsonSerializer.Serialize(new { results, errors, dpi = VisualTreeHelper.GetDpi(island).PixelsPerInchX, systemDpiSwitchVerified = false }, new JsonSerializerOptions { WriteIndented = true }));
    }
    app.Shutdown(errors.Count == 0 ? 0 : 1);
  }
  private static IEnumerable<T> Descendants<T>(DependencyObject parent) where T : DependencyObject
  {
    for (int index = 0; index < VisualTreeHelper.GetChildrenCount(parent); index++)
    {
      var child = VisualTreeHelper.GetChild(parent, index);
      if (child is T match) yield return match;
      foreach (var descendant in Descendants<T>(child)) yield return descendant;
    }
  }
  private static T? Ancestor<T>(DependencyObject child) where T : DependencyObject
  { for (var parent = VisualTreeHelper.GetParent(child); parent is not null; parent = VisualTreeHelper.GetParent(parent)) if (parent is T match) return match; return null; }
  private static TextBlock TextFor(DependencyObject parent, string path) => Descendants<TextBlock>(parent).First(text => BindingOperations.GetBindingExpression(text, TextBlock.TextProperty)?.ParentBinding.Path?.Path == path);
  private static Rect Bounds(FrameworkElement element, Visual relativeTo) => element.TransformToAncestor(relativeTo).TransformBounds(new Rect(element.RenderSize));
}
