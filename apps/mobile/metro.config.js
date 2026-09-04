// Metro config for Expo in a pnpm monorepo — watches the repo root so
// workspace packages (@oasis/api, @oasis/domain) resolve correctly.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const domainSourceRoot = `${path.join(workspaceRoot, 'packages', 'domain', 'src')}${path.sep}`;

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enablePackageExports = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isNodeNextDomainImport =
    context.originModulePath.startsWith(domainSourceRoot) &&
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js');

  return context.resolveRequest(
    context,
    isNodeNextDomainImport ? moduleName.slice(0, -3) : moduleName,
    platform,
  );
};

module.exports = config;
