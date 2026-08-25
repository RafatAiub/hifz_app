// Windows-specific hardening. Metro's default cold-cache crawl opens one
// file handle per file it scans; combined with a large node_modules tree
// this can hit Windows' concurrent-handle limit (EMFILE) well before it
// would on macOS/Linux. Two mitigations: exclude directories Metro should
// never need to look inside, and cap worker concurrency so fewer files are
// open at once during that crawl.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /\/\.git\//,
  /\/dist\//,
  /\/docs\//,
  /\/supabase\//,
];

config.maxWorkers = 2;

module.exports = config;
