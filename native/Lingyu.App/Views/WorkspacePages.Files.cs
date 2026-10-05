/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WorkspacePages.Files.cs @description 拖放真实文件引用，不搬移或删除原文件。 @author 灵屿
 */
using System.Collections.Specialized;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using Lingyu.App.Localization;
using Lingyu.App.Models;

namespace Lingyu.App.Views;

internal static partial class WorkspacePages
{
  /// <summary>实际文件拖放、打开、定位和复制。</summary>
  public static UIElement Files(SessionModel model)
  {
    var root = new StackPanel { AllowDrop = true }; root.Children.Add(Ui.Header("filesHeading", "filesSubtitle"));
    root.DragOver += (_, e) => { e.Effects = e.Data.GetDataPresent(DataFormats.FileDrop) ? DragDropEffects.Link : DragDropEffects.None; e.Handled = true; };
    root.Drop += (_, e) => { if (e.Data.GetData(DataFormats.FileDrop) is string[] paths) model.AddFiles(paths); e.Handled = true; };
    var drop = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 15, 0, 15) }; drop.Children.Add(Ui.Icon("folder", 34, "Accent")); var label = Ui.Label("fileDrop", 20); label.Margin = new Thickness(0, 15, 0, 8); drop.Children.Add(label); drop.Children.Add(Ui.Label("fileDropHint", 12, "Muted"));
    var pick = Ui.Button(TextCatalog.T("fileAdd"), () => { var dialog = new Microsoft.Win32.OpenFileDialog { Multiselect = true, Title = TextCatalog.T("fileAdd") }; if (dialog.ShowDialog() == true) model.AddFiles(dialog.FileNames); }); pick.HorizontalAlignment = HorizontalAlignment.Center; pick.Margin = new Thickness(0, 20, 0, 0); drop.Children.Add(pick); var dropSurface = Ui.Surface(drop); dropSurface.Margin = new Thickness(0, 0, 0, 22); root.Children.Add(dropSurface);
    var items = new StackPanel(); root.Children.Add(items);
    void Draw()
    {
    items.Children.Clear();
    foreach (string path in model.Files)
    {
      bool exists = File.Exists(path); var row = new Grid { Margin = new Thickness(0, 0, 0, 9) }; row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(44) }); row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) }); row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
      row.Children.Add(Ui.Icon("note", 25, "Accent")); var info = new StackPanel { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 10, 0) }; info.Children.Add(new TextBlock { Text = Path.GetFileName(path), FontSize = 13, TextTrimming = TextTrimming.CharacterEllipsis, ToolTip = path }); info.Children.Add(new TextBlock { Text = exists ? path : TextCatalog.T("fileMissing"), FontSize = 10, Foreground = Ui.Brush("Muted"), TextTrimming = TextTrimming.CharacterEllipsis }); Grid.SetColumn(info, 1); row.Children.Add(info);
      var actions = new StackPanel { Orientation = Orientation.Horizontal };
      void TryAction(Action action) { try { action(); } catch (Exception error) when (error is IOException or System.ComponentModel.Win32Exception or System.Runtime.InteropServices.COMException) { model.Emit("operationFailed"); } }
      var open = Ui.IconButton("arrow", "fileOpen", () => TryAction(() => Process.Start(new ProcessStartInfo(path) { UseShellExecute = true }))); open.IsEnabled = exists; actions.Children.Add(open);
      var locate = Ui.IconButton("folder", "fileLocate", () => TryAction(() => { var command = new ProcessStartInfo("explorer.exe") { UseShellExecute = false }; command.ArgumentList.Add("/select," + path); Process.Start(command); })); locate.IsEnabled = exists; actions.Children.Add(locate);
      var copy = Ui.IconButton("copy", "fileCopy", () => TryAction(() => { var paths = new StringCollection { path }; Clipboard.SetFileDropList(paths); })); copy.IsEnabled = exists; actions.Children.Add(copy);
      actions.Children.Add(Ui.IconButton("trash", "fileRemove", () => model.RemoveFile(path))); Grid.SetColumn(actions, 2); row.Children.Add(actions); items.Children.Add(Ui.Surface(row, new Thickness(15, 11, 12, 11)));
    }
    if (model.Files.Count == 0) items.Children.Add(Ui.Label("fileEmpty", 13, "Muted"));
    }
    void Changed(ChangeArea area) { if (area == ChangeArea.Files) Draw(); }
    root.Loaded += (_, _) => { model.StructureChanged += Changed; Draw(); }; root.Unloaded += (_, _) => model.StructureChanged -= Changed; Draw();
    return Ui.Scroll(root);
  }
}
