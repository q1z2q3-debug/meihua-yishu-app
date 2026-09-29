// 梅花易数·起卦与全息排盘算法引擎
// 先天八卦数：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8
// 五行：乾兑金、震巽木、坎水、离火、艮坤土
// 八卦卦象（三爻，自下而上：下-中-上；1阳0阴）
const TRIGRAMS = {
  1: { name: '乾', xing: '金', symbol: '☰', lines: [1,1,1], nature: '天' },
  2: { name: '兑', xing: '金', symbol: '☱', lines: [1,1,0], nature: '泽' },
  3: { name: '离', xing: '火', symbol: '☲', lines: [1,0,1], nature: '火' },
  4: { name: '震', xing: '木', symbol: '☳', lines: [1,0,0], nature: '雷' },
  5: { name: '巽', xing: '木', symbol: '☴', lines: [0,1,1], nature: '风' },
  6: { name: '坎', xing: '水', symbol: '☵', lines: [0,1,0], nature: '水' },
  7: { name: '艮', xing: '土', symbol: '☶', lines: [0,0,1], nature: '山' },
  8: { name: '坤', xing: '土', symbol: '☷', lines: [0,0,0], nature: '地' },
};

// 五行相生相克
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

// 地支对应的五行与数字
const DIZHI = {
  子: { xing: '水', num: 1 }, 丑: { xing: '土', num: 2 }, 寅: { xing: '木', num: 3 },
  卯: { xing: '木', num: 4 }, 辰: { xing: '土', num: 5 }, 巳: { xing: '火', num: 6 },
  午: { xing: '火', num: 7 }, 未: { xing: '土', num: 8 }, 申: { xing: '金', num: 9 },
  酉: { xing: '金', num: 10 }, 戌: { xing: '土', num: 11 }, 亥: { xing: '水', num: 12 },
};

// 先天八卦卦数（梅花易数取数用）
const XIAN_TIAN = { 乾: 1, 兑: 2, 离: 3, 震: 4, 巽: 5, 坎: 6, 艮: 7, 坤: 8 };

// 月令五行旺衰（旺相休囚死）：monthIndex = 农历月 1..12
// 春(寅卯月)木旺火相水休金囚土死；夏(巳午月)火旺土相木休水囚金死；
// 秋(申酉月)金旺水相土休火囚木死；冬(亥子月)水旺木相金休土囚火死；
// 四季月(辰戌丑未月)土旺金相火休木囚水死
function getWangShuai(xing, lunarMonth) {
  const season = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'][lunarMonth - 1];
  const wangPhase = { 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土',
                      申: '金', 酉: '金', 戌: '土', 亥: '水', 子: '水', 丑: '土' };
  const wang = wangPhase[season];
  const xiang = SHENG[wang];       // 令生者相
  const xiu = Object.keys(SHENG).find((k) => SHENG[k] === wang); // 生令者休
  const qiu = Object.keys(KE).find((k) => KE[k] === wang);       // 克令者囚
  const si = KE[wang];            // 令克者死
  const map = { [wang]: '旺', [xiang]: '相', [xiu]: '休', [qiu]: '囚', [si]: '死' };
  return map[xing] || '平';
}

// 时间起卦（梅花易数传统）：年支序数+月数+日数 得 上卦；加时辰序数 得 下卦；总数 ÷6 余数定动爻（余0为6）
// params: { nianZhi: '子'..'亥', lunarMonth: 1..12, lunarDay: 1..30, shiChen: '子'..'亥' }
function castByTime({ nianZhi, lunarMonth, lunarDay, shiChen }) {
  const nian = DIZHI[nianZhi].num;
  const yue = lunarMonth;
  const ri = lunarDay;
  const shi = DIZHI[shiChen].num;
  const upperRem = (nian + yue + ri) % 8;
  const total = nian + yue + ri + shi;
  const lowerRem = total % 8;
  const dongRem = total % 6;
  const upper = upperRem === 0 ? 8 : upperRem;
  const lower = lowerRem === 0 ? 8 : lowerRem;
  const dongLine = dongRem === 0 ? 6 : dongRem;
  return { upper, lower, dongLine, method: '时间起卦', note: `${nianZhi}年${yue}月${ri}日${shiChen}时` };
}

// 铜钱摇卦：六次摇卦结果数组（每次为数值：6老阴 7少阳 8少阴 9老阳），自初爻至上爻
// 三个铜钱：三字=老阴6，两字一背=少阳7，一字两背=少阴8，三背=老阳9
function castByCoins(coinResults) {
  if (!Array.isArray(coinResults) || coinResults.length !== 6) {
    throw new Error('coinResults must be 6 values');
  }
  // 六个爻值（6/7/8/9）自初爻至上爻；7/9为阳爻，6/8为阴爻；6/9为动爻
  const yangLines = coinResults.map((v) => (v === 7 || v === 9 ? 1 : 0));
  const dongLines = coinResults.map((v) => (v === 6 || v === 9 ? 1 : 0));
  // 上卦 = 第4-6爻（自下而上 index 3,4,5 转 上中下），下卦 = 第1-3爻（index 0,1,2）
  const lowerLines = yangLines.slice(0, 3); // [初,二,三]
  const upperLines = yangLines.slice(3, 6); // [四,五,上]
  const lower = trigramFromLines(lowerLines);
  const upper = trigramFromLines(upperLines);
  // 动爻：自下而上，若多爻动取第一个动爻（传统取初动）；单爻动取其位
  let dongLine = 0;
  for (let i = 0; i < 6; i += 1) {
    if (dongLines[i]) { dongLine = i + 1; break; }
  }
  return { upper, lower, dongLine, yangLines, dongLines, method: '铜钱摇卦', note: coinResults.join('·') };
}

