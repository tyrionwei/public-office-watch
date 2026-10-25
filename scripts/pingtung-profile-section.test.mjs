import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {pingtungProfileListHtml as extract} from './lib/pingtung-profile-section.mjs';
test('education stops at its own closed list, excluding footer',()=>{
  const list='<ul><li>大學</li><li>高中</li></ul>';
  assert.equal(extract('<h4>縣長學歷</h4>'+list+'<footer>資安政策地址電話</footer>','縣長學歷'),list);
});
test('nested experience lists are retained completely',()=>{
  const list='<ul><li>委員<ul><li>第9屆</li></ul></li><li>律師</li></ul>';
  assert.equal(extract('<h4>縣長經歷</h4>'+list+'<h4>縣長學歷</h4><ul><li>學校</li></ul>','縣長經歷'),list);
});
test('missing heading fails closed',()=>assert.throws(()=>extract('<ul></ul>','縣長學歷')));
test('duplicate heading fails closed',()=>assert.throws(()=>extract('<h4>縣長學歷</h4><ul></ul><h4>縣長學歷</h4><ul></ul>','縣長學歷')));
test('missing list fails closed',()=>assert.throws(()=>extract('<h4>縣長學歷</h4><div>其他文字</div><ul></ul>','縣長學歷')));
test('unclosed list fails closed',()=>assert.throws(()=>extract('<h4>縣長學歷</h4><ul><li>學校</li>','縣長學歷')));
test('commented section is inert',()=>assert.throws(()=>extract('<!-- <h4>縣長學歷</h4><ul></ul> -->','縣長學歷')));
test('comment cannot truncate list',()=>assert.equal(extract('<h4>縣長學歷</h4><ul><li>大學</li><!-- </ul> --><li>高中</li></ul>','縣長學歷'),'<ul><li>大學</li><li>高中</li></ul>'));
test('script cannot create section',()=>assert.throws(()=>extract('<script>"<h4>縣長學歷</h4><ul></ul>"</script>','縣長學歷')));
test('script cannot close list',()=>assert.equal(extract('<h4>縣長學歷</h4><ul><li>大學</li><script>"</ul>"</script><li>高中</li></ul>','縣長學歷'),'<ul><li>大學</li><li>高中</li></ul>'));
test('unclosed education cannot consume experience',()=>assert.throws(()=>extract('<h4>縣長學歷</h4><ul><li>大學</li><h4>縣長經歷</h4><ul><li>經歷</li></ul></ul>','縣長學歷')));
test('footer boundary fails closed',()=>assert.throws(()=>extract('<h4>縣長學歷</h4><ul><li>大學</li><footer></footer></ul>','縣長學歷')));
test('container boundary fails closed',()=>assert.throws(()=>extract('<div><h4>縣長學歷</h4><ul><li>大學</li></div></ul>','縣長學歷')));
test('quoted attribute is not returned as markup',()=>assert.equal(extract('<h4>縣長學歷</h4><ul><li title="x > </ul>">大學</li><li>高中</li></ul>','縣長學歷'),'<ul><li>大學</li><li>高中</li></ul>'));

// Exercise the actual final parser and legacy cleanText, without importing its
// environment/network side effects. Only output-object construction is stubbed.
function finalProfile(html) {
  const code = fs.readFileSync(new URL('./fetch-pingtung-county-official-person-profiles.mjs', import.meta.url), 'utf8');
  const ctx = vm.createContext({ pingtungProfileListHtml: extract,
    profileRowFromPage: (_page, name, education, experience) => ({name, education, experience}) });
  for (const name of ['decodeHtml','cleanText','parseMagistrateProfile']) {
    const body = code.match(new RegExp('function ' + name + '\\([^]*?(?=\\nfunction )'));
    assert.ok(body); vm.runInContext(body[0], ctx);
  }
  return ctx.parseMagistrateProfile(html, {expectedNames:['周春米'],url:'https://www.pthg.gov.tw/'})[0];
}
const profileHtml = (first) => '周春米<h4>縣長經歷</h4><ul><li>委員<ul><li>第9屆</li></ul></li><li>律師</li></ul><h4>縣長學歷</h4><ul>' + first + '<li>高中</li></ul>';
test('final fields reject attribute markup contamination',()=>{
  const p=finalProfile(profileHtml('<li title="x > <h4>錯欄經歷</h4>">大學</li>'));
  assert.equal(p.education,'大學\n高中'); assert.equal(p.experience,'委員第9屆\n律師');
});
test('final fields preserve second item across comment/script text',()=>{
  const p=finalProfile(profileHtml('<li>大學</li><!-- </ul> --><script>"</ul>"</script>'));
  assert.equal(p.education,'大學\n高中'); assert.equal(p.experience,'委員第9屆\n律師');
});
test('final fields fail closed across another heading',()=>assert.throws(()=>finalProfile(profileHtml('<li>大學</li><h4>縣長經歷</h4><ul><li>錯欄</li></ul>'))));
