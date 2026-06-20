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
  "dizzy":"dizziness","epigastralgia":"epigastric pain","fb":"foreign body",   // 真實病歷常見措辭
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
  // 由真實 KMUH 急診病歷高頻縮寫補入
  "age":"acute gastroenteritis","pn":"pneumonia","ugi":"upper gastrointestinal",
  "aur":"retention urine","apn":"acute pyelonephritis","lbp":"low back pain",
  "ohca":"cardiac arrest","psvt":"supraventricular tachycardia","vt":"ventricular tachycardia",
  "hcc":"liver cell carcinoma","mdd":"major depressive","urosepsis":"urosepsis",
};

function hasCJK(s){return /[一-鿿]/.test(s);}
function norm(q){
  q = q.toLowerCase();
  q = q.replace(/[,;]?\s*(cause|focus|etiology)\s+(to\s+be\s+)?determin\w*/g," ");  // 剝「…cause to be determined」尾綴
  q = q.replace(/[,\.\(\)\/\-]/g," ").replace(/#/g," fracture ");   // 連字號也拆（covid-19→covid 19、a-v→a v）
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
  // 臨床口語 → ICD 官方碼名：radial neck/head 寫作 neck/head of radius；
  // distal humerus 寫作 lower end of humerus；both bone forearm 沒有獨立外傷碼，回到 forearm。
  if(out.includes("radial")&&(out.includes("head")||out.includes("neck"))){
    out=out.map(w=>w==="radial"?"radius":w);
  }
  if(out.includes("distal")&&out.includes("humerus")){
    const expanded=[];
    for(const w of out){
      if(w==="distal") expanded.push("lower","end");
      else expanded.push(w);
    }
    out=expanded;
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
// 專一構造詞：碼名有、但 query 沒提 → 該碼較專一，往下壓（優先單純傷口/部位碼）
const SPECIFIER = ["tendon","muscle","fascia","ligament","artery","vein","nerve","vessel",
                   "flexor","extensor","abductor","adductor","intrinsic"];
function qhas(qtoks,w){ return qtoks.indexOf(w)>=0; }

function indexEntry(e,kind){
  const toks = e.en.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(t=>t&&!STOP.has(t));
  // 官方字母索引別名（同義詞/俗稱/eponym）：另存，比對時給較低分，避免上層解剖詞污染
  let axToks=[], axhay="";
  if(e.ax){
    const ts=new Set(toks);
    axToks=e.ax.toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(t=>t&&!STOP.has(t)&&!ts.has(t));
    axhay=" "+axToks.join(" ")+" ";
  }
  return {e,kind,toks,hay:" "+toks.join(" ")+" ",axToks,axhay,zh:e.zh};
}
function scoreEntry(item,qtoks,cjk,qHasSide){
  let score=0, matched=0;
  const hay=item.hay;
  for(const qt of qtoks){
    let best=0;
    if(qt.charCodeAt(0)<0x4e00){            // 英數 token：先用 indexOf 快篩
      if(hay.includes(" "+qt+" ")) best=1.0;                       // 整字命中
      else if(qt.length>=3 && hay.includes(" "+qt)) best=0.85;     // 字首命中
      else if(qt.length>=4){                                       // 模糊：閘門限制呼叫次數
        for(const t of item.toks){
          if(t[0]!==qt[0] || Math.abs(t.length-qt.length)>1) continue;
          if(levLE(qt,t,1)<=1){best=0.7;break;}
        }
      }
      // 只靠官方索引別名命中：給較低分（正式碼名主導），仍保留召回
      if(best===0 && item.axhay){
        if(item.axhay.includes(" "+qt+" ")) best=0.5;
        else if(qt.length>=3 && item.axhay.includes(" "+qt)) best=0.42;
      }
      // 極性相反懲罰：查 traumatic 卻只有 nontraumatic（或反向），是相反診斷，往下壓
      if(best===0 && qt.length>=5){
        if(!qt.startsWith("non") && hay.includes(" non"+qt+" ")) score-=0.9;
        else if(qt.startsWith("non") && hay.includes(" "+qt.slice(3)+" ") && !hay.includes(" "+qt+" ")) score-=0.9;
      }
    }else if(cjk){                          // 中文 token：子字串/字數比例
      if(item.zh.includes(qt)) best=1.0;
      else{ let c=0; for(const ch of qt) if(item.zh.includes(ch)) c++; if(c>0) best=0.9*(c/qt.length); }
    }
    if(best>0){score+=best;matched++;}
  }
  if(matched===0) return 0;
  const cov = matched/qtoks.length;
  if(cov<0.5) return 0;
  // 專一構造詞懲罰：碼名提到 tendon/muscle/artery/nerve… 但使用者沒打 → 往下壓
  // （讓單純「laceration」優先開放性傷口碼，而非肌腱/血管/神經的專一傷）
  let pen=0;
  for(const w of SPECIFIER){ if(item.hay.includes(" "+w+" ") && !qhas(qtoks,w)){ pen+=0.4; if(pen>=1.2)break; } }
  // Generic "metacarpal fracture" in ED use usually means 2nd-5th metacarpal;
  // keep first metacarpal/thumb codes for explicit first/thumb queries.
  if(qhas(qtoks,"metacarpal")&&!qhas(qtoks,"first")&&!qhas(qtoks,"1st")&&!qhas(qtoks,"thumb")&&
     hay.includes(" first metacarpal ")){
    pen+=0.35;
  }
  // 沒查左右時，帶 left/right 的碼往下壓，讓「未明示側性」優先（急診常不特別 code 左右）
  if(!qHasSide && (hay.includes(" left ")||hay.includes(" right ")||hay.includes(" bilateral "))) pen+=0.3;
  return score*cov - pen;
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

function searchCore(IDX,q,scope){
  if(!q.trim())return [];
  if(isCodeQuery(q)) return codeSearch(IDX,q,scope);
  const qtoks=norm(q), cjk=hasCJK(q);
  const qHasSide = qtoks.includes("left")||qtoks.includes("right")||qtoks.includes("bilateral");
  const res=[];
  for(const item of IDX){
    if(scope!=="all"&&item.kind!==scope)continue;
    let sc=scoreEntry(item,qtoks,cjk,qHasSide);
    if(sc>0){
      if(item.e.b) sc*=1.4;               // 急診常見診斷加權
      res.push([sc,item]);
    }
  }
  // 排序：分數 → 常見 → 代碼短者（較通用）優先
  res.sort((a,b)=> b[0]-a[0] || (b[1].e.b||0)-(a[1].e.b||0) || a[1].e.c.length-b[1].e.c.length);
  return res.slice(0,25);
}
if(typeof module!=="undefined")module.exports={SEV_ORDER,SYN,hasCJK,norm,levLE,indexEntry,scoreEntry,buildCode,whyHit,needMore,searchCore,isCodeQuery};
