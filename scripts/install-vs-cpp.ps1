$setup = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\setup.exe'
$argStr = 'modify --installPath "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools" --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet --norestart'
$p = Start-Process -FilePath $setup -ArgumentList $argStr -Verb RunAs -Wait -PassThru
Write-Output ("VS_SETUP_EXIT=" + $p.ExitCode)
