import { nodeResolve } from '@rollup/plugin-node-resolve';
import { createFilter, FilterPattern } from '@rollup/pluginutils';
import { RollupOptions, Plugin } from 'rollup';
import type { Program } from 'estree';
import { walk } from 'estree-walker';
import type { FunctionDeclaration, VariableDeclarator, Property, Identifier } from 'estree';
import { posix as path } from 'path';

const input = 'vaadin-components-federation.js';

const modulesDirectory = path.join(__dirname, 'node_modules');

const modules = {};

function getLocalModuleId(id: string): string {
  return id.startsWith(modulesDirectory) ? id.substring(modulesDirectory.length + 1) : id;
}

const collectModules = (options: {include?: FilterPattern, exclude?: FilterPattern} = {}): Plugin => {
  const filter = createFilter(options.include, options.exclude);

  return {
    name: 'collectModules',
    async resolveId(source, importer, options) {
      if (options.isEntry) {
        return null;
      }

      const resolution = await this.resolve(source, importer, {
        skipSelf: true,
        ...options
      });

      let id = source.startsWith('.') ? resolution.id : source;
      id = getLocalModuleId(id);
      if (id.startsWith(__dirname)) return null;

      try {
        const resolvedPath = require.resolve(id, {});
        if (resolvedPath && !(id in modules)) {
          modules[id] = {};
        }
        if (!id.endsWith('.js')) {
          const aliasedId = getLocalModuleId(resolution.id);
          modules[id] = {
            exports: [`__@__${aliasedId}`],
          }
        }
      } catch(_) { }

      return resolution;
    },

    async transform(code, sourceId) {
      if (!filter(sourceId)) return;
      const id  = getLocalModuleId(sourceId);
      if (!modules[id]) return;

      const ast = this.parse(code);

      const exports = [];

      let isExport = false;

      const getTargetId = async (value: string) => {
        const targetSourceId = (await this.resolve(value, sourceId)).id;
        return getLocalModuleId(targetSourceId);
      };

      for (const topLevelNode of (ast as unknown as Program).body) {
        if (topLevelNode.type === 'ExportAllDeclaration') {
          const namespace = topLevelNode.exported ? topLevelNode.exported.name : '';
          const targetId = await getTargetId(topLevelNode.source.value as string);
          if (!modules[targetId]) continue;
          exports.push(`${namespace}__@__${targetId}`); 
        } else if (topLevelNode.type === 'ExportDefaultDeclaration') {
          exports.push('default');
        } else if (topLevelNode.type === 'ExportNamedDeclaration') {
          if (topLevelNode.declaration) {
            walk(topLevelNode.declaration, {
              enter(node, parent) {
                if (node.type === 'BlockStatement' 
                  || node.type === 'ClassBody'
                  || (parent && parent.type === 'VariableDeclarator' && (parent as VariableDeclarator).init === node)
                  || (parent && parent.type === 'Property' && (parent as Property).value === node)
                  || (parent && parent.type === 'FunctionDeclaration' && (parent as FunctionDeclaration).id !== node)) {
                  this.skip();
                } else if (node.type === 'Identifier') {
                  this.skip();
                  exports.push((node as Identifier).name);
                }
              }
            });
          } else {
            for (const specifier of topLevelNode.specifiers) {
              exports.push(specifier.exported.name);
            }
          }
        }
      }

      modules[id].exports = exports;

      return {
        moduleSideEffects: 'no-treeshake',
      };
    },

    renderChunk() {
      return '';
    },

    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'modules.json',
        source: JSON.stringify({ modules }, undefined, 2),
      });
    }
  };
}

const rollupOptions: RollupOptions = {
  input,
  preserveSymlinks: true,
  plugins: [
    collectModules(),
    nodeResolve({ }),
  ],
  output: {
    format: 'esm',
    dir: 'dist',
    sourcemap: false,
  },
};

export default rollupOptions;