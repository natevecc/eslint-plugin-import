'use strict';Object.defineProperty(exports, "__esModule", { value: true });exports.



































































































































































































































































































































































































































































































































































































































































recursivePatternCapture = recursivePatternCapture;var _fs = require('fs');var _fs2 = _interopRequireDefault(_fs);var _doctrine = require('doctrine');var _doctrine2 = _interopRequireDefault(_doctrine);var _debug = require('debug');var _debug2 = _interopRequireDefault(_debug);var _eslint = require('eslint');var _parse = require('eslint-module-utils/parse');var _parse2 = _interopRequireDefault(_parse);var _resolve = require('eslint-module-utils/resolve');var _resolve2 = _interopRequireDefault(_resolve);var _ignore = require('eslint-module-utils/ignore');var _ignore2 = _interopRequireDefault(_ignore);var _hash = require('eslint-module-utils/hash');var _unambiguous = require('eslint-module-utils/unambiguous');var unambiguous = _interopRequireWildcard(_unambiguous);var _tsconfigLoader = require('tsconfig-paths/lib/tsconfig-loader');var _arrayIncludes = require('array-includes');var _arrayIncludes2 = _interopRequireDefault(_arrayIncludes);function _interopRequireWildcard(obj) {if (obj && obj.__esModule) {return obj;} else {var newObj = {};if (obj != null) {for (var key in obj) {if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];}}newObj.default = obj;return newObj;}}function _interopRequireDefault(obj) {return obj && obj.__esModule ? obj : { default: obj };}let parseConfigFileTextToJson;const log = (0, _debug2.default)('eslint-plugin-import:ExportMap');const exportCache = new Map();class ExportMap {constructor(path) {this.path = path;this.namespace = new Map(); // todo: restructure to key on path, value is resolver + map of names
    this.reexports = new Map(); /**
                                 * star-exports
                                 * @type {Set} of () => ExportMap
                                 */this.dependencies = new Set(); /**
                                                                   * dependencies of this module that are not explicitly re-exported
                                                                   * @type {Map} from path = () => ExportMap
                                                                   */this.imports = new Map();this.errors = [];}get hasDefault() {return this.get('default') != null;} // stronger than this.has
  get size() {let size = this.namespace.size + this.reexports.size;this.dependencies.forEach(dep => {const d = dep(); // CJS / ignored dependencies won't exist (#717)
      if (d == null) return;size += d.size;});return size;} /**
                                                             * Note that this does not check explicitly re-exported names for existence
                                                             * in the base namespace, but it will expand all `export * from '...'` exports
                                                             * if not found in the explicit namespace.
                                                             * @param  {string}  name
                                                             * @return {Boolean} true if `name` is exported by this module.
                                                             */has(name) {if (this.namespace.has(name)) return true;if (this.reexports.has(name)) return true; // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {for (let dep of this.dependencies) {let innerMap = dep(); // todo: report as unresolved?
        if (!innerMap) continue;if (innerMap.has(name)) return true;}}return false;} /**
                                                                                      * ensure that imported name fully resolves.
                                                                                      * @param  {[type]}  name [description]
                                                                                      * @return {Boolean}      [description]
                                                                                      */hasDeep(name) {if (this.namespace.has(name)) return { found: true, path: [this] };if (this.reexports.has(name)) {const reexports = this.reexports.get(name),imported = reexports.getImport(); // if import is ignored, return explicit 'null'
      if (imported == null) return { found: true, path: [this] // safeguard against cycles, only if name matches
      };if (imported.path === this.path && reexports.local === name) {return { found: false, path: [this] };}const deep = imported.hasDeep(reexports.local);deep.path.unshift(this);return deep;} // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {for (let dep of this.dependencies) {let innerMap = dep();if (innerMap == null) return { found: true, path: [this] // todo: report as unresolved?
        };if (!innerMap) continue; // safeguard against cycles
        if (innerMap.path === this.path) continue;let innerValue = innerMap.hasDeep(name);if (innerValue.found) {innerValue.path.unshift(this);return innerValue;}}}return { found: false, path: [this] };}get(name) {if (this.namespace.has(name)) return this.namespace.get(name);if (this.reexports.has(name)) {const reexports = this.reexports.get(name),imported = reexports.getImport(); // if import is ignored, return explicit 'null'
      if (imported == null) return null; // safeguard against cycles, only if name matches
      if (imported.path === this.path && reexports.local === name) return undefined;return imported.get(reexports.local);} // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {for (let dep of this.dependencies) {let innerMap = dep(); // todo: report as unresolved?
        if (!innerMap) continue; // safeguard against cycles
        if (innerMap.path === this.path) continue;let innerValue = innerMap.get(name);if (innerValue !== undefined) return innerValue;}}return undefined;}forEach(callback, thisArg) {this.namespace.forEach((v, n) => callback.call(thisArg, v, n, this));this.reexports.forEach((reexports, name) => {const reexported = reexports.getImport(); // can't look up meta for ignored re-exports (#348)
      callback.call(thisArg, reexported && reexported.get(reexports.local), name, this);});this.dependencies.forEach(dep => {const d = dep(); // CJS / ignored dependencies won't exist (#717)
      if (d == null) return;d.forEach((v, n) => n !== 'default' && callback.call(thisArg, v, n, this));});} // todo: keys, values, entries?
  reportErrors(context, declaration) {context.report({ node: declaration.source, message: `Parse errors in imported module '${declaration.source.value}': ` + `${this.errors.map(e => `${e.message} (${e.lineNumber}:${e.column})`).join(', ')}` });}}exports.default = ExportMap; /**
                                                                                                                                                                                                                                                                                    * parse docs from the first node that has leading comments
                                                                                                                                                                                                                                                                                    */function captureDoc(source, docStyleParsers) {const metadata = {}; // 'some' short-circuits on first 'true'
  for (var _len = arguments.length, nodes = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {nodes[_key - 2] = arguments[_key];}nodes.some(n => {try {let leadingComments; // n.leadingComments is legacy `attachComments` behavior
      if ('leadingComments' in n) {leadingComments = n.leadingComments;} else if (n.range) {leadingComments = source.getCommentsBefore(n);}if (!leadingComments || leadingComments.length === 0) return false;for (let name in docStyleParsers) {const doc = docStyleParsers[name](leadingComments);if (doc) {metadata.doc = doc;}}return true;} catch (err) {return false;}});return metadata;}const availableDocStyleParsers = { jsdoc: captureJsDoc, tomdoc: captureTomDoc /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                               * parse JSDoc from leading comments
                                                                                                                                                                                                                                                                                                                                                                                                                                                                               * @param  {...[type]} comments [description]
                                                                                                                                                                                                                                                                                                                                                                                                                                                                               * @return {{doc: object}}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */ };function captureJsDoc(comments) {let doc; // capture XSDoc
  comments.forEach(comment => {// skip non-block comments
    if (comment.type !== 'Block') return;try {doc = _doctrine2.default.parse(comment.value, { unwrap: true });} catch (err) {/* don't care, for now? maybe add to `errors?` */}});return doc;} /**
                                                                                                                                                                                                 * parse TomDoc section from comments
                                                                                                                                                                                                 */function captureTomDoc(comments) {// collect lines up to first paragraph break
  const lines = [];for (let i = 0; i < comments.length; i++) {const comment = comments[i];if (comment.value.match(/^\s*$/)) break;lines.push(comment.value.trim());} // return doctrine-like object
  const statusMatch = lines.join(' ').match(/^(Public|Internal|Deprecated):\s*(.+)/);if (statusMatch) {return { description: statusMatch[2], tags: [{ title: statusMatch[1].toLowerCase(), description: statusMatch[2] }] };}}ExportMap.get = function (source, context) {const path = (0, _resolve2.default)(source, context);if (path == null) return null;return ExportMap.for(childContext(path, context));};ExportMap.for = function (context) {const path = context.path;const cacheKey = (0, _hash.hashObject)(context).digest('hex');let exportMap = exportCache.get(cacheKey); // return cached ignore
  if (exportMap === null) return null;const stats = _fs2.default.statSync(path);if (exportMap != null) {// date equality check
    if (exportMap.mtime - stats.mtime === 0) {return exportMap;} // future: check content equality?
  } // check valid extensions first
  if (!(0, _ignore.hasValidExtension)(path, context)) {exportCache.set(cacheKey, null);return null;} // check for and cache ignore
  if ((0, _ignore2.default)(path, context)) {log('ignored path due to ignore settings:', path);exportCache.set(cacheKey, null);return null;}const content = _fs2.default.readFileSync(path, { encoding: 'utf8' }); // check for and cache unambiguous modules
  if (!unambiguous.test(content)) {log('ignored path due to unambiguous regex:', path);exportCache.set(cacheKey, null);return null;}log('cache miss', cacheKey, 'for path', path);exportMap = ExportMap.parse(path, content, context); // ambiguous modules return null
  if (exportMap == null) return null;exportMap.mtime = stats.mtime;exportCache.set(cacheKey, exportMap);return exportMap;};ExportMap.parse = function (path, content, context) {var m = new ExportMap(path);try {var ast = (0, _parse2.default)(path, content, context);} catch (err) {log('parse error:', path, err);m.errors.push(err);return m; // can't continue
  }if (!unambiguous.isModule(ast)) return null;const docstyle = context.settings && context.settings['import/docstyle'] || ['jsdoc'];const docStyleParsers = {};docstyle.forEach(style => {docStyleParsers[style] = availableDocStyleParsers[style];}); // attempt to collect module doc
  if (ast.comments) {ast.comments.some(c => {if (c.type !== 'Block') return false;try {const doc = _doctrine2.default.parse(c.value, { unwrap: true });if (doc.tags.some(t => t.title === 'module')) {m.doc = doc;return true;}} catch (err) {/* ignore */}return false;});}const namespaces = new Map();function remotePath(value) {return _resolve2.default.relative(value, path, context.settings);}function resolveImport(value) {const rp = remotePath(value);if (rp == null) return null;return ExportMap.for(childContext(rp, context));}function getNamespace(identifier) {if (!namespaces.has(identifier.name)) return;return function () {return resolveImport(namespaces.get(identifier.name));};}function addNamespace(object, identifier) {const nsfn = getNamespace(identifier);if (nsfn) {Object.defineProperty(object, 'namespace', { get: nsfn });}return object;}function captureDependency(declaration) {if (declaration.source == null) return null;if (declaration.importKind === 'type') return null; // skip Flow type imports
    const importedSpecifiers = new Set();const supportedTypes = new Set(['ImportDefaultSpecifier', 'ImportNamespaceSpecifier']);let hasImportedType = false;if (declaration.specifiers) {declaration.specifiers.forEach(specifier => {const isType = specifier.importKind === 'type';hasImportedType = hasImportedType || isType;if (supportedTypes.has(specifier.type) && !isType) {importedSpecifiers.add(specifier.type);}if (specifier.type === 'ImportSpecifier' && !isType) {importedSpecifiers.add(specifier.imported.name);}});} // only Flow types were imported
    if (hasImportedType && importedSpecifiers.size === 0) return null;const p = remotePath(declaration.source.value);if (p == null) return null;const existing = m.imports.get(p);if (existing != null) return existing.getter;const getter = thunkFor(p, context);m.imports.set(p, { getter, source: { // capturing actual node reference holds full AST in memory!
        value: declaration.source.value, loc: declaration.source.loc }, importedSpecifiers });return getter;}const source = makeSourceCode(content, ast);function isEsModuleInterop() {const tsConfigInfo = (0, _tsconfigLoader.tsConfigLoader)({ cwd: context.parserOptions && context.parserOptions.tsconfigRootDir || process.cwd(), getEnv: key => process.env[key] });try {if (tsConfigInfo.tsConfigPath !== undefined) {const jsonText = _fs2.default.readFileSync(tsConfigInfo.tsConfigPath).toString();if (!parseConfigFileTextToJson) {var _require = require('typescript'); // this is because projects not using TypeScript won't have typescript installed
          parseConfigFileTextToJson = _require.parseConfigFileTextToJson;}const tsConfig = parseConfigFileTextToJson(tsConfigInfo.tsConfigPath, jsonText).config;return tsConfig.compilerOptions.esModuleInterop;}} catch (e) {return false;}}ast.body.forEach(function (n) {if (n.type === 'ExportDefaultDeclaration') {const exportMeta = captureDoc(source, docStyleParsers, n);if (n.declaration.type === 'Identifier') {addNamespace(exportMeta, n.declaration);}m.namespace.set('default', exportMeta);return;}if (n.type === 'ExportAllDeclaration') {const getter = captureDependency(n);if (getter) m.dependencies.add(getter);return;} // capture namespaces in case of later export
    if (n.type === 'ImportDeclaration') {captureDependency(n);let ns;if (n.specifiers.some(s => s.type === 'ImportNamespaceSpecifier' && (ns = s))) {namespaces.set(ns.local.name, n.source.value);}return;}if (n.type === 'ExportNamedDeclaration') {// capture declaration
      if (n.declaration != null) {switch (n.declaration.type) {case 'FunctionDeclaration':case 'ClassDeclaration':case 'TypeAlias': // flowtype with babel-eslint parser
          case 'InterfaceDeclaration':case 'DeclareFunction':case 'TSDeclareFunction':case 'TSEnumDeclaration':case 'TSTypeAliasDeclaration':case 'TSInterfaceDeclaration':case 'TSAbstractClassDeclaration':case 'TSModuleDeclaration':m.namespace.set(n.declaration.id.name, captureDoc(source, docStyleParsers, n));break;case 'VariableDeclaration':n.declaration.declarations.forEach(d => recursivePatternCapture(d.id, id => m.namespace.set(id.name, captureDoc(source, docStyleParsers, d, n))));break;}}const nsource = n.source && n.source.value;n.specifiers.forEach(s => {const exportMeta = {};let local;switch (s.type) {case 'ExportDefaultSpecifier':if (!n.source) return;local = 'default';break;case 'ExportNamespaceSpecifier':m.namespace.set(s.exported.name, Object.defineProperty(exportMeta, 'namespace', { get() {return resolveImport(nsource);} }));return;case 'ExportSpecifier':if (!n.source) {m.namespace.set(s.exported.name, addNamespace(exportMeta, s.local));return;} // else falls through
          default:local = s.local.name;break;} // todo: JSDoc
        m.reexports.set(s.exported.name, { local, getImport: () => resolveImport(nsource) });});}const isEsModuleInteropTrue = isEsModuleInterop();const exports = ['TSExportAssignment'];if (isEsModuleInteropTrue) {exports.push('TSNamespaceExportDeclaration');} // This doesn't declare anything, but changes what's being exported.
    if ((0, _arrayIncludes2.default)(exports, n.type)) {const exportedName = n.type === 'TSNamespaceExportDeclaration' ? n.id.name : n.expression && n.expression.name || n.expression.id && n.expression.id.name || null;const declTypes = ['VariableDeclaration', 'ClassDeclaration', 'TSDeclareFunction', 'TSEnumDeclaration', 'TSTypeAliasDeclaration', 'TSInterfaceDeclaration', 'TSAbstractClassDeclaration', 'TSModuleDeclaration'];const exportedDecls = ast.body.filter((_ref) => {let type = _ref.type,id = _ref.id,declarations = _ref.declarations;return (0, _arrayIncludes2.default)(declTypes, type) && (id && id.name === exportedName || declarations && declarations.find(d => d.id.name === exportedName));});if (exportedDecls.length === 0) {// Export is not referencing any local declaration, must be re-exporting
        m.namespace.set('default', captureDoc(source, docStyleParsers, n));return;}if (isEsModuleInteropTrue) {m.namespace.set('default', {});}exportedDecls.forEach(decl => {if (decl.type === 'TSModuleDeclaration') {if (decl.body && decl.body.type === 'TSModuleDeclaration') {m.namespace.set(decl.body.id.name, captureDoc(source, docStyleParsers, decl.body));} else if (decl.body && decl.body.body) {decl.body.body.forEach(moduleBlockNode => {// Export-assignment exports all members in the namespace,
              // explicitly exported or not.
              const namespaceDecl = moduleBlockNode.type === 'ExportNamedDeclaration' ? moduleBlockNode.declaration : moduleBlockNode;if (!namespaceDecl) {// TypeScript can check this for us; we needn't
              } else if (namespaceDecl.type === 'VariableDeclaration') {namespaceDecl.declarations.forEach(d => recursivePatternCapture(d.id, id => m.namespace.set(id.name, captureDoc(source, docStyleParsers, decl, namespaceDecl, moduleBlockNode))));} else {m.namespace.set(namespaceDecl.id.name, captureDoc(source, docStyleParsers, moduleBlockNode));}});}} else {// Export as default
          m.namespace.set('default', captureDoc(source, docStyleParsers, decl));}});}});return m;}; /**
                                                                                                     * The creation of this closure is isolated from other scopes
                                                                                                     * to avoid over-retention of unrelated variables, which has
                                                                                                     * caused memory leaks. See #1266.
                                                                                                     */function thunkFor(p, context) {return () => ExportMap.for(childContext(p, context));} /**
                                                                                                                                                                                              * Traverse a pattern/identifier node, calling 'callback'
                                                                                                                                                                                              * for each leaf identifier.
                                                                                                                                                                                              * @param  {node}   pattern
                                                                                                                                                                                              * @param  {Function} callback
                                                                                                                                                                                              * @return {void}
                                                                                                                                                                                              */function recursivePatternCapture(pattern, callback) {switch (pattern.type) {case 'Identifier': // base case
      callback(pattern);break;case 'ObjectPattern':pattern.properties.forEach(p => {recursivePatternCapture(p.value, callback);});break;case 'ArrayPattern':pattern.elements.forEach(element => {if (element == null) return;recursivePatternCapture(element, callback);});break;case 'AssignmentPattern':callback(pattern.left);break;}} /**
                                                                                                                                                                                                                                                                                                                                           * don't hold full context object in memory, just grab what we need.
                                                                                                                                                                                                                                                                                                                                           */function childContext(path, context) {const settings = context.settings,parserOptions = context.parserOptions,parserPath = context.parserPath;return { settings, parserOptions, parserPath, path };} /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   * sometimes legacy support isn't _that_ hard... right?
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   */function makeSourceCode(text, ast) {if (_eslint.SourceCode.length > 1) {// ESLint 3
    return new _eslint.SourceCode(text, ast);} else {// ESLint 4, 5
    return new _eslint.SourceCode({ text, ast });}}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9FeHBvcnRNYXAuanMiXSwibmFtZXMiOlsicmVjdXJzaXZlUGF0dGVybkNhcHR1cmUiLCJ1bmFtYmlndW91cyIsInBhcnNlQ29uZmlnRmlsZVRleHRUb0pzb24iLCJsb2ciLCJleHBvcnRDYWNoZSIsIk1hcCIsIkV4cG9ydE1hcCIsImNvbnN0cnVjdG9yIiwicGF0aCIsIm5hbWVzcGFjZSIsInJlZXhwb3J0cyIsImRlcGVuZGVuY2llcyIsIlNldCIsImltcG9ydHMiLCJlcnJvcnMiLCJoYXNEZWZhdWx0IiwiZ2V0Iiwic2l6ZSIsImZvckVhY2giLCJkZXAiLCJkIiwiaGFzIiwibmFtZSIsImlubmVyTWFwIiwiaGFzRGVlcCIsImZvdW5kIiwiaW1wb3J0ZWQiLCJnZXRJbXBvcnQiLCJsb2NhbCIsImRlZXAiLCJ1bnNoaWZ0IiwiaW5uZXJWYWx1ZSIsInVuZGVmaW5lZCIsImNhbGxiYWNrIiwidGhpc0FyZyIsInYiLCJuIiwiY2FsbCIsInJlZXhwb3J0ZWQiLCJyZXBvcnRFcnJvcnMiLCJjb250ZXh0IiwiZGVjbGFyYXRpb24iLCJyZXBvcnQiLCJub2RlIiwic291cmNlIiwibWVzc2FnZSIsInZhbHVlIiwibWFwIiwiZSIsImxpbmVOdW1iZXIiLCJjb2x1bW4iLCJqb2luIiwiY2FwdHVyZURvYyIsImRvY1N0eWxlUGFyc2VycyIsIm1ldGFkYXRhIiwibm9kZXMiLCJzb21lIiwibGVhZGluZ0NvbW1lbnRzIiwicmFuZ2UiLCJnZXRDb21tZW50c0JlZm9yZSIsImxlbmd0aCIsImRvYyIsImVyciIsImF2YWlsYWJsZURvY1N0eWxlUGFyc2VycyIsImpzZG9jIiwiY2FwdHVyZUpzRG9jIiwidG9tZG9jIiwiY2FwdHVyZVRvbURvYyIsImNvbW1lbnRzIiwiY29tbWVudCIsInR5cGUiLCJkb2N0cmluZSIsInBhcnNlIiwidW53cmFwIiwibGluZXMiLCJpIiwibWF0Y2giLCJwdXNoIiwidHJpbSIsInN0YXR1c01hdGNoIiwiZGVzY3JpcHRpb24iLCJ0YWdzIiwidGl0bGUiLCJ0b0xvd2VyQ2FzZSIsImZvciIsImNoaWxkQ29udGV4dCIsImNhY2hlS2V5IiwiZGlnZXN0IiwiZXhwb3J0TWFwIiwic3RhdHMiLCJmcyIsInN0YXRTeW5jIiwibXRpbWUiLCJzZXQiLCJjb250ZW50IiwicmVhZEZpbGVTeW5jIiwiZW5jb2RpbmciLCJ0ZXN0IiwibSIsImFzdCIsImlzTW9kdWxlIiwiZG9jc3R5bGUiLCJzZXR0aW5ncyIsInN0eWxlIiwiYyIsInQiLCJuYW1lc3BhY2VzIiwicmVtb3RlUGF0aCIsInJlc29sdmUiLCJyZWxhdGl2ZSIsInJlc29sdmVJbXBvcnQiLCJycCIsImdldE5hbWVzcGFjZSIsImlkZW50aWZpZXIiLCJhZGROYW1lc3BhY2UiLCJvYmplY3QiLCJuc2ZuIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJjYXB0dXJlRGVwZW5kZW5jeSIsImltcG9ydEtpbmQiLCJpbXBvcnRlZFNwZWNpZmllcnMiLCJzdXBwb3J0ZWRUeXBlcyIsImhhc0ltcG9ydGVkVHlwZSIsInNwZWNpZmllcnMiLCJzcGVjaWZpZXIiLCJpc1R5cGUiLCJhZGQiLCJwIiwiZXhpc3RpbmciLCJnZXR0ZXIiLCJ0aHVua0ZvciIsImxvYyIsIm1ha2VTb3VyY2VDb2RlIiwiaXNFc01vZHVsZUludGVyb3AiLCJ0c0NvbmZpZ0luZm8iLCJjd2QiLCJwYXJzZXJPcHRpb25zIiwidHNjb25maWdSb290RGlyIiwicHJvY2VzcyIsImdldEVudiIsImtleSIsImVudiIsInRzQ29uZmlnUGF0aCIsImpzb25UZXh0IiwidG9TdHJpbmciLCJyZXF1aXJlIiwidHNDb25maWciLCJjb25maWciLCJjb21waWxlck9wdGlvbnMiLCJlc01vZHVsZUludGVyb3AiLCJib2R5IiwiZXhwb3J0TWV0YSIsIm5zIiwicyIsImlkIiwiZGVjbGFyYXRpb25zIiwibnNvdXJjZSIsImV4cG9ydGVkIiwiaXNFc01vZHVsZUludGVyb3BUcnVlIiwiZXhwb3J0cyIsImV4cG9ydGVkTmFtZSIsImV4cHJlc3Npb24iLCJkZWNsVHlwZXMiLCJleHBvcnRlZERlY2xzIiwiZmlsdGVyIiwiZmluZCIsImRlY2wiLCJtb2R1bGVCbG9ja05vZGUiLCJuYW1lc3BhY2VEZWNsIiwicGF0dGVybiIsInByb3BlcnRpZXMiLCJlbGVtZW50cyIsImVsZW1lbnQiLCJsZWZ0IiwicGFyc2VyUGF0aCIsInRleHQiLCJTb3VyY2VDb2RlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQW9vQmdCQSx1QixHQUFBQSx1QixDQXBvQmhCLHdCLHVDQUVBLG9DLG1EQUVBLDhCLDZDQUVBLGdDQUVBLGtELDZDQUNBLHNELGlE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TyxJQUFJcUgsa0JBQUosQ0FBZUQsSUFBZixFQUFxQjdFLEdBQXJCLENBQVAsQ0FDRCxDQUhELE1BR08sQ0FDTDtBQUNBLFdBQU8sSUFBSThFLGtCQUFKLENBQWUsRUFBRUQsSUFBRixFQUFRN0UsR0FBUixFQUFmLENBQVAsQ0FDRCxDQUNGIiwiZmlsZSI6IkV4cG9ydE1hcC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmcyBmcm9tICdmcydcblxuaW1wb3J0IGRvY3RyaW5lIGZyb20gJ2RvY3RyaW5lJ1xuXG5pbXBvcnQgZGVidWcgZnJvbSAnZGVidWcnXG5cbmltcG9ydCB7IFNvdXJjZUNvZGUgfSBmcm9tICdlc2xpbnQnXG5cbmltcG9ydCBwYXJzZSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL3BhcnNlJ1xuaW1wb3J0IHJlc29sdmUgZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy9yZXNvbHZlJ1xuaW1wb3J0IGlzSWdub3JlZCwgeyBoYXNWYWxpZEV4dGVuc2lvbiB9IGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvaWdub3JlJ1xuXG5pbXBvcnQgeyBoYXNoT2JqZWN0IH0gZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy9oYXNoJ1xuaW1wb3J0ICogYXMgdW5hbWJpZ3VvdXMgZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy91bmFtYmlndW91cydcblxuaW1wb3J0IHsgdHNDb25maWdMb2FkZXIgfSBmcm9tICd0c2NvbmZpZy1wYXRocy9saWIvdHNjb25maWctbG9hZGVyJ1xuXG5pbXBvcnQgaW5jbHVkZXMgZnJvbSAnYXJyYXktaW5jbHVkZXMnXG5cbmxldCBwYXJzZUNvbmZpZ0ZpbGVUZXh0VG9Kc29uXG5cbmNvbnN0IGxvZyA9IGRlYnVnKCdlc2xpbnQtcGx1Z2luLWltcG9ydDpFeHBvcnRNYXAnKVxuXG5jb25zdCBleHBvcnRDYWNoZSA9IG5ldyBNYXAoKVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFeHBvcnRNYXAge1xuICBjb25zdHJ1Y3RvcihwYXRoKSB7XG4gICAgdGhpcy5wYXRoID0gcGF0aFxuICAgIHRoaXMubmFtZXNwYWNlID0gbmV3IE1hcCgpXG4gICAgLy8gdG9kbzogcmVzdHJ1Y3R1cmUgdG8ga2V5IG9uIHBhdGgsIHZhbHVlIGlzIHJlc29sdmVyICsgbWFwIG9mIG5hbWVzXG4gICAgdGhpcy5yZWV4cG9ydHMgPSBuZXcgTWFwKClcbiAgICAvKipcbiAgICAgKiBzdGFyLWV4cG9ydHNcbiAgICAgKiBAdHlwZSB7U2V0fSBvZiAoKSA9PiBFeHBvcnRNYXBcbiAgICAgKi9cbiAgICB0aGlzLmRlcGVuZGVuY2llcyA9IG5ldyBTZXQoKVxuICAgIC8qKlxuICAgICAqIGRlcGVuZGVuY2llcyBvZiB0aGlzIG1vZHVsZSB0aGF0IGFyZSBub3QgZXhwbGljaXRseSByZS1leHBvcnRlZFxuICAgICAqIEB0eXBlIHtNYXB9IGZyb20gcGF0aCA9ICgpID0+IEV4cG9ydE1hcFxuICAgICAqL1xuICAgIHRoaXMuaW1wb3J0cyA9IG5ldyBNYXAoKVxuICAgIHRoaXMuZXJyb3JzID0gW11cbiAgfVxuXG4gIGdldCBoYXNEZWZhdWx0KCkgeyByZXR1cm4gdGhpcy5nZXQoJ2RlZmF1bHQnKSAhPSBudWxsIH0gLy8gc3Ryb25nZXIgdGhhbiB0aGlzLmhhc1xuXG4gIGdldCBzaXplKCkge1xuICAgIGxldCBzaXplID0gdGhpcy5uYW1lc3BhY2Uuc2l6ZSArIHRoaXMucmVleHBvcnRzLnNpemVcbiAgICB0aGlzLmRlcGVuZGVuY2llcy5mb3JFYWNoKGRlcCA9PiB7XG4gICAgICBjb25zdCBkID0gZGVwKClcbiAgICAgIC8vIENKUyAvIGlnbm9yZWQgZGVwZW5kZW5jaWVzIHdvbid0IGV4aXN0ICgjNzE3KVxuICAgICAgaWYgKGQgPT0gbnVsbCkgcmV0dXJuXG4gICAgICBzaXplICs9IGQuc2l6ZVxuICAgIH0pXG4gICAgcmV0dXJuIHNpemVcbiAgfVxuXG4gIC8qKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBkb2VzIG5vdCBjaGVjayBleHBsaWNpdGx5IHJlLWV4cG9ydGVkIG5hbWVzIGZvciBleGlzdGVuY2VcbiAgICogaW4gdGhlIGJhc2UgbmFtZXNwYWNlLCBidXQgaXQgd2lsbCBleHBhbmQgYWxsIGBleHBvcnQgKiBmcm9tICcuLi4nYCBleHBvcnRzXG4gICAqIGlmIG5vdCBmb3VuZCBpbiB0aGUgZXhwbGljaXQgbmFtZXNwYWNlLlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9ICBuYW1lXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59IHRydWUgaWYgYG5hbWVgIGlzIGV4cG9ydGVkIGJ5IHRoaXMgbW9kdWxlLlxuICAgKi9cbiAgaGFzKG5hbWUpIHtcbiAgICBpZiAodGhpcy5uYW1lc3BhY2UuaGFzKG5hbWUpKSByZXR1cm4gdHJ1ZVxuICAgIGlmICh0aGlzLnJlZXhwb3J0cy5oYXMobmFtZSkpIHJldHVybiB0cnVlXG5cbiAgICAvLyBkZWZhdWx0IGV4cG9ydHMgbXVzdCBiZSBleHBsaWNpdGx5IHJlLWV4cG9ydGVkICgjMzI4KVxuICAgIGlmIChuYW1lICE9PSAnZGVmYXVsdCcpIHtcbiAgICAgIGZvciAobGV0IGRlcCBvZiB0aGlzLmRlcGVuZGVuY2llcykge1xuICAgICAgICBsZXQgaW5uZXJNYXAgPSBkZXAoKVxuXG4gICAgICAgIC8vIHRvZG86IHJlcG9ydCBhcyB1bnJlc29sdmVkP1xuICAgICAgICBpZiAoIWlubmVyTWFwKSBjb250aW51ZVxuXG4gICAgICAgIGlmIChpbm5lck1hcC5oYXMobmFtZSkpIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICAvKipcbiAgICogZW5zdXJlIHRoYXQgaW1wb3J0ZWQgbmFtZSBmdWxseSByZXNvbHZlcy5cbiAgICogQHBhcmFtICB7W3R5cGVdfSAgbmFtZSBbZGVzY3JpcHRpb25dXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgW2Rlc2NyaXB0aW9uXVxuICAgKi9cbiAgaGFzRGVlcChuYW1lKSB7XG4gICAgaWYgKHRoaXMubmFtZXNwYWNlLmhhcyhuYW1lKSkgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHBhdGg6IFt0aGlzXSB9XG5cbiAgICBpZiAodGhpcy5yZWV4cG9ydHMuaGFzKG5hbWUpKSB7XG4gICAgICBjb25zdCByZWV4cG9ydHMgPSB0aGlzLnJlZXhwb3J0cy5nZXQobmFtZSlcbiAgICAgICAgICAsIGltcG9ydGVkID0gcmVleHBvcnRzLmdldEltcG9ydCgpXG5cbiAgICAgIC8vIGlmIGltcG9ydCBpcyBpZ25vcmVkLCByZXR1cm4gZXhwbGljaXQgJ251bGwnXG4gICAgICBpZiAoaW1wb3J0ZWQgPT0gbnVsbCkgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHBhdGg6IFt0aGlzXSB9XG5cbiAgICAgIC8vIHNhZmVndWFyZCBhZ2FpbnN0IGN5Y2xlcywgb25seSBpZiBuYW1lIG1hdGNoZXNcbiAgICAgIGlmIChpbXBvcnRlZC5wYXRoID09PSB0aGlzLnBhdGggJiYgcmVleHBvcnRzLmxvY2FsID09PSBuYW1lKSB7XG4gICAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgcGF0aDogW3RoaXNdIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgZGVlcCA9IGltcG9ydGVkLmhhc0RlZXAocmVleHBvcnRzLmxvY2FsKVxuICAgICAgZGVlcC5wYXRoLnVuc2hpZnQodGhpcylcblxuICAgICAgcmV0dXJuIGRlZXBcbiAgICB9XG5cblxuICAgIC8vIGRlZmF1bHQgZXhwb3J0cyBtdXN0IGJlIGV4cGxpY2l0bHkgcmUtZXhwb3J0ZWQgKCMzMjgpXG4gICAgaWYgKG5hbWUgIT09ICdkZWZhdWx0Jykge1xuICAgICAgZm9yIChsZXQgZGVwIG9mIHRoaXMuZGVwZW5kZW5jaWVzKSB7XG4gICAgICAgIGxldCBpbm5lck1hcCA9IGRlcCgpXG4gICAgICAgIGlmIChpbm5lck1hcCA9PSBudWxsKSByZXR1cm4geyBmb3VuZDogdHJ1ZSwgcGF0aDogW3RoaXNdIH1cbiAgICAgICAgLy8gdG9kbzogcmVwb3J0IGFzIHVucmVzb2x2ZWQ/XG4gICAgICAgIGlmICghaW5uZXJNYXApIGNvbnRpbnVlXG5cbiAgICAgICAgLy8gc2FmZWd1YXJkIGFnYWluc3QgY3ljbGVzXG4gICAgICAgIGlmIChpbm5lck1hcC5wYXRoID09PSB0aGlzLnBhdGgpIGNvbnRpbnVlXG5cbiAgICAgICAgbGV0IGlubmVyVmFsdWUgPSBpbm5lck1hcC5oYXNEZWVwKG5hbWUpXG4gICAgICAgIGlmIChpbm5lclZhbHVlLmZvdW5kKSB7XG4gICAgICAgICAgaW5uZXJWYWx1ZS5wYXRoLnVuc2hpZnQodGhpcylcbiAgICAgICAgICByZXR1cm4gaW5uZXJWYWx1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgZm91bmQ6IGZhbHNlLCBwYXRoOiBbdGhpc10gfVxuICB9XG5cbiAgZ2V0KG5hbWUpIHtcbiAgICBpZiAodGhpcy5uYW1lc3BhY2UuaGFzKG5hbWUpKSByZXR1cm4gdGhpcy5uYW1lc3BhY2UuZ2V0KG5hbWUpXG5cbiAgICBpZiAodGhpcy5yZWV4cG9ydHMuaGFzKG5hbWUpKSB7XG4gICAgICBjb25zdCByZWV4cG9ydHMgPSB0aGlzLnJlZXhwb3J0cy5nZXQobmFtZSlcbiAgICAgICAgICAsIGltcG9ydGVkID0gcmVleHBvcnRzLmdldEltcG9ydCgpXG5cbiAgICAgIC8vIGlmIGltcG9ydCBpcyBpZ25vcmVkLCByZXR1cm4gZXhwbGljaXQgJ251bGwnXG4gICAgICBpZiAoaW1wb3J0ZWQgPT0gbnVsbCkgcmV0dXJuIG51bGxcblxuICAgICAgLy8gc2FmZWd1YXJkIGFnYWluc3QgY3ljbGVzLCBvbmx5IGlmIG5hbWUgbWF0Y2hlc1xuICAgICAgaWYgKGltcG9ydGVkLnBhdGggPT09IHRoaXMucGF0aCAmJiByZWV4cG9ydHMubG9jYWwgPT09IG5hbWUpIHJldHVybiB1bmRlZmluZWRcblxuICAgICAgcmV0dXJuIGltcG9ydGVkLmdldChyZWV4cG9ydHMubG9jYWwpXG4gICAgfVxuXG4gICAgLy8gZGVmYXVsdCBleHBvcnRzIG11c3QgYmUgZXhwbGljaXRseSByZS1leHBvcnRlZCAoIzMyOClcbiAgICBpZiAobmFtZSAhPT0gJ2RlZmF1bHQnKSB7XG4gICAgICBmb3IgKGxldCBkZXAgb2YgdGhpcy5kZXBlbmRlbmNpZXMpIHtcbiAgICAgICAgbGV0IGlubmVyTWFwID0gZGVwKClcbiAgICAgICAgLy8gdG9kbzogcmVwb3J0IGFzIHVucmVzb2x2ZWQ/XG4gICAgICAgIGlmICghaW5uZXJNYXApIGNvbnRpbnVlXG5cbiAgICAgICAgLy8gc2FmZWd1YXJkIGFnYWluc3QgY3ljbGVzXG4gICAgICAgIGlmIChpbm5lck1hcC5wYXRoID09PSB0aGlzLnBhdGgpIGNvbnRpbnVlXG5cbiAgICAgICAgbGV0IGlubmVyVmFsdWUgPSBpbm5lck1hcC5nZXQobmFtZSlcbiAgICAgICAgaWYgKGlubmVyVmFsdWUgIT09IHVuZGVmaW5lZCkgcmV0dXJuIGlubmVyVmFsdWVcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdW5kZWZpbmVkXG4gIH1cblxuICBmb3JFYWNoKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdGhpcy5uYW1lc3BhY2UuZm9yRWFjaCgodiwgbikgPT5cbiAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdiwgbiwgdGhpcykpXG5cbiAgICB0aGlzLnJlZXhwb3J0cy5mb3JFYWNoKChyZWV4cG9ydHMsIG5hbWUpID0+IHtcbiAgICAgIGNvbnN0IHJlZXhwb3J0ZWQgPSByZWV4cG9ydHMuZ2V0SW1wb3J0KClcbiAgICAgIC8vIGNhbid0IGxvb2sgdXAgbWV0YSBmb3IgaWdub3JlZCByZS1leHBvcnRzICgjMzQ4KVxuICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCByZWV4cG9ydGVkICYmIHJlZXhwb3J0ZWQuZ2V0KHJlZXhwb3J0cy5sb2NhbCksIG5hbWUsIHRoaXMpXG4gICAgfSlcblxuICAgIHRoaXMuZGVwZW5kZW5jaWVzLmZvckVhY2goZGVwID0+IHtcbiAgICAgIGNvbnN0IGQgPSBkZXAoKVxuICAgICAgLy8gQ0pTIC8gaWdub3JlZCBkZXBlbmRlbmNpZXMgd29uJ3QgZXhpc3QgKCM3MTcpXG4gICAgICBpZiAoZCA9PSBudWxsKSByZXR1cm5cblxuICAgICAgZC5mb3JFYWNoKCh2LCBuKSA9PlxuICAgICAgICBuICE9PSAnZGVmYXVsdCcgJiYgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB2LCBuLCB0aGlzKSlcbiAgICB9KVxuICB9XG5cbiAgLy8gdG9kbzoga2V5cywgdmFsdWVzLCBlbnRyaWVzP1xuXG4gIHJlcG9ydEVycm9ycyhjb250ZXh0LCBkZWNsYXJhdGlvbikge1xuICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgIG5vZGU6IGRlY2xhcmF0aW9uLnNvdXJjZSxcbiAgICAgIG1lc3NhZ2U6IGBQYXJzZSBlcnJvcnMgaW4gaW1wb3J0ZWQgbW9kdWxlICcke2RlY2xhcmF0aW9uLnNvdXJjZS52YWx1ZX0nOiBgICtcbiAgICAgICAgICAgICAgICAgIGAke3RoaXMuZXJyb3JzXG4gICAgICAgICAgICAgICAgICAgICAgICAubWFwKGUgPT4gYCR7ZS5tZXNzYWdlfSAoJHtlLmxpbmVOdW1iZXJ9OiR7ZS5jb2x1bW59KWApXG4gICAgICAgICAgICAgICAgICAgICAgICAuam9pbignLCAnKX1gLFxuICAgIH0pXG4gIH1cbn1cblxuLyoqXG4gKiBwYXJzZSBkb2NzIGZyb20gdGhlIGZpcnN0IG5vZGUgdGhhdCBoYXMgbGVhZGluZyBjb21tZW50c1xuICovXG5mdW5jdGlvbiBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCAuLi5ub2Rlcykge1xuICBjb25zdCBtZXRhZGF0YSA9IHt9XG5cbiAgLy8gJ3NvbWUnIHNob3J0LWNpcmN1aXRzIG9uIGZpcnN0ICd0cnVlJ1xuICBub2Rlcy5zb21lKG4gPT4ge1xuICAgIHRyeSB7XG5cbiAgICAgIGxldCBsZWFkaW5nQ29tbWVudHNcblxuICAgICAgLy8gbi5sZWFkaW5nQ29tbWVudHMgaXMgbGVnYWN5IGBhdHRhY2hDb21tZW50c2AgYmVoYXZpb3JcbiAgICAgIGlmICgnbGVhZGluZ0NvbW1lbnRzJyBpbiBuKSB7XG4gICAgICAgIGxlYWRpbmdDb21tZW50cyA9IG4ubGVhZGluZ0NvbW1lbnRzXG4gICAgICB9IGVsc2UgaWYgKG4ucmFuZ2UpIHtcbiAgICAgICAgbGVhZGluZ0NvbW1lbnRzID0gc291cmNlLmdldENvbW1lbnRzQmVmb3JlKG4pXG4gICAgICB9XG5cbiAgICAgIGlmICghbGVhZGluZ0NvbW1lbnRzIHx8IGxlYWRpbmdDb21tZW50cy5sZW5ndGggPT09IDApIHJldHVybiBmYWxzZVxuXG4gICAgICBmb3IgKGxldCBuYW1lIGluIGRvY1N0eWxlUGFyc2Vycykge1xuICAgICAgICBjb25zdCBkb2MgPSBkb2NTdHlsZVBhcnNlcnNbbmFtZV0obGVhZGluZ0NvbW1lbnRzKVxuICAgICAgICBpZiAoZG9jKSB7XG4gICAgICAgICAgbWV0YWRhdGEuZG9jID0gZG9jXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gbWV0YWRhdGFcbn1cblxuY29uc3QgYXZhaWxhYmxlRG9jU3R5bGVQYXJzZXJzID0ge1xuICBqc2RvYzogY2FwdHVyZUpzRG9jLFxuICB0b21kb2M6IGNhcHR1cmVUb21Eb2MsXG59XG5cbi8qKlxuICogcGFyc2UgSlNEb2MgZnJvbSBsZWFkaW5nIGNvbW1lbnRzXG4gKiBAcGFyYW0gIHsuLi5bdHlwZV19IGNvbW1lbnRzIFtkZXNjcmlwdGlvbl1cbiAqIEByZXR1cm4ge3tkb2M6IG9iamVjdH19XG4gKi9cbmZ1bmN0aW9uIGNhcHR1cmVKc0RvYyhjb21tZW50cykge1xuICBsZXQgZG9jXG5cbiAgLy8gY2FwdHVyZSBYU0RvY1xuICBjb21tZW50cy5mb3JFYWNoKGNvbW1lbnQgPT4ge1xuICAgIC8vIHNraXAgbm9uLWJsb2NrIGNvbW1lbnRzXG4gICAgaWYgKGNvbW1lbnQudHlwZSAhPT0gJ0Jsb2NrJykgcmV0dXJuXG4gICAgdHJ5IHtcbiAgICAgIGRvYyA9IGRvY3RyaW5lLnBhcnNlKGNvbW1lbnQudmFsdWUsIHsgdW53cmFwOiB0cnVlIH0pXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvKiBkb24ndCBjYXJlLCBmb3Igbm93PyBtYXliZSBhZGQgdG8gYGVycm9ycz9gICovXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiBkb2Ncbn1cblxuLyoqXG4gICogcGFyc2UgVG9tRG9jIHNlY3Rpb24gZnJvbSBjb21tZW50c1xuICAqL1xuZnVuY3Rpb24gY2FwdHVyZVRvbURvYyhjb21tZW50cykge1xuICAvLyBjb2xsZWN0IGxpbmVzIHVwIHRvIGZpcnN0IHBhcmFncmFwaCBicmVha1xuICBjb25zdCBsaW5lcyA9IFtdXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgY29tbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjb21tZW50ID0gY29tbWVudHNbaV1cbiAgICBpZiAoY29tbWVudC52YWx1ZS5tYXRjaCgvXlxccyokLykpIGJyZWFrXG4gICAgbGluZXMucHVzaChjb21tZW50LnZhbHVlLnRyaW0oKSlcbiAgfVxuXG4gIC8vIHJldHVybiBkb2N0cmluZS1saWtlIG9iamVjdFxuICBjb25zdCBzdGF0dXNNYXRjaCA9IGxpbmVzLmpvaW4oJyAnKS5tYXRjaCgvXihQdWJsaWN8SW50ZXJuYWx8RGVwcmVjYXRlZCk6XFxzKiguKykvKVxuICBpZiAoc3RhdHVzTWF0Y2gpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGVzY3JpcHRpb246IHN0YXR1c01hdGNoWzJdLFxuICAgICAgdGFnczogW3tcbiAgICAgICAgdGl0bGU6IHN0YXR1c01hdGNoWzFdLnRvTG93ZXJDYXNlKCksXG4gICAgICAgIGRlc2NyaXB0aW9uOiBzdGF0dXNNYXRjaFsyXSxcbiAgICAgIH1dLFxuICAgIH1cbiAgfVxufVxuXG5FeHBvcnRNYXAuZ2V0ID0gZnVuY3Rpb24gKHNvdXJjZSwgY29udGV4dCkge1xuICBjb25zdCBwYXRoID0gcmVzb2x2ZShzb3VyY2UsIGNvbnRleHQpXG4gIGlmIChwYXRoID09IG51bGwpIHJldHVybiBudWxsXG5cbiAgcmV0dXJuIEV4cG9ydE1hcC5mb3IoY2hpbGRDb250ZXh0KHBhdGgsIGNvbnRleHQpKVxufVxuXG5FeHBvcnRNYXAuZm9yID0gZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgY29uc3QgeyBwYXRoIH0gPSBjb250ZXh0XG5cbiAgY29uc3QgY2FjaGVLZXkgPSBoYXNoT2JqZWN0KGNvbnRleHQpLmRpZ2VzdCgnaGV4JylcbiAgbGV0IGV4cG9ydE1hcCA9IGV4cG9ydENhY2hlLmdldChjYWNoZUtleSlcblxuICAvLyByZXR1cm4gY2FjaGVkIGlnbm9yZVxuICBpZiAoZXhwb3J0TWFwID09PSBudWxsKSByZXR1cm4gbnVsbFxuXG4gIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMocGF0aClcbiAgaWYgKGV4cG9ydE1hcCAhPSBudWxsKSB7XG4gICAgLy8gZGF0ZSBlcXVhbGl0eSBjaGVja1xuICAgIGlmIChleHBvcnRNYXAubXRpbWUgLSBzdGF0cy5tdGltZSA9PT0gMCkge1xuICAgICAgcmV0dXJuIGV4cG9ydE1hcFxuICAgIH1cbiAgICAvLyBmdXR1cmU6IGNoZWNrIGNvbnRlbnQgZXF1YWxpdHk/XG4gIH1cblxuICAvLyBjaGVjayB2YWxpZCBleHRlbnNpb25zIGZpcnN0XG4gIGlmICghaGFzVmFsaWRFeHRlbnNpb24ocGF0aCwgY29udGV4dCkpIHtcbiAgICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIG51bGwpXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIC8vIGNoZWNrIGZvciBhbmQgY2FjaGUgaWdub3JlXG4gIGlmIChpc0lnbm9yZWQocGF0aCwgY29udGV4dCkpIHtcbiAgICBsb2coJ2lnbm9yZWQgcGF0aCBkdWUgdG8gaWdub3JlIHNldHRpbmdzOicsIHBhdGgpXG4gICAgZXhwb3J0Q2FjaGUuc2V0KGNhY2hlS2V5LCBudWxsKVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHBhdGgsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuXG4gIC8vIGNoZWNrIGZvciBhbmQgY2FjaGUgdW5hbWJpZ3VvdXMgbW9kdWxlc1xuICBpZiAoIXVuYW1iaWd1b3VzLnRlc3QoY29udGVudCkpIHtcbiAgICBsb2coJ2lnbm9yZWQgcGF0aCBkdWUgdG8gdW5hbWJpZ3VvdXMgcmVnZXg6JywgcGF0aClcbiAgICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIG51bGwpXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIGxvZygnY2FjaGUgbWlzcycsIGNhY2hlS2V5LCAnZm9yIHBhdGgnLCBwYXRoKVxuICBleHBvcnRNYXAgPSBFeHBvcnRNYXAucGFyc2UocGF0aCwgY29udGVudCwgY29udGV4dClcblxuICAvLyBhbWJpZ3VvdXMgbW9kdWxlcyByZXR1cm4gbnVsbFxuICBpZiAoZXhwb3J0TWFwID09IG51bGwpIHJldHVybiBudWxsXG5cbiAgZXhwb3J0TWFwLm10aW1lID0gc3RhdHMubXRpbWVcblxuICBleHBvcnRDYWNoZS5zZXQoY2FjaGVLZXksIGV4cG9ydE1hcClcbiAgcmV0dXJuIGV4cG9ydE1hcFxufVxuXG5cbkV4cG9ydE1hcC5wYXJzZSA9IGZ1bmN0aW9uIChwYXRoLCBjb250ZW50LCBjb250ZXh0KSB7XG4gIHZhciBtID0gbmV3IEV4cG9ydE1hcChwYXRoKVxuXG4gIHRyeSB7XG4gICAgdmFyIGFzdCA9IHBhcnNlKHBhdGgsIGNvbnRlbnQsIGNvbnRleHQpXG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGxvZygncGFyc2UgZXJyb3I6JywgcGF0aCwgZXJyKVxuICAgIG0uZXJyb3JzLnB1c2goZXJyKVxuICAgIHJldHVybiBtIC8vIGNhbid0IGNvbnRpbnVlXG4gIH1cblxuICBpZiAoIXVuYW1iaWd1b3VzLmlzTW9kdWxlKGFzdCkpIHJldHVybiBudWxsXG5cbiAgY29uc3QgZG9jc3R5bGUgPSAoY29udGV4dC5zZXR0aW5ncyAmJiBjb250ZXh0LnNldHRpbmdzWydpbXBvcnQvZG9jc3R5bGUnXSkgfHwgWydqc2RvYyddXG4gIGNvbnN0IGRvY1N0eWxlUGFyc2VycyA9IHt9XG4gIGRvY3N0eWxlLmZvckVhY2goc3R5bGUgPT4ge1xuICAgIGRvY1N0eWxlUGFyc2Vyc1tzdHlsZV0gPSBhdmFpbGFibGVEb2NTdHlsZVBhcnNlcnNbc3R5bGVdXG4gIH0pXG5cbiAgLy8gYXR0ZW1wdCB0byBjb2xsZWN0IG1vZHVsZSBkb2NcbiAgaWYgKGFzdC5jb21tZW50cykge1xuICAgIGFzdC5jb21tZW50cy5zb21lKGMgPT4ge1xuICAgICAgaWYgKGMudHlwZSAhPT0gJ0Jsb2NrJykgcmV0dXJuIGZhbHNlXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBkb2MgPSBkb2N0cmluZS5wYXJzZShjLnZhbHVlLCB7IHVud3JhcDogdHJ1ZSB9KVxuICAgICAgICBpZiAoZG9jLnRhZ3Muc29tZSh0ID0+IHQudGl0bGUgPT09ICdtb2R1bGUnKSkge1xuICAgICAgICAgIG0uZG9jID0gZG9jXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7IC8qIGlnbm9yZSAqLyB9XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9KVxuICB9XG5cbiAgY29uc3QgbmFtZXNwYWNlcyA9IG5ldyBNYXAoKVxuXG4gIGZ1bmN0aW9uIHJlbW90ZVBhdGgodmFsdWUpIHtcbiAgICByZXR1cm4gcmVzb2x2ZS5yZWxhdGl2ZSh2YWx1ZSwgcGF0aCwgY29udGV4dC5zZXR0aW5ncylcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc29sdmVJbXBvcnQodmFsdWUpIHtcbiAgICBjb25zdCBycCA9IHJlbW90ZVBhdGgodmFsdWUpXG4gICAgaWYgKHJwID09IG51bGwpIHJldHVybiBudWxsXG4gICAgcmV0dXJuIEV4cG9ydE1hcC5mb3IoY2hpbGRDb250ZXh0KHJwLCBjb250ZXh0KSlcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldE5hbWVzcGFjZShpZGVudGlmaWVyKSB7XG4gICAgaWYgKCFuYW1lc3BhY2VzLmhhcyhpZGVudGlmaWVyLm5hbWUpKSByZXR1cm5cblxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZUltcG9ydChuYW1lc3BhY2VzLmdldChpZGVudGlmaWVyLm5hbWUpKVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZE5hbWVzcGFjZShvYmplY3QsIGlkZW50aWZpZXIpIHtcbiAgICBjb25zdCBuc2ZuID0gZ2V0TmFtZXNwYWNlKGlkZW50aWZpZXIpXG4gICAgaWYgKG5zZm4pIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmplY3QsICduYW1lc3BhY2UnLCB7IGdldDogbnNmbiB9KVxuICAgIH1cblxuICAgIHJldHVybiBvYmplY3RcbiAgfVxuXG4gIGZ1bmN0aW9uIGNhcHR1cmVEZXBlbmRlbmN5KGRlY2xhcmF0aW9uKSB7XG4gICAgaWYgKGRlY2xhcmF0aW9uLnNvdXJjZSA9PSBudWxsKSByZXR1cm4gbnVsbFxuICAgIGlmIChkZWNsYXJhdGlvbi5pbXBvcnRLaW5kID09PSAndHlwZScpIHJldHVybiBudWxsIC8vIHNraXAgRmxvdyB0eXBlIGltcG9ydHNcbiAgICBjb25zdCBpbXBvcnRlZFNwZWNpZmllcnMgPSBuZXcgU2V0KClcbiAgICBjb25zdCBzdXBwb3J0ZWRUeXBlcyA9IG5ldyBTZXQoWydJbXBvcnREZWZhdWx0U3BlY2lmaWVyJywgJ0ltcG9ydE5hbWVzcGFjZVNwZWNpZmllciddKVxuICAgIGxldCBoYXNJbXBvcnRlZFR5cGUgPSBmYWxzZVxuICAgIGlmIChkZWNsYXJhdGlvbi5zcGVjaWZpZXJzKSB7XG4gICAgICBkZWNsYXJhdGlvbi5zcGVjaWZpZXJzLmZvckVhY2goc3BlY2lmaWVyID0+IHtcbiAgICAgICAgY29uc3QgaXNUeXBlID0gc3BlY2lmaWVyLmltcG9ydEtpbmQgPT09ICd0eXBlJ1xuICAgICAgICBoYXNJbXBvcnRlZFR5cGUgPSBoYXNJbXBvcnRlZFR5cGUgfHwgaXNUeXBlXG5cbiAgICAgICAgaWYgKHN1cHBvcnRlZFR5cGVzLmhhcyhzcGVjaWZpZXIudHlwZSkgJiYgIWlzVHlwZSkge1xuICAgICAgICAgIGltcG9ydGVkU3BlY2lmaWVycy5hZGQoc3BlY2lmaWVyLnR5cGUpXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNwZWNpZmllci50eXBlID09PSAnSW1wb3J0U3BlY2lmaWVyJyAmJiAhaXNUeXBlKSB7XG4gICAgICAgICAgaW1wb3J0ZWRTcGVjaWZpZXJzLmFkZChzcGVjaWZpZXIuaW1wb3J0ZWQubmFtZSlcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG5cbiAgICAvLyBvbmx5IEZsb3cgdHlwZXMgd2VyZSBpbXBvcnRlZFxuICAgIGlmIChoYXNJbXBvcnRlZFR5cGUgJiYgaW1wb3J0ZWRTcGVjaWZpZXJzLnNpemUgPT09IDApIHJldHVybiBudWxsXG5cbiAgICBjb25zdCBwID0gcmVtb3RlUGF0aChkZWNsYXJhdGlvbi5zb3VyY2UudmFsdWUpXG4gICAgaWYgKHAgPT0gbnVsbCkgcmV0dXJuIG51bGxcbiAgICBjb25zdCBleGlzdGluZyA9IG0uaW1wb3J0cy5nZXQocClcbiAgICBpZiAoZXhpc3RpbmcgIT0gbnVsbCkgcmV0dXJuIGV4aXN0aW5nLmdldHRlclxuXG4gICAgY29uc3QgZ2V0dGVyID0gdGh1bmtGb3IocCwgY29udGV4dClcbiAgICBtLmltcG9ydHMuc2V0KHAsIHtcbiAgICAgIGdldHRlcixcbiAgICAgIHNvdXJjZTogeyAgLy8gY2FwdHVyaW5nIGFjdHVhbCBub2RlIHJlZmVyZW5jZSBob2xkcyBmdWxsIEFTVCBpbiBtZW1vcnkhXG4gICAgICAgIHZhbHVlOiBkZWNsYXJhdGlvbi5zb3VyY2UudmFsdWUsXG4gICAgICAgIGxvYzogZGVjbGFyYXRpb24uc291cmNlLmxvYyxcbiAgICAgIH0sXG4gICAgICBpbXBvcnRlZFNwZWNpZmllcnMsXG4gICAgfSlcbiAgICByZXR1cm4gZ2V0dGVyXG4gIH1cblxuICBjb25zdCBzb3VyY2UgPSBtYWtlU291cmNlQ29kZShjb250ZW50LCBhc3QpXG5cbiAgZnVuY3Rpb24gaXNFc01vZHVsZUludGVyb3AoKSB7XG4gICAgY29uc3QgdHNDb25maWdJbmZvID0gdHNDb25maWdMb2FkZXIoe1xuICAgICAgY3dkOiBjb250ZXh0LnBhcnNlck9wdGlvbnMgJiYgY29udGV4dC5wYXJzZXJPcHRpb25zLnRzY29uZmlnUm9vdERpciB8fCBwcm9jZXNzLmN3ZCgpLFxuICAgICAgZ2V0RW52OiAoa2V5KSA9PiBwcm9jZXNzLmVudltrZXldLFxuICAgIH0pXG4gICAgdHJ5IHtcbiAgICAgIGlmICh0c0NvbmZpZ0luZm8udHNDb25maWdQYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29uc3QganNvblRleHQgPSBmcy5yZWFkRmlsZVN5bmModHNDb25maWdJbmZvLnRzQ29uZmlnUGF0aCkudG9TdHJpbmcoKVxuICAgICAgICBpZiAoIXBhcnNlQ29uZmlnRmlsZVRleHRUb0pzb24pIHtcbiAgICAgICAgICAvLyB0aGlzIGlzIGJlY2F1c2UgcHJvamVjdHMgbm90IHVzaW5nIFR5cGVTY3JpcHQgd29uJ3QgaGF2ZSB0eXBlc2NyaXB0IGluc3RhbGxlZFxuICAgICAgICAgICh7cGFyc2VDb25maWdGaWxlVGV4dFRvSnNvbn0gPSByZXF1aXJlKCd0eXBlc2NyaXB0JykpXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdHNDb25maWcgPSBwYXJzZUNvbmZpZ0ZpbGVUZXh0VG9Kc29uKHRzQ29uZmlnSW5mby50c0NvbmZpZ1BhdGgsIGpzb25UZXh0KS5jb25maWdcbiAgICAgICAgcmV0dXJuIHRzQ29uZmlnLmNvbXBpbGVyT3B0aW9ucy5lc01vZHVsZUludGVyb3BcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cblxuICBhc3QuYm9keS5mb3JFYWNoKGZ1bmN0aW9uIChuKSB7XG4gICAgaWYgKG4udHlwZSA9PT0gJ0V4cG9ydERlZmF1bHREZWNsYXJhdGlvbicpIHtcbiAgICAgIGNvbnN0IGV4cG9ydE1ldGEgPSBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCBuKVxuICAgICAgaWYgKG4uZGVjbGFyYXRpb24udHlwZSA9PT0gJ0lkZW50aWZpZXInKSB7XG4gICAgICAgIGFkZE5hbWVzcGFjZShleHBvcnRNZXRhLCBuLmRlY2xhcmF0aW9uKVxuICAgICAgfVxuICAgICAgbS5uYW1lc3BhY2Uuc2V0KCdkZWZhdWx0JywgZXhwb3J0TWV0YSlcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChuLnR5cGUgPT09ICdFeHBvcnRBbGxEZWNsYXJhdGlvbicpIHtcbiAgICAgIGNvbnN0IGdldHRlciA9IGNhcHR1cmVEZXBlbmRlbmN5KG4pXG4gICAgICBpZiAoZ2V0dGVyKSBtLmRlcGVuZGVuY2llcy5hZGQoZ2V0dGVyKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gY2FwdHVyZSBuYW1lc3BhY2VzIGluIGNhc2Ugb2YgbGF0ZXIgZXhwb3J0XG4gICAgaWYgKG4udHlwZSA9PT0gJ0ltcG9ydERlY2xhcmF0aW9uJykge1xuICAgICAgY2FwdHVyZURlcGVuZGVuY3kobilcbiAgICAgIGxldCBuc1xuICAgICAgaWYgKG4uc3BlY2lmaWVycy5zb21lKHMgPT4gcy50eXBlID09PSAnSW1wb3J0TmFtZXNwYWNlU3BlY2lmaWVyJyAmJiAobnMgPSBzKSkpIHtcbiAgICAgICAgbmFtZXNwYWNlcy5zZXQobnMubG9jYWwubmFtZSwgbi5zb3VyY2UudmFsdWUpXG4gICAgICB9XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAobi50eXBlID09PSAnRXhwb3J0TmFtZWREZWNsYXJhdGlvbicpIHtcbiAgICAgIC8vIGNhcHR1cmUgZGVjbGFyYXRpb25cbiAgICAgIGlmIChuLmRlY2xhcmF0aW9uICE9IG51bGwpIHtcbiAgICAgICAgc3dpdGNoIChuLmRlY2xhcmF0aW9uLnR5cGUpIHtcbiAgICAgICAgICBjYXNlICdGdW5jdGlvbkRlY2xhcmF0aW9uJzpcbiAgICAgICAgICBjYXNlICdDbGFzc0RlY2xhcmF0aW9uJzpcbiAgICAgICAgICBjYXNlICdUeXBlQWxpYXMnOiAvLyBmbG93dHlwZSB3aXRoIGJhYmVsLWVzbGludCBwYXJzZXJcbiAgICAgICAgICBjYXNlICdJbnRlcmZhY2VEZWNsYXJhdGlvbic6XG4gICAgICAgICAgY2FzZSAnRGVjbGFyZUZ1bmN0aW9uJzpcbiAgICAgICAgICBjYXNlICdUU0RlY2xhcmVGdW5jdGlvbic6XG4gICAgICAgICAgY2FzZSAnVFNFbnVtRGVjbGFyYXRpb24nOlxuICAgICAgICAgIGNhc2UgJ1RTVHlwZUFsaWFzRGVjbGFyYXRpb24nOlxuICAgICAgICAgIGNhc2UgJ1RTSW50ZXJmYWNlRGVjbGFyYXRpb24nOlxuICAgICAgICAgIGNhc2UgJ1RTQWJzdHJhY3RDbGFzc0RlY2xhcmF0aW9uJzpcbiAgICAgICAgICBjYXNlICdUU01vZHVsZURlY2xhcmF0aW9uJzpcbiAgICAgICAgICAgIG0ubmFtZXNwYWNlLnNldChuLmRlY2xhcmF0aW9uLmlkLm5hbWUsIGNhcHR1cmVEb2Moc291cmNlLCBkb2NTdHlsZVBhcnNlcnMsIG4pKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBjYXNlICdWYXJpYWJsZURlY2xhcmF0aW9uJzpcbiAgICAgICAgICAgIG4uZGVjbGFyYXRpb24uZGVjbGFyYXRpb25zLmZvckVhY2goKGQpID0+XG4gICAgICAgICAgICAgIHJlY3Vyc2l2ZVBhdHRlcm5DYXB0dXJlKGQuaWQsXG4gICAgICAgICAgICAgICAgaWQgPT4gbS5uYW1lc3BhY2Uuc2V0KGlkLm5hbWUsIGNhcHR1cmVEb2Moc291cmNlLCBkb2NTdHlsZVBhcnNlcnMsIGQsIG4pKSkpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG5zb3VyY2UgPSBuLnNvdXJjZSAmJiBuLnNvdXJjZS52YWx1ZVxuICAgICAgbi5zcGVjaWZpZXJzLmZvckVhY2goKHMpID0+IHtcbiAgICAgICAgY29uc3QgZXhwb3J0TWV0YSA9IHt9XG4gICAgICAgIGxldCBsb2NhbFxuXG4gICAgICAgIHN3aXRjaCAocy50eXBlKSB7XG4gICAgICAgICAgY2FzZSAnRXhwb3J0RGVmYXVsdFNwZWNpZmllcic6XG4gICAgICAgICAgICBpZiAoIW4uc291cmNlKSByZXR1cm5cbiAgICAgICAgICAgIGxvY2FsID0gJ2RlZmF1bHQnXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGNhc2UgJ0V4cG9ydE5hbWVzcGFjZVNwZWNpZmllcic6XG4gICAgICAgICAgICBtLm5hbWVzcGFjZS5zZXQocy5leHBvcnRlZC5uYW1lLCBPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0TWV0YSwgJ25hbWVzcGFjZScsIHtcbiAgICAgICAgICAgICAgZ2V0KCkgeyByZXR1cm4gcmVzb2x2ZUltcG9ydChuc291cmNlKSB9LFxuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICBjYXNlICdFeHBvcnRTcGVjaWZpZXInOlxuICAgICAgICAgICAgaWYgKCFuLnNvdXJjZSkge1xuICAgICAgICAgICAgICBtLm5hbWVzcGFjZS5zZXQocy5leHBvcnRlZC5uYW1lLCBhZGROYW1lc3BhY2UoZXhwb3J0TWV0YSwgcy5sb2NhbCkpXG4gICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gZWxzZSBmYWxscyB0aHJvdWdoXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGxvY2FsID0gcy5sb2NhbC5uYW1lXG4gICAgICAgICAgICBicmVha1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdG9kbzogSlNEb2NcbiAgICAgICAgbS5yZWV4cG9ydHMuc2V0KHMuZXhwb3J0ZWQubmFtZSwgeyBsb2NhbCwgZ2V0SW1wb3J0OiAoKSA9PiByZXNvbHZlSW1wb3J0KG5zb3VyY2UpIH0pXG4gICAgICB9KVxuICAgIH1cblxuICAgIGNvbnN0IGlzRXNNb2R1bGVJbnRlcm9wVHJ1ZSA9IGlzRXNNb2R1bGVJbnRlcm9wKClcblxuICAgIGNvbnN0IGV4cG9ydHMgPSBbJ1RTRXhwb3J0QXNzaWdubWVudCddXG4gICAgaWYgKGlzRXNNb2R1bGVJbnRlcm9wVHJ1ZSkge1xuICAgICAgZXhwb3J0cy5wdXNoKCdUU05hbWVzcGFjZUV4cG9ydERlY2xhcmF0aW9uJylcbiAgICB9XG5cbiAgICAvLyBUaGlzIGRvZXNuJ3QgZGVjbGFyZSBhbnl0aGluZywgYnV0IGNoYW5nZXMgd2hhdCdzIGJlaW5nIGV4cG9ydGVkLlxuICAgIGlmIChpbmNsdWRlcyhleHBvcnRzLCBuLnR5cGUpKSB7XG4gICAgICBjb25zdCBleHBvcnRlZE5hbWUgPSBuLnR5cGUgPT09ICdUU05hbWVzcGFjZUV4cG9ydERlY2xhcmF0aW9uJ1xuICAgICAgICA/IG4uaWQubmFtZVxuICAgICAgICA6IChuLmV4cHJlc3Npb24gJiYgbi5leHByZXNzaW9uLm5hbWUgfHwgKG4uZXhwcmVzc2lvbi5pZCAmJiBuLmV4cHJlc3Npb24uaWQubmFtZSkgfHwgbnVsbClcbiAgICAgIGNvbnN0IGRlY2xUeXBlcyA9IFtcbiAgICAgICAgJ1ZhcmlhYmxlRGVjbGFyYXRpb24nLFxuICAgICAgICAnQ2xhc3NEZWNsYXJhdGlvbicsXG4gICAgICAgICdUU0RlY2xhcmVGdW5jdGlvbicsXG4gICAgICAgICdUU0VudW1EZWNsYXJhdGlvbicsXG4gICAgICAgICdUU1R5cGVBbGlhc0RlY2xhcmF0aW9uJyxcbiAgICAgICAgJ1RTSW50ZXJmYWNlRGVjbGFyYXRpb24nLFxuICAgICAgICAnVFNBYnN0cmFjdENsYXNzRGVjbGFyYXRpb24nLFxuICAgICAgICAnVFNNb2R1bGVEZWNsYXJhdGlvbicsXG4gICAgICBdXG4gICAgICBjb25zdCBleHBvcnRlZERlY2xzID0gYXN0LmJvZHkuZmlsdGVyKCh7IHR5cGUsIGlkLCBkZWNsYXJhdGlvbnMgfSkgPT4gaW5jbHVkZXMoZGVjbFR5cGVzLCB0eXBlKSAmJiAoXG4gICAgICAgIChpZCAmJiBpZC5uYW1lID09PSBleHBvcnRlZE5hbWUpIHx8IChkZWNsYXJhdGlvbnMgJiYgZGVjbGFyYXRpb25zLmZpbmQoKGQpID0+IGQuaWQubmFtZSA9PT0gZXhwb3J0ZWROYW1lKSlcbiAgICAgICkpXG4gICAgICBpZiAoZXhwb3J0ZWREZWNscy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gRXhwb3J0IGlzIG5vdCByZWZlcmVuY2luZyBhbnkgbG9jYWwgZGVjbGFyYXRpb24sIG11c3QgYmUgcmUtZXhwb3J0aW5nXG4gICAgICAgIG0ubmFtZXNwYWNlLnNldCgnZGVmYXVsdCcsIGNhcHR1cmVEb2Moc291cmNlLCBkb2NTdHlsZVBhcnNlcnMsIG4pKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGlmIChpc0VzTW9kdWxlSW50ZXJvcFRydWUpIHtcbiAgICAgICAgbS5uYW1lc3BhY2Uuc2V0KCdkZWZhdWx0Jywge30pXG4gICAgICB9XG4gICAgICBleHBvcnRlZERlY2xzLmZvckVhY2goKGRlY2wpID0+IHtcbiAgICAgICAgaWYgKGRlY2wudHlwZSA9PT0gJ1RTTW9kdWxlRGVjbGFyYXRpb24nKSB7XG4gICAgICAgICAgaWYgKGRlY2wuYm9keSAmJiBkZWNsLmJvZHkudHlwZSA9PT0gJ1RTTW9kdWxlRGVjbGFyYXRpb24nKSB7XG4gICAgICAgICAgICBtLm5hbWVzcGFjZS5zZXQoZGVjbC5ib2R5LmlkLm5hbWUsIGNhcHR1cmVEb2Moc291cmNlLCBkb2NTdHlsZVBhcnNlcnMsIGRlY2wuYm9keSkpXG4gICAgICAgICAgfSBlbHNlIGlmIChkZWNsLmJvZHkgJiYgZGVjbC5ib2R5LmJvZHkpIHtcbiAgICAgICAgICAgIGRlY2wuYm9keS5ib2R5LmZvckVhY2goKG1vZHVsZUJsb2NrTm9kZSkgPT4ge1xuICAgICAgICAgICAgICAvLyBFeHBvcnQtYXNzaWdubWVudCBleHBvcnRzIGFsbCBtZW1iZXJzIGluIHRoZSBuYW1lc3BhY2UsXG4gICAgICAgICAgICAgIC8vIGV4cGxpY2l0bHkgZXhwb3J0ZWQgb3Igbm90LlxuICAgICAgICAgICAgICBjb25zdCBuYW1lc3BhY2VEZWNsID0gbW9kdWxlQmxvY2tOb2RlLnR5cGUgPT09ICdFeHBvcnROYW1lZERlY2xhcmF0aW9uJyA/XG4gICAgICAgICAgICAgICAgbW9kdWxlQmxvY2tOb2RlLmRlY2xhcmF0aW9uIDpcbiAgICAgICAgICAgICAgICBtb2R1bGVCbG9ja05vZGVcblxuICAgICAgICAgICAgICBpZiAoIW5hbWVzcGFjZURlY2wpIHtcbiAgICAgICAgICAgICAgICAvLyBUeXBlU2NyaXB0IGNhbiBjaGVjayB0aGlzIGZvciB1czsgd2UgbmVlZG4ndFxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKG5hbWVzcGFjZURlY2wudHlwZSA9PT0gJ1ZhcmlhYmxlRGVjbGFyYXRpb24nKSB7XG4gICAgICAgICAgICAgICAgbmFtZXNwYWNlRGVjbC5kZWNsYXJhdGlvbnMuZm9yRWFjaCgoZCkgPT5cbiAgICAgICAgICAgICAgICAgIHJlY3Vyc2l2ZVBhdHRlcm5DYXB0dXJlKGQuaWQsIChpZCkgPT4gbS5uYW1lc3BhY2Uuc2V0KFxuICAgICAgICAgICAgICAgICAgICBpZC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCBkZWNsLCBuYW1lc3BhY2VEZWNsLCBtb2R1bGVCbG9ja05vZGUpXG4gICAgICAgICAgICAgICAgICApKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtLm5hbWVzcGFjZS5zZXQoXG4gICAgICAgICAgICAgICAgICBuYW1lc3BhY2VEZWNsLmlkLm5hbWUsXG4gICAgICAgICAgICAgICAgICBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCBtb2R1bGVCbG9ja05vZGUpKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBFeHBvcnQgYXMgZGVmYXVsdFxuICAgICAgICAgIG0ubmFtZXNwYWNlLnNldCgnZGVmYXVsdCcsIGNhcHR1cmVEb2Moc291cmNlLCBkb2NTdHlsZVBhcnNlcnMsIGRlY2wpKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gbVxufVxuXG4vKipcbiAqIFRoZSBjcmVhdGlvbiBvZiB0aGlzIGNsb3N1cmUgaXMgaXNvbGF0ZWQgZnJvbSBvdGhlciBzY29wZXNcbiAqIHRvIGF2b2lkIG92ZXItcmV0ZW50aW9uIG9mIHVucmVsYXRlZCB2YXJpYWJsZXMsIHdoaWNoIGhhc1xuICogY2F1c2VkIG1lbW9yeSBsZWFrcy4gU2VlICMxMjY2LlxuICovXG5mdW5jdGlvbiB0aHVua0ZvcihwLCBjb250ZXh0KSB7XG4gIHJldHVybiAoKSA9PiBFeHBvcnRNYXAuZm9yKGNoaWxkQ29udGV4dChwLCBjb250ZXh0KSlcbn1cblxuXG4vKipcbiAqIFRyYXZlcnNlIGEgcGF0dGVybi9pZGVudGlmaWVyIG5vZGUsIGNhbGxpbmcgJ2NhbGxiYWNrJ1xuICogZm9yIGVhY2ggbGVhZiBpZGVudGlmaWVyLlxuICogQHBhcmFtICB7bm9kZX0gICBwYXR0ZXJuXG4gKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWN1cnNpdmVQYXR0ZXJuQ2FwdHVyZShwYXR0ZXJuLCBjYWxsYmFjaykge1xuICBzd2l0Y2ggKHBhdHRlcm4udHlwZSkge1xuICAgIGNhc2UgJ0lkZW50aWZpZXInOiAvLyBiYXNlIGNhc2VcbiAgICAgIGNhbGxiYWNrKHBhdHRlcm4pXG4gICAgICBicmVha1xuXG4gICAgY2FzZSAnT2JqZWN0UGF0dGVybic6XG4gICAgICBwYXR0ZXJuLnByb3BlcnRpZXMuZm9yRWFjaChwID0+IHtcbiAgICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUocC52YWx1ZSwgY2FsbGJhY2spXG4gICAgICB9KVxuICAgICAgYnJlYWtcblxuICAgIGNhc2UgJ0FycmF5UGF0dGVybic6XG4gICAgICBwYXR0ZXJuLmVsZW1lbnRzLmZvckVhY2goKGVsZW1lbnQpID0+IHtcbiAgICAgICAgaWYgKGVsZW1lbnQgPT0gbnVsbCkgcmV0dXJuXG4gICAgICAgIHJlY3Vyc2l2ZVBhdHRlcm5DYXB0dXJlKGVsZW1lbnQsIGNhbGxiYWNrKVxuICAgICAgfSlcbiAgICAgIGJyZWFrXG5cbiAgICBjYXNlICdBc3NpZ25tZW50UGF0dGVybic6XG4gICAgICBjYWxsYmFjayhwYXR0ZXJuLmxlZnQpXG4gICAgICBicmVha1xuICB9XG59XG5cbi8qKlxuICogZG9uJ3QgaG9sZCBmdWxsIGNvbnRleHQgb2JqZWN0IGluIG1lbW9yeSwganVzdCBncmFiIHdoYXQgd2UgbmVlZC5cbiAqL1xuZnVuY3Rpb24gY2hpbGRDb250ZXh0KHBhdGgsIGNvbnRleHQpIHtcbiAgY29uc3QgeyBzZXR0aW5ncywgcGFyc2VyT3B0aW9ucywgcGFyc2VyUGF0aCB9ID0gY29udGV4dFxuICByZXR1cm4ge1xuICAgIHNldHRpbmdzLFxuICAgIHBhcnNlck9wdGlvbnMsXG4gICAgcGFyc2VyUGF0aCxcbiAgICBwYXRoLFxuICB9XG59XG5cblxuLyoqXG4gKiBzb21ldGltZXMgbGVnYWN5IHN1cHBvcnQgaXNuJ3QgX3RoYXRfIGhhcmQuLi4gcmlnaHQ/XG4gKi9cbmZ1bmN0aW9uIG1ha2VTb3VyY2VDb2RlKHRleHQsIGFzdCkge1xuICBpZiAoU291cmNlQ29kZS5sZW5ndGggPiAxKSB7XG4gICAgLy8gRVNMaW50IDNcbiAgICByZXR1cm4gbmV3IFNvdXJjZUNvZGUodGV4dCwgYXN0KVxuICB9IGVsc2Uge1xuICAgIC8vIEVTTGludCA0LCA1XG4gICAgcmV0dXJuIG5ldyBTb3VyY2VDb2RlKHsgdGV4dCwgYXN0IH0pXG4gIH1cbn1cbiJdfQ==