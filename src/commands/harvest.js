'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { readYaml } = require('../util/yaml');
const {
  parseAreaRef, resolvePackDirOrNull,
  resolveOperatorScope, isOwnedNamespace,
} = require('../lib/pack-resolve');
const { isRepo, commitAll } = require('../lib/git');
const { bumpVersion, namespaceToName } = require('../lib/pack-manifest');
const { syncArea } = require('./sync-area');
const { fileSink } = require('../lib/file-sink');
const { registrySink } = require('../lib/registry-sink');
const { buildForkPack } = require('../lib/fork-core');
const { buildTarball, computeIntegrity } = require('../lib/tarball-builder');
const { removeSideCars } = require('../lib/render-core');
const { requireAccess } = require('../lib/auth');
const { DEFAULT_REGISTRY, throwIfError } = require('../lib/registry-client');

// Umbrella harvest verb. Auto-detects the sink (owned linked pack that is a git repo -> git;
// else file) unless --sink is explicit.
//
// Fork detection (SA1 + SA4 + SA5, section 2): the operator's registry scope comes from the
// local auth session (resolveOperatorScope(), decoded from ~/.tapestryrc - the same session
// the registry sink already authenticates with; never tapestry-links.yaml, which link/unlink
// rewrites on every call, dropping unknown keys). If a scope is known, an area is OWNED iff
// isOwnedNamespace(namespace, operatorScope) - the namespace equals the scope, or starts with
// `<scope>-` (SA5 prefix rule; a first-dash split of the namespace would misdetect every
// hyphenated operator handle's own content as a fork). Otherwise it is a fork. If NO scope is
// known (not logged in), the area is NEVER a fork - forking foreign content requires the
// operator's scope to be known; unconfigured instances keep the shipped dispatch unchanged.
async function harvest(areaRef, options = {}) {
  const cwd = options.cwd || process.cwd();
  const gameRoot = options.gameRoot || cwd;
  const { namespace, area } = parseAreaRef(areaRef);

  const operatorScope = resolveOperatorScope();
  const isFork = operatorScope ? !isOwnedNamespace(namespace, operatorScope) : false;

  if (isFork) {
    if (!options.name) {
      throw new Error(
        `error: area '${namespace}:${area}' is a fork target (namespace '${namespace}' is not owned by scope '${operatorScope}').\n` +
        `  Provide the fork pack name: --name @<scope>/fork-name\n` +
        `  Convention: @yourscope/${namespace}-fork  (scope + origin-package + "-fork")`
      );
    }
    return forkHarvest(areaRef, cwd, gameRoot, namespace, area, options);
  }

  // Owned or unconfigured path: dispatch to the appropriate sink unchanged.
  const packDir = resolvePackDirOrNull(cwd, namespace, options.pack);
  let sink = options.sink;
  if (!sink) {
    sink = (packDir && isRepo(packDir)) ? 'git' : 'file';
  }

  if (sink === 'git') {
    return syncArea(areaRef, options);
  }
  if (sink === 'file') {
    return fileSink(areaRef, {
      cwd, gameRoot, namespace, area,
      force: options.force, keepSidecars: options.keepSidecars,
      out: options.out, name: options.name, pack: options.pack,
    });
  }
  if (sink === 'registry') {
    return registrySink(areaRef, {
      cwd, gameRoot, namespace, area,
      force: options.force, keepSidecars: options.keepSidecars,
      pack: options.pack, name: options.name,
      bump: options.bump,
      registryUrl: options.registryUrl,
    });
  }
  throw new Error(`Unknown sink '${sink}'. Use 'file', 'git', or 'registry'.`);
}

