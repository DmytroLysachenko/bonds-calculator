import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import ts from 'typescript';

export interface ImportEdge {
  specifier: string;
  typeOnly: boolean;
}
/** Parse executable import forms; comments and type-only declarations are not runtime edges. */
export function importsOf(source: string, filename = 'module.ts'): ImportEdge[] {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const edges: ImportEdge[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly = Boolean(
        clause?.isTypeOnly ||
        (!clause?.name &&
          bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((element) => element.isTypeOnly)),
      );
      edges.push({ specifier: node.moduleSpecifier.text, typeOnly });
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.exportClause;
      edges.push({
        specifier: node.moduleSpecifier.text,
        typeOnly:
          node.isTypeOnly ||
          Boolean(
            clause &&
            ts.isNamedExports(clause) &&
            clause.elements.length > 0 &&
            clause.elements.every((element) => element.isTypeOnly),
          ),
      });
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      edges.push({ specifier: node.arguments[0].text, typeOnly: false });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return edges;
}

export function resolvedRuntimeGraph(root: string, files: string[]) {
  const config = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const edges = importsOf(readFileSync(resolve(root, file), 'utf8'), file)
      .filter((edge) => !edge.typeOnly)
      .map(({ specifier }) => {
        const result = ts.resolveModuleName(
          specifier,
          resolve(root, file),
          options,
          ts.sys,
        ).resolvedModule;
        return result && !result.isExternalLibraryImport
          ? relative(root, result.resolvedFileName).replaceAll('\\', '/')
          : specifier;
      });
    graph.set(file, edges);
  }
  return graph;
}

export function forbiddenReachability(
  graph: Map<string, string[]>,
  start: string,
  forbidden: (path: string) => boolean,
): string[] | null {
  const visited = new Set<string>();
  function walk(node: string, chain: string[]): string[] | null {
    if (visited.has(node)) return null;
    visited.add(node);
    if (node !== start && forbidden(node)) return [...chain, node];
    for (const edge of graph.get(node) ?? []) {
      const violation = walk(edge, [...chain, node]);
      if (violation) return violation;
    }
    return null;
  }
  return walk(start, []);
}
