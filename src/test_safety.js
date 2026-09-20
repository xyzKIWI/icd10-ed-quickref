// 臨床安全回歸：否定/不確定、多診斷切分、保守排序、縮寫與第7碼。
const assert = require("assert");
const fs = require("fs"), path = require("path");
const C = require("./search_core.js");
const DB = JSON.parse(fs.readFileSync(path.join(__dirname,"../build/icd_data.json"),"utf8"));
const IDX = DB.entries.map(e=>C.indexEntry(e,e.k));

function codes(q,n=5){
  return C.searchCore(IDX,q,"all").slice(0,n).map(x=>x[1].e.c);
}
function expectTop(q,code){
  const got=codes(q,1)[0];
  assert.strictEqual(got,code,`${q}: expected ${code}, got ${got||"(empty)"}`);
}
function entry(code){
  const e=DB.entries.find(x=>x.c===code);
  assert(e,`missing fixture code ${code}`);
  return e;
}

// 否定/不確定診斷不可變成可複製確診碼；句中否定保留前段陽性症狀。
for(const q of ["否認胸痛","無肺炎","無糖尿病","no fracture of left wrist","denies chest pain",
                "patient denies chest pain","chest pain denied","rule out appendicitis",
                "appendicitis suspected","possible pneumonia","疑似肺炎","不排除肺炎","肺炎待排"]){
  const a=C.analyzeQuery(q);
  assert.strictEqual(a.blocked,true,`${q}: should be blocked`);
  assert.deepStrictEqual(a.queries,[],`${q}: should have no active query`);
  assert.deepStrictEqual(codes(q),[],`${q}: searchCore defense-in-depth should return no code`);
}
assert.deepStrictEqual(C.analyzeQuery("left wrist pain, no fracture").queries,["left wrist pain"]);
assert.deepStrictEqual(C.analyzeQuery("左手腕疼痛，無骨折").queries,["左手腕疼痛"]);
assert.deepStrictEqual(C.analyzeQuery("left wrist pain, no evidence of fracture").queries,["left wrist pain"]);
assert.deepStrictEqual(C.analyzeQuery("chest pain, denies fever").queries,["chest pain"]);
assert.deepStrictEqual(C.analyzeQuery("胸痛，否認呼吸困難").queries,["胸痛"]);
assert.deepStrictEqual(C.analyzeQuery("胸痛，未見肺炎").queries,["胸痛"]);
assert.deepStrictEqual(C.analyzeQuery("pneumonia, possible PE").queries,["pneumonia"]);
assert.deepStrictEqual(C.analyzeQuery("cough without fever").queries,["cough"]);
assert.deepStrictEqual(C.analyzeQuery("head injury without loss of consciousness").queries,
  ["head injury without loss of consciousness"]);

// 多診斷先切組，左右側不得跨子句重組；直接把複合句丟進 searchCore 也不回錯碼。
let a=C.analyzeQuery("right ankle sprain and left knee contusion");
assert.deepStrictEqual(a.queries,["right ankle sprain","left knee contusion"]);
assert.strictEqual(a.blocked,false);
assert.deepStrictEqual(codes("right ankle sprain and left knee contusion"),[]);
expectTop(a.queries[0],"S93.401");
expectTop(a.queries[1],"S80.02");
a=C.analyzeQuery("左腳踝扭傷合併左膝挫傷");
assert.deepStrictEqual(a.queries,["左腳踝扭傷","左膝挫傷"]);
a=C.analyzeQuery("bilateral ankle sprain");
assert.deepStrictEqual(a.queries,["left ankle sprain","right ankle sprain"]);
a=C.analyzeQuery("雙側股骨骨折");
assert.deepStrictEqual(a.queries,["左側股骨骨折","右側股骨骨折"]);
for(const q of ["left and right wrist fracture","left/right wrist fracture"]){
  assert.deepStrictEqual(C.analyzeQuery(q).queries,["left wrist fracture","right wrist fracture"]);
}
for(const q of ["左右手腕骨折","左、右手腕骨折"]){
  assert.deepStrictEqual(C.analyzeQuery(q).queries,["左側手腕骨折","右側手腕骨折"]);
}
assert.deepStrictEqual(C.analyzeQuery("左右腳踝扭傷").queries,["左側腳踝扭傷","右側腳踝扭傷"]);
assert.deepStrictEqual(C.analyzeQuery("bilateral pneumonia").queries,["bilateral pneumonia"]);
assert.deepStrictEqual(C.analyzeQuery("bilateral hip osteoarthritis").queries,["bilateral hip osteoarthritis"]);
a=C.analyzeQuery("pneumonia\nurinary tract infection");
assert.deepStrictEqual(a.queries,["pneumonia","urinary tract infection"]);

