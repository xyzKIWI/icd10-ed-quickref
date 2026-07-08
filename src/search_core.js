// 純搜尋邏輯：瀏覽器與 Node 測試共用。無 DOM 依賴。
const SEV_ORDER = "ABCDEFGHJKMNPQRS";
const SYN = {
  "fx":"fracture","fract":"fracture","fxs":"fracture","frac":"fracture","fractured":"fracture",
  "lac":"laceration","lacs":"laceration","cut":"laceration",
  "bruise":"contusion","bruised":"contusion","contused":"contusion",
  "graze":"abrasion","scrape":"abrasion",
  "dislocated":"dislocation","disloc":"dislocation","subluxation":"dislocation",
  "sprained":"sprain","strain":"sprain",
  "amp":"amputation","amputated":"amputation",
  "bite":"bitten","bites":"bitten","biting":"bitten","bit":"bitten",
  "fb":"foreign body",
  "lt":"left","l":"left","rt":"right","r":"right",
  "bilat":"bilateral","bil":"bilateral",
  "shin":"lower leg","calf":"lower leg",
  "collarbone":"clavicle",
  "stone":"calculus","stones":"calculus","calculi":"calculus",   // 結石：官方用 calculus
  "renal":"kidney","ureteral":"ureter","urethral":"urethra",
  "dizzy":"dizziness","epigastralgia":"epigastric pain","fb":"foreign body",   // 急診常見措辭
  "sting":"venom","stung":"venom",   // 叮咬：官方碼名用 venom（蜂螫 bee sting→venom of bees）
  // 結膜出血：官方碼名用 conjunctival，sub- 前綴與少 c 的 typo 都導過去
  "subconjunctival":"conjunctival","subconjunctiva":"conjunctival","conjunctiva":"conjunctival",
  "conjuntiva":"conjunctival","subconjuntiva":"conjunctival","subconjunctival":"conjunctival",
  "legs":"leg","limbs":"limb",   // 複數→單數(2026-07-07 回饋：contusion of legs/limbs 查無)
  "ulc":"ulcer",                 // 病歷常見截斷寫法(duodenal ulc)
  "cancer":"malignant neoplasm","cancers":"malignant neoplasm",   // 官方碼名用 malignant neoplasm，不用 cancer
  "gouty":"gout","flu":"influenza",   // 2026-07-08 體檢批次
};
const STOP = new Set(["of","the","a","an","and","to","with","at","on","in","x",
  "cause","focus","determined","determinated","be","suspect","suspected","favor","favour",
  "impression","probable","possible","need","should","over"]);  // 急診病程慣用修飾詞
// 英文縮寫 → 完整詞（會再切成多 token）
const ABBR = {
  // 感染/呼吸
  "uti":"urinary tract infection","urti":"upper respiratory infection","uri":"upper respiratory infection",
  "copd":"chronic obstructive pulmonary","cap":"pneumonia","hap":"pneumonia","ards":"respiratory distress",
  "tb":"tuberculosis","sob":"dyspnea","uri":"upper respiratory infection",
  // 心血管
  "chf":"heart failure","cad":"coronary artery","acs":"acute coronary",
  "mi":"myocardial infarction","ami":"myocardial infarction","stemi":"st elevation myocardial infarction",
  "nstemi":"non-st elevation myocardial infarction","af":"atrial fibrillation","afib":"atrial fibrillation",
  "dvt":"deep vein thrombosis","pe":"pulmonary embolism","aaa":"abdominal aortic aneurysm","htn":"hypertension",
  // 神經/腦出血
  "ich":"intracerebral hemorrhage","sah":"subarachnoid hemorrhage","sdh":"subdural hemorrhage",
  "edh":"epidural hemorrhage","tbi":"traumatic brain injury","cva":"cerebral infarction",
  "tia":"transient cerebral ischemic","ams":"altered mental","loc":"loss of consciousness","sz":"seizure",
  // 腸胃/肝膽
  "gi":"gastrointestinal","gib":"gastrointestinal hemorrhage","ugib":"gastrointestinal hemorrhage",
  "lgib":"gastrointestinal hemorrhage","gerd":"gastroesophageal reflux","pud":"peptic ulcer",
  "gb":"gallbladder","ibd":"inflammatory bowel","sbo":"intestinal obstruction","lbo":"intestinal obstruction",
  // 內分泌/腎/其他
  "dm":"diabetes","dka":"diabetes ketoacidosis","hhs":"hyperosmolar hyperglycemia",
  "ckd":"chronic kidney","aki":"acute kidney failure","esrd":"end stage renal","arf":"acute kidney failure",
  "bph":"benign prostatic hyperplasia","pid":"pelvic inflammatory","cp":"chest pain","abd":"abdominal",
  // 急診高頻縮寫補入
  "age":"gastroenteritis","pn":"pneumonia","ugi":"upper gastrointestinal",
  "aur":"retention urine","apn":"acute pyelonephritis","lbp":"low back pain",
  "ohca":"cardiac arrest","psvt":"supraventricular tachycardia","vt":"ventricular tachycardia",
  "hcc":"liver cell carcinoma","mdd":"major depressive","urosepsis":"urosepsis",
  // ask-all 縮寫稽核(2026-06-23 Codex+Hermes+本機逐一實跑驗證)：展開字串貼官方碼名用詞
  "aod":"dissection of aorta",            // 主動脈剝離 I71.0x（不可用 aortic dissection→會混進主動脈體腫瘤）
  "aom":"acute suppurative otitis media", // 急性中耳炎 H66.0x（不可用 acute otitis media→會落到 H65 漿液性/OME）
  "ptx":"pneumothorax","htx":"hemothorax","vf":"ventricular fibrillation",
  "ha":"headache","appy":"acute appendicitis","bppv":"benign paroxysmal vertigo",
  "brbpr":"hemorrhage of anus and rectum","nv":"nausea vomiting",
  "t1dm":"type 1 diabetes","t2dm":"type 2 diabetes","ptb":"pulmonary tuberculosis",  // 2026-06-23 補
  "ihca":"cardiac arrest","bzd":"benzodiazepine",   // 2026-06-27 回饋補
  "hss":"hyperosmolar hyperglycemia",               // 2026-07-07 回饋補：HSS(=HHS 高血糖高滲透壓狀態)
  "du":"duodenal ulcer",                            // 2026-07-07 回饋補：DU 十二指腸潰瘍
  // 2026-07-08 體檢批次(76 個常用查詢實跑找出的缺口)
  "aecopd":"chronic obstructive pulmonary exacerbation",
  "adhf":"heart failure",                           // 急性失代償心衰
  "rosc":"cardiac arrest",                          // 原誤中羅斯河病 B33.1
  "pta":"peritonsillar abscess",                    // 原誤中凝血因子XI缺乏(PTA 舊稱)
  "cbd":"bile duct",                                // CBD stone→膽管結石(原誤中腎結石)
  "mva":"motor vehicle accident",
  "aub":"abnormal uterine bleeding",
  "luts":"lower urinary tract symptoms",
  "ppu":"peptic ulcer perforation",                 // 官方碼名用 perforation 非 perforated
};

