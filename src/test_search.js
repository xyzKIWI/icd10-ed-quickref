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
  ["right ring finger laceration","S61.2"],      // 不同手指
  ["lt index finger laceration","S61.2"],
  ["rt middle toe laceration","S91.11"],         // 腳趾：middle toe→lesser toe 撕裂傷
  ["big toe laceration","S91.11"],               // great toe
  ["toe laceration","S91.1"],
  ["fracture left tibia","S82"],
  ["fracture left fibula","S82"],
  ["radius fracture","S52"],
  ["ulna fracture","S52"],
  ["both bone forearm fracture","S52"],
  ["olecranon fracture","S52.0"],
  ["radial head fracture","S52.12"],
  ["radial neck fracture","S52.13"],
  ["distal humerus fracture","S42.4"],
  ["metacarpal fracture","S62.3"],
  ["thumb phalanx fracture","S62.5"],
  ["index finger phalanx fracture","S62.6"],
  ["middle finger phalanx fracture","S62.6"],
  ["ring finger phalanx fracture","S62.6"],
  ["little finger phalanx fracture","S62.6"],
  ["metatarsal fracture","S92.3"],
  ["great toe fracture","S92.4"],
  ["lesser toe fracture","S92.5"],
  // 真實 KMUH 急診措辭（縮寫/尾綴/連字號）
  ["pn","J18"],
  ["ugi bleeding","K92"],
  ["covid-19","U07.1"],
  ["fever, cause to be determined","R50.9"],
  ["dizzy","R42"],
  ["chest pain, cause to be determined","R07"],
  ["epigastralgia","R10"],
  ["lbp","M54"],
  ["apn","N10"],
  ["psvt","I47.1"],
  // ask-all 縮寫稽核 + P0 臨床安全(2026-06-23)
  ["aod","I71.0"],                  // 主動脈剝離
  ["aom","H66.0"],                  // 急性化膿性中耳炎(非 H65 漿液性)
  ["ptx","J93"],["htx","J94.2"],
  ["vf","I49.01"],["ha","R51.9"],
  ["appy","K35"],["bppv","H81.1"],
  ["brbpr","K62.5"],
  ["nv","R11.2"],["n/v","R11.2"],   // n/v 不再誤命中眼科 V pattern
  ["coma","R40.20"],                // 不再被 DKA 蓋過
  ["stroke","I63.9"],               // 腦梗塞(非中風症候群/家族史)
  ["overdose","T50.90"],["drug overdose","T50.90"],
  ["unconscious","R41.82"],["意識不清","R41.82"],  // = AMS
  ["無力","R53.1"],
  ["t1dm","E10"],["t2dm","E11"],["ptb","A15.0"],
  // 臨床回饋修正(2026-06-22)
  ["nasal bleeding","R04.0"],
  ["gum bleeding","K06.8"],
  ["sinusitis","J01"],
  // 精確度(IDF)與同義詞修正
  ["age","A09"],                          // 不再噴 acute MI；腸胃炎
  ["acute gastroenteritis","A09"],
  ["subconjunctival hemorrhage","H11.3"], // sub-/typo→conjunctival
  ["subconjuntiva hemorrhage","H11.3"],
  ["acute appendicitis","K35.80"],        // 精準，不被一堆 acute 淹沒
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
// 側別守門：沒查左右時，未明示側性(S06.36x)應排在 left(S06.35x)/right(S06.34x)之前
function lateralityGuard(){
  const r=C.searchCore(IDX,"traumatic ICH","all").slice(0,5).map(x=>x[1].e.c);
  const uns=r.findIndex(c=>c.startsWith("S06.36"));
  const side=r.findIndex(c=>c.startsWith("S06.34")||c.startsWith("S06.35"));
  const ok = uns>=0 && (side<0 || uns<side);
  console.log((ok?"✅":"❌")+" 側別守門：traumatic ICH(未指定側) 前5名 = "+r.join(", "));
  return ok;
}

// 小人圖碼段白名單守門：prefixes 必須硬過濾，不可查無 fallback 到全域錯碼
function prefixGuard(){
  const guards=[
    ["上背骨折 S22，不可跑出顱骨 S02","fracture",["S22"],["S22"],["S02"]],
    ["下背骨折 S32，不可跑出顱骨 S02","fracture",["S32"],["S32"],["S02"]],
    ["前臂骨折 refine 只留 S52","radius fracture",["S52"],["S52"],["S42","S62"]],
    ["手部骨折 refine 只留 S62","metacarpal fracture",["S62"],["S62"],["S52"]],
    ["後胸壁挫傷只留 S20.22/S20.4","contusion back wall thorax",["S20.22","S20.4"],["S20.22","S20.4"],["S20.0","S20.1","S20.21","S20.3"]],
    ["前胸壁挫傷不可含後胸 S20.22","contusion front wall thorax",["S20.0","S20.1","S20.21","S20.3"],["S20.0","S20.1","S20.21","S20.3"],["S20.22","S20.4"]],
    ["肩胛骨折只留 S42.1","scapula fracture",["S42.1"],["S42.1"],["S42.0","S42.2","S42.3"]],
    ["跟腱傷只留 S86.0","achilles tendon",["S86.0"],["S86.0"],["S86.1","S86.2","S86.3","S86.8","S86.9"]],
    ["下背挫傷只留 S30.0 且不可含腹壁 S30.1","contusion lower back pelvis",["S30.0"],["S30.0"],["S30.1"]],
    ["前/後軀幹燒傷只留 T21","burn chest abdomen",["T21"],["T21"],["T20","T22","T23","T24","T25"]],
    ["鼻骨折只留 S02.2","nasal bone fracture",["S02.2"],["S02.2"],["S02.3","S02.4","S02.5","S02.6"]],
    ["眼眶骨折只留 S02.3","orbital floor fracture",["S02.3"],["S02.3"],["S02.2","S02.4","S02.5","S02.6"]],
    ["眼球傷只留 S05","eye injury corneal abrasion",["S05"],["S05"],["S00","S01","S02"]],
    ["下顎骨折只留 S02.6","mandible jaw fracture",["S02.6"],["S02.6"],["S02.2","S02.3","S02.4","S02.5"]],
    ["拇指骨折只留 S62.5","thumb phalanx fracture",["S62.5"],["S62.5"],["S62.3","S62.6"]],
    ["大腳趾骨折只留 S92.4","great toe fracture",["S92.4"],["S92.4"],["S92.3","S92.5"]],
    ["頭皮撕裂只留 S01.0","scalp laceration",["S01.0"],["S01.0"],["S01.1","S01.2","S01.5"]],
    ["腳跟骨折只留 S92.0","calcaneus heel fracture",["S92.0"],["S92.0"],["S92.3","S92.4","S92.5"]],
  ];
  let okAll=true;
  for(const [label,q,prefixes,want,deny] of guards){
    const codes=C.searchCore(IDX,q,"all",prefixes).slice(0,10).map(x=>x[1].e.c);
    const ok=codes.length>0 && codes.every(c=>want.some(p=>c.startsWith(p))) && !codes.some(c=>deny.some(p=>c.startsWith(p)));
    console.log((ok?"✅":"❌")+" prefixes 守門："+label+" 前10名 = "+(codes.join(", ")||"(空)"));
    if(!ok) okAll=false;
  }
  return okAll;
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
const latOk = lateralityGuard();
const prefixOk = prefixGuard();
console.log(`=== ${pass}/${cases.length} 通過 ｜ 平均單次查詢 ${ms.toFixed(1)} ms（${IDX.length} 條目）===`);
process.exit(pass===cases.length && guardOk && fingerOk && latOk && prefixOk?0:1);
