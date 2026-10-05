/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file MarkdownBody.cs @description 将 CommonMark 转为原生控件，不执行 HTML 或下载远程图片。 @author 灵屿
 */
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using Lingyu.App.Localization;
using Lingyu.App.Views;
using Markdig;
using Markdig.Syntax;
using Markdig.Syntax.Inlines;
using MarkdownInline = Markdig.Syntax.Inlines.Inline;

namespace Lingyu.App.Controls;

/// <summary>完成的回复使用原生段落、列表和可复制代码；流式期间只更新文字。</summary>
public sealed class MarkdownBody : StackPanel
{
  private static readonly MarkdownPipeline Pipeline = new MarkdownPipelineBuilder().DisableHtml().Build();
  /// <summary>解析用户可见文本，不使用 WebView 或脚本。</summary>
  public MarkdownBody(string markdown) { RenderBlocks(Markdown.Parse(markdown, Pipeline), this); }
  private static void RenderBlocks(ContainerBlock blocks, Panel target)
  {
    foreach (var block in blocks)
    {
      if (block is CodeBlock code)
      {
        string content = code.Lines.ToString();
        var body = new StackPanel();
        var copy = Ui.Button(TextCatalog.T("codeCopy"), () => { });
        copy.Click += (_, _) => { try { Clipboard.SetText(content); copy.Content = TextCatalog.T("copied"); } catch (System.Runtime.InteropServices.COMException) { copy.Content = TextCatalog.T("operationFailed"); } };
        copy.HorizontalAlignment = HorizontalAlignment.Right; copy.Padding = new Thickness(10, 5, 10, 5); body.Children.Add(copy);
        body.Children.Add(new TextBox { Text = content, IsReadOnly = true, AcceptsReturn = true, FontFamily = new FontFamily("Consolas"),
          FontSize = 12, Background = Brushes.Transparent, Foreground = Ui.Brush("Ink"), BorderThickness = new Thickness(0),
          TextWrapping = TextWrapping.NoWrap, HorizontalScrollBarVisibility = ScrollBarVisibility.Auto, Padding = new Thickness(0, 10, 0, 0) });
        var surface = Ui.Surface(body, new Thickness(14)); surface.Margin = new Thickness(0, 5, 0, 13); target.Children.Add(surface);
      }
      else if (block is ListBlock list)
      {
        int counter = int.TryParse(list.OrderedStart, out int start) ? start : 1;
        foreach (var item in list.OfType<ListItemBlock>())
        {
          var row = new Grid { Margin = new Thickness(0, 2, 0, 0) };
          row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(26) }); row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
          row.Children.Add(new TextBlock { Text = list.IsOrdered ? counter++ + "." : "•", FontSize = 14, Foreground = Ui.Brush("Muted"), Margin = new Thickness(0, 3, 0, 0) });
          var content = new StackPanel(); RenderBlocks(item, content); Grid.SetColumn(content, 1); row.Children.Add(content); target.Children.Add(row);
        }
      }
      else if (block is QuoteBlock quote)
      {
        var content = new StackPanel(); RenderBlocks(quote, content);
        target.Children.Add(new Border { BorderBrush = Ui.Brush("Accent"), BorderThickness = new Thickness(2, 0, 0, 0), Padding = new Thickness(14, 0, 0, 0), Margin = new Thickness(0, 8, 0, 12), Child = content });
      }
      else if (block is LeafBlock leaf && leaf.Inline is not null)
      {
        var paragraph = new TextBlock { TextWrapping = TextWrapping.Wrap, FontSize = block is HeadingBlock h ? 25 - h.Level * 2 : 14,
          FontWeight = block is HeadingBlock ? FontWeights.SemiBold : FontWeights.Normal, LineHeight = 25, Margin = new Thickness(0, block is HeadingBlock ? 8 : 0, 0, 11) };
        RenderInlines(leaf.Inline, paragraph.Inlines); target.Children.Add(paragraph);
      }
      else if (block is ThematicBreakBlock)
        target.Children.Add(new Border { Height = 1, Background = Ui.Brush("Line"), Margin = new Thickness(0, 10, 0, 14) });
    }
  }
  private static void RenderInlines(ContainerInline source, InlineCollection output)
  {
    foreach (MarkdownInline inline in source)
    {
      if (inline is LiteralInline literal) output.Add(new Run(literal.Content.ToString()));
      else if (inline is CodeInline code) output.Add(new Run(code.Content) { FontFamily = new FontFamily("Consolas"), Background = Ui.Brush("Line") });
      else if (inline is LineBreakInline) output.Add(new LineBreak());
      else if (inline is EmphasisInline emphasis)
      {
        Span span = emphasis.DelimiterCount >= 2 ? new Bold() : new Italic(); RenderInlines(emphasis, span.Inlines); output.Add(span);
      }
      else if (inline is LinkInline link && !link.IsImage && Uri.TryCreate(link.Url, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http")
      {
        var hyperlink = new Hyperlink { NavigateUri = uri, Foreground = Ui.Brush("Accent") }; RenderInlines(link, hyperlink.Inlines);
        hyperlink.RequestNavigate += (_, e) => {
          try { Process.Start(new ProcessStartInfo(e.Uri.AbsoluteUri) { UseShellExecute = true }); }
          catch (Exception error) when (error is System.ComponentModel.Win32Exception or InvalidOperationException) { hyperlink.ToolTip = TextCatalog.T("operationFailed"); }
          e.Handled = true;
        }; output.Add(hyperlink);
      }
      else if (inline is ContainerInline container) RenderInlines(container, output);
    }
  }
}
