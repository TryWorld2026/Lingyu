/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file WorkspacePages.Ai.cs @description 按原型构建的实际流式对话与用户预览操作。 @author 灵屿
 */
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.Core;

namespace Lingyu.App.Views;

internal static partial class WorkspacePages
{
  /// <summary>更新正在生成的文字，不为每个 token 重建整张页面。</summary>
  public static UIElement Ai(SessionModel model, Action<string> navigate)
  {
    var root = new Grid(); root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
    var header = new DockPanel { Margin = new Thickness(0, 0, 0, 20) }; var actions = new StackPanel { Orientation = Orientation.Horizontal }; actions.Children.Add(Ui.IconButton("plus", "aiNew", model.NewChat)); actions.Children.Add(Ui.IconButton("trash", "aiDelete", model.DeleteChat)); actions.Children.Add(Ui.IconButton("settings", "aiConfigure", () => navigate("settings"))); DockPanel.SetDock(actions, Dock.Right); header.Children.Add(actions);
    var title = new StackPanel(); var heading = Ui.Label("ai", 20); heading.FontWeight = FontWeights.SemiBold; title.Children.Add(heading); title.Children.Add(new TextBlock { Text = model.Connection?.Model ?? TextCatalog.T("aiSubtitle"), FontSize = 11, Foreground = Ui.Brush("Muted"), Margin = new Thickness(0, 7, 0, 0) }); header.Children.Add(title); root.Children.Add(header);
    var messages = new StackPanel { Margin = new Thickness(0, 7, 7, 10) }; var scroll = Ui.Scroll(messages); Grid.SetRow(scroll, 1); root.Children.Add(scroll);
    var compose = new Grid(); compose.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) }); compose.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(54) }); var input = Ui.Input("aiInput", "AiInput"); input.AcceptsReturn = true; input.TextWrapping = TextWrapping.Wrap; input.MinHeight = 49; input.MaxHeight = 120; input.VerticalScrollBarVisibility = ScrollBarVisibility.Auto; compose.Children.Add(input);
    var send = Ui.IconButton("send", "aiSend", () => { }, "RoundButton"); send.Width = send.Height = 42; send.Margin = new Thickness(12, 0, 0, 0); send.Background = Ui.Brush("Accent"); ((Controls.Glyph)send.Content).Foreground = Ui.Brush("Surface"); Grid.SetColumn(send, 1); compose.Children.Add(send);
    var footer = new StackPanel { Margin = new Thickness(0, 17, 0, 0) }; footer.Children.Add(compose); var cost = Ui.Label("aiCost", 10, "Muted"); cost.Margin = new Thickness(0, 11, 0, 0); footer.Children.Add(cost); Grid.SetRow(footer, 2); root.Children.Add(footer);
    int renderedCount = -1; Guid? renderedId = null; TextBlock? lastReply = null; bool wasGenerating = model.IsGenerating;
    void Draw()
    {
      var conversation = model.CurrentChat;
      if (wasGenerating && !model.IsGenerating) renderedCount = -1;
      wasGenerating = model.IsGenerating;
      var history = conversation?.Messages ?? (model.Showcase ? new List<ChatMessage> { new("user", TextCatalog.T("demoQuestion")), new("assistant", TextCatalog.T("demoAnswer")) } : []);
      if (renderedId != conversation?.Id || renderedCount != history.Count)
      {
        messages.Children.Clear(); renderedId = conversation?.Id; renderedCount = history.Count; lastReply = null;
        if (history.Count == 0)
        {
          var empty = new StackPanel { Margin = new Thickness(20, 70, 20, 0), HorizontalAlignment = HorizontalAlignment.Center }; empty.Children.Add(Ui.Icon("ai", 48, "Accent")); var greeting = Ui.Label("aiHeading", 28); greeting.Margin = new Thickness(0, 24, 0, 12); empty.Children.Add(greeting); empty.Children.Add(Ui.Label("aiEmptyHint", 13, "Muted")); var configure = Ui.Button(TextCatalog.T("aiConfigure"), () => navigate("settings")); configure.Margin = new Thickness(0, 22, 0, 0); configure.HorizontalAlignment = HorizontalAlignment.Center; empty.Children.Add(configure); messages.Children.Add(empty);
        }
        foreach (var message in history)
        {
          bool assistant = message.Role == "assistant"; var row = new Grid { Margin = new Thickness(0, 0, 0, 20) }; row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(assistant ? 44 : 0) }); row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
          if (assistant) { var icon = Ui.Icon("ai", 26, "Accent"); icon.VerticalAlignment = VerticalAlignment.Top; icon.Margin = new Thickness(0, 12, 0, 0); row.Children.Add(icon); }
          var content = new StackPanel(); var text = new TextBlock { Text = message.Content.Length == 0 ? TextCatalog.T("aiThinking") : message.Content, FontSize = 14, TextWrapping = TextWrapping.Wrap, LineHeight = 26 }; content.Children.Add(text); if (assistant) lastReply = text;
          if (assistant && message.Content.Length > 0)
          {
            var tools = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 10, 0, 0) };
            tools.Children.Add(Ui.IconButton("copy", "aiCopy", () => { try { Clipboard.SetText(text.Text); } catch (System.Runtime.InteropServices.COMException) { model.Emit("operationFailed"); } }));
            tools.Children.Add(Ui.IconButton("note", "aiToNote", () => { model.SaveNote(null, conversation?.Title ?? TextCatalog.T("ai"), text.Text); model.Emit("saved"); }));
            tools.Children.Add(Ui.IconButton("check", "aiToTask", () => TaskDraft(model, text.Text))); content.Children.Add(tools);
          }
          var bubble = Ui.Surface(content, new Thickness(20, 14, 20, 14)); bubble.MaxWidth = 670; bubble.HorizontalAlignment = assistant ? HorizontalAlignment.Stretch : HorizontalAlignment.Right; if (!assistant) bubble.Background = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(37, 37, 44)); Grid.SetColumn(bubble, 1); row.Children.Add(bubble); messages.Children.Add(row);
        }
        if (model.Showcase) scroll.ScrollToTop(); else scroll.ScrollToEnd();
      }
      else if (lastReply is not null && history.LastOrDefault()?.Role == "assistant") { lastReply.Text = string.IsNullOrEmpty(history[^1].Content) ? TextCatalog.T("aiThinking") : history[^1].Content; scroll.ScrollToEnd(); }
      ((Controls.Glyph)send.Content).Kind = model.IsGenerating ? "stop" : "send";
      send.ToolTip = TextCatalog.T(model.IsGenerating ? "aiStop" : "aiSend"); input.IsEnabled = !model.IsGenerating;
    }
    void Send()
    {
      if (model.IsGenerating) { model.StopChat(); return; }
      string question = input.Text; if (string.IsNullOrWhiteSpace(question)) return;
      if (model.Connection is null) { model.Emit("aiNotConnected"); navigate("settings"); return; }
      input.Clear(); _ = model.SendChatAsync(question);
    }
    send.Click += (_, _) => Send(); input.KeyDown += (_, e) => { if (e.Key == Key.Enter && !Keyboard.Modifiers.HasFlag(ModifierKeys.Shift)) { Send(); e.Handled = true; } };
    model.ChatChanged += Draw; root.Unloaded += (_, _) => model.ChatChanged -= Draw; Draw(); return root;
  }
  private static void TaskDraft(SessionModel model, string text)
  {
    var content = new StackPanel(); content.Children.Add(Ui.Label("aiTaskReview", 12, "Muted")); var input = Ui.Input("taskPlaceholder", "AiTaskDraft"); input.Text = text; input.AcceptsReturn = true; input.TextWrapping = TextWrapping.Wrap; input.Height = 210; input.VerticalScrollBarVisibility = ScrollBarVisibility.Auto; input.Margin = new Thickness(0, 15, 0, 18); content.Children.Add(input);
    var dialog = new Window { Title = TextCatalog.T("aiToTask"), Width = 520, Height = 370, Background = Ui.Brush("Surface"), Foreground = Ui.Brush("Ink"), FontFamily = (System.Windows.Media.FontFamily)System.Windows.Application.Current.FindResource("UiFont"), Owner = System.Windows.Application.Current.Windows.OfType<Windows.WorkspaceWindow>().FirstOrDefault(), WindowStartupLocation = WindowStartupLocation.CenterOwner, ResizeMode = ResizeMode.NoResize };
    var button = Ui.Button(TextCatalog.T("taskAdd"), () => { model.AddTask(input.Text); dialog.Close(); }, "Primary"); content.Children.Add(button); dialog.Content = new Border { Padding = new Thickness(24), Child = content }; dialog.ShowDialog();
  }
}
