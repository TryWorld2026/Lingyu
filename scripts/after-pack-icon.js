/**
 * @file after-pack-icon.js
 * @description electron-builder afterPack 钩子：将灵屿产品图标和版本信息写入打包后的 exe。
 * 背景：electron-builder 配置了 signAndEditExecutable=false（避免无签名环境下 winCodeSign
 * 下载/解压失败），导致 exe 图标一直是 Electron 默认图标。此钩子用 resedit（纯 Node，
 * electron-builder 自带依赖）在打包后直接改写 exe 资源，NSIS/Portable 会内嵌修改后的 exe。
 * @author 灵屿
 */

const fs = require('fs');
const path = require('path');
const ResEdit = require('resedit');

const EXE_NAME = 'Lingyu.exe';
const APP_VERSION = '0.1.0';

/**
 * 用 resedit 替换 exe 的图标与版本信息。
 * @param {string} exePath - 待修改的 exe 完整路径
 * @param {string} icoPath - 新的 .ico 完整路径
 * @returns {boolean} 是否成功
 */
function patchExe(exePath, icoPath) {
  if (!fs.existsSync(exePath)) {
    console.error(`[after-pack-icon] exe not found: ${exePath}`);
    return false;
  }
  if (!fs.existsSync(icoPath)) {
    console.error(`[after-pack-icon] ico not found: ${icoPath}`);
    return false;
  }

  const data = fs.readFileSync(exePath);
  const exe = ResEdit.NtExecutable.from(data);
  const res = ResEdit.NtExecutableResource.from(exe);

  // 替换图标：对每个 IconGroupEntry（RT_GROUP_ICON）重写其引用的图标
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  if (groups.length === 0) {
    console.error('[after-pack-icon] no IconGroupEntry found in exe');
    return false;
  }
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
  const icons = iconFile.icons.map((item) => item.data);
  for (const group of groups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      group.id,
      group.lang,
      icons
    );
  }

  // 替换版本信息：先清空旧值（如 GitHub, Inc. / electron.exe 等模板残留），再写入 Lingyu 值
  const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  if (viList.length > 0) {
    const vi = viList[0];
    const [major, minor, patch] = APP_VERSION.split('.').map((n) => parseInt(n, 10) || 0);
    vi.setFileVersion(major, minor, patch, 0, 1033);
    vi.setProductVersion(major, minor, patch, 0, 1033);
    const langs = vi.getAllLanguagesForStringValues();
    for (const lang of langs) {
      vi.removeAllStringValues(lang, false);
    }
    vi.setStringValues(
      { lang: 1033, codepage: 1200 },
      {
        FileDescription: 'Lingyu',
        ProductName: 'Lingyu',
        LegalCopyright: 'Copyright (C) 2026 JNTMTMTM',
      }
    );
    vi.outputToResourceEntries(res.entries);
  }

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`[after-pack-icon] patched: ${path.basename(exePath)}`);
  return true;
}

/**
 * electron-builder afterPack 钩子入口。
 * @param {import('app-builder-lib').AfterPackContext} context
 */
module.exports = async function afterPackIcon(context) {
  const { appOutDir, electronPlatformName } = context;
  if (electronPlatformName !== 'win32') {
    return;
  }

  const exePath = path.join(appOutDir, EXE_NAME);
  const icoPath = path.resolve(__dirname, '..', 'resources', 'icon', 'lingyu_256x256.ico');

  const ok = patchExe(exePath, icoPath);
  if (!ok) {
    console.error('[after-pack-icon] failed to patch exe icon; build continues with default icon');
  }
};
