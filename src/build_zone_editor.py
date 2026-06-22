#!/usr/bin/env python3
"""產生 design/zone_editor.html：互動式小人圖熱區編輯器（單檔、可離線）。
把兩張底圖 base64 + 現有 zones_{front,back}.json 內嵌進去，
Kiwi 開檔即可拖拉頂點微調 / 畫新區域 / 標注部位側別 → 匯出 JSON 接回 build_figure.py。
重跑：python3 src/build_zone_editor.py
"""
import base64, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESIGN = ROOT / "design"

def b64(p):
    return base64.b64encode((DESIGN / p).read_bytes()).decode()

front_img = b64("chart_front_final.png")
back_img  = b64("chart_back_final.png")
zones_front = json.loads((DESIGN / "zones_front.json").read_text(encoding="utf-8"))
zones_back  = json.loads((DESIGN / "zones_back.json").read_text(encoding="utf-8"))

# 部位中文名（與 build_figure.py 的 NAME 一致）
PARTS = {
    "head":"頭部","face":"臉部","ear":"耳","neck":"頸部","chest":"胸部","abdomen":"腹部",
    "hip":"髖部","pelvis":"骨盆",
    "shoulder":"肩部","upper_arm":"上臂","elbow":"肘部","forearm":"前臂","wrist":"手腕","hand":"手部",
    "thigh":"大腿","knee":"膝部","lower_leg":"小腿","ankle":"腳踝","foot":"足部","heel":"腳跟",
    "occiput":"後腦/枕部","upper_back":"上背/胸背","lower_back":"下背/腰","buttock":"臀部",
    "scapula":"肩胛","achilles":"跟腱",
}

