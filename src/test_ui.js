// Exercise the actual template functions without a browser, network or patient data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const core=require('./search_core.js');
const data=require('../build/icd_data.json');
const template=fs.readFileSync(path.join(__dirname,'template.html'),'utf8');
const ui=template.slice(template.indexOf('function seventhLabel'),template.indexOf('let theme ='));
function loadTraumaMap(){
  const context=vm.createContext({});
  const start=template.indexOf('function injuryEntry');
  const end=template.indexOf('let traumaInjury=');
  assert.notEqual(start,-1,'找不到 injuryEntry');
  assert.notEqual(end,-1,'找不到 trauma state');
  vm.runInContext(`${template.slice(start,end)}\nglobalThis.__map=ANATOMICAL_MAP;globalThis.__noMatch=NO_MATCH_PREFIX;`,context);
  return {map:context.__map,noMatch:context.__noMatch};
}
function setup(){
  const nodes={out:{innerHTML:''},status:{textContent:''},code0:{dataset:{code:''}}};
  const context=vm.createContext({...core,DB:{entries:[]},SEVENTH:{A:'初期照護',D:'後續照護',S:'後遺症'},
    noDot:true,navigator:{},document:{getElementById:id=>nodes[id]},setTimeout,clearTimeout});
  vm.runInContext(ui,context);
  return {context,nodes};
}
const entry={c:'S50.12',en:'Contusion of left forearm',zh:'左前臂挫傷',s7:'ADS',k:'inj'};
test('bone-specific trauma sort terms are fracture-only',()=>{
  const {map}=loadTraumaMap();
  assert.equal(map.wrist.sprain.q,'wrist');
  assert.equal(map.wrist.abrasion.q,'wrist');
  assert.equal(map.wrist.contusion.q,'wrist');
  assert.equal(map.wrist.laceration.q,'wrist');
  assert.equal(map.wrist.fracture.q,'wrist distal radius');
  assert.equal(map.elbow.sprain.q,'elbow');
  assert.equal(map.elbow.fracture.q,'elbow forearm humerus');
  assert.equal(map.knee.sprain.q,'knee');
  assert.equal(map.knee.fracture.q,'knee patella');
});
test('all valid trauma body-map part, injury and side combinations have results',()=>{
  const {map,noMatch}=loadTraumaMap();
  const index=data.entries.map(e=>core.indexEntry(e,e.k==='inj'?'inj':e.k==='ext'?'ext':'dx'));
  const sides=['','left','right','bilateral'];
  for(const [part,injuries] of Object.entries(map)){
    for(const [injury,config] of Object.entries(injuries)){
      if(!config.prefixes.length||config.prefixes.includes(noMatch)) continue;
      for(const side of sides){
        const query=[injury,side,config.q].filter(Boolean).join(' ');
        const results=core.searchCore(index,query,'all',config.prefixes);
        assert.ok(results.length>0,`外傷小人查無結果：${part} / ${injury} / ${side||'unspecified'} / ${query}`);
      }
    }
  }
});
test('injury cards default to A and copy by clicking the code itself',()=>{
  const {context}=setup();
  const html=context.card(core.indexEntry(entry,'inj'),core.norm('left forearm contusion'),0,'left forearm contusion');
  assert.match(html,/data-code="S50\.12XA"/);
  assert.match(html,/class="code"[^>]+onclick="cardCopy\(0\)"/);
  assert.doesNotMatch(html,/class="copybtn"/);
  assert.doesNotMatch(html,/>複製代碼<\/button>/);
  assert.doesNotMatch(html,/id="add0" disabled/);
});
test('an explicit complete code retains its seventh character',()=>{
  const {context}=setup();
  const html=context.card(core.indexEntry(entry,'inj'),[],0,'S50.12XS');
  assert.match(html,/data-code="S50\.12XS"/);
  assert.doesNotMatch(html,/class="code"[^>]+disabled/);
});
test('simple open fracture seventh character B does not invent a Gustilo subtype',()=>{
  const {context}=setup();
  const e={...entry,en:'Fracture of humerus',s7:'ABDGKPS'};
  assert.equal(context.seventhLabel(e,'B'),'初期照護（開放性骨折）');
});
test('rendered metadata and query warnings cannot become HTML',()=>{
  const {context,nodes}=setup();
  const e={...entry,zh:'<img src=x onerror=alert(1)>'};
  assert.match(context.card(core.indexEntry(e,'inj'),[],0,''),/&lt;img/);
  assert.doesNotMatch(context.card(core.indexEntry(e,'inj'),[],0,''),/<img/);
  const invalid={...entry,c:'X00.0" autofocus onfocus="alert(1)'};
  assert.equal(context.card(core.indexEntry(invalid,'inj'),[],0,''),'');
  context.analyzeQuery=()=>({queries:[],blocked:true,warnings:['<script>bad()</script>']});
  context.search('synthetic');
  assert.match(nodes.out.innerHTML,/&lt;script&gt;/);
});
test('incomplete code never reaches the clipboard',async()=>{
  const {context,nodes}=setup();let writes=0;
  context.navigator.clipboard={writeText:async()=>{writes++;}};
  await context.cardCopy(0);
  assert.equal(writes,0);
  assert.match(nodes.status.textContent,/先選擇照護階段/);
});
test('clipboard denial is reported as failure rather than success',async()=>{
  const {context,nodes}=setup();
  context.navigator.clipboard={writeText:async()=>{throw new Error('denied');}};
  assert.equal(await context.copyText('S5012XA'),false);
  assert.match(nodes.status.textContent,/無法/);
  assert.doesNotMatch(nodes.status.textContent,/已複製/);
});
test('multi-site trauma copies from the rendered ICD-10 code instead of opening candidates',()=>{
  assert.match(template,/class="mcode" onclick="multiCopy\(\$\{i\},this\)"/);
  assert.match(template,/async function multiCopy\(i,button\)/);
  assert.doesNotMatch(template,/function multiCopy\(i\)\{[\s\S]{0,240}applyQuery/);
});
test('feedback does not auto-submit or persist query and note',()=>{
  assert.doesNotMatch(template,/formResponse|no-cors|localStorage\.setItem\(["']fb["']/);
  assert.match(template,/viewform/);
  assert.match(template,/maxlength="1000"/);
  assert.match(template,/placeholder="例：PN 應能找到 pneumonia"/);
  assert.doesNotMatch(template,/maximum-scale=1/);
});

test('bilateral fracture chips do not duplicate or mislabel unsided codes',()=>{
  const nodes={chipsTitle:{},chipsWrap:{querySelectorAll:()=>[]},chipsPanel:{classList:{remove:()=>{}}}};
  const context=vm.createContext({document:{getElementById:id=>nodes[id]},
    FRACTURE_CHIPS:{chest:[['胸骨',{U:'S22.20'}],['肋骨',{R:'S22.31',L:'S22.32'}]]},
    SIDE_LABEL:{bilateral:'雙側'},chipEntry:c=>({c,zh:'test'}),esc:s=>s});
  vm.runInContext(template.slice(template.indexOf('function showFractureChips'),template.indexOf('function applyQuery')),context);
  context.showFractureChips('chest','bilateral');
  const html=nodes.chipsWrap.innerHTML;
  assert.equal((html.match(/data-stem="S22.20"/g)||[]).length,1);
  assert.doesNotMatch(html,/(右側|左側) 胸骨/);
  assert.match(html,/右側 肋骨/);
  assert.match(html,/左側 肋骨/);
});
