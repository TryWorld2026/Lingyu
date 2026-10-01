# 灵屿 Lingyu · Copyright (C) 2026 TryWorld2026 · GPL-3.0
# @file build-preview.ps1 @description 构建可独立运行的原生 Windows 预览。 @author 灵屿
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Push-Location -LiteralPath $projectRoot
try {
  dotnet run --project native/Lingyu.Tests/Lingyu.Tests.csproj -c Release
  if ($LASTEXITCODE -ne 0) { throw 'Core verification failed' }
  dotnet publish native/Lingyu.App/Lingyu.App.csproj -c Release -r win-x64 --self-contained true -p:PublishReadyToRun=true -o dist/native-preview/app --nologo
  if ($LASTEXITCODE -ne 0) { throw 'Native publish failed' }
  Copy-Item -LiteralPath 'LICENSE' -Destination 'dist/native-preview/app/LICENSE' -Force
  $previewReadme = (Get-Content -LiteralPath 'native/README.md' -Raw).Replace('../docs/NATIVE_PREVIEW_VERIFICATION_2026-10-02.md', 'NATIVE_PREVIEW_VERIFICATION_2026-10-02.md')
  Set-Content -LiteralPath 'dist/native-preview/app/README.md' -Value $previewReadme -Encoding utf8
  Copy-Item -LiteralPath 'docs/NATIVE_PREVIEW_VERIFICATION_2026-10-02.md' -Destination 'dist/native-preview/app/' -Force
  $licenseDirectory = 'dist/native-preview/app/Assets/Fonts'
  New-Item -ItemType Directory -Path $licenseDirectory -Force | Out-Null
  foreach ($fontLicense in @('Manrope-OFL.txt', 'NotoSansSC-OFL.txt')) {
    Copy-Item -LiteralPath (Join-Path 'native/Lingyu.App/Assets/Fonts' $fontLicense) -Destination $licenseDirectory -Force
  }
  Set-Content -LiteralPath 'dist/native-preview/app/Open-workspace.cmd' -Encoding ascii -Value '@echo off', 'start "" "%~dp0Lingyu.Native.exe" --workspace'
  Set-Content -LiteralPath 'dist/native-preview/app/Open-visual-sample.cmd' -Encoding ascii -Value '@echo off', 'start "" "%~dp0Lingyu.Native.exe" --workspace --showcase'
} finally { Pop-Location }
