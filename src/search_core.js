// 純搜尋邏輯：瀏覽器與 Node 測試共用。無 DOM 依賴。
// 詞表(SYN/ABBR/PHRASE_CODE/外傷表等)已抽到 lexicon.js——加詞只動那裡。Node 端在此 require 載入(掛 globalThis)；
// 瀏覽器由 build_html.py 把 lexicon.js 併在本檔前面同一 <script>，這些常數自然在作用域內，故略過 require。
if (typeof module !== "undefined" && typeof require !== "undefined") require("./lexicon.js");

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
