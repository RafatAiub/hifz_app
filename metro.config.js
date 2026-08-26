// Windows-specific local-dev hardening. Metro's default cold-cache crawl
// opens one file handle per file it scans; combined with a large
// node_modules tree this can hit Windows' concurrent-handle limit (EMFILE)
// well before it would on macOS/Linux.
//
// Scoped to local dev only (skipped when EAS_BUILD is set, which EAS Build
// always sets in its cloud environment): this exact customization was
// tried unscoped first and reproducibly broke the cloud "Bundle
// JavaScript" phase (Metro failed to resolve whatwg-fetch's `main` field
// even though the file is genuinely present in the published package --
// root cause not fully isolated, but conclusively tied to this file's
// presence via before/after cloud builds). Since the problem it fixes
// (Windows EMFILE) doesn't occur on EAS's Linux workers anyway, gating it
// out there is correct regardless of the exact mechanism.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!process.env.EAS_BUILD) {
  const defaultBlockList = Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList].filter(Boolean);

  config.resolver.blockList = [
    ...defaultBlockList,
    /\/\.git\//,
    /\/dist\//,
    /\/docs\//,
    /\/supabase\//,
  ];

  config.maxWorkers = 2;
}

module.exports = config;