// Fork path: build the fork pack dir (re-keyed + provenance + depends-on), then route to
// the chosen sink. The fork dir is always a temp dir; sinks treat it as a pre-built pack.
async function forkHarvest(areaRef, cwd, gameRoot, originNamespace, area, options) {
  const forkPackName = options.name;

  // Resolve origin version from the linked origin pack (section 4).
  const originPackDir = resolvePackDirOrNull(cwd, originNamespace);
  if (!originPackDir) {
    // F6/R2-F4: use the actual pack name (derived via namespaceToName) in the hint when
    // derivable. Guard the hyphenless-namespace edge (e.g. a bare 'core:area') so
    // namespaceToName's derive error can't silently replace this message with a less
    // helpful one - degrade to a generic hint instead.
    let originHint;
    try {
      originHint = `tapestry link ${namespaceToName(originNamespace)} <path>`;
    } catch (e) {
      originHint = `tapestry link <@scope/pack for '${originNamespace}'> <path>`;
    }
    throw new Error(
      `cannot determine origin version for '${originNamespace}' - pack not linked.\n` +
      `Link it first: ${originHint}`
    );
  }
  const originManifest = readYaml(path.join(originPackDir, 'pack.yaml')) || {};
  const originVersion = originManifest.version;
  if (!originVersion) {
    throw new Error(`origin pack at ${originPackDir} has no 'version' in pack.yaml.`);
  }

  const sink = options.sink || 'file';
  const tmpBuild = fs.mkdtempSync(path.join(os.tmpdir(), 'tapestry-fork-'));

  try {
    // F2: buildForkPack returns version directly; no disk re-read needed.
    // F5: pass originManifest.name (authoritative) instead of deriving via namespaceToName.
    const { forkNamespace, files, version: forkVersion } = buildForkPack(tmpBuild, {
      gameRoot, area,
      originNamespace, originVersion,
      originPackName: originManifest.name,
      forkPackName, force: options.force,
    });

    const shortName = forkPackName.split('/')[1];

    if (sink === 'file') {
      const outputPath = options.out
        ? (path.isAbsolute(options.out) ? options.out : path.join(cwd, options.out))
        : path.join(cwd, `${shortName}-${forkVersion}.tgz`);
      await buildTarball(tmpBuild, outputPath);
      if (!options.keepSidecars) {
        removeSideCars(gameRoot, area, files);
      }
      console.log(
        `Forked '${originNamespace}:${area}' -> ${forkPackName}` +
        ` (derivative of ${originManifest.name}@${originVersion})`
      );
      console.log(`Harvested -> ${outputPath}`);
      return outputPath;
    }

    if (sink === 'registry') {
      // F4: source-of-truth gate - refuse if the fork pack is a linked git repo.
      const forkPackDir = resolvePackDirOrNull(cwd, forkNamespace);
      if (forkPackDir && isRepo(forkPackDir)) {
        throw new Error(
          `cannot publish '${forkPackName}' directly to the registry: it is a linked git repo.\n` +
          `CI publish will clobber a direct publish. Use --sink git instead.`
        );
      }
      const tmpTgz = path.join(
        os.tmpdir(), `tapestry-publish-${shortName}-${forkVersion}.tgz`
      );
      try {
        await buildTarball(tmpBuild, tmpTgz);
        const integrity = computeIntegrity(tmpTgz);
        const token = await requireAccess();
        const form = new FormData();
        form.append('tarball', fs.createReadStream(tmpTgz), {
          filename: `${forkVersion}.tgz`,
          contentType: 'application/gzip',
        });
        // F2: construct metadata from known values, no disk re-read.
        form.append('metadata', JSON.stringify({
          name: forkPackName,
          version: forkVersion,
          description: 'derivative of ' + originManifest.name + '@' + originVersion,
          integrity,
        }));
        const registryUrl = options.registryUrl || DEFAULT_REGISTRY;
        const res = await fetch(`${registryUrl}/v1/publish`, {
          method: 'POST',
          headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` },
          body: form,
        });
        await throwIfError(res, 'Publish failed');
        const result = await res.json();
        if (!options.keepSidecars) {
          removeSideCars(gameRoot, area, files);
        }
        console.log(
          `Forked '${originNamespace}:${area}' -> ${result.name}@${result.version}` +
          ` (derivative of ${originManifest.name}@${originVersion})`
        );
        console.log('Run `tapestry update` on your game server to pull the new version.');
      } finally {
        if (fs.existsSync(tmpTgz)) {
          fs.unlinkSync(tmpTgz);
        }
      }
      return;
    }

    if (sink === 'git') {
      // Git sink: the fork pack must already be a linked git repo.
      const forkPackDir = resolvePackDirOrNull(cwd, forkNamespace);
      if (!forkPackDir || !isRepo(forkPackDir)) {
        throw new Error(
          `git sink for a fork requires the fork pack to be a linked git repo.\n` +
          `Create the fork pack repo, link it: tapestry link ${forkPackName} <path>, then re-run.`
        );
      }
      const srcAreaDir = path.join(tmpBuild, 'areas', area);
      const destAreaDir = path.join(forkPackDir, 'areas', area);
      fs.mkdirSync(path.dirname(destAreaDir), { recursive: true });
      fs.cpSync(srcAreaDir, destAreaDir, { recursive: true });

      const { old, new: next } = bumpVersion(forkPackDir, options.bump || 'patch');
      commitAll(
        forkPackDir,
        `content(${area}): fork from ${originNamespace}, bump ${old} -> ${next}`
      );
      if (!options.keepSidecars) {
        removeSideCars(gameRoot, area, files);
      }
      console.log(
        `Forked '${originNamespace}:${area}' -> ${forkPackName} v${next}` +
        ` (derivative of ${originManifest.name}@${originVersion})`
      );
      console.log('To publish + deploy, push the fork pack repo:');
      console.log(`  cd ${forkPackDir} && git push`);
      return;
    }

    throw new Error(`Unknown sink '${sink}'. Use 'file', 'git', or 'registry'.`);
  } finally {
    fs.rmSync(tmpBuild, { recursive: true, force: true });
  }
}

module.exports = { harvest };
