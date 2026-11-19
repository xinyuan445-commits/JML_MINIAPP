const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const text = fs.readFileSync(path.join(__dirname, '../src/pages/mo/production-label/index.tsx'), 'utf8');
const source = ts.createSourceFile('index.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function initializer(name) {
  let result;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) result = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(result, `Missing ${name}`);
  return ts.transpileModule(`module.exports = ${result}`, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
}
function evaluate(name, scope) {
  const module = {exports: {}};
  new Function('module', ...Object.keys(scope), initializer(name))(module, ...Object.values(scope));
  return module.exports;
}
function harness(overrides = {}) {
  const events = [];
  const win = {close: () => events.push('window-close'), document: {
    write: (html) => events.push(['html', html]), close: () => events.push('document-close'),
  }};
  const scope = {
    canPrint: true, isOutsource: true,
    document: {getElementById: () => ({cloneNode: () => ({outerHTML: '<div>exact-preview</div>', querySelectorAll: () => [{}]})})},
    window: {open: () => {events.push('window-open'); return win;}},
    message: {error: (message) => events.push(['error', message])},
    data: {header: {mo_code: 'TEST'}}, lines: [{}], materials: [{}], pages: [{}], materialPrintPages: [{}, {}],
    logOutsourceDocumentPrint: async (payload) => { events.push(['outsource-authorized', payload]); return {code: 0}; },
    logProductionLabelPrint: async (payload) => { events.push(['production-authorized', payload]); return {code: 0}; },
    FINISHED_GOODS_STYLES: '', OUTSOURCE_ORDER_STYLES: '', OUTSOURCE_MATERIAL_STYLES: '', pageTitle: '测试标签',
    ...overrides,
  };
  return {events, print: evaluate('handlePrint', scope)};
}
test('no print permission never opens a window or calls print authorization', async () => {
  const {events, print} = harness({canPrint: false});
  await print();
  assert.deepEqual(events, []);
});
test('rejected server authorization closes the blank window without exposing printable content', async () => {
  const {events, print} = harness({logOutsourceDocumentPrint: async () => {throw new Error('403');}});
  await print();
  assert.ok(events.includes('window-close'));
  assert.ok(!events.some((event) => event[0] === 'html'));
});
test('business authorization failure also stops printing', async () => {
  const {events, print} = harness({logOutsourceDocumentPrint: async () => ({code: 403})});
  await print();
  assert.ok(events.includes('window-close'));
  assert.ok(!events.includes('document-close'));
});
for (const isOutsource of [true, false]) {
  test(`authorized ${isOutsource ? 'outsource' : 'production'} print retains the exact preview DOM`, async () => {
    const {events, print} = harness({isOutsource});
    await print();
    const authorizationIndex = events.findIndex((event) => event[0] === (isOutsource ? 'outsource-authorized' : 'production-authorized'));
    const htmlIndex = events.findIndex((event) => event[0] === 'html');
    assert.ok(authorizationIndex >= 0 && htmlIndex > authorizationIndex);
    assert.ok(events[htmlIndex][1].includes('<div>exact-preview</div>'));
    if (isOutsource) assert.equal(events[authorizationIndex][1].page_count, 3);
    assert.ok(events.includes('document-close'));
  });
}
test('outsource material copies remain first-copy pages then second-copy pages', () => {
  const materialPages = [[{id: 1}], [{id: 2}]];
  const copies = evaluate('materialPrintPages', {isOutsource: true, materialPages});
  assert.deepEqual(copies.map((page) => [page.copyName, page.pageIndex]), [['第一联', 0], ['第一联', 1], ['第二联', 0], ['第二联', 1]]);
  assert.equal(evaluate('materialPrintPages', {isOutsource: false, materialPages}).length, 2);
});
