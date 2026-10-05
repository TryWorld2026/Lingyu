# 灵屿 Lingyu · Copyright (C) 2026 TryWorld2026 · GPL-3.0
# @file build-preview.ps1 @description 构建可独立运行的原生 Windows 预览。 @author 灵屿
param([string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Push-Location -LiteralPath $projectRoot
try {
  $version = ([xml](Get-Content -LiteralPath 'native/Directory.Build.props' -Raw)).Project.PropertyGroup.Version
  if ([string]::IsNullOrWhiteSpace($OutputDirectory)) { $OutputDirectory = "dist/native-preview/$version/app" }
  $outputPath = [IO.Path]::GetFullPath($OutputDirectory, $projectRoot)
  dotnet run --project native/Lingyu.Tests/Lingyu.Tests.csproj -c Release
  if ($LASTEXITCODE -ne 0) { throw 'Core verification failed' }
  dotnet publish native/Lingyu.App/Lingyu.App.csproj -c Release -r win-x64 --self-contained true -p:PublishReadyToRun=true -o $outputPath --nologo
  if ($LASTEXITCODE -ne 0) { throw 'Native publish failed' }
  Copy-Item -LiteralPath 'LICENSE' -Destination (Join-Path $outputPath 'LICENSE') -Force
  $previewReadme = (Get-Content -LiteralPath 'native/README.md' -Raw).Replace('../docs/', 'docs/')
  Set-Content -LiteralPath (Join-Path $outputPath 'README.md') -Value $previewReadme -Encoding utf8
  $docsDirectory = Join-Path $outputPath 'docs'
  $imagesDirectory = Join-Path $docsDirectory 'images'
  New-Item -ItemType Directory -Path $imagesDirectory -Force | Out-Null
  $documents = @([regex]::Matches($previewReadme, '\]\(docs/([^)]+\.md)\)') | ForEach-Object { $_.Groups[1].Value }) + @('LUMA_BAR_REFERENCE.md')
  foreach ($document in ($documents | Select-Object -Unique)) {
    $source = Join-Path (Join-Path $projectRoot 'docs') $document
    $body = Get-Content -LiteralPath $source -Raw
    # 验收图片随包复制，解压后不再依赖开发机上的绝对路径。
    foreach ($match in [regex]::Matches($body, '!\[[^\]]*\]\(([^)]+)\)')) {
      $image = $match.Groups[1].Value
      if ($image -match '^https?://') { continue }
      $imagePath = if ([IO.Path]::IsPathRooted($image)) { $image } else { Join-Path (Split-Path $source -Parent) $image }
      $imageName = [IO.Path]::GetFileNameWithoutExtension($document) + '-' + [IO.Path]::GetFileName($imagePath)
      Copy-Item -LiteralPath $imagePath -Destination (Join-Path $imagesDirectory $imageName) -Force
      $body = $body.Replace('](' + $image + ')', '](images/' + $imageName + ')')
    }
    Set-Content -LiteralPath (Join-Path $docsDirectory $document) -Value $body -Encoding utf8
  }
  $licenseDirectory = Join-Path $outputPath 'Assets/Fonts'
  New-Item -ItemType Directory -Path $licenseDirectory -Force | Out-Null
  foreach ($fontLicense in @('Manrope-OFL.txt', 'NotoSansSC-OFL.txt')) {
    Copy-Item -LiteralPath (Join-Path 'native/Lingyu.App/Assets/Fonts' $fontLicense) -Destination $licenseDirectory -Force
  }
  Set-Content -LiteralPath (Join-Path $outputPath 'Open-workspace.cmd') -Encoding ascii -Value '@echo off', 'start "" "%~dp0Lingyu.Native.exe" --workspace'
  Set-Content -LiteralPath (Join-Path $outputPath 'Open-visual-sample.cmd') -Encoding ascii -Value '@echo off', 'start "" "%~dp0Lingyu.Native.exe" --workspace --showcase'
  Write-Output "Preview ready: $outputPath"
} finally { Pop-Location }
