/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file MediaSeekBar.cs @description 工作台的真实跳转、能力说明与拖动保护。 @author 灵屿
 */
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using Lingyu.App.Models;
using Lingyu.App.Views;

namespace Lingyu.App.Controls;

/// <summary>只依据播放器提供的时间轴显示进度，不用模拟时间填补缺失能力。</summary>
public sealed class MediaSeekBar : Grid
{
  private readonly SessionModel model;
  private readonly Slider slider;
  private readonly DockPanel times;
  private readonly TextBlock hint;
  private bool holding;
  /// <summary>输入捕获期间暂停绑定，松手后发送实际请求并恢复同步。</summary>
  public MediaSeekBar(SessionModel session)
  {
    model = session; DataContext = model;
    RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
    slider = new Slider { Minimum = 0, Maximum = 100, IsMoveToPointEnabled = true };
    slider.SetValue(System.Windows.Automation.AutomationProperties.AutomationIdProperty, "WorkspaceMediaSeek");
    slider.SetValue(System.Windows.Automation.AutomationProperties.NameProperty, Localization.TextCatalog.T("mediaSeek"));
    slider.SetBinding(IsEnabledProperty, "CanSeek"); slider.SetBinding(ToolTipProperty, "MediaSeekHint");
    ToolTipService.SetShowOnDisabled(slider, true); BindProgress(); Children.Add(slider);
    times = new DockPanel(); var duration = Ui.BoundText("MediaDuration", 10, "Muted"); DockPanel.SetDock(duration, Dock.Right); times.Children.Add(duration); times.Children.Add(Ui.BoundText("MediaTime", 10, "Muted")); SetRow(times, 1); Children.Add(times);
    hint = Ui.BoundText("MediaSeekHint", 10, "Muted"); hint.TextWrapping = TextWrapping.Wrap; SetRow(hint, 1); Children.Add(hint);
    slider.GotMouseCapture += Begin; slider.LostMouseCapture += End;
    slider.PreviewKeyDown += (_, e) => { if (IsSeekKey(e.Key)) Begin(slider, e); };
    slider.PreviewKeyUp += (_, e) => { if (IsSeekKey(e.Key)) End(slider, e); };
    Loaded += (_, _) => { model.PropertyChanged += Changed; DrawAvailability(); };
    Unloaded += (_, _) => model.PropertyChanged -= Changed;
    DrawAvailability();
  }
  private static bool IsSeekKey(Key key) => key is Key.Left or Key.Right or Key.Up or Key.Down or Key.Home or Key.End or Key.PageUp or Key.PageDown;
  private void BindProgress() => slider.SetBinding(Slider.ValueProperty, new Binding(nameof(SessionModel.MediaProgress)) { Mode = BindingMode.OneWay });
  private void Begin(object sender, InputEventArgs e)
  {
    if (holding || !slider.IsEnabled) return;
    double value = slider.Value; holding = true; BindingOperations.ClearBinding(slider, Slider.ValueProperty); slider.Value = value;
  }
  private async void End(object sender, InputEventArgs e)
  {
    if (!holding || slider.IsMouseCaptureWithin) return;
    double value = slider.Value / 100;
    try { await model.MediaActionAsync("seek", value); }
    finally { holding = false; BindProgress(); }
  }
  private void Changed(object? sender, PropertyChangedEventArgs e)
  { if (e.PropertyName is nameof(SessionModel.HasTimeline) or nameof(SessionModel.CanSeek)) DrawAvailability(); }
  private void DrawAvailability()
  {
    times.Visibility = model.HasTimeline ? Visibility.Visible : Visibility.Collapsed;
    hint.Visibility = !model.HasTimeline || !model.CanSeek ? Visibility.Visible : Visibility.Collapsed;
    if (model.HasTimeline && !model.CanSeek) { SetRow(hint, 2); if (RowDefinitions.Count == 2) RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); }
    else SetRow(hint, 1);
  }
}