function trigramFromLines(lines) {
  // lines = [下,中,上] 1阳0阴；查 trigram
  for (const [num, t] of Object.entries(TRIGRAMS)) {
    if (t.lines[0] === lines[0] && t.lines[1] === lines[1] && t.lines[2] === lines[2]) {
      return Number(num);
    }
  }
  throw new Error(`unknown trigram lines: ${lines}`);
}

// 六爻（本卦）自下而上：由上下卦推导
function hexagramLines(upper, lower) {
  const l = TRIGRAMS[lower].lines; // [初,二,三]
  const u = TRIGRAMS[upper].lines; // [四,五,上]
  return [...l, ...u]; // index0=初爻 ... index5=上爻
}

// 由六爻（自下而上）还原上下卦
function hexagramFromLines(lines) {
  const lower = trigramFromLines(lines.slice(0, 3));
  const upper = trigramFromLines(lines.slice(3, 6));
  return { upper, lower };
}

function hexagramByKey(key) {
  if (!GUA_INDEX[key]) throw new Error(`no hexagram for combo ${key}`);
  return HEXAGRAMS[String(GUA_INDEX[key].seq)];
}

// 求卦并全息排盘
function fullCast(cast) {
  const { upper, lower, dongLine, method, note } = cast;
  const benKey = `${upper}${lower}`;
  const ben = hexagramByKey(benKey);
  const benLines = hexagramLines(upper, lower);

  // 变卦：动爻位阴阳翻转
  const bianLines = benLines.slice();
  if (dongLine > 0) bianLines[dongLine - 1] = 1 - bianLines[dongLine - 1];
  const bian = hexagramFromLines(bianLines);
  const bianKey = `${bian.upper}${bian.lower}`;
  const bianHex = hexagramByKey(bianKey);

  // 互卦：本卦 2、3、4 爻为下互卦，3、4、5 爻为上互卦（梅花易数取法，以本卦中四爻）
  const huLower = trigramFromLines([benLines[1], benLines[2], benLines[3]]); // 二三爻? 梅花: 中四爻
  // 修正：互卦取本卦 2、3、4 爻为下互，3、4、5 爻为上互（即第2-5爻，去掉初上）
  // 下互 = 第2,3,4爻（index1,2,3），上互 = 第3,4,5爻（index2,3,4）
  const huLowerLines = [benLines[1], benLines[2], benLines[3]];
  const huUpperLines = [benLines[2], benLines[3], benLines[4]];
  const huLowerTrigram = trigramFromLines(huLowerLines);
  const huUpperTrigram = trigramFromLines(huUpperLines);
  const huKey = `${huUpperTrigram}${huLowerTrigram}`;
  const huHex = hexagramByKey(huKey);

  // 错卦：六爻全变
  const cuoLines = benLines.map((l) => 1 - l);
  const cuoTr = hexagramFromLines(cuoLines);
  const cuoKey = `${cuoTr.upper}${cuoTr.lower}`;
  const cuoHex = hexagramByKey(cuoKey);

  // 综卦：初上颠倒（上下翻转）
  const zongLines = benLines.slice().reverse();
  const zongTr = hexagramFromLines(zongLines);
  const zongKey = `${zongTr.upper}${zongTr.lower}`;
  const zongHex = hexagramByKey(zongKey);

  // 体用：动爻在上卦则上卦为用、下卦为体；动爻在下卦则下卦为用、上卦为体；动爻=0（无动）则体用比和
  let ti, yong;
  if (dongLine === 0) { ti = lower; yong = upper; }
  else if (dongLine <= 3) { ti = upper; yong = lower; }
  else { ti = lower; yong = upper; }
  const tiXing = TRIGRAMS[ti].xing;
  const yongXing = TRIGRAMS[yong].xing;

  // 体用生克关系
  let tiYongRelation, tiYongDesc;
  if (yongXing === tiXing) { tiYongRelation = '比和'; tiYongDesc = '体用比和，五行相同，彼此和谐互助，谋事顺遂。'; }
  else if (SHENG[tiXing] === yongXing) { tiYongRelation = '体生用'; tiYongDesc = '体生用（我生之），泄气耗力，主为外事付出、劳心费力，宜量力而行。'; }
  else if (SHENG[yongXing] === tiXing) { tiYongRelation = '用生体'; tiYongDesc = '用生体（生我者），得外界之助，诸事有援、渐入佳境。'; }
  else if (KE[tiXing] === yongXing) { tiYongRelation = '体克用'; tiYongDesc = '体克用（我克之），主事可成，但需费力自主、劳而有功。'; }
  else { tiYongRelation = '用克体'; tiYongDesc = '用克体（克我者），受制于人、事多阻逆，宜谨慎守成，不宜冒进。'; }

  // 世应
  const sy = SHIYING[String(ben.seq)] || null;
  // 当月（农历月）由调用方传入用于旺衰
  return {
    method, note,
    upper, lower, dongLine,
    ben: { ...ben, key: benKey },
    bian: { ...bianHex, key: bianKey },
    hu: { ...huHex, key: huKey, huLowerTrigram, huUpperTrigram },
    cuo: { ...cuoHex, key: cuoKey },
    zong: { ...zongHex, key: zongKey },
    benLines, bianLines,
    ti, yong, tiXing, yongXing, tiYongRelation, tiYongDesc,
    shi: sy ? sy.shi : null, ying: sy ? sy.ying : null, palace: sy ? sy.palace : null,
    tiWangShuai: null, yongWangShuai: null,
    tiScore: 1, yongScore: 1,
  };
}

// 测试辅助（Node）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TRIGRAMS, SHENG, KE, DIZHI, getWangShuai, castByTime, castByCoins, fullCast, trigramFromLines, hexagramFromLines, hexagramLines };
}