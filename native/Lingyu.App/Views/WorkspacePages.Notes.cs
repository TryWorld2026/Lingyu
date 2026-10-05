/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WorkspacePages.Notes.cs @description 按需加载、延迟保存的实际笔记编辑器。 @author 灵屿
 */
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using Lingyu.App.Localization;
using Lingyu.App.Models;

namespace Lingyu.App.Views;

internal static partial class WorkspacePages
{
  /// <summary>编辑后自动保存，离开页面时立即写入。</summary>
  public static UIElement Notes(SessionModel model, Action<Action> setFlush)
  {
    var root = new Grid(); root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); root.Children.Add(Ui.Header("notesHeading", "notesSubtitle"));
    var body = new Grid { MinHeight = 360 }; body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(190) }); body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) }); body.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); body.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); Grid.SetRow(body, 1); root.Children.Add(body);
    var list = new StackPanel(); var listScroll = Ui.Scroll(list); listScroll.Margin = new Thickness(0, 0, 20, 0); body.Children.Add(listScroll);
    var editor = new Grid(); editor.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); editor.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); editor.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
    var title = Ui.Input("noteTitle", "NoteTitle"); title.FontSize = 20; title.FontWeight = FontWeights.SemiBold; title.TextWrapping = TextWrapping.Wrap; title.Background = System.Windows.Media.Brushes.Transparent; title.BorderThickness = new Thickness(0); title.Margin = new Thickness(0, 0, 0, 12); editor.Children.Add(title);
    var text = Ui.Input("noteBody", "NoteBody"); text.AcceptsReturn = true; text.TextWrapping = TextWrapping.Wrap; text.VerticalScrollBarVisibility = ScrollBarVisibility.Auto; text.FontSize = 14; text.Padding = new Thickness(18); Grid.SetRow(text, 1); editor.Children.Add(text);
    var footer = new DockPanel { Margin = new Thickness(0, 10, 0, 0) }; var status = Ui.Label("noteEmpty", 11, "Muted"); footer.Children.Add(status);
    Guid? selected = null; bool loading = false; bool dirty = false;
    var delay = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(650) };
    void RefreshList()
    {
      list.Children.Clear(); var add = Ui.Button(TextCatalog.T("noteNew"), () => { Save(); Select(null); }, "Primary"); add.Margin = new Thickness(0, 0, 0, 16); list.Children.Add(add);
      foreach (var note in model.Notes)
      {
        var label = new TextBlock { Text = string.IsNullOrWhiteSpace(note.Title) ? TextCatalog.T("noteTitle") : note.Title, FontSize = 12, TextWrapping = TextWrapping.Wrap };
        var button = Ui.Button(label, () => { Save(); Select(note.Id); }, "NavButton"); if (selected == note.Id) button.Background = Ui.Brush("Surface"); list.Children.Add(button);
      }
    }
    void Save()
    {
      delay.Stop(); if (loading || !dirty) return;
      if (string.IsNullOrWhiteSpace(title.Text) && string.IsNullOrWhiteSpace(text.Text)) return;
      selected = model.SaveNote(selected, title.Text, text.Text); dirty = false; status.Text = TextCatalog.T("saved"); RefreshList();
    }
    void Select(Guid? id)
    {
      loading = true; selected = id; var note = model.Notes.FirstOrDefault(value => value.Id == id);
      title.Text = note?.Title ?? ""; text.Text = note?.Body ?? ""; dirty = false; loading = false;
      status.Text = TextCatalog.T(note is null ? "noteEmpty" : "saved"); RefreshList();
    }
    var delete = Ui.IconButton("trash", "noteDelete", () => { delay.Stop(); dirty = false; var id = selected; selected = null; if (id is not null) model.DeleteNote(id.Value); Select(null); });
    delete.HorizontalAlignment = HorizontalAlignment.Right; DockPanel.SetDock(delete, Dock.Right); footer.Children.Insert(0, delete); Grid.SetRow(footer, 2); editor.Children.Add(footer);
    var surface = Ui.Surface(editor, new Thickness(19)); Grid.SetColumn(surface, 1); body.Children.Add(surface);
    Grid.SetRowSpan(listScroll, 2); Grid.SetRowSpan(surface, 2); bool stacked = false;
    body.SizeChanged += (_, e) => {
      bool next = e.NewSize.Width < 600; if (next == stacked) return; stacked = next;
      Grid.SetColumnSpan(listScroll, stacked ? 2 : 1); Grid.SetColumnSpan(surface, stacked ? 2 : 1); Grid.SetColumn(surface, stacked ? 0 : 1);
      Grid.SetRow(surface, stacked ? 1 : 0); Grid.SetRowSpan(listScroll, stacked ? 1 : 2); Grid.SetRowSpan(surface, stacked ? 1 : 2);
      listScroll.Height = stacked ? 110 : double.NaN; listScroll.Margin = stacked ? new Thickness(0, 0, 0, 16) : new Thickness(0, 0, 20, 0);
      surface.MinHeight = stacked ? 300 : 0; body.MinHeight = stacked ? 426 : 360;
    };
    title.TextChanged += (_, _) => { if (loading) return; dirty = true; delay.Stop(); delay.Start(); };
    text.TextChanged += (_, _) => { if (loading) return; dirty = true; delay.Stop(); delay.Start(); };
    void Changed(ChangeArea area)
    {
      if (area != ChangeArea.Notes) return;
      if (selected is { } id && !model.Notes.Any(note => note.Id == id)) Select(null); else RefreshList();
    }
    root.Loaded += (_, _) => model.StructureChanged += Changed;
    delay.Tick += (_, _) => Save(); root.Unloaded += (_, _) => { model.StructureChanged -= Changed; Save(); delay.Stop(); };
    setFlush(Save); Select(model.Notes.FirstOrDefault()?.Id); return Ui.Scroll(root);
  }
}