HTML = r"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>小人圖熱區編輯器</title>
<style>
  :root{--bd:#cbd5e1;--blue:#2563eb;--bg:#f8fafc;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;background:var(--bg);color:#0f172a;}
  header{padding:8px 12px;background:#fff;border-bottom:1px solid var(--bd);display:flex;flex-wrap:wrap;gap:6px;align-items:center;position:sticky;top:0;z-index:10;}
  button{padding:6px 10px;border:1px solid var(--bd);background:#fff;border-radius:7px;cursor:pointer;font-size:13px;}
  button:hover{background:#eff6ff;}
  button.on{background:var(--blue);color:#fff;border-color:var(--blue);}
  button.danger{color:#b91c1c;border-color:#fca5a5;}
  .sep{width:1px;height:22px;background:var(--bd);margin:0 4px;}
  select,input{padding:5px 7px;border:1px solid var(--bd);border-radius:6px;font-size:13px;}
  .wrap{display:flex;gap:14px;padding:12px;align-items:flex-start;flex-wrap:wrap;}
  .stage{background:#fff;border:1px solid var(--bd);border-radius:10px;padding:6px;}
  svg{display:block;touch-action:none;width:434px;height:651px;max-width:90vw;}
  image{pointer-events:none;}
  polygon.zone{fill:#2563eb;fill-opacity:.18;stroke:#1d4ed8;stroke-width:1.5;cursor:pointer;}
  polygon.zone:hover{fill-opacity:.34;}
  polygon.zone.sel{fill:#f59e0b;fill-opacity:.34;stroke:#b45309;stroke-width:2;}
  polyline.draft{fill:#10b981;fill-opacity:.18;stroke:#059669;stroke-width:2;stroke-dasharray:4 3;}
  circle.vtx{fill:#fff;stroke:#b45309;stroke-width:2;cursor:grab;}
  circle.dpt{fill:#059669;}
  text.lbl{font-size:11px;fill:#1e3a8a;pointer-events:none;font-weight:600;}
  .panel{flex:1;min-width:280px;}
  .card{background:#fff;border:1px solid var(--bd);border-radius:10px;padding:12px;margin-bottom:12px;}
  .card h3{margin:0 0 8px;font-size:14px;}
  .row{display:flex;gap:8px;align-items:center;margin:6px 0;flex-wrap:wrap;}
  label{font-size:13px;}
  textarea{width:100%;height:150px;font-family:ui-monospace,monospace;font-size:11px;border:1px solid var(--bd);border-radius:6px;padding:8px;}
  .hint{font-size:12px;color:#64748b;line-height:1.6;}
  .pill{font-size:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;padding:2px 7px;border-radius:99px;}
  kbd{background:#f1f5f9;border:1px solid var(--bd);border-radius:4px;padding:1px 5px;font-size:11px;}
</style>
</head>
<body>
<header>
  <button id="bFront" class="on">正面 Front</button>
  <button id="bBack">背面 Back</button>
  <span class="sep"></span>
  <button id="mEdit" class="on">✋ 選取/微調</button>
  <button id="mDraw">✏️ 畫新區域</button>
  <button id="bFinish" style="display:none">✔ 閉合區域</button>
  <button id="bCancel" style="display:none">✕ 取消</button>
  <span class="sep"></span>
  <button id="bDelZone" class="danger" disabled>🗑 刪除選取區域</button>
  <span class="sep"></span>
  <button id="bExport" class="on">⬇ 匯出 JSON</button>
  <span id="status" class="pill" style="margin-left:auto"></span>
</header>

<div class="wrap">
  <div class="stage">
    <svg id="svg" viewBox="0 0 724 1086">
      <image id="bg" x="0" y="0" width="724" height="1086"></image>
      <g id="gZones"></g>
      <g id="gDraft"></g>
      <g id="gVtx"></g>
    </svg>
  </div>

  <div class="panel">
    <div class="card">
      <h3>選取的區域</h3>
      <div id="selInfo" class="hint">點圖上的區域來選取，或按「畫新區域」。</div>
      <div id="selEdit" style="display:none">
        <div class="row">
          <label>部位類別</label>
          <select id="selPart"></select>
        </div>
        <div class="row">
          <label>自訂名稱</label>
          <input id="selName" type="text" placeholder="可空白，留空用部位類別名" style="flex:1;min-width:140px">
        </div>
        <div class="row">
          <label>側別</label>
          <select id="selSide">
            <option value="">無（中線部位）</option>
            <option value="R">R（圖的右半邊）</option>
            <option value="L">L（圖的左半邊）</option>
          </select>
        </div>
        <div class="hint">拖<b>區域內部</b>＝整塊移動；拖<b>白色圓點</b>＝移動單一頂點；<kbd>雙擊</kbd>白點＝刪除該頂點（保留 ≥3 點）。</div>
      </div>
    </div>

    <div class="card">
      <h3>怎麼用</h3>
      <div class="hint">
        1. 選「正面/背面」<br>
        2. <b>微調</b>：點區域 → 拖白點對齊身體<br>
        3. <b>畫新</b>：按「畫新區域」→ 沿邊界一路點 → 按「閉合區域」→ 選部位/側別<br>
        4. 都好了按「<b>匯出 JSON</b>」→ 複製或下載，把內容貼/傳給 Claude，我接回 pipeline 重建小人圖<br>
        <br>側別 R/L 指<b>圖片的左右半邊</b>（系統會自動換算成解剖左右：正面圖左半=病人右、背面相反）。中線部位（頭/胸/腹/上背…）選「無」。
      </div>
    </div>

    <div id="exportCard" class="card" style="display:none">
      <h3>匯出（front / back 各一份）</h3>
      <div class="row">
        <button id="cpFront">📋 複製 zones_front.json</button>
        <button id="cpBack">📋 複製 zones_back.json</button>
        <button id="dl">💾 下載兩個檔</button>
      </div>
      <div class="hint" style="margin:6px 0">front：</div>
      <textarea id="taFront" readonly></textarea>
      <div class="hint" style="margin:6px 0">back：</div>
      <textarea id="taBack" readonly></textarea>
    </div>
  </div>
</div>

<script>
const IMGS = {front:"data:image/png;base64,__FRONT_IMG__", back:"data:image/png;base64,__BACK_IMG__"};
const PARTNAMES = __PARTNAMES__;
let DATA = {front: __ZONES_FRONT__, back: __ZONES_BACK__};

const svg=document.getElementById("svg"), bg=document.getElementById("bg");
const gZones=document.getElementById("gZones"), gDraft=document.getElementById("gDraft"), gVtx=document.getElementById("gVtx");
let view="front", mode="edit", sel=null, draft=[], drag=null;

// 部位下拉
const selPart=document.getElementById("selPart");
for(const k in PARTNAMES){const o=document.createElement("option");o.value=k;o.textContent=PARTNAMES[k]+" ("+k+")";selPart.appendChild(o);}

function svgPt(evt){
  const p=svg.createSVGPoint(); p.x=evt.clientX; p.y=evt.clientY;
  const m=svg.getScreenCTM().inverse(); const r=p.matrixTransform(m);
  return [Math.round(r.x*10)/10, Math.round(r.y*10)/10];
}
function status(t){document.getElementById("status").textContent=t;}

function render(){
  bg.setAttributeNS("http://www.w3.org/1999/xlink","href",IMGS[view]);
  bg.setAttribute("href",IMGS[view]);
  // zones
  gZones.innerHTML="";
  DATA[view].forEach((z,i)=>{
    const pg=document.createElementNS("http://www.w3.org/2000/svg","polygon");
    pg.setAttribute("points",z.points.map(p=>p.join(",")).join(" "));
    pg.setAttribute("class","zone"+(i===sel?" sel":""));
    pg.addEventListener("mousedown",e=>{if(mode==="edit"){e.stopPropagation();if(i!==sel)selectZone(i);
      drag={move:true,start:svgPt(e),orig:DATA[view][i].points.map(p=>p.slice())};}});
    gZones.appendChild(pg);
    // label at centroid
    const c=centroid(z.points);
    const t=document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x",c[0]);t.setAttribute("y",c[1]);t.setAttribute("class","lbl");t.setAttribute("text-anchor","middle");
    t.textContent=(z.side?z.side+" ":"")+(z.name||PARTNAMES[z.part]||z.part);
    gZones.appendChild(t);
  });
  // vertices of selected
  gVtx.innerHTML="";
  if(sel!=null && DATA[view][sel]){
    DATA[view][sel].points.forEach((p,vi)=>{
      const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute("cx",p[0]);c.setAttribute("cy",p[1]);c.setAttribute("r",6);c.setAttribute("class","vtx");
      c.addEventListener("mousedown",e=>{e.stopPropagation();drag={vi};});
      c.addEventListener("dblclick",e=>{e.stopPropagation();delVertex(vi);});
      gVtx.appendChild(c);
    });
  }
  // draft
  gDraft.innerHTML="";
  if(draft.length){
    const pl=document.createElementNS("http://www.w3.org/2000/svg","polyline");
    pl.setAttribute("points",draft.map(p=>p.join(",")).join(" "));
    pl.setAttribute("class","draft");
    gDraft.appendChild(pl);
    draft.forEach(p=>{const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute("cx",p[0]);c.setAttribute("cy",p[1]);c.setAttribute("r",4);c.setAttribute("class","dpt");gDraft.appendChild(c);});
  }
  status(view+"："+DATA[view].length+" 區域"+(sel!=null?" ｜ 已選 #"+sel:""));
}
function centroid(pts){let x=0,y=0;for(const p of pts){x+=p[0];y+=p[1];}return [x/pts.length,y/pts.length];}

function selectZone(i){
  sel=i; const z=DATA[view][i];
  document.getElementById("selInfo").style.display="none";
  document.getElementById("selEdit").style.display="block";
  selPart.value=z.part; document.getElementById("selSide").value=z.side||"";
  document.getElementById("selName").value=z.name||"";
  document.getElementById("bDelZone").disabled=false;
  render();
}
function deselect(){sel=null;document.getElementById("selInfo").style.display="block";
  document.getElementById("selEdit").style.display="none";document.getElementById("bDelZone").disabled=true;render();}
function delVertex(vi){const z=DATA[view][sel];if(z.points.length<=3){alert("至少要 3 個頂點");return;}z.points.splice(vi,1);render();}

selPart.addEventListener("change",()=>{if(sel!=null)DATA[view][sel].part=selPart.value;render();});
document.getElementById("selSide").addEventListener("change",e=>{if(sel!=null)DATA[view][sel].side=e.target.value;render();});
document.getElementById("selName").addEventListener("input",e=>{
  if(sel==null)return; const v=e.target.value.trim();
  if(v)DATA[view][sel].name=v; else delete DATA[view][sel].name; render();
});

// SVG 互動
svg.addEventListener("mousedown",e=>{
  if(mode==="draw"){draft.push(svgPt(e));render();}
  else{deselect();}
});
svg.addEventListener("mousemove",e=>{
  if(!drag||sel==null)return;
  const cur=svgPt(e);
  if(drag.vi!=null){DATA[view][sel].points[drag.vi]=cur;render();}
  else if(drag.move){
    const dx=cur[0]-drag.start[0], dy=cur[1]-drag.start[1];
    DATA[view][sel].points=drag.orig.map(p=>[Math.round((p[0]+dx)*10)/10,Math.round((p[1]+dy)*10)/10]);
    render();
  }
});
window.addEventListener("mouseup",()=>{drag=null;});

// 模式切換
function setMode(m){mode=m;draft=[];
  document.getElementById("mEdit").classList.toggle("on",m==="edit");
  document.getElementById("mDraw").classList.toggle("on",m==="draw");
  document.getElementById("bFinish").style.display=m==="draw"?"":"none";
  document.getElementById("bCancel").style.display=m==="draw"?"":"none";
  render();}
document.getElementById("mEdit").onclick=()=>setMode("edit");
document.getElementById("mDraw").onclick=()=>{deselect();setMode("draw");};
document.getElementById("bCancel").onclick=()=>setMode("draw");
document.getElementById("bFinish").onclick=()=>{
  if(draft.length<3){alert("至少點 3 個點");return;}
  DATA[view].push({part:"head",side:"",points:draft.slice()});
  const ni=DATA[view].length-1; setMode("edit"); selectZone(ni);
  const n=document.getElementById("selName"); n.focus();
  status("已新增 → 右側選「部位類別」＋打「自訂名稱」");
};

// 視圖切換
document.getElementById("bFront").onclick=()=>{view="front";deselect();
  document.getElementById("bFront").classList.add("on");document.getElementById("bBack").classList.remove("on");};
document.getElementById("bBack").onclick=()=>{view="back";deselect();
  document.getElementById("bBack").classList.add("on");document.getElementById("bFront").classList.remove("on");};

document.getElementById("bDelZone").onclick=()=>{
  if(sel==null)return; if(!confirm("刪除這個區域？"))return;
  DATA[view].splice(sel,1);deselect();};

// 匯出
function dump(arr){return "["+arr.map(z=>JSON.stringify(z)).join(",\n")+"]";}
document.getElementById("bExport").onclick=()=>{
  document.getElementById("exportCard").style.display="block";
  document.getElementById("taFront").value=dump(DATA.front);
  document.getElementById("taBack").value=dump(DATA.back);
  document.getElementById("exportCard").scrollIntoView({behavior:"smooth"});
};
function copy(id){navigator.clipboard.writeText(document.getElementById(id).value).then(()=>status("已複製"));}
document.getElementById("cpFront").onclick=()=>copy("taFront");
document.getElementById("cpBack").onclick=()=>copy("taBack");
document.getElementById("dl").onclick=()=>{
  for(const [name,id] of [["zones_front.json","taFront"],["zones_back.json","taBack"]]){
    const b=new Blob([document.getElementById(id).value],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();
  }
};

render();
</script>
</body>
</html>
"""

out = (HTML
       .replace("__FRONT_IMG__", front_img)
       .replace("__BACK_IMG__", back_img)
       .replace("__PARTNAMES__", json.dumps(PARTS, ensure_ascii=False))
       .replace("__ZONES_FRONT__", json.dumps(zones_front, ensure_ascii=False))
       .replace("__ZONES_BACK__", json.dumps(zones_back, ensure_ascii=False)))

dst = DESIGN / "zone_editor.html"
dst.write_text(out, encoding="utf-8")
print(f"已產生 {dst}  ({dst.stat().st_size/1024:.0f} KB)  front {len(zones_front)} 區 / back {len(zones_back)} 區")
