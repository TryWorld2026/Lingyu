/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file App.xaml.cs @description 独立的原生预览入口和窗口生命周期。 @author 灵屿
 */
using System.IO;
using System.Windows;
using System.Windows.Threading;
using Lingyu.App.Localization;
using Lingyu.App.Models;
using Lingyu.App.Windows;
using Lingyu.Platform.Windows;

namespace Lingyu.App;

/// <summary>仅按需创建工作台，不保留隐藏窗口的视觉树。</summary>
public partial class App : System.Windows.Application
{
  private SessionModel? model;
  private IslandWindow? island;
  private WorkspaceWindow? workspace;
  private System.Windows.Forms.NotifyIcon? tray;
  private readonly DispatcherTimer timer = new() { Interval = TimeSpan.FromSeconds(1) };
  private Mutex? singleInstance;
  private WindowEnvironment? environment;
  /// <summary>建立隔离数据目录并启动真实原生窗口。</summary>
  protected override async void OnStartup(StartupEventArgs e)
  {
    base.OnStartup(e);
    if (!e.Args.Contains("--hardware-render")) System.Windows.Media.RenderOptions.ProcessRenderMode = System.Windows.Interop.RenderMode.SoftwareOnly;
    string? Value(string name) { int index = Array.IndexOf(e.Args, name); return index >= 0 && index + 1 < e.Args.Length ? e.Args[index + 1] : null; }
    bool frameOnly = e.Args.Contains("--verify-frame");
    bool verification = e.Args.Contains("--verify") || frameOnly;
    singleInstance = new Mutex(true, verification ? "Lingyu.Native.Verification" : "Lingyu.Native.Preview", out bool acquired);
    if (!acquired) { Shutdown(2); return; }
    string data = Value("--data-dir") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Lingyu", "NativePreview");
    Directory.CreateDirectory(data);
    DispatcherUnhandledException += (_, args) => {
      File.AppendAllText(Path.Combine(data, "startup-errors.log"), args.Exception.ToString() + Environment.NewLine);
      args.Handled = true; Shutdown(1);
    };
    model = new SessionModel(data, e.Args.Contains("--showcase"), Value("--language"));
    island = new IslandWindow(model, OpenWorkspace);
    island.Show();
    if (e.Args.Contains("--workspace")) OpenWorkspace("today");
    if (!verification)
    {
      CreateTray(); environment = new WindowEnvironment(Dispatcher);
      environment.FullScreenChanged += fullscreen => { if (fullscreen) island.Hide(); else if (!island.IsVisible) island.Show(); };
    }
    timer.Tick += (_, _) => model.Tick(); timer.Start();
    await model.StartAsync();
    if (verification)
      await Verification.NativeChecks.RunAsync(this, model, island, OpenWorkspace, () => workspace,
        Value("--output") ?? Path.Combine(data, "verification"), !e.Args.Contains("--no-capture"), frameOnly);
  }
  /// <summary>打开指定页面；关闭后的工作台重新建立，不重复后台服务。</summary>
  public void OpenWorkspace(string page)
  {
    if (model is null) return;
    if (workspace is null)
    {
      workspace = new WorkspaceWindow(model, () => { island?.Show(); island?.Collapse(); });
      workspace.Closed += (_, _) => workspace = null;
    }
    workspace.Navigate(page);
    workspace.Show();
    if (workspace.WindowState == WindowState.Minimized) workspace.WindowState = WindowState.Normal;
    workspace.Activate();
  }
  private void CreateTray()
  {
    tray = new System.Windows.Forms.NotifyIcon { Icon = new System.Drawing.Icon(Path.Combine(AppContext.BaseDirectory, "Assets", "lingyu.ico")), Text = TextCatalog.T("brand"), Visible = true };
    var menu = new System.Windows.Forms.ContextMenuStrip();
    menu.Items.Add(TextCatalog.T("openWorkspace"), null, (_, _) => OpenWorkspace("today"));
    menu.Items.Add(TextCatalog.T("showIsland"), null, (_, _) => { island?.Show(); island?.Collapse(); });
    menu.Items.Add(new System.Windows.Forms.ToolStripSeparator());
    menu.Items.Add(TextCatalog.T("quit"), null, (_, _) => Shutdown());
    tray.ContextMenuStrip = menu;
    tray.DoubleClick += (_, _) => OpenWorkspace("today");
    TextCatalog.Current.PropertyChanged += TrayLanguageChanged;
  }
  private void TrayLanguageChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
  {
    if (e.PropertyName != nameof(TextCatalog.Language) || tray?.ContextMenuStrip is not { } menu) return;
    menu.Items[0].Text = TextCatalog.T("openWorkspace"); menu.Items[1].Text = TextCatalog.T("showIsland"); menu.Items[3].Text = TextCatalog.T("quit");
  }
  /// <summary>退出时解除计时、托盘、窗口与系统订阅。</summary>
  protected override void OnExit(ExitEventArgs e)
  {
    timer.Stop(); environment?.Dispose(); workspace?.Close(); island?.Close();
    TextCatalog.Current.PropertyChanged -= TrayLanguageChanged;
    tray?.Icon?.Dispose(); tray?.ContextMenuStrip?.Dispose(); tray?.Dispose(); model?.Dispose(); singleInstance?.Dispose();
    base.OnExit(e);
  }
}
