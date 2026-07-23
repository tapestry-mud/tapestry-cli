'use strict';

const { z } = require('zod');

const SCOPED_NAME = /^@[a-z0-9-]+\/[a-z0-9-]+$/;

const PackageManifestSchema = z.object({
  name: z.string().regex(SCOPED_NAME, 'name must be @scope/package-name'),
  version: z.string().min(1),
  type: z.enum(['core', 'module', 'world']),
  display_name: z.string().min(1),
  description: z.string().min(1),
  author: z.string().min(1),
  license: z.string().min(1),
  engine: z.string().min(1),
  validation: z.enum(['strict', 'lenient']),
  dependencies: z.record(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional(),
  provides: z.array(z.string()).optional(),
  tags: z.string().optional(),
  module: z.object({
    assembly: z.string(),
    class: z.string(),
    implements: z.string(),
    after: z.string().optional(),
  }).optional(),
  content: z.record(z.string()).optional(),
  client: z.object({
    manifest: z.string(),
    assets: z.string(),
    min_client_version: z.string(),
  }).optional(),
  meta: z.object({
    commands: z.array(z.string()).optional(),
    properties: z.number().optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
  private: z.boolean().optional(),
});

const ProjectManifestSchema = z.object({
  name: z.string().min(1),
  engine: z.union([
    z.string().min(1),
    z.object({
      version: z.string().min(1),
      mode: z.enum(['docker', 'binary', 'source']),
      image: z.string().optional(),
      network: z.string().optional(),
      env_file: z.string().optional(),
      host_ports: z.object({
        telnet: z.number().int().positive().optional(),
        websocket: z.number().int().positive().optional(),
      }).optional(),
    }),
  ]),
  dependencies: z.record(z.string()).optional(),
  packs: z.array(z.string()).optional(),
  validation: z.enum(['strict', 'lenient']).optional(),
});

function validatePackageManifest(data) {
  return PackageManifestSchema.safeParse(data);
}

function validateProjectManifest(data) {
  return ProjectManifestSchema.safeParse(data);
}

module.exports = {
  PackageManifestSchema,
  ProjectManifestSchema,
  validatePackageManifest,
  validateProjectManifest,
};
