// 驗證搜尋核心 + 效能：跑急診常見查詢案例
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
  // 急診常見措辭（縮寫/尾綴/連字號）
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
  // 臨床回饋修正(2026-07-07)
  ["hss","E11.00"],                       // HSS/HHS 高血糖高滲透壓狀態
  ["hhs","E11.00"],
  ["contusion of limbs","S40"],           // 四肢挫傷：無單一 limb 碼，落在肢體表淺挫傷(非燒傷即達標)
  ["limbs contusion","S40"],
  ["contusion of legs","S80.10"],         // 複數 legs→leg
  ["conjunctivitis","H10.9"],             // unspecified 置頂
  ["sma aneurysm","I72.9"],               // SMA 動脈瘤
  ["du","K26.9"],                         // DU 十二指腸潰瘍 unspecified 置頂
  ["duodenal ulcer","K26.9"],
  ["duodenal ulc","K26"],                 // 截斷寫法 ulc→ulcer
  ["left radial fracture","S52.502"],     // 橈骨遠端(lower end)骨折置頂
  ["lt radial fx","S52.502"],             // norm 後片語比對：lt→left、fx→fracture
  ["rt radius fx","S52.501"],
  ["radial fracture","S52.509"],
  // 排序通用規則(2026-07-07)：同分時 unspecified/未明示優先 + cancer→malignant neoplasm 同義詞
  ["gastritis","K29.70"],                 // 胃炎 unspecified 置頂(原急性胃炎排前)
  ["stomach cancer","C16.9"],
  ["gastric cancer","C16.9"],
  ["colon cancer","C18.9"],
  ["bladder cancer","C67.9"],
  ["lung cancer","C34.90"],               // 原發置頂(非 C78.00 續發)
  ["breast cancer","C50.919"],
  ["anemia","D64.9"],                     // 貧血 unspecified 置頂
  ["dermatitis","L30.9"],
  ["otitis media","H66.90"],
  ["pharyngitis","J02.9"],
  ["tonsillitis","J03.90"],
  ["hemorrhoid","K64.9"],
  ["cholecystitis","K81.9"],              // 原被 K80.20「膽結石未伴有膽囊炎」蓋過
  ["pleural effusion","J90"],             // NEC 樣板字不計多餘資訊
  // 體檢批次(2026-07-08)：76 個常用查詢實跑找出的錯誤第一名/缺縮寫
  ["anaphylaxis","T78.2"],                // 原第一名是「過敏性反應個人史」
  ["empyema","J86.9"],                    // 原誤中肺氣腫
  ["septic arthritis","M00.9"],
  ["testicular torsion","N44.00"],
  ["perforated peptic ulcer","K27.5"],
  ["ppu","K27.5"],
  ["thyroid storm","E05.91"],
  ["aortic dissection","I71.00"],
  ["seizure","R56.9"],
  ["angioedema","T78.3"],
  ["paronychia","L03.019"],
  ["herpes simplex","B00.9"],
  ["carbon monoxide intoxication","T58.91"],
  ["pta","J36"],                          // 原誤中凝血因子XI缺乏
  ["rosc","I46.9"],                       // 原誤中羅斯河病
  ["aecopd","J44.1"],
  ["adhf","I50.9"],
  ["mva","V89.2"],
  ["aub","N93.9"],
  ["luts","N40.1"],
  ["od","T50.901"],
  ["cbd stone","K80.5"],                  // 膽管結石(原誤中腎結石)
  ["hyponatremia","E87.1"],               // 新生兒碼降權：成人 E87.1 勝 P74.22
  ["hypernatremia","E87.0"],
  ["hypothermia","T68"],
  ["influenza","J11.1"],
  ["flu","J11.1"],
  ["gouty arthritis","M10.9"],
  ["frozen shoulder","M75.00"],
  ["edema","R60.9"],
  ["mesenteric ischemia","K55.059"],
  ["empyema gallbladder","K81.0"],
  // 外傷語意層 + 大審計批次(2026-07-08 治本)：中文外傷措辭杜絕滑進燒傷/生產傷害/大腦/皮膚癌
  ["顏面挫傷","S00.83"],                   // 原→P15.4 生產傷害
  ["facial contusion","S00.83"],
  ["Left chest contusion","S20.21"],       // 原→S06.3 大腦挫傷
  ["胸壁鈍傷","S20.2"],                    // 原→T21 燒傷
  ["頭皮血腫","S00.0"],                    // 原→C44 皮膚癌
  ["肢體多處挫擦傷","S40"],                // 原→T24 腐蝕傷,現落在肢體表淺挫傷(非燒傷即達標)
  ["multiple abrasion over limbs","S40.2"], // 肢體擦傷,不再退回燒傷
  ["前額鈍傷","S00.8"],                    // 前額→其他頭部,非 T20 燒傷
  ["軀幹挫傷","S20.2"],                    // 軀幹→胸部挫傷,非 T21 燒傷
  ["distal radius fracture","S52.5"],      // 橈骨遠端(Colles),官方 lower end of radius
  ["distal radial fracure","S52.5"],       // 含拼字錯誤
  ["colles fracture","S52.5"],
  ["proximal tibia fracture","S82.1"],     // 脛骨近端(平台),官方 upper end of tibia
  ["tibia plateau fracture","S82.1"],
  ["distal ulna fracture","S52.6"],
  ["proximal humerus fracture","S42.2"],
  ["distal femur fracture","S72.4"],
  ["頸部鈍傷","S10.9"],
  ["腹部挫傷","S30.1"],
  ["臀部鈍傷","S30.0"],
  ["acute stroke","I63.9"],                // 原→G46.4 小腦症候群
  ["ischemic stroke","I63.9"],
  ["hyperthyroidism","E05.90"],            // 原→E03.9 甲狀腺低下(polarity)
  ["hypothyroidism","E03.9"],
  ["esophageal cancer","C15.9"],           // 原→C44.90 皮膚癌
  ["rectal cancer","C20"],
  ["oral cancer","C06.9"],
  ["cancer pain","G89.3"],
  ["peptic ulcer disease","K27.9"],        // 原→Z87.11 病史
  ["SAH","I60"],                           // SAH 原→P10.3 生產傷害
  ["radial head fracture","S52.12"],       // 具名長骨骨折不進外傷層,維持精準
  ["radial neck fracture","S52.13"],
  ["hip fracture","S72.0"],                // 外傷層區域骨折
  ["ankle fracture","S82"],
  // 手指序數 + 骨名形容詞/名詞 + cont 縮寫(2026-08-25 回饋批次)
  ["1st finger fracture","S62.5"],         // 1st finger=拇指(原落 unspecified finger)
  ["first finger fracture","S62.5"],       // 原誤中第一掌骨 S62.2
  ["2nd finger fracture","S62.600"],       // 食指
  ["3rd finger fracture","S62.602"],       // 中指(原被 middle phalanx 歧義蓋過)
  ["middle finger fracture","S62.602"],    // 中指本尊，非「中段指骨之未明示手指」
  ["4th finger fracture","S62.604"],       // 無名指
  ["5th finger fracture","S62.606"],       // 小指
  ["1st finger laceration","S61.0"],       // 拇指撕裂傷
  ["fibular fx","S82.4"],                  // 形容詞形=名詞形
  ["fibula fracture","S82.4"],
  ["humeral fracture","S42"],
  ["femoral fracture","S72.90"],           // 原誤中 M84.750S 非典型股骨骨折後遺症
  ["tibial fracture","S82.209"],           // 原誤中脛骨棘 S82.113
  ["femoral neck fracture","S72.0"],       // 官方 neck of femur
  ["radial styloid fracture","S52.51"],    // 守衛：官方就用 radial，不可被轉壞
  ["atypical femoral fracture","M84.75"],  // 守衛：官方用形容詞形，不轉
  ["chest cont","S20.2"],                  // cont=contusion(原誤中胸痛 R07)
  ["cont chest","S20.2"],
  ["abd cont","S30.1"],                    // 腹壁挫傷優先
  // codex 審查修正(2026-08-25)：成對守衛/語境限定後的回歸防護
  ["small finger fracture","S62.606"],     // small=小指(原誤中腕骨 trapezoid)
  ["ulnar styloid fracture","S52.61"],     // 官方名詞形 ulna styloid process,不可被 styloid 誤擋
  ["1st metacarpal fracture","S62.2"],     // 數字序數→拼字序數(first metacarpal)
  ["5th metacarpal fracture","S62.3"],
  ["femoral fractures","S72.90"],          // 複數 fractures→fracture
  ["clavicular fracture","S42.0"],         // 原完全查無
  ["patellar fracture","S82.0"],
  ["radial head dislocation","S53.0"],     // head/neck 改寫限骨折語境,勿蓋掉脫臼碼
];

