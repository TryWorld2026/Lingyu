/* 灵屿 Lingyu · https://github.com/TryWorld2026/Lingyu
 * Copyright (C) 2026 TryWorld2026. Licensed under GPL-3.0.
 * @file TextCatalog.cs @description 支持运行时语言切换的原生文案目录。 @author 灵屿
 */
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Windows.Data;
using System.Windows.Markup;

namespace Lingyu.App.Localization;

/// <summary>所有产品文字通过同一个已验证的双语目录获得。</summary>
public sealed class TextCatalog : INotifyPropertyChanged
{
  private readonly Dictionary<string, Dictionary<string, string>> catalogs = new();
  /// <summary>界面使用的共享目录。</summary>
  public static TextCatalog Current { get; } = new();
  /// <summary>当前语言。</summary>
  public string Language { get; private set; } = "zh-CN";
  /// <summary>通知文字重新绑定。</summary>
  public event PropertyChangedEventHandler? PropertyChanged;
  /// <summary>读取目录；缺失键属于构建错误，不能静默变成空白。</summary>
  public string this[string key] => catalogs[Language].TryGetValue(key, out string? value)
    ? value : throw new KeyNotFoundException($"Missing translation: {key}");

  /// <summary>加载双语文件并检查键完整性。</summary>
  public void Load(string? language = null)
  {
    foreach (string locale in new[] { "zh-CN", "en-US" })
      catalogs[locale] = JsonSerializer.Deserialize<Dictionary<string, string>>(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "i18n", locale + ".json")))!;
    if (!catalogs["zh-CN"].Keys.ToHashSet().SetEquals(catalogs["en-US"].Keys))
      throw new InvalidDataException("Translation key sets differ");
    SetLanguage(language ?? (CultureInfo.CurrentUICulture.Name.StartsWith("zh", StringComparison.OrdinalIgnoreCase) ? "zh-CN" : "en-US"));
  }

  /// <summary>切换语言并更新已打开的窗口。</summary>
  public void SetLanguage(string language)
  {
    Language = language == "en-US" ? "en-US" : "zh-CN";
    PropertyChanged?.Invoke(this, new PropertyChangedEventArgs("Item[]"));
    PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Language)));
  }

  /// <summary>代码创建控件时使用同一翻译入口。</summary>
  public static string T(string key) => Current[key];
}

/// <summary>XAML 中的本地化绑定，保持语言切换响应。</summary>
[MarkupExtensionReturnType(typeof(string))]
public sealed class L(string key) : MarkupExtension
{
  /// <summary>创建随目录变化而更新的绑定。</summary>
  public override object ProvideValue(IServiceProvider serviceProvider) => new Binding($"[{key}]")
  { Source = TextCatalog.Current, Mode = BindingMode.OneWay }.ProvideValue(serviceProvider);
}
