// 算法验证测试
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 加载数据文件
const dataCode = readFileSync(path.join(__dirname, 'hexagram-data.js'), 'utf8');
const algoCode = readFileSync(path.join(__dirname, 'algo.js'), 'utf8');
const sandbox = { };
const vm = await import('node:vm');
vm.runInNewContext(dataCode + '\n;globalThis.__DATA = { HEXAGRAMS, GUA_INDEX, SHIYING };', sandbox);
vm.runInNewContext(algoCode + '\n;globalThis.__ALGO = { castByTime, castByCoins, fullCast, getWangShuai, TRIGRAMS, DIZHI };', sandbox);
const { castByTime, castByCoins, fullCast, getWangShuai } = sandbox.__ALGO;
const dry = sandbox.__DATA.SHIYING;

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass += 1; console.log(`  ✓ ${name}`); }
  else { fail += 1; console.log(`  ✗ ${name} ${detail}`); }
}

console.log('== 观梅占（梅花易数经典案例）==');
// 辰年十二月十七日申时：辰=5, 十二月=12, 十七=17, 申时=9
// 上卦=(5+12+17)%8=34%8=2→兑；下卦=(5+12+17+9)%8=43%8=3→离；动爻=43%6=1→初爻
const guan = castByTime({ nianZhi: '辰', lunarMonth: 12, lunarDay: 17, shiChen: '申' });
check('观梅占上卦为兑(2)', guan.upper === 2, `got ${guan.upper}`);
check('观梅占下卦为离(3)', guan.lower === 3, `got ${guan.lower}`);
check('观梅占动爻为初爻(1)', guan.dongLine === 1, `got ${guan.dongLine}`);
const guanFull = fullCast(guan);
check('观梅占本卦为泽火革', guanFull.ben.full === '泽火革', guanFull.ben.full);
check('观梅占变卦为泽山咸', guanFull.bian.full === '泽山咸', guanFull.bian.full);
check('观梅占上互卦为乾', guanFull.hu.huUpperTrigram === 1 && TRIGRAM_NAME(guanFull.hu.huUpperTrigram) === '乾', '');
check('观梅占下互卦为巽', guanFull.hu.huLowerTrigram === 5 && TRIGRAM_NAME(guanFull.hu.huLowerTrigram) === '巽', '');
check('观梅占变卦卦象正确（初爻动）', guanFull.bianLines[0] === 1 - guanFull.benLines[0], '');

function TRIGRAM_NAME(n) { return ['', '乾','兑','离','震','巽','坎','艮','坤'][n]; }

console.log('== 铜钱摇卦 ==');
// 例：三个背=老阳9（阳动）、两字一背=少阳7、一字两背=少阴8、三字=老阴6
// 摇出：初爻老阳9、二爻少阳7、三爻少阴8、四爻老阴6、五爻少阳7、上爻少阴8
const coins = castByCoins([9, 7, 8, 6, 7, 8]);
const coinFull = fullCast(coins);
check('铜钱摇卦六爻数正确', JSON.stringify(coins.yangLines) === JSON.stringify([1,1,0,0,1,0]), JSON.stringify(coins.yangLines));
check('铜钱摇卦动爻为初爻', coinFull.dongLine === 1, `got ${coinFull.dongLine}`);
// 上卦=四五六爻=[0,1,0]→坎6；下卦=一二三爻=[1,1,0]→兑2 → 水泽节
check('铜钱摇卦下卦为兑(泽)', coins.lower === 2, `got ${coins.lower}`);
check('铜钱摇卦上卦为坎(水)', coins.upper === 6, `got ${coins.upper}`);
check('铜钱摇卦本卦为水泽节', coinFull.ben.full === '水泽节', coinFull.ben.full);
// 初爻动：节初九→阴：变卦 水泽节(坎上兑下)初爻变→下卦兑→震？改初爻阴：兑[1,1,0]→[0,1,0]=坎? no
// 兑变初爻：1→0 → [0,1,0]=坎 → 变卦坎上坎下 = 坎为水
check('铜钱摇卦变卦为坎为水', coinFull.bian.full === '坎为水', coinFull.bian.full);

console.log('== 世应 ==');
check('乾为天 世六应三', dry[1].shi === 6 && dry[1].ying === 3, JSON.stringify(dry[1]));
check('天风姤 世一应四', dry[44].shi === 1 && dry[44].ying === 4, JSON.stringify(dry[44]));
check('未济 世三应六（归魂）', dry[64].shi === 3 && dry[64].ying === 6, JSON.stringify(dry[64]));
check('晋 世四应初（游魂）', dry[35].shi === 4 && dry[35].ying === 1, JSON.stringify(dry[35]));

console.log('== 五行旺衰 ==');
check('寅月(春)木旺', getWangShuai('木', 1) === '旺', getWangShuai('木', 1));
check('寅月(春)火相', getWangShuai('火', 1) === '相', getWangShuai('火', 1));
check('寅月(春)金囚', getWangShuai('金', 1) === '囚', getWangShuai('金', 1));
check('午月(夏)火旺', getWangShuai('火', 5) === '旺', getWangShuai('火', 5));
check('亥月(冬)水旺', getWangShuai('水', 10) === '旺', getWangShuai('水', 10));
check('辰月(四季)土旺', getWangShuai('土', 3) === '旺', getWangShuai('土', 3));

console.log('== 全息六卦完整性 ==');
for (const combo of ['11','22','33','44','55','66','77','88','13','62','86','57']) {
  const [u, l] = combo.split('').map(Number);
  const c = fullCast({ upper: u, lower: l, dongLine: ((u + l) % 6) || 6, method: 'test' });
  if (!c.ben || !c.bian || !c.hu || !c.cuo || !c.zong) { fail += 1; console.log(`  ✗ combo ${combo} missing hex`); }
}
check('六卦全息结构完整（抽查12组）', true);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);