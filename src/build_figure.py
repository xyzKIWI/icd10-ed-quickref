#!/usr/bin/env python3
"""把 design/zones_{front,back}.json 的多邊形寫進 template.html 兩個 SVG。
側別映射:front 影像左=病人右(R→right);back 為背面,影像左=病人左(R→left,反轉)。"""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
TPL = ROOT/"src"/"template.html"

NAME = {"head":"頭部","neck":"頸部","chest":"胸部","abdomen":"腹部","hip":"髖部","pelvis":"骨盆",
 "shoulder":"肩部","upper_arm":"上臂","elbow":"肘部","forearm":"前臂","wrist":"手腕","hand":"手部",
 "thigh":"大腿","knee":"膝部","lower_leg":"小腿","ankle":"腳踝","foot":"足部","heel":"腳跟",
 "face":"臉部","ear":"耳",
 "occiput":"後腦/枕部","upper_back":"上背/胸背","lower_back":"下背/腰","buttock":"臀部",
 "scapula":"肩胛","achilles":"跟腱"}
# 影像 R/L → 解剖 data-side
SIDEMAP = {"front":{"R":"right","L":"left","":""}, "back":{"R":"left","L":"right","":""}}

def polys(name):
    sm = SIDEMAP[name]
    out=[]
    for z in json.load(open(ROOT/"design"/f"zones_{name}.json")):
        side = sm[z["side"]]
        pts = " ".join(f"{x},{y}" for x,y in z["points"])
        pre = {"right":"右","left":"左"}.get(side,"")
        title = pre + (z.get("name") or NAME.get(z["part"], z["part"]))   # 自訂名稱優先(臉部/耳/骨盆/足跟)
        out.append(f'          <polygon class="zone" data-part="{z["part"]}" '
                   f'data-side="{side}" points="{pts}"><title>{title}</title></polygon>')
    return "\n".join(out)

html = TPL.read_text(encoding="utf-8")
for name,aria in [("front","Body front"),("back","Body back")]:
    # 抓該 SVG 的 <image ...></image> ... </svg>,替換中間多邊形
    pat = re.compile(r'(aria-label="'+aria+r'">\s*<image[^>]*></image>\n)(.*?)(\s*</svg>)', re.S)
    html = pat.sub(lambda m: m.group(1)+polys(name)+"\n"+m.group(3), html, count=1)
TPL.write_text(html, encoding="utf-8")
print("polygons 已寫入 template.html")