// 中文長詞與 Unicode 正規化。
expectTop("左側股骨頸骨折","S72.002");
expectTop("右股骨頸骨折","S72.001");
expectTop("股骨頸骨折","S72.009");
for(const [q,bone,opposite] of [
  ["左側股骨頸骨折",/\bfem(?:ur|oral)\b/i,/\b(?:right|bilateral)\b/i],
  ["left radius fracture",/\bradi(?:us|al)\b/i,/\b(?:right|bilateral)\b/i],
  ["right humerus fracture",/\bhumer(?:us|al)\b/i,/\b(?:left|bilateral)\b/i],
]){
  const got=C.searchCore(IDX,q,"all").slice(0,25).map(x=>x[1].e);
  assert(got.length>0,`${q}: expected candidates`);
  for(const e of got){
    assert(bone.test(e.en),`${q}: wrong bone candidate ${e.c} ${e.en}`);
    assert(!opposite.test(e.en),`${q}: opposite-side candidate ${e.c} ${e.en}`);
  }
}
expectTop("泌尿道感染","N39.0");
expectTop("尿路感染","N39.0");
expectTop("攝護腺肥大","N40.0");
expectTop("退化性關節炎","M19.90");

// 一般疾病採保守碼，不擅加未提到的併發症、急性惡化、病因或手術史。
for(const [q,code] of [
  ["糖尿病","E11.9"],["DM","E11.9"],["T2DM","E11.9"],["NIDDM","E11.9"],
  ["COPD","J44.9"],["chronic obstructive pulmonary disease","J44.9"],
  ["CAD","I25.10"],["coronary artery disease","I25.10"],
  ["脂肪肝","K76.0"],["fatty liver","K76.0"],
  ["胃食道逆流","K21.9"],["GERD","K21.9"],
  ["UTI","N39.0"],["urinary tract infection","N39.0"],
]) expectTop(q,code);
expectTop("AECOPD","J44.1"); // 明確寫急性惡化仍應保留特異碼

// 新增常見縮寫；高歧義縮寫單獨出現時阻擋，含明確語境時可繼續並提示。
for(const [q,code] of [
  ["CKD3","N18.30"],["CKD3a","N18.31"],["CKD3b","N18.32"],
  ["PNA","J18.9"],["HFrEF","I50.20"],["HFpEF","I50.30"],
  ["OA","M19.90"],["rheumatoid arthritis (RA)","M06.9"],
]) expectTop(q,code);
// 本站明確指定 PN 代表 pneumonia；大小寫／全形一致，PNA 保留相容。
for(const q of ["PN","pn","Pn","ＰＮ"," PN ","PN.","pneumonia (PN)"]){
  const result=C.analyzeQuery(q);
  assert.strictEqual(result.blocked,false,`${q}: configured pneumonia abbreviation must be searchable`);
  assert.deepStrictEqual(result.warnings,[],`${q}: PN must not retain an ambiguity warning`);
  expectTop(q,"J18.9");
}
for(const q of ["no PN","denies PN","possible PN","r/o PN","疑似PN","否認PN"]){
  assert.strictEqual(C.analyzeQuery(q).blocked,true,`${q}: PN must retain assertion safeguards`);
  assert.deepStrictEqual(codes(q),[],`${q}: negated or uncertain PN is not an active diagnosis`);
}
assert.deepStrictEqual(C.analyzeQuery("PN and UTI").queries,["PN","UTI"]);
assert.deepStrictEqual(C.analyzeQuery("PN, no fever").queries,["PN"]);
expectTop("PN, no fever","J18.9");
for(const q of ["CP","PE","RA","MS","PTA","AF","LOC"]){
  const result=C.analyzeQuery(q);
  assert.strictEqual(result.blocked,true,`${q}: bare high-ambiguity abbreviation must be blocked`);
  assert.deepStrictEqual(result.queries,[],`${q}: should require a full diagnostic term`);
  assert(result.warnings.length>0,`${q}: ambiguous abbreviation needs warning`);
  assert.deepStrictEqual(codes(q),[],`${q}: core search must not bypass ambiguity block`);
}
for(const q of ["PE, possible pneumonia","CP, no fever","RA, denies trauma","LOC, possible seizure"]){
  const result=C.analyzeQuery(q);
  assert.strictEqual(result.blocked,true,`${q}: scoped tail leaves a bare ambiguous abbreviation`);
  assert.deepStrictEqual(result.queries,[],`${q}: bare abbreviation after tail removal must be blocked`);
  assert.deepStrictEqual(codes(q),[],`${q}: core search must not bypass scoped ambiguity block`);
}
assert.strictEqual(C.analyzeQuery("CP due to anxiety").blocked,false);
assert(C.analyzeQuery("OA").warnings.length>0);
assert(C.analyzeQuery("DM").warnings.length>0);

