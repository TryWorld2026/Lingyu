/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WorkspacePages.Focus.cs @description 真正可运行的专注与任务交接。 @author 灵屿
 */
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using Lingyu.App.Controls;
using Lingyu.App.Localization;
using Lingyu.App.Models;

namespace Lingyu.App.Views;

internal static partial class WorkspacePages
{
  /// <summary>专注环、暂停恢复和实际任务。</summary>
  public static UIElement Focus(SessionModel model)
  {
    var root = new StackPanel(); root.Children.Add(Ui.Header("focusHeading", "focusSubtitle"));
    var body = new Grid { Height = 220 }; body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(160) }); body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(190) }); body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
    var caption = new StackPanel { VerticalAlignment = VerticalAlignment.Center }; caption.Children.Add(Ui.Icon("focus", 32, "Accent")); var label = Ui.BoundText("FocusLabel", 16); label.Margin = new Thickness(0, 16, 0, 8); caption.Children.Add(label); caption.Children.Add(Ui.Label("timeCaption", 11, "Muted")); body.Children.Add(caption);
    var timer = new Grid { Width = 180, Height = 180 }; var ring = new FocusRing(); ring.SetBinding(FocusRing.ProgressProperty, "FocusProgress"); timer.Children.Add(ring); var time = Ui.BoundText("FocusTime", 39); time.FontWeight = FontWeights.SemiBold; time.VerticalAlignment = VerticalAlignment.Center; time.HorizontalAlignment = HorizontalAlignment.Center; timer.Children.Add(time); Grid.SetColumn(timer, 1); body.Children.Add(timer);
    var actionPanel = new StackPanel { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(25, 0, 0, 0) }; var toggle = Ui.Button("", model.ToggleFocus, "Primary"); toggle.SetBinding(ContentControl.ContentProperty, "FocusAction"); toggle.SetValue(System.Windows.Automation.AutomationProperties.AutomationIdProperty, "FocusToggle"); actionPanel.Children.Add(toggle);
    var reset = Ui.Button(TextCatalog.T("focusReset"), model.ResetFocus); reset.Margin = new Thickness(0, 10, 0, 0); actionPanel.Children.Add(reset);
    var durations = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 14, 0, 0) };
    foreach (int minutes in new[] { 15, 25, 50 }) { var button = Ui.Button(minutes.ToString(System.Globalization.CultureInfo.InvariantCulture), () => model.StartFocus(minutes)); button.ToolTip = minutes + " " + TextCatalog.T("focusMinutes"); button.Padding = new Thickness(10, 6, 10, 6); button.Margin = new Thickness(3, 0, 3, 0); durations.Children.Add(button); }
    actionPanel.Children.Add(durations); Grid.SetColumn(actionPanel, 2); body.Children.Add(actionPanel); root.Children.Add(Ui.Surface(body));
    var list = Ui.Surface(TaskList(model, false)); list.Margin = new Thickness(0, 20, 0, 0); root.Children.Add(list); return Ui.Scroll(root);
  }
  private static StackPanel TaskList(SessionModel model, bool compact)
  {
    var root = new StackPanel();
    var top = new DockPanel { Margin = new Thickness(0, 0, 0, 15) }; var heading = Ui.Label("tasks", 15); heading.FontWeight = FontWeights.SemiBold; top.Children.Add(heading); root.Children.Add(top);
    foreach (var task in compact ? model.Tasks.Take(3) : model.Tasks)
    {
      var row = new Grid { Margin = new Thickness(0, 0, 0, 9), MinHeight = 34 }; row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(29) }); row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) }); row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(36) }); row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(36) });
      var check = Ui.IconButton(task.Done ? "check" : "", "taskComplete", () => model.ToggleTask(task.Id)); check.Width = check.Height = 23; check.Padding = new Thickness(3); check.BorderThickness = new Thickness(1); check.BorderBrush = Ui.Brush(task.Done ? "Accent" : "Faint"); check.Background = task.Done ? Ui.Brush("Surface") : System.Windows.Media.Brushes.Transparent; row.Children.Add(check);
      var text = new TextBlock { Text = task.Text, FontSize = 13, TextWrapping = TextWrapping.Wrap, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(9, 0, 10, 0), Foreground = Ui.Brush(task.Done ? "Faint" : "Ink") }; if (task.Done) text.TextDecorations = TextDecorations.Strikethrough; Grid.SetColumn(text, 1); row.Children.Add(text);
      var pin = Ui.IconButton("pin", task.Pinned ? "taskUnpin" : "taskPin", () => model.PinTask(task.Id)); pin.Width = pin.Height = 30; pin.Padding = new Thickness(7); if (task.Pinned) ((Glyph)pin.Content).Foreground = Ui.Brush("Accent"); Grid.SetColumn(pin, 2); row.Children.Add(pin);
      var delete = Ui.IconButton("trash", "taskDelete", () => model.DeleteTask(task.Id)); delete.Width = delete.Height = 30; delete.Padding = new Thickness(7); Grid.SetColumn(delete, 3); row.Children.Add(delete); root.Children.Add(row);
    }
    if (model.Tasks.Count == 0) { var empty = Ui.Label("taskEmpty", 12, "Muted"); empty.Margin = new Thickness(0, 5, 0, 16); root.Children.Add(empty); }
    var inputRow = new Grid(); inputRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) }); inputRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(45) });
    var input = Ui.Input("taskPlaceholder", "TaskInput"); input.FontSize = 12; input.Padding = new Thickness(11, 8, 11, 8); inputRow.Children.Add(input);
    void Add() { model.AddTask(input.Text); input.Clear(); }
    input.KeyDown += (_, e) => { if (e.Key == Key.Enter) { Add(); e.Handled = true; } };
    var add = Ui.IconButton("plus", "taskAdd", Add); add.Margin = new Thickness(5, 0, 0, 0); add.Width = add.Height = 36; Grid.SetColumn(add, 1); inputRow.Children.Add(add); root.Children.Add(inputRow); return root;
  }
}
