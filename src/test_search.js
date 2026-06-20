// 驗證搜尋核心 + 效能：跑 Kiwi 的真實查詢案例
const fs = require("fs"), path = require("path");
const C = require("./search_core.js");
const DB = JSON.parse(fs.readFileSync(path.join(__dirname,"../build/icd_data.json"),"utf8"));
const IDX = DB.entries.map(e=>C.indexEntry(e,e.k));

function top(q,n=3){
  return C.searchCore(IDX,q,"all").slice(0,n).map(([sc,it])=>{
    const ch = it.e.s7 ? (it.e.s7.includes("A")?"A":it.e.s7[0]) : "";
    return {code:C.buildCode(it.e.c,ch), zh:it.e.zh, en:it.e.en, s7:it.e.s7||"", score:+sc.toFixed(2)};
  });
}

const cases = [
  ["contusion of left forearm","S50.12"],
  ["contusoin lt forearm","S50.12"],
  ["lt radial fx","S52"],
  ["頭部撕裂傷","S01"],
  ["前臂挫傷","S50"],
  ["ankle sprain right","S93"],
  ["cellulitis","L03"],
  ["cellulitis of left leg","L03.116"],
  ["liver abscess","K75.0"],
  ["bronchopneumonia","J18.0"],
  ["severe sepsis with septic shock","R65.21"],
  ["sepsis","A41.9"],
  ["cat bite","W55.01"],
  ["cat bitten","W55.01"],
  ["dog bite","W54.0"],
  ["bee sting","T63.4"],
  ["chest pain","R07"],
  ["腹痛","R10"],
  ["UTI","N39.0"],
  ["pneumonia","J18.9"],
  ["acute appendicitis","K35"],
  ["糖尿病","E11"],
  ["traumatic intracerebral hemorrhage","S06.3"],
  ["ICH, traumatic","S06.3"],
  ["nontraumatic intracerebral hemorrhage","I61"],
  ["GB stone","K80"],
  ["kidney stone","N20.0"],
  ["renal calculus","N20.0"],
  ["ureteral stone","N20.1"],
  ["SAH","I60"],
  ["N20.1","N20.1"],        // 代碼反查
  ["N20","N20"],            // 代碼前綴 → 列出該段
  ["S50.12XA","S50.12"],    // 完整碼(含第7碼)→ 主幹
  ["abscess anus","K61.0"],       // 字母索引：俗稱→碼
  ["perianal abscess","K61.0"],   // 字母索引別名
  ["anal fissure","K60.2"],       // 字母索引
  ["right middle finger laceration","S61.21"],  // 單純傷口應勝肌腱傷
];

// ED 排序守門：手指撕裂傷，單純開放傷 S61 應排在肌腱傷 S56 之前
function fingerGuard(){
  const r=C.searchCore(IDX,"right middle finger laceration","all").slice(0,5).map(x=>x[1].e.c);
  const s61=r.findIndex(c=>c.startsWith("S61.21"));
  const s56=r.findIndex(c=>c.startsWith("S56"));
  const ok = s61>=0 && (s56<0 || s61<s56);
  console.log((ok?"✅":"❌")+" 手指傷守門：finger laceration 前5名 = "+r.join(", "));
  return ok;
}

// 極性相反守門：查 traumatic 時，S06 創傷性必須排在 I61 非創傷性之前
function polarityGuard(){
  const r=C.searchCore(IDX,"ICH, traumatic","all").slice(0,5).map(x=>x[1].e.c);
  const s06=r.findIndex(c=>c.startsWith("S06"));
  const i61=r.findIndex(c=>c.startsWith("I61"));
  const ok = s06>=0 && (i61<0 || s06<i61);
  console.log((ok?"✅":"❌")+" 極性守門：traumatic ICH 前5名 = "+r.join(", "));
  return ok;
}

let pass=0;
for(const [q,exp] of cases){
  const r = top(q,3);
  const hit = r.some(x=>x.code.startsWith(exp));
  console.log((hit?"✅":"❌")+" \""+q+"\"  期望含 "+exp);
  r.forEach(x=>console.log("    "+x.code.padEnd(11)+" | "+x.zh+"  ["+x.en.slice(0,40)+"] sc="+x.score));
  if(hit)pass++; else console.log("    ⚠ 未命中");
  console.log();
}

// 效能
const qs=["contusion left forearm","cellulitis","severe sepsis with septic shock","糖尿病","cat bite"];
const t0=Date.now(); const N=20;
for(let i=0;i<N;i++) for(const q of qs) C.searchCore(IDX,q,"all");
const ms=(Date.now()-t0)/(N*qs.length);
const guardOk = polarityGuard();
const fingerOk = fingerGuard();
console.log(`=== ${pass}/${cases.length} 通過 ｜ 平均單次查詢 ${ms.toFixed(1)} ms（${IDX.length} 條目）===`);
process.exit(pass===cases.length && guardOk && fingerOk?0:1);