// 組合碼保留完整查詢，另開 CKD stage 組；due to 則拆開病因與表現。
a=C.analyzeQuery("type 2 diabetes with CKD3");
assert.deepStrictEqual(a.queries,["type 2 diabetes with CKD3","CKD3"]);
a=C.analyzeQuery("sepsis due to UTI");
assert.deepStrictEqual(a.queries,["sepsis","UTI"]);

// 第7碼：未指定時依急診流程預設 A；明確階段仍沿用輸入判斷。
const contusion=entry("S50.12"), tibiaFx=entry("S82.202");
assert.deepStrictEqual(C.encounterChoice(contusion,"left forearm contusion"),{
  value:"A",needsChoice:false,message:"未指定照護階段，依急診流程預設為初期照護。"
});
assert.strictEqual(C.encounterChoice(contusion,"left forearm contusion subsequent encounter").value,"D");
assert.strictEqual(C.encounterChoice(contusion,"left forearm contusion sequela").value,"S");
assert.strictEqual(C.encounterChoice(contusion,"S50.12XD").value,"D");
assert.strictEqual(C.encounterChoice(tibiaFx,"open fracture left tibia").value,"A");
assert.strictEqual(C.encounterChoice(tibiaFx,"initial open fracture Gustilo type II").value,"B");
assert.strictEqual(C.encounterChoice(tibiaFx,"initial open fracture Gustilo IIIA").value,"C");
assert.strictEqual(C.encounterChoice(tibiaFx,"initial open displaced fracture").needsChoice,true);
assert.strictEqual(C.encounterChoice(tibiaFx,"initial open tibia fracture").needsChoice,true);
assert.strictEqual(C.encounterChoice(tibiaFx,"initial fracture of tibia, open").needsChoice,true);
assert.strictEqual(C.encounterChoice(tibiaFx,"初期照護 開放性脛骨骨折").needsChoice,true);
assert.strictEqual(C.encounterChoice(tibiaFx,"subsequent open fracture Gustilo II routine healing").value,"E");
assert.strictEqual(C.encounterChoice(tibiaFx,"subsequent closed fracture with nonunion").value,"K");
assert.strictEqual(C.encounterChoice(tibiaFx,"S82.202B").value,"B");
assert.strictEqual(C.encounterChoice(tibiaFx,"首次就醫之左脛骨骨折").value,"A");
assert.strictEqual(C.encounterChoice(tibiaFx,"initial fracture with type 2 diabetes").value,"A");
assert.strictEqual(C.encounterChoice(tibiaFx,"initial closed fracture type II").value,"A");
assert.strictEqual(C.encounterChoice(tibiaFx,"initial closed fracture Gustilo type II").needsChoice,true);

for(const q of [
  "initial and subsequent fracture","initial fracture sequela",
  "subsequent fracture delayed healing with nonunion","initial open and closed fracture",
]){
  const result=C.encounterChoice(tibiaFx,q);
  assert.strictEqual(result.value,"",`${q}: contradictory signals must not select a character`);
  assert.strictEqual(result.needsChoice,true,`${q}: contradictory signals require review`);
}

// s7 有 B、沒有 C 的骨折家族：B 即所有開放性初期照護，後續只用 D/G/K/P。
const noGustiloFx=DB.entries.find(e=>/fracture/i.test(e.en||"") && /B/.test(e.s7||"") && !/C/.test(e.s7||"") && /DGKP/.test(e.s7||""));
assert(noGustiloFx,"missing fracture fixture with B but no C");
assert.strictEqual(C.encounterChoice(noGustiloFx,"initial open fracture").value,"B");
assert.strictEqual(C.encounterChoice(noGustiloFx,"initial open fracture").needsChoice,false);
assert.strictEqual(C.encounterChoice(noGustiloFx,"subsequent open fracture routine healing").value,"D");
assert.strictEqual(C.encounterChoice(noGustiloFx,"subsequent open fracture delayed healing").value,"G");
assert.strictEqual(C.encounterChoice(noGustiloFx,"subsequent open fracture nonunion").value,"K");
assert.strictEqual(C.encounterChoice(noGustiloFx,"subsequent open fracture malunion").value,"P");

console.log("✅ clinical safety regression passed");