function hasCJK(s){return /[一-鿿]/.test(s);}
function norm(q){
  q = q.toLowerCase();
  q = q.replace(/[,;]?\s*(cause|focus|etiology)\s+(to\s+be\s+)?determin\w*/g," ");  // 剝「…cause to be determined」尾綴
  q = q.replace(/\bn\s*\/\s*v\b/g," nausea vomiting ");   // n/v 在拆斜線前先展開，否則 v 會誤命中眼科 V pattern
  q = q.replace(/[,\.\(\)\/\-?!;:「」『』，、。？！；：]/g," ").replace(/#/g," fracture ");   // 連字號也拆（covid-19→covid 19）；清問號等標點(cause?→cause 才會被 STOP 濾)
  const parts = q.split(/\s+/).filter(Boolean);
  let out=[];
  for(let w of parts){
    if(ABBR[w]){ for(const t of ABBR[w].split(" ")) if(!STOP.has(t)) out.push(t); continue; }
    w = SYN[w]||w;
    for(const t of w.split(" ")){ if(t&&!STOP.has(t)) out.push(t); }
  }
  // 腳趾命名正規化：ICD 只有 great toe / lesser toe，把口語的 middle/second/little toe 等轉過去
  if(out.includes("toe")||out.includes("toes")){
    const GREAT=new Set(["great","big","first","1st","large"]);
    const LESSER=new Set(["little","middle","ring","index","second","third","fourth","fifth","2nd","3rd","4th","5th","small","pinky","lesser"]);
    out=out.map(w=>GREAT.has(w)?"great":LESSER.has(w)?"lesser":w);
  }
  // 臨床口語 → ICD 官方碼名：radial neck/head 寫作 neck/head of radius。
  if(out.includes("radial")&&(out.includes("head")||out.includes("neck"))){
    out=out.map(w=>w==="radial"?"radius":w);
  }
  // 具名長骨的「遠端/近端/脛骨平台/eponym」→ ICD 官方「lower/upper end of <骨>」
  // (distal radius / Colles→lower end radius=S52.5、proximal tibia / tibia plateau→upper end tibia=S82.1)。
  // 只轉長骨，不動 distal phalanx(手指遠端指骨 S62.6)、radial styloid(S52.51 官方就用 radial)。
  const BONE_ADJ={radial:"radius",radius:"radius",ulnar:"ulna",ulna:"ulna",tibial:"tibia",tibia:"tibia",
                  femoral:"femur",femur:"femur",fibular:"fibula",fibula:"fibula",humeral:"humerus",humerus:"humerus"};
  if(out.some(w=>w==="colles"||w==="smith"||w==="barton")){          // 橈骨遠端 eponym
    out=out.filter(w=>!/^(colles|smith|barton)$/.test(w)&&BONE_ADJ[w]!=="radius").concat(["lower","end","radius"]);
  }else if(out.includes("plateau")){                                 // 脛骨平台=脛骨近端
    out=out.filter(w=>w!=="plateau"&&BONE_ADJ[w]!=="tibia").concat(["upper","end","tibia"]);
  }else{
    const end=out.includes("distal")?"lower":out.includes("proximal")?"upper":null;
    let bone=null; for(const w of out){ if(BONE_ADJ[w]){ bone=BONE_ADJ[w]; break; } }
    if(end && bone){
      const res=[]; let done=false;
      for(const w of out){
        if(w==="distal"||w==="proximal"||BONE_ADJ[w]){ if(!done){ res.push(end,"end",bone); done=true; } }
        else res.push(w);
      }
      out=res;
    }
  }
  if(out.includes("forearm")&&out.includes("both")&&(out.includes("bone")||out.includes("bones"))){
    out=out.filter(w=>w!=="both"&&w!=="bone"&&w!=="bones");
  }
  return out;
}
// 有界編輯距離：超過 max 立即回 max+1（給 max=1 用，快）
function levLE(a,b,max){
  const m=a.length,n=b.length;
  if(Math.abs(m-n)>max) return max+1;
  let prev=new Array(n+1); for(let j=0;j<=n;j++)prev[j]=j;
  for(let i=1;i<=m;i++){
    let cur=new Array(n+1); cur[0]=i; let rowMin=cur[0];
    for(let j=1;j<=n;j++){
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      if(cur[j]<rowMin)rowMin=cur[j];
    }
    if(rowMin>max) return max+1;
    prev=cur;
  }
  return prev[n];
}
// ===== 外傷語意層(2026-07-08 真實病歷大審計治本) =====
// 打字查外傷時，比照小人圖用「部位×傷型→碼段白名單」硬過濾，杜絕中文措辭滑進燒傷 T2x/生產傷害 P/
// 大腦 S06/皮膚癌 C44/手部 S60。只在「明確傷型詞 + 部位詞」都命中才觸發；純「頭部外傷」(無明確傷型)
// 不觸發，維持原一般搜尋(S09.90)。白名單粒度比小人圖粗(打字比點圖模糊)，權威版仍是 template.html
// 的 ANATOMICAL_MAP；此表為文字版子集，區域選擇對齊之。查無會退回全域(不像小人圖給查無)。
const TRAUMA_TYPE = [
  [/挫傷|瘀傷|鈍挫|挫瘀|鈍瘀|鈍傷|血腫|contus|bruise|h(a)?ematoma|blunt/i, "contusion"],   // 鈍傷/blunt 歸挫傷
  [/擦傷|抓傷|擦挫|挫擦|abrasion|graze|scrape/i, "abrasion"],   // 挫擦傷同時含挫+擦，歸表淺(與 contusion 同碼段)
  [/裂傷|撕裂|laceration/i, "laceration"],
  [/骨折|fracture/i, "fracture"],
];
// 部位詞 → 區域鍵。順序要緊：長/具體詞在前(下肢 before 肢、前臂 before 臂、手腕 before 手、顏面 before 頭)。
const TRAUMA_PART = [
  [/四肢|肢體|多肢|多處肢|both limbs|multiple limb|limbs|extremit/i, "multilimb"],
  [/眶周|眼周|眼眶|眼皮|眼瞼|periorbit|periocular|orbital|eyelid|黑眼/i, "eye"],   // 眶周挫傷=黑眼圈,非大腦
  [/前額|額頭|forehead/i, "face"],   // 前額=其他頭部 S00.8,非燒傷
  [/顏面|臉部|面部|facial|\bface\b|\bfacial\b/i, "face"],
  [/頦|下巴|下顎|jaw|chin/i, "face"],
  [/軀幹|trunk/i, "trunk"],
  [/頭皮|後腦|枕部|枕|scalp/i, "scalp"],
  [/頸部|頸|neck/i, "neck"],
  [/前胸|胸壁|胸廓|胸部|\bchest\b|thorax|thoracic wall/i, "chest"],
  [/下背|腰部|腰椎|腰|lower back|low back|lumbar/i, "lowback"],
  [/上背|後背|背部|背|\bback\b/i, "back"],
  [/腹部|腹壁|腹|abdom/i, "abdomen"],
  [/臀部|臀|buttock|gluteal/i, "buttock"],
  [/肩胛/i, "scapula"],
  [/肩部|肩膀|肩|shoulder/i, "shoulder"],
  [/上臂|upper arm/i, "upperarm"],
  [/手肘|肘部|肘|elbow/i, "elbow"],
  [/前臂|forearm/i, "forearm"],
  [/手腕|腕部|腕|wrist/i, "wrist"],
  [/手指|指頭|手掌|手背|\bhand\b|finger|palm/i, "hand"],
  [/上肢|手臂|upper limb/i, "upperlimb"],
  [/髖部|髖|hip/i, "hip"],
  [/大腿|thigh/i, "thigh"],
  [/膝部|膝蓋|膝|knee|patella/i, "knee"],
  [/小腿|shin|calf|lower leg/i, "lowerleg"],
  [/腳踝|踝部|踝|ankle/i, "ankle"],
  [/腳趾|足趾|趾/i, "toe"],
  [/足背|腳掌|足部|腳|\bfoot\b/i, "foot"],
  [/下肢|lower limb|\bleg\b/i, "lowerlimb"],
  [/頭部|\bhead\b/i, "scalp"],   // 頭部放最後：顏面/頭皮/後腦優先；頭部+明確傷型才到這
];
// 區域鍵 → {傷型:碼段白名單}。S(表淺,開放傷,骨折)：contusion/abrasion 共用表淺碼段。
const S=(sup,open,frac)=>({contusion:sup,abrasion:sup,laceration:open,fracture:frac});
const TRAUMA_MAP = {
  eye:    S(["S00.1"],["S01.1"],["S02.3"]),   // 眶周/眼瞼挫傷 S00.1;眼眶骨折 S02.3
  face:   S(["S00.8"],["S01.8","S01.4","S01.5"],["S02.2","S02.4","S02.5","S02.6","S02.8"]),   // 顏面表淺=其他頭部 S00.83;不含耳/鼻(自成部位)
  scalp:  S(["S00.0"],["S01.0"],["S02.0","S02.1"]),
  neck:   S(["S10"],["S11"],["S12"]),
  chest:  S(["S20.21","S20.3"],["S21.1","S21.3"],["S22.3","S22.4","S22.2"]),   // 前胸壁,不含乳房 S20.0
  back:   S(["S20.22","S20.4","S30.0"],["S21.2","S21.4","S31.0"],["S22.0","S32.0"]),
  lowback:S(["S30.0"],["S31.0"],["S32.0"]),
  abdomen:S(["S30.1"],["S31.1"],["S32.8"]),
  buttock:S(["S30.0"],["S31.8"],["S32.8"]),
  trunk:  S(["S20.2","S30.1","S30.0"],["S21.9","S31.9"],["S22","S32"]),   // 軀幹統包胸/腹/背表淺
  // 四肢：表淺碼段用整段 S40/S50/S60/S70/S80/S90(含挫傷+擦傷子碼),讓 contusion/abrasion 都命中,不退回燒傷
  scapula:S(["S40"],["S41"],["S42.1"]),
  shoulder:S(["S40"],["S41"],["S42"]),
  upperarm:S(["S40"],["S41"],["S42.2","S42.3"]),
  elbow:  S(["S50"],["S51"],["S42.4","S52.0"]),
  forearm:S(["S50"],["S51"],["S52"]),
  wrist:  S(["S60"],["S61"],["S52.5","S52.6","S62.0","S62.1"]),
  hand:   S(["S60"],["S61"],["S62"]),
  upperlimb:S(["S40","S50"],["S41","S51"],["S42","S52"]),
  hip:    S(["S70"],["S71"],["S72.0"]),
  thigh:  S(["S70"],["S71"],["S72"]),
  knee:   S(["S80"],["S81"],["S82.0","S82.1","S72.4"]),
  lowerleg:S(["S80"],["S81"],["S82"]),
  ankle:  S(["S90"],["S91"],["S82.5","S82.6"]),
  foot:   S(["S90"],["S91"],["S92"]),
  toe:    S(["S90.1","S90.2"],["S91.1"],["S92.4","S92.5"]),
  lowerlimb:S(["S80","S70"],["S81","S71"],["S82","S72"]),   // 下肢統包偏小腿/大腿(足自成部位)
  multilimb:S(["S50","S80","S70","S40"],["S51","S81","S71","S41"],["S52","S82","S72","S42"]),   // 前臂/小腿優先(多處擦挫傷常見肢端)
};
// 具名長骨：命中則骨折交回一般搜尋(那條路徑更精準,且避免 radial head/femoral neck 的 head/neck 被誤判成部位)
const NAMED_BONE = /radi(us|al)|ulnar?|humer(us|al)|femur|femoral|tibial?|fibular?|clavicl|patella|metacarp|metatars|phalan|carpal|tarsal|scaphoid|malleol|styloid|olecranon|calcane|navicular|sternum|vertebra|sacr|coccyx/i;
function traumaParse(q){
  let injury=null;
  for(const [re,k] of TRAUMA_TYPE){ if(re.test(q)){ injury=k; break; } }
  if(!injury) return null;
  if(injury==="fracture" && NAMED_BONE.test(q)) return null;   // 具名長骨骨折→一般搜尋(較精準)
  let part=null;
  for(const [re,k] of TRAUMA_PART){ if(re.test(q)){ part=k; break; } }
  if(!part) return null;
  const m=TRAUMA_MAP[part]; if(!m) return null;
  const pf=m[injury];
  return (pf&&pf.length)?pf:null;
}

// 專一構造詞：碼名有、但 query 沒提 → 該碼較專一，往下壓（優先單純傷口/部位碼）
const SPECIFIER = ["tendon","muscle","fascia","ligament","artery","vein","nerve","vessel",
                   "flexor","extensor","abductor","adductor","intrinsic"];
// tie-break 多餘字計算要跳過的「零臨床資訊」樣板字：without X = 沒有那個條件，不是多一個條件
const EXTRA_SKIP = new Set(["unspecified","without","other","not","elsewhere","classifiable","classified"]);
function qhas(qtoks,w){ return qtoks.indexOf(w)>=0; }

// 片語直接對應碼：關鍵字比對救不了的臨床慣用語，直接指定正確碼置頂(臨床回饋持續補)
const PHRASE_CODE = {
  "nasal bleeding":["R04.0"],"nose bleeding":["R04.0"],"nosebleed":["R04.0"],"nose bleed":["R04.0"],
  "gum bleeding":["K06.8"],"gingival bleeding":["K06.8"],"bleeding gum":["K06.8"],"bleeding gums":["K06.8"],
  // ask-all P0 臨床安全(2026-06-23)：純關鍵字排序救不了，強制置頂正確碼
  "coma":["R40.20"],                               // 修：原本被 DKA(含 coma 字)蓋過
  "stroke":["I63.9"],                              // 修：原本命中中風症候群/家族史，非腦梗塞
  "overdose":["T50.901","T50.902"],               // 藥物中毒(意外+自傷，醫師自選意圖)
  "drug overdose":["T50.901","T50.902"],
  "unconscious":["R41.82"],"意識不清":["R41.82"],   // = AMS 精神狀態改變
  "conscious disturbance":["R41.82"],"conscious change":["R41.82"],"consciousness change":["R41.82"],
  "altered consciousness":["R41.82"],"意識改變":["R41.82"],"意識障礙":["R41.82"],   // 原→S06.4X8 硬膜上出血死亡碼
  "無力":["R53.1"],                                 // 修：原本命中重症肌無力/子宮無力
  "aur":["R33.9"],                                  // 尿滯留：unspecified 置頂(原 R33.0 藥物導致排前)
  // 臨床回饋(2026-06-27)：強制置頂正確碼
  "bzd overdose":["T42.4X2","T42.4X1","T42.4X4","T42.4X3"],  // BZD 中毒：X2 自傷置頂，並列出意外/未定/攻擊供選意圖
  "ihca":["I46.9"],                                 // 院內心跳停止：cause unspecified 置頂
  "contusion chest":["S20.20"],                     // 胸部挫傷：原跑出胸痛 R07
  "urticaria":["L50.9"],                            // 蕁麻疹：unspecified 置頂(原過敏性 L50.0 排前)
  // 臨床回饋(2026-06-29)：強制置頂正確碼
  "face laceration":["S01.81","S01.419","S01.511"], // 臉部撕裂傷：無單一「臉」碼，列其他部位NOS+臉頰+嘴唇供選(原跑出惡性腫瘤)
  "herpes zoster":["B02.9","B02.8"],                // 帶狀疱疹：無併發症/其他併發症置頂(原 B02.39 眼部排前)
  "zoster":["B02.9","B02.8"],
  "numbness":["R20.0","R20.2"],                     // 麻木：皮膚感覺缺失/感覺異常置頂(原跑出免疫缺乏症)
  // 臨床回饋(2026-07-07)：強制置頂正確碼
  "hss":["E11.00","E11.01"],"hhs":["E11.00","E11.01"],  // 高血糖高滲透壓狀態：E11.00 未昏迷/E11.01 伴昏迷
  "conjunctivitis":["H10.9"],                       // 結膜炎：unspecified 置頂(原按字母序披衣菌/病毒性排前)
  "sma aneurysm":["I72.9","I72.8"],                 // 上腸繫膜動脈瘤：回饋指定 I72.9 置頂，並列 I72.8(官方索引 mesenteric→I72.8)供選
  "du":["K26.9"],"duodenal ulcer":["K26.9"],        // 十二指腸潰瘍：unspecified 置頂(原急性併出血 K26.0 排前)
  // 四肢挫傷：ICD 無單一 limb 碼，列小腿/前臂/大腿/上臂 unspecified 供選
  "contusion limb":["S80.10","S50.10","S70.10","S40.029"],
  "limb contusion":["S80.10","S50.10","S70.10","S40.029"],
  // 橈骨骨折：遠端 lower end(Colles 類)最常見，置頂；norm 後備援讓 lt radial fx 等變體也命中
  "radial fracture":["S52.509","S52.501","S52.502"],"radius fracture":["S52.509","S52.501","S52.502"],
  "left radial fracture":["S52.502"],"left radius fracture":["S52.502"],
  "right radial fracture":["S52.501"],"right radius fracture":["S52.501"],
  "gastric cancer":["C16.9"],   // gastric→stomach 不能做全域同義詞(官方胃潰瘍就叫 gastric ulcer)，用片語釘選
  "lung cancer":["C34.90"],     // 原發置頂(同分時 C78.00 續發性碼名字少會排前)
  "breast cancer":["C50.919"],  // 乳癌置頂(原 C44.501 乳房皮膚癌排前)
  "cholecystitis":["K81.9","K81.0"],  // 膽囊炎 unspecified+急性置頂(原被 K80.20「膽結石未伴有膽囊炎」常見碼加權蓋過)
  // 體檢批次(2026-07-08)：76 個常用查詢實跑，修「第一名是錯的」
  "anaphylaxis":["T78.2"],"anaphylactic shock":["T78.2"],  // 原第一名是「過敏性反應個人史」Z87.892
  "empyema":["J86.9"],                              // 原誤中肺氣腫 emphysema(拼字模糊)，肺積膿
  "empyema gallbladder":["K81.0"],"gallbladder empyema":["K81.0"],  // 膽囊蓄膿=急性膽囊炎
  "septic arthritis":["M00.9"],                     // 原跑出敗血症
  "testicular torsion":["N44.00"],"torsion testis":["N44.00"],  // 原跑出睪丸疼痛
  "perforated peptic ulcer":["K27.5","K27.1"],"ppu":["K27.5","K27.1"],  // 原跑出穿孔性角膜潰瘍
  "thyroid storm":["E05.91"],                       // 原跑出異位甲狀腺組織
  "aortic dissection":["I71.00"],"dissection aorta":["I71.00"],  // 原 I71.011 弓部排前；未明示部位優先
  "seizure":["R56.9"],                              // 急診預設痙攣 NOS(原 G40.89 其他發作排前)
  "angioedema":["T78.3"],                           // 原跑出嗜酸性白血球增多
  "paronychia":["L03.019","L03.039"],               // 甲溝炎=指/趾蜂窩組織炎(原跑出念珠菌病)
  "herpes simplex":["B00.9"],                       // 原跑出疱疹性脊髓炎
  "co intoxication":["T58.91","T58.92","T58.94"],   // 意外優先，並列自傷/意圖未明(原「被加害」排前)
  "carbon monoxide intoxication":["T58.91","T58.92","T58.94"],
  "co poisoning":["T58.91","T58.92","T58.94"],
  "aecopd":["J44.1"],"adhf":["I50.9"],"rosc":["I46.9"],
  "mva":["V89.2"],"aub":["N93.9"],"luts":["N40.1","R39.198"],
  "od":["T50.901","T50.902"],                       // 同 overdose：意外+自傷並列
  "influenza":["J11.1"],                            // 未確認病毒株+呼吸道表徵=急診預設(原 J10 已確認排前)
  "edema":["R60.9"],                                // 水腫 NOS(原被 J81.0 急性肺水腫常見碼加權蓋過)
  "mesenteric ischemia":["K55.059"],                // 未明示程度優先
  "gouty arthritis":["M10.9"],                      // 原查無(gouty 對不到 gout)
  "frozen shoulder":["M75.00"],                     // 五十肩=粘連性囊炎，原查無
  // 單純膽管結石優先(K80.30「併膽管炎，unspecified」的 unspecified 指膽管炎急慢性，會沾 unspec 旗標的光)
  "bile duct calculus":["K80.50"],"choledocholithiasis":["K80.50"],   // cbd stone 經 norm 命中前者
  // 真實病歷大審計批次(2026-07-08)：中風/甲亢/器官癌/PUD 釘正確碼
  "acute stroke":["I63.9"],"ischemic stroke":["I63.9"],"acute ischemic stroke":["I63.9"],
  "cerebral infarction":["I63.9"],"infarct stroke":["I63.9"],
  "hyperthyroidism":["E05.90"],                     // 原模糊命中 E03.9 甲狀腺低下(hypo)
  "thyrotoxicosis":["E05.90"],
  "peptic ulcer disease":["K27.9"],"peptic ulcer":["K27.9"],"pud":["K27.9"],  // 原命中 Z87.11 病史
  "cancer pain":["G89.3"],                          // 腫瘤相關疼痛(原命中 C44 皮膚癌)
  "esophageal cancer":["C15.9"],"esophageal ca":["C15.9"],
  "rectal cancer":["C20"],"rectal ca":["C20"],
  "oral cancer":["C06.9"],"oral ca":["C06.9"],
  "liver cancer":["C22.9"],"hepatoma":["C22.0"],"hcc":["C22.0"],
  "pancreatic cancer":["C25.9"],"prostate cancer":["C61"],
  "cervical cancer":["C53.9"],"nasopharyngeal cancer":["C11.9"],"npc":["C11.9"],
};

// IDF 字詞權重：罕見字(gastroenteritis)權重高、常用字(acute/unspecified/left)權重低
// → 只命中常用字的碼會被過濾，大幅提升精確度。DF 只建一次。
let _DF=null, _DFN=0;
function ensureDF(IDX){
  if(_DF) return;
  _DF=new Map(); _DFN=IDX.length;
  for(const item of IDX){
    const uniq=new Set(item.toks);
    for(const t of uniq) _DF.set(t,(_DF.get(t)||0)+1);
  }
}
// 上限 5.5：避免單一罕見字/typo 壟斷總權重，害「未命中該字」整筆被濾掉
function idf(tok){ return Math.min(5.5, Math.log(1 + _DFN/((_DF.get(tok)||0)+1))); }

function indexEntry(e,kind){
  const toks = e.en.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(t=>t&&!STOP.has(t));
  // 官方字母索引別名（同義詞/俗稱/eponym）：另存，比對時給較低分，避免上層解剖詞污染
  let axToks=[], axhay="";
  if(e.ax){
    const ts=new Set(toks);
    axToks=e.ax.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(t=>t&&!STOP.has(t)&&!ts.has(t));
    axhay=" "+axToks.join(" ")+" ";
  }
  // unspecified/未明示 旗標：bare query 同分時優先（急診慣用 unspecified 碼）
  const unspec = /unspecified/i.test(e.en) || /未明示/.test(e.zh||"");
  return {e,kind,toks,hay:" "+toks.join(" ")+" ",axToks,axhay,zh:e.zh,unspec};
}
function scoreEntry(item,qtoks,cjk,qHasSide,qIdf,totalW,covFloor){
  let acc=0, anyMatch=false, polarityPen=0;   // acc = Σ best·idf（命中的資訊量）
  const hay=item.hay;
  for(let k=0;k<qtoks.length;k++){
    const qt=qtoks[k], w=qIdf[k];
    let best=0;
    if(qt.charCodeAt(0)<0x4e00){            // 英數 token：先用 indexOf 快篩
      if(hay.includes(" "+qt+" ")) best=1.0;                       // 整字命中
      else if(qt.length>=3 && hay.includes(" "+qt)) best=0.85;     // 字首命中
      else if(qt.length>=4){                                       // 模糊：閘門限制呼叫次數
        for(const t of item.toks){
          if(t[0]!==qt[0]) continue;
          const dl=Math.abs(t.length-qt.length);
          if(dl<=1 && levLE(qt,t,1)<=1){best=0.7;break;}
          if(qt.length>=7 && dl<=2){ const d=levLE(qt,t,2); if(d<=2){best=(d<=1?0.7:0.55);break;} }  // 長字容許距離2(對調/雙字)
        }
      }
      // 只靠官方索引別名命中：給較低分（正式碼名主導），仍保留召回
      if(best===0 && item.axhay){
        if(item.axhay.includes(" "+qt+" ")) best=0.5;
        else if(qt.length>=3 && item.axhay.includes(" "+qt)) best=0.42;
      }
      // 極性相反懲罰：查 traumatic 卻只有 nontraumatic（或反向）→ 扣掉該詞的權重(資訊量)
      if(best===0 && qt.length>=5){
        if(!qt.startsWith("non") && hay.includes(" non"+qt+" ")) polarityPen+=w;
        else if(qt.startsWith("non") && hay.includes(" "+qt.slice(3)+" ") && !hay.includes(" "+qt+" ")) polarityPen+=w;
      }
    }else if(cjk){                          // 中文 token：子字串/字數比例
      if(item.zh.includes(qt)) best=1.0;
      else{ let c=0; for(const ch of qt) if(item.zh.includes(ch)) c++; if(c>0) best=0.9*(c/qt.length); }
    }
    if(best>0){ acc+=best*w; anyMatch=true; }
  }
  if(!anyMatch) return 0;
  // 加權覆蓋率 ∈ [0,1]：命中的「資訊量」佔查詢總資訊量比例。只命中常用字→低→被濾掉
  let cov=(acc - polarityPen)/totalW;
  if(cov<(covFloor==null?0.45:covFloor)) return 0;   // 小人圖(有 prefix 白名單)時放寬,不砍已鎖定碼段內的合法碼
  // 懲罰(0..1 尺度)：專一構造詞、generic metacarpal、未查左右
  let pen=0;
  for(const w of SPECIFIER){ if(hay.includes(" "+w+" ") && !qhas(qtoks,w)){ pen+=0.12; if(pen>=0.36)break; } }
  if(qhas(qtoks,"metacarpal")&&!qhas(qtoks,"first")&&!qhas(qtoks,"1st")&&!qhas(qtoks,"thumb")&&
     hay.includes(" first metacarpal ")) pen+=0.12;
  if(!qHasSide && (hay.includes(" left ")||hay.includes(" right ")||hay.includes(" bilateral "))) pen+=0.1;
  // 沒查 chronic 時，慢性碼降權→急診情境讓急性/未明示優先(如 sinusitis 讓 J01 急性勝 J32 慢性)
  if(!qhas(qtoks,"chronic") && hay.includes(" chronic ")) pen+=0.14;
  // 周產期章(P00-P96)整章降權：成人急診幾乎不用，除非明講新生兒/生產。重罰，杜絕
  // SAH→P10.3 生產傷害、hyperthyroidism→P72.1 新生兒、顏面→P15.4 這類誤中。
  if(item.e.c.charCodeAt(0)===80 && !qtoks.some(t=>/neonat|newborn|infant|birth|perinat|新生|生產|早產|胎|嬰/.test(t))) pen+=0.6;
  // 病史/篩檢 Z 碼降權：Z85/86/87 個人史、Z80 家族史、Z12 篩檢——沒查 history/old/family/篩檢 時
  // 讓現行病碼優先(oral cancer→C06 勝 Z85 口腔癌病史、ischemic stroke→I63 勝 Z86、PUD→K27 勝 Z87)。
  // Z88 藥物過敏、Z91 過敏狀態等「現行狀態」碼不在此列(那是正確碼)。
  if(/^Z(8[0567]|12)/.test(item.e.c) && !qtoks.some(t=>/histor|\bhx\b|\bold\b|previous|prior|family|screen|status|post|survivor|病史|個人史|家族史|篩檢|舊|陳舊|曾/.test(t))) pen+=0.5;
  return cov - pen;
}
function buildCode(stem,ch){
  if(!ch) return stem;
  let raw=stem.replace(".","");
  while(raw.length<6) raw+="X";
  raw+=ch;
  return raw.slice(0,3)+"."+raw.slice(3);
}
function whyHit(item,qtoks){
  const hits=[];
  for(const qt of qtoks){
    if(qt.charCodeAt(0)<0x4e00){
      let f=false;
      for(const t of item.toks){ if(t===qt||t.startsWith(qt)||(qt.length>=4&&t.includes(qt))||(qt.length>=4&&t[0]===qt[0]&&levLE(qt,t,1)<=1)){hits.push(t);f=true;break;} }
      if(!f&&item.axToks) for(const t of item.axToks){ if(t===qt||t.startsWith(qt)){hits.push(t);break;} }
    }else if(item.zh.includes(qt))hits.push(qt);
  }
  return [...new Set(hits)].join(" + ");
}
function needMore(e){
  const en=e.en.toLowerCase();
  if(en.includes("unspecified")){
    if(en.includes("fracture")) return "未指明部位/側別，建議補：哪一段、左右、位移、開放或閉鎖";
    return "此為「未明示」碼，若臨床已知側別/部位建議改用更精確碼";
  }
  return "";
}
// 偵測「以代碼反查」：整串去空白後為 字母+數字 開頭、≤8 字、只含英數與點
function isCodeQuery(q){
  const dq=q.trim().replace(/\s+/g,"");
  return /^[a-z]\d/i.test(dq) && dq.length<=8 && /^[a-z0-9.]+$/i.test(dq);
}
function codeSearch(IDX,q,scope){
  const qn=q.trim().toUpperCase().replace(/[\s.]/g,"");   // 去空白與點
  const res=[];
  for(const item of IDX){
    if(scope!=="all"&&item.kind!==scope)continue;
    const nc=item.e.c.replace(".","");
    let sc=0;
    if(nc===qn) sc=100;
    else if(nc.startsWith(qn)) sc=60-nc.length*0.1;       // 輸入前綴 → 列出該段全部
    else if(qn.startsWith(nc)&&nc.length>=3) sc=50;       // 輸入完整碼(含第7碼) → 對到主幹
    if(sc>0) res.push([sc,item]);
  }
  res.sort((a,b)=> b[0]-a[0] || a[1].e.c.localeCompare(b[1].e.c));
  return res.slice(0,25);
}

// prefixes：可選的 ICD 碼段白名單（小人圖用）。給了就「硬過濾」只留這些碼段，
// 且查無時不 fallback 全域（防錯碼）。文字 q 仍負責在白名單內排序（如 back/chest 細分）。
function searchCore(IDX,q,scope,prefixes){
  const explicitPf = (prefixes && prefixes.length) ? prefixes : null;   // 小人圖點擊傳入
  if(!q.trim() && !explicitPf) return [];
  if(!explicitPf && isCodeQuery(q) && !ABBR[q.trim().toLowerCase()]) return codeSearch(IDX,q,scope);  // 整串是已知縮寫(t1dm/t2dm)→走文字搜尋,別誤判成代碼反查
  ensureDF(IDX);
  const qtoks=norm(q), cjk=hasCJK(q);
  const qHasSide = qtoks.includes("left")||qtoks.includes("right")||qtoks.includes("bilateral");
  const hasText = !!q.trim();
  const qIdf = qtoks.map(idf);
  let totalW=0; for(const w of qIdf) totalW+=w; if(totalW<=0) totalW=1;
  // 外傷語意層：打字命中「傷型+部位」→ 套碼段白名單(同小人圖硬過濾)。小人圖點擊(explicitPf)優先。
  const traumaPf = explicitPf ? null : traumaParse(q);
  function collect(pf){
    const res=[];
    for(const item of IDX){
      if(scope!=="all"&&item.kind!==scope)continue;
      if(pf && !pf.some(p=>item.e.c.startsWith(p))) continue;   // 硬過濾到指定碼段
      let sc;
      if(hasText){
        sc=scoreEntry(item,qtoks,cjk,qHasSide,qIdf,totalW,pf?0.05:undefined);
        if(sc>0 && item.e.b) sc*=1.4;       // 急診常見診斷加權
      }else{
        sc = item.e.b ? 1.4 : 1;            // 純部位(無文字)：全列出，常見碼略前
      }
      if(sc>0){
        // 同分 tie-break 用：碼名裡「query 沒提到的資訊量」(idf 加權)，越少 = 該碼越不多加條件
        let ex=0;
        if(hasText){
          for(const t of item.toks){
            if(EXTRA_SKIP.has(t)) continue;
            let hit=false;
            for(const qt of qtoks){ if(t===qt||(qt.length>2&&t.startsWith(qt))||(t.length>2&&qt.startsWith(t))){hit=true;break;} }
            if(!hit) ex+=idf(t);
          }
        }
        res.push([sc,item,ex]);
      }
    }
    // 排序通用規則(2026-07-07)：同分時 unspecified/未明示優先 → 碼名多餘資訊少者優先 → 短碼 → 字母序。
    // 分數不動；查得越具體(acute/hemorrhage/left…)分數自然拉開，此規則只在同分時生效。
    res.sort((a,b)=> b[0]-a[0] || (b[1].e.b||0)-(a[1].e.b||0)
      || (b[1].unspec?1:0)-(a[1].unspec?1:0) || (a[2]||0)-(b[2]||0)
      || a[1].e.c.length-b[1].e.c.length || a[1].e.c.localeCompare(b[1].e.c));
    return res;
  }
  const pf = explicitPf || traumaPf;
  let res = collect(pf);
  if(traumaPf && !res.length) res = collect(null);   // 外傷白名單查無 → 退回全域，不給空結果
  let out = res.slice(0, pf ? 60 : 25);
  // 片語直接對應碼：命中已知臨床慣用語→把指定碼置頂
  if(!pf){
    // 原字串比對優先；查無再用 norm 後 token 比對(縮寫/複數/lt→left 展開)，讓 lt radial fx、contusion of limbs 等變體也命中
    const forced = PHRASE_CODE[q.toLowerCase().trim().replace(/\s+/g," ")] || PHRASE_CODE[qtoks.join(" ")];
    if(forced){
      const set=new Set(forced), top=[];
      for(const code of forced){ const it=IDX.find(x=>x.e.c===code); if(it) top.push([999,it]); }
      out = top.concat(out.filter(([s,it])=>!set.has(it.e.c)));
    }
  }
  return out;
}
if(typeof module!=="undefined")module.exports={SEV_ORDER,SYN,hasCJK,norm,levLE,indexEntry,scoreEntry,buildCode,whyHit,needMore,searchCore,isCodeQuery};
