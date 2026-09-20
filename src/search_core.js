// 純搜尋邏輯：瀏覽器與 Node 測試共用。無 DOM 依賴。
// 詞表(SYN/ABBR/PHRASE_CODE/外傷表等)已抽到 lexicon.js——加詞只動那裡。Node 端在此 require 載入(掛 globalThis)；
// 瀏覽器由 build_html.py 把 lexicon.js 併在本檔前面同一 <script>，這些常數自然在作用域內，故略過 require。
if (typeof module !== "undefined" && typeof require !== "undefined") require("./lexicon.js");

function canonicalText(s){
  s=String(s==null?"":s);
  return typeof s.normalize==="function" ? s.normalize("NFKC") : s;
}
function hasCJK(s){return /[一-鿿]/.test(canonicalText(s));}
function norm(q){
  q = canonicalText(q).toLowerCase();
  const rawForSide=q;
  for(const [from,to] of QUERY_REWRITES) q=q.split(from).join(to);
  if(/雙側|兩側|左右/.test(rawForSide) && !/\bbilateral\b/.test(q)) q+=" bilateral";
  else{
    if(/左/.test(rawForSide) && !/\bleft\b/.test(q)) q+=" left";
    if(/右/.test(rawForSide) && !/\bright\b/.test(q)) q+=" right";
  }
  // cont=挫傷慣用縮寫(2026-08-25)：整句只有 cont 時直接視為 contusion；否則僅在句中同時有
  // 部位詞(TRAUMA_PART)時展開——cont dermatitis(=contact)、cont seizure 等非外傷語境不動。
  if(/^cont\.?$/.test(q.trim())) q="contusion";
  else if(/\bcont\b/.test(q) && TRAUMA_PART.some(([re])=>re.test(q))) q=q.replace(/\bcont\b/g," contusion ");
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
  // 手指序數正規化(2026-08-25)：臨床慣用 1st=拇指、2nd=食指、3rd=中指、4th=無名指、5th=小指。
  // 拇指碼名無 finger 字(S62.5 "…of thumb")，故 1st/first 轉 thumb 後把 finger token 移除。
  // 只在有 finger token 時觸發，不影響 "1st metacarpal"(第一掌骨) 等既有查詢。
  if(out.includes("finger")||out.includes("fingers")){
    const FNAME={"1st":"thumb","first":"thumb","2nd":"index","second":"index","3rd":"middle","third":"middle",
                 "4th":"ring","fourth":"ring","5th":"little","fifth":"little","pinky":"little","small":"little"};
    let isThumb=false;
    out=out.map(w=>{const m=FNAME[w]; if(m==="thumb")isThumb=true; return m||w;});
    if(isThumb) out=out.filter(w=>w!=="finger"&&w!=="fingers");
  }
  // 中指歧義治本：middle finger 併成單一相鄰片語 token，與碼名「middle phalanx of unspecified finger」
  // 區隔(原本 middle 誤沾指骨中段，中指本尊反被側別降權壓下去)。index/ring/little 一併處理，行為一致。
  for(let i=0;i<out.length-1;i++){
    if((out[i+1]==="finger"||out[i+1]==="fingers")&&/^(index|middle|ring|little)$/.test(out[i])){
      out.splice(i,2,out[i]+" finger");
    }
  }
  // 掌骨/蹠骨序數(2026-08-25)：官方碼名用拼字序數(first metacarpal bone)，數字序數對不到
  if(out.includes("metacarpal")||out.includes("metatarsal")){
    const ORD={"1st":"first","2nd":"second","3rd":"third","4th":"fourth","5th":"fifth"};
    out=out.map(w=>ORD[w]||w);
  }
  // 臨床口語 → ICD 官方碼名：radial neck/head 寫作 neck/head of radius。
  // 限骨折語境：radial head dislocation 官方就叫 radial head(S53.0)，不可改寫
  if(out.includes("radial")&&(out.includes("head")||out.includes("neck"))&&out.includes("fracture")){
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
  // 具名骨形容詞→名詞(2026-08-25)：骨折語境下對齊官方名詞形碼名(官方骨折碼名用 fibula/humerus/
  // femur/tibia/clavicle…；原本形容詞形只靠模糊比對 0.55-0.8 分或查無——femoral fracture 誤中
  // M84.75 非典型骨折後遺症、tibial fracture 誤中脛骨棘、clavicular fracture 完全查無)。
  // 成對守衛(codex 全量枚舉官方碼名確認)：只有「該骨自己的官方形容詞構造」在句中時該骨才不轉——
  // radial styloid(S52.51)、tibial spine/tuberosity(S82.11/.15)、atypical femoral fracture(M84.75)。
  // ulnar styloid 官方反而用名詞(ulna styloid process S52.61)，故 ulnar 照轉。
  if(out.includes("fracture")){
    const FRAC_ADJ=Object.assign({},BONE_ADJ,{clavicular:"clavicle",patellar:"patella",scapular:"scapula",calcaneal:"calcaneus"});
    const keep=new Set();
    if(out.includes("styloid")) keep.add("radial");
    if(out.includes("spine")||out.includes("tuberosity")) keep.add("tibial");
    if(out.includes("atypical")) keep.add("femoral");
    out=out.map(w=>keep.has(w)?w:(FRAC_ADJ[w]||w));
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
// 外傷語意層：打字命中「傷型詞+部位詞」→ 套碼段白名單硬過濾(同小人圖)。
// TRAUMA_TYPE/TRAUMA_PART/TRAUMA_MAP/NAMED_BONE 三表 + 長骨守衛都在 lexicon.js，這裡只放解析邏輯。
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

// SPECIFIER(專一構造詞)、EXTRA_SKIP(樣板字)在 lexicon.js。
function qhas(qtoks,w){ return qtoks.indexOf(w)>=0; }

// PHRASE_CODE(片語直接對應碼)在 lexicon.js。

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
  const zh=canonicalText(e.zh||"");
  const unspec = /unspecified/i.test(e.en) || /未明示/.test(zh);
  return {e,kind,toks,hay:" "+toks.join(" ")+" ",axToks,axhay,zh,unspec};
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
  // 未提及的高風險限定詞降權：一般 DM/COPD/CAD/脂肪肝/GERD 不應自動升級為
  // 高血糖、急性惡化、心絞痛、酒精性或食道炎。"without X" 是排除 X，不予懲罰。
  for(const [term,p] of SAFETY_QUALIFIERS){
    if(!hay.includes(" "+term+" ") || qhas(qtoks,term)) continue;
    const before=new RegExp("\\bwithout(?:\\s+\\w+){0,3}\\s+"+term+"\\b");
    if(before.test(hay)) continue;
    pen+=p;
  }
  // 產科章碼在未提妊娠/產後時不可因常見碼加權跑到一般成人診斷前面。
  if(item.e.c.startsWith("O") && !qtoks.some(t=>/pregnan|gestation|trimester|maternal|childbirth|puerper|postpartum|妊娠|孕|產後|生產/.test(t))) pen+=0.48;
  return cov - pen;
}

function uniqueStrings(xs){
  const seen=new Set(), out=[];
  for(const x of xs){
    const v=canonicalText(x).replace(/\s+/g," ").trim();
    if(!v) continue;
    const k=v.toLowerCase();
    if(!seen.has(k)){seen.add(k);out.push(v);}
  }
  return out;
}

const DIAG_HINT_RE = /pain|shortness of breath|dyspnea|fractur|sprain|contus|lacerat|injur|pneumonia|diabet|hypertension|failure|infection|fever|cough|hematur|neuropath|hyperglyc|bleed|hemorrhage|sepsis|disease|syndrome|arthritis|cancer|tumou?r|edema|nausea|vomit|疼痛|痛|骨折|扭傷|挫傷|撕裂|外傷|肺炎|糖尿病|高血壓|衰竭|感染|發燒|發熱|咳嗽|呼吸困難|血尿|神經病變|高血糖|出血|敗血|疾病|症候群|關節炎|腫瘤|癌|水腫|噁心|嘔吐/i;
function looksLikeDiagnosis(s){
  if(DIAG_HINT_RE.test(s)) return true;
  return canonicalText(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    .some(t=>Object.prototype.hasOwnProperty.call(ABBR,t));
}
const BLOCKING_AMBIGUOUS_ABBR = new Set(["cp","pe","ra","ms","pta","ca","af","loc"]);
const EXPLICIT_INJURY_RE=/contus|fractur|sprain|lacerat|abrasion|bruise|wound|injur|挫傷|骨折|扭傷|裂傷|撕裂|擦傷|瘀傷|外傷/i;
function expandBilateralInjury(s){
  if(!EXPLICIT_INJURY_RE.test(s)) return [s];
  if(/\bbilateral\b/i.test(s)) return [s.replace(/\bbilateral\b/ig,"left"),s.replace(/\bbilateral\b/ig,"right")];
  if(/雙側|雙邊|兩側/.test(s)) return [s.replace(/雙側|雙邊|兩側/g,"左側"),s.replace(/雙側|雙邊|兩側/g,"右側")];
  return [s];
}

function splitClinicalQuery(q){
  q=canonicalText(q).replace(/\r\n?/g,"\n").trim();
  // 明確外傷的常見雙側寫法先正規化，避免「左、右…」被頓號切成只有「左」的無效查詢。
  if(EXPLICIT_INJURY_RE.test(q)){
    q=q.replace(/\b(?:left\s*(?:and|\/)\s*right|right\s*(?:and|\/)\s*left)\b/gi,"bilateral");
    q=q.replace(/左\s*、\s*右|右\s*、\s*左|左右|右左/g,"雙側");
  }
  // 既有急診尾綴不是第二個診斷，先移除，避免逗號被誤判為多診斷。
  q=q.replace(/[,;，；]?\s*(cause|focus|etiology)\s+(to\s+be\s+)?determin\w*/gi," ").trim();
  if(!q) return [];

  // 同一糖尿病主詞帶兩個併發症：保留主詞到兩組，避免第二組失去 diabetes 語境。
  let m=q.match(/^(.+?\bdiabetes(?:\s+mellitus)?)\s+with\s+(.+?)\s+and\s+(.+)$/i);
  if(m && looksLikeDiagnosis(m[2]) && looksLikeDiagnosis(m[3])) return [m[1]+" with "+m[2],m[1]+" with "+m[3]];
  m=q.match(/^(.+?糖尿病)\s*合併\s*(.+?)(?:及|與|和)\s*(.+)$/i);
  if(m && looksLikeDiagnosis(m[2]) && looksLikeDiagnosis(m[3])) return [m[1]+"合併"+m[2],m[1]+"合併"+m[3]];

  // DM/HTN + CKD 是組合碼且常另需 CKD stage 碼：保留完整查詢，另開 CKD 組。
  m=q.match(/^(.*(?:diabet|hypertension|糖尿病|高血壓).*?)(?:\s+with\s+|\s*合併\s*)(.*(?:chronic kidney|ckd|慢性腎).*)$/i);
  if(m) return [q,m[2]];

  // due to 通常同時包含病因與表現，應分組，不把 token 混成不存在的單一診斷。
  m=q.match(/^(.+?)\s+due\s+to\s+(.+)$/i);
  if(m && looksLikeDiagnosis(m[1]) && looksLikeDiagnosis(m[2])) return [m[1],m[2]];

  // with 只拆已知需要兩碼的高頻組合；其餘保留 ICD 組合診斷語意。
  m=q.match(/^(.+?)\s+with\s+(.+)$/i);
  if(m && looksLikeDiagnosis(m[1]) && /respiratory failure|hematuria|呼吸衰竭|血尿/i.test(m[2])) return [m[1],m[2]];

  // 明確分隔符永遠分；and/及/與/和/合併則僅在兩側都像診斷時分，避免 head and neck 等解剖片語。
  const hard=q.split(/\s*(?:;|；|\n|、)\s*/).filter(Boolean);
  const out=[];
  for(const part of hard){
    const mm=part.match(/^(.+?)(?:\s+and\s+|\s*&\s*|\s*\+\s*|\s*(?:及|與|和|合併)\s*)(.+)$/i);
    if(mm && looksLikeDiagnosis(mm[1]) && looksLikeDiagnosis(mm[2])) out.push(mm[1],...splitClinicalQuery(mm[2]));
    else out.push(part);
  }
  return uniqueStrings(out);
}

function analyzeQuery(q){
  // 保留換行給 splitClinicalQuery 當可靠分句；只壓縮同一行的水平空白。
  const raw=canonicalText(q).replace(/\r\n?/g,"\n").replace(/[\t\f\v ]+/g," ").trim();
  if(!raw) return {queries:[],warnings:[],blocked:false};
  const warnings=[];
  for(const [abbr,msg] of Object.entries(AMBIGUOUS_ABBR)){
    if(new RegExp("(^|[^a-z0-9])"+abbr+"([^a-z0-9]|$)","i").test(raw)) warnings.push(msg);
  }

  const clauses=splitClinicalQuery(raw);
  const active=[];
  for(let clause of clauses){
    let low=clause.toLowerCase().trim();
    const negEn=/^(?:no\b|denies?\b|denied\b|negative\s+for\b|(?:no|without)\s+evidence\s+of\b|absence\s+of\b|ruled?\s+out\b|r\s*\/\s*o\b|exclude(?:d)?\b)/i;
    const uncertainEn=/^(?:possible|possibly|probable|probably|suspected?|suspicious\s+for|concern\s+for|consider|likely|may\s+be|could\s+be|query)\b/i;
    const negZh=/^(?:否認|否定|未見|未發現|排除|已排除|沒有|無證據|無明顯|無任何|無(?:肺炎|糖尿病|骨折|胸痛|感染|出血|發燒|發熱|呼吸困難|心臟衰竭|腫瘤|癌))/;
    const uncertainZh=/^(?:疑似|懷疑|考慮|可能|待排|不排除)/;
    const uncertainAnywhere=/\b(?:possible|possibly|probable|probably|suspected?|suspicious\s+for|concern\s+for|may\s+be|could\s+be|rule\s+out|r\s*\/\s*o)\b/i;
    const uncertainZhAnywhere=/(?:疑似|懷疑|考慮|可能|待排|不排除)/;
    const negAnywhere=/\b(?:denies?|denied|negative\s+for|(?:no|without)\s+evidence\s+of|absence\s+of|ruled?\s+out)\b/i;
    const negZhAnywhere=/(?:否認|否定|未見|未發現|已排除|排除)/;
    // 只在逗號後明確另起否定/不確定 assertion 時保留前段；一般 ICD 描述中的逗號不拆。
    const scoped=clause.match(/^(.*?)[,，]\s*(.+)$/);
    if(scoped&&scoped[1].trim()){
      const tail=scoped[2].trim(), tailLow=tail.toLowerCase();
      if(uncertainEn.test(tailLow)||uncertainZh.test(tail)){
        clause=scoped[1].trim(); low=clause.toLowerCase();
        warnings.push("已略過逗號後的不確定診斷：「"+tail+"」；請確認為確診後再查碼。");
      }else if(negEn.test(tailLow)||negZh.test(tail)){
        clause=scoped[1].trim(); low=clause.toLowerCase();
        warnings.push("已略過逗號後的否定診斷：「"+tail+"」。");
      }
    }
    // assertion scope 截短後需重新判斷；例如「CP, no fever」不可把 CP 當確診放行。
    const bareAbbr=low.replace(/[^a-z0-9]/g,"");
    if(BLOCKING_AMBIGUOUS_ABBR.has(bareAbbr)){
      if(AMBIGUOUS_ABBR[bareAbbr]) warnings.push(AMBIGUOUS_ABBR[bareAbbr]);
      warnings.push("單獨縮寫 "+clause.trim()+" 無法安全判定，請輸入完整診斷名稱。");
      continue;
    }
    if(uncertainEn.test(low)||uncertainZh.test(clause)||uncertainAnywhere.test(low)||uncertainZhAnywhere.test(clause)){
      warnings.push("已略過不確定診斷：「"+clause+"」；請確認為確診後再查碼。");
      continue;
    }
    if(negEn.test(low)||negZh.test(clause)||negAnywhere.test(low)||negZhAnywhere.test(clause)){
      warnings.push("已略過否定診斷：「"+clause+"」；否定內容不會當成確診搜尋。");
      continue;
    }

    // 句中否定：保留否定詞前的確診/症狀，捨棄後段；ICD 常見的 without qualifier 則完整保留。
    let cut=clause.match(/^(.*?)(?:\s+|[,，]\s*)(?:no\b|denies?\b|negative\s+for\b|(?:no|without)\s+evidence\s+of\b)(.+)$/i);
    if(cut && cut[1].trim()){
      clause=cut[1].trim();
      warnings.push("已略過句中的否定內容：「"+cut[2].trim()+"」。");
    }else{
      cut=clause.match(/^(.*?)(?:[,，]\s*|\s+)(?:無|否認|未見|未發現|排除)(.+)$/);
      if(cut && cut[1].trim()){
        clause=cut[1].trim();
        warnings.push("已略過句中的否定內容：「"+cut[2].trim()+"」。");
      }
    }
    if(!(cut && cut[1] && clause===cut[1].trim())){
      const keepWithout=/\bwithout\s+(?:loss\s+of\s+consciousness|coma|complications?|angina(?:\s+pectoris)?|bleeding|perforation|obstruction|esophagitis|hypoxia|hypercapnia|status\s+epilepticus|foreign\s+body|nail\s+damage|heart\s+failure|acute\s+cor\s+pulmonale)\b/i;
      cut=clause.match(/^(.*?)\s+without\s+(.+)$/i);
      if(cut && cut[1].trim() && !keepWithout.test(clause)){
        clause=cut[1].trim();
        warnings.push("已略過句中的否定內容：「"+cut[2].trim()+"」。");
      }
    }
    if(clause) active.push(...expandBilateralInjury(clause));
  }
  const queries=uniqueStrings(active);
  if(queries.length>1) warnings.push("已將複合敘述拆成 "+queries.length+" 組，避免側別或部位跨診斷串台。");
  return {queries,warnings:uniqueStrings(warnings),blocked:queries.length===0};
}

function encounterChoice(e,q){
  const allowed=String((e&&e.s7)||"").toUpperCase();
  if(!allowed) return {value:"",needsChoice:false,message:""};
  const raw=canonicalText(q).trim();
  const compact=raw.toUpperCase().replace(/[^A-Z0-9]/g,"");
  // 直接輸入合法完整碼時保留第7碼，不要求再選一次。
  for(const ch of allowed){
    if(buildCode(e.c,ch).toUpperCase().replace(/[^A-Z0-9]/g,"")===compact){
      return {value:ch,needsChoice:false,message:"已沿用輸入代碼的第7碼 "+ch+"。"};
    }
  }

  const low=raw.toLowerCase();
  const isFracture=/fracture/i.test((e&&e.en)||"") || /骨折/.test((e&&e.zh)||"");
  const sequela=/\bsequela(?:e)?\b|後遺症?|陳舊性後遺/i.test(low);
  const delayed=/delayed\s+healing|延遲癒合/i.test(low);
  const nonunion=/non[- ]?union|未癒合|不癒合/i.test(low);
  const malunion=/mal[- ]?union|畸形癒合/i.test(low);
  const subsequent=/\bsubsequent(?:\s+encounter)?\b|follow[- ]?up|後續照護|後續就醫|追蹤/i.test(low)||delayed||nonunion||malunion;
  // ICD-10-CM 的 initial encounter 指 active treatment，不等於「首次到本院就醫」。
  const initial=/\binitial(?:\s+encounter)?\b|\bactive\s+treatment\b|初期照護|急性治療/i.test(low);
  // 接受 open displaced fracture、fracture of tibia, open、開放性脛骨骨折等常見語序。
  const explicitOpen=/\bopen\b[^,;.\n]{0,80}\bfracture\b|\bfracture\b[^;.\n]{0,80}\bopen\b|開放性?[^，；。\n]{0,20}骨折|骨折[^，；。\n]{0,20}開放性?/i.test(low);
  const closed=/\bclosed\b[^,;.\n]{0,80}\bfracture\b|\bfracture\b[^;.\n]{0,80}\bclosed\b|閉鎖性?[^，；。\n]{0,20}骨折|骨折[^，；。\n]{0,20}閉鎖性?/i.test(low);
  // 裸 type II/III 可能是糖尿病等其他分類；只有 Gustilo 明示，或已明示 open fracture 才當分型。
  const gustilo3=/\bgustilo(?:\s+(?:type|grade|classification))?[\s:-]*(?:iii(?:a|b|c)?|3(?:a|b|c)?)\b/i.test(low);
  const gustilo12=/\bgustilo(?:\s+(?:type|grade|classification))?[\s:-]*(?:i{1,2}|[12])\b/i.test(low) && !gustilo3;
  const typed3=explicitOpen && /\b(?:type|grade)\s*(?:iii(?:a|b|c)?|3(?:a|b|c)?)\b(?!\s+(?:diabet|dm\b|mellitus))/i.test(low);
  const typed12=explicitOpen && /\b(?:type|grade)\s*(?:i{1,2}|[12])\b(?!\s+(?:diabet|dm\b|mellitus))/i.test(low) && !typed3;
  const zh3=explicitOpen && /(?:第\s*)?(?:III(?:A|B|C)?|3(?:A|B|C)?)\s*型/i.test(raw);
  const zh12=explicitOpen && /(?:第\s*)?(?:I{1,2}|[12])\s*型/i.test(raw) && !zh3;
  const open3=gustilo3||typed3||zh3;
  const open12=(gustilo12||typed12||zh12)&&!open3;
  const open=explicitOpen||open3||open12;
  function chosen(ch,msg){
    if(allowed.includes(ch)) return {value:ch,needsChoice:false,message:msg};
    return {value:"",needsChoice:true,message:"此候選不支援判定出的第7碼 "+ch+"，請人工確認。"};
  }
  const stageCount=[initial,subsequent,sequela].filter(Boolean).length;
  const healingCount=[delayed,nonunion,malunion].filter(Boolean).length;
  if(stageCount>1) return {value:"",needsChoice:true,message:"查詢同時包含互斥的照護階段，請確認初期、後續或後遺症。"};
  if(healingCount>1) return {value:"",needsChoice:true,message:"查詢同時包含互斥的癒合狀態，請確認延遲癒合、未癒合或畸形癒合。"};
  if(open&&closed) return {value:"",needsChoice:true,message:"查詢同時包含開放性與閉鎖性骨折，請確認骨折型別。"};
  if(sequela) return chosen("S","已辨識為後遺症照護。");

  if(!isFracture){
    if(subsequent) return chosen("D","已辨識為後續照護。");
    if(initial) return chosen("A","已辨識為初期照護。");
    return {value:"",needsChoice:true,message:"此代碼需要第7碼；請選擇初期、後續或後遺症。"};
  }

  const healing=delayed?"delayed":nonunion?"nonunion":malunion?"malunion":"routine";
  // 有些骨折碼只用 B 表示所有開放性骨折（s7 有 B、沒有 C），不再細分 Gustilo。
  const distinguishesOpenType=allowed.includes("C");
  if(open && distinguishesOpenType && !open12 && !open3){
    return {value:"",needsChoice:true,message:"開放性骨折需確認 Gustilo I/II 或 IIIA-C，不能自動猜第7碼。"};
  }
  if(!initial && !subsequent){
    return {value:"",needsChoice:true,message:"骨折代碼需確認初期/後續/後遺症；未指定時不預設 A。"};
  }
  if(initial){
    if(open && !distinguishesOpenType) return chosen("B","已辨識為初期照護之開放性骨折；此候選不細分 Gustilo 型別。");
    if(open3) return chosen("C","已辨識為初期照護之 Gustilo IIIA-C 開放性骨折。");
    if(open12) return chosen("B","已辨識為初期照護之 Gustilo I/II 開放性骨折。");
    if(closed||!open) return chosen("A","已辨識為初期照護之閉鎖性骨折。");
  }
  // 不細分 Gustilo 的候選，後續照護沿用 D/G/K/P；不可套用不存在的 E/F 等組別。
  const group=distinguishesOpenType?(open3?"open3":open12?"open12":"closed"):"closed";
  const map={
    routine:{closed:"D",open12:"E",open3:"F"},
    delayed:{closed:"G",open12:"H",open3:"J"},
    nonunion:{closed:"K",open12:"M",open3:"N"},
    malunion:{closed:"P",open12:"Q",open3:"R"},
  };
  return chosen(map[healing][group],"已依照護階段、開放型別與癒合狀態選擇第7碼。");
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

const BONE_ALIASES = [
  ["femur","femoral"],["radius","radial"],["ulna","ulnar"],["humerus","humeral"],
  ["tibia","tibial"],["fibula","fibular"],["clavicle","clavicular"],["patella","patellar"],
  ["metacarpal"],["metatarsal"],["phalanx","phalangeal"],["calcaneus","calcaneal"],
  ["scaphoid"],["navicular"],["sternum","sternal"],["vertebra","vertebral"],
];
function recognizedBones(qtoks){
  return BONE_ALIASES.filter(group=>qtoks.some(t=>group.includes(t)));
}
function itemHasRecognizedBone(item,groups){
  if(!groups.length) return true;
  const hay=item.hay+(item.axhay||"");
  return groups.some(group=>group.some(t=>hay.includes(" "+t+" ")));
}

// prefixes：可選的 ICD 碼段白名單（小人圖用）。給了就「硬過濾」只留這些碼段，
// 且查無時不 fallback 全域（防錯碼）。文字 q 仍負責在白名單內排序（如 back/chest 細分）。
function searchCore(IDX,q,scope,prefixes){
  const explicitPf = (prefixes && prefixes.length) ? prefixes : null;   // 小人圖點擊傳入
  q=canonicalText(q);
  // 防呆：即使呼叫端忘了先 analyzeQuery，否定/不確定診斷也不回可複製碼；
  // 多診斷則要求呼叫端逐 queries 搜尋，避免跨子句混合側別與部位。
  if(!explicitPf){
    const analysis=analyzeQuery(q);
    if(analysis.blocked || analysis.queries.length>1) return [];
    if(analysis.queries.length===1) q=analysis.queries[0];
  }
  if(!q.trim() && !explicitPf) return [];
  if(!explicitPf && isCodeQuery(q) && !ABBR[q.trim().toLowerCase()]) return codeSearch(IDX,q,scope);  // 整串是已知縮寫(t1dm/t2dm)→走文字搜尋,別誤判成代碼反查
  ensureDF(IDX);
  const qtoks=norm(q), cjk=hasCJK(q);
  const hasLeft=qtoks.includes("left"), hasRight=qtoks.includes("right"), hasBilateral=qtoks.includes("bilateral");
  const qSide=hasLeft&&!hasRight&&!hasBilateral?"left":hasRight&&!hasLeft&&!hasBilateral?"right":"";
  const qHasSide=hasLeft||hasRight||hasBilateral;
  const queryBones=recognizedBones(qtoks);
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
      // 明確單側不可回傳相反側/雙側；未明示側別仍保留，供使用者補資訊。
      if(qSide==="left" && (item.hay.includes(" right ")||item.hay.includes(" bilateral "))) continue;
      if(qSide==="right" && (item.hay.includes(" left ")||item.hay.includes(" bilateral "))) continue;
      // 已辨識的具名骨是安全硬條件，避免股骨查詢混入肱骨、橈骨等可複製候選。
      if(!itemHasRecognizedBone(item,queryBones)) continue;
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
    const forced = PHRASE_CODE[canonicalText(q).toLowerCase().trim().replace(/\s+/g," ")] || PHRASE_CODE[qtoks.join(" ")];
    if(forced){
      const set=new Set(forced), top=[];
      for(const code of forced){ const it=IDX.find(x=>x.e.c===code); if(it) top.push([999,it]); }
      out = top.concat(out.filter(([s,it])=>!set.has(it.e.c)));
    }
  }
  return out;
}
if(typeof module!=="undefined")module.exports={SEV_ORDER,SYN,canonicalText,hasCJK,norm,levLE,indexEntry,scoreEntry,
  buildCode,whyHit,needMore,analyzeQuery,encounterChoice,searchCore,isCodeQuery};