// 骨折快捷 chips 守門：每顆 chip 的碼必須存在於官方表，且左右/未明槽位與碼名側別字樣相符
function chipsGuard(){
  let ok=true, n=0;
  const byC={}; for(const it of IDX) byC[it.e.c]=it.e;
  for(const part in FRACTURE_CHIPS){
    for(const [label,codes] of FRACTURE_CHIPS[part]){
      for(const k of ["R","L","U"]){
        const c=codes[k]; if(!c) continue; n++;
        const e=byC[c];
        if(!e){ console.log("❌ chips 守門："+part+"/"+label+"/"+k+" 碼不存在 "+c); ok=false; continue; }
        if(codes.R&&codes.L){   // 有左右槽位的 chip 才驗側別字樣
          const want=k==="R"?"right":k==="L"?"left":"unspecified";
          if(!(" "+e.en.toLowerCase()+" ").includes(want)){
            console.log("❌ chips 守門："+part+"/"+label+"/"+k+" 側別不符 "+c+" = "+e.en); ok=false;
          }
        }
      }
    }
  }
  console.log((ok?"✅":"❌")+" chips 守門：骨折快捷 "+n+" 碼存在性+側別字樣全驗");
  return ok;
}

// 中指守門：middle finger fracture 前3名必須全是「中指本尊」碼，S62.629(中段指骨之未明示手指)不可混入
function middleFingerGuard(){
  const r=C.searchCore(IDX,"middle finger fracture","all").slice(0,3).map(x=>x[1].e);
  const ok = r.length===3 && r.every(e=>/middle finger/i.test(e.en)) && !r.some(e=>e.c==="S62.629");
  console.log((ok?"✅":"❌")+" 中指守門：middle finger fracture 前3名 = "+r.map(e=>e.c).join(", "));
  return ok;
}

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
    // ask-all 小人圖對應表修正(2026-06-23)
    ["踝骨折=內外踝(非S92足骨)","fracture ankle malleolus",["S82.5","S82.6","S82.8"],["S82"],["S92"]],
    ["腕Colles=橈骨遠端","fracture lower end radius",["S52.5"],["S52.5"],["S62"]],
    ["膝脛骨近端","fracture upper end tibia",["S82.1"],["S82.1"],["S82.0","S72"]],
    ["膝股骨遠端","fracture lower end femur",["S72.4"],["S72.4"],["S82"]],
    ["骨盆環(排除S32.0腰椎,非髖S72)","fracture pelvis sacrum coccyx pubis",["S32.1","S32.2","S32.3","S32.4","S32.5","S32.6","S32.7","S32.8","S32.9"],["S32"],["S72","S32.0"]],
    ["臉撕裂有結果(非空)","laceration face",["S01"],["S01"],["S00","S02"]],
    ["耳撕裂只留 S01.3","laceration ear",["S01.3"],["S01.3"],["S01.0","S01.1","S01.2"]],
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
const midOk = middleFingerGuard();
const latOk = lateralityGuard();
const prefixOk = prefixGuard();
const chipsOk = chipsGuard();
console.log(`=== ${pass}/${cases.length} 通過 ｜ 平均單次查詢 ${ms.toFixed(1)} ms（${IDX.length} 條目）===`);
process.exit(pass===cases.length && guardOk && fingerOk && midOk && latOk && prefixOk && chipsOk?0:1);
