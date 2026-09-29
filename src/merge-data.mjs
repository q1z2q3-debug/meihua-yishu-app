// 合并 64 卦数据 + 生成索引与世应表
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname);

async function load(name) {
  const code = await readFile(path.join(src, name), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(code, context);
  const key = Object.keys(context).find((k) => k.startsWith('HEXAGRAMS_PART'));
  if (!key) throw new Error(`no HEXAGRAMS_PART found in ${name}`);
  return context[key];
}

const parts = [
  await load('data-part1.js'),
  await load('data-part2.js'),
  await load('data-part3.js'),
  await load('data-part4.js'),
];

const HEXAGRAMS = {};
for (const part of parts) {
  for (const [seq, g] of Object.entries(part)) {
    if (HEXAGRAMS[seq]) throw new Error(`duplicate seq ${seq}`);
    HEXAGRAMS[seq] = g;
  }
}

// 校验：64 卦齐全；上下卦组合唯一（先天数 1-8）
if (Object.keys(HEXAGRAMS).length !== 64) {
  throw new Error(`expected 64 hexagrams, got ${Object.keys(HEXAGRAMS).length}`);
}
const byCombo = {};
for (const [seq, g] of Object.entries(HEXAGRAMS)) {
  if (![1,2,3,4,5,6,7,8].includes(g.upper) || ![1,2,3,4,5,6,7,8].includes(g.lower)) {
    throw new Error(`bad trigram for seq ${seq}`);
  }
  const key = `${g.upper}${g.lower}`;
  if (byCombo[key]) throw new Error(`duplicate combo ${key} (${byCombo[key].name}/${g.name})`);
  byCombo[key] = { seq: Number(seq), name: g.name };
  if (!Array.isArray(g.lines) || g.lines.length !== 6) throw new Error(`bad lines for seq ${seq}`);
}

// 八宫世应表：每宫 8 卦（六纯、一至五变、游魂、归魂）
const PALACE_ORDER = [
  [1,44,33,12,20,23,35,14], // 乾宫
  [29,60,3,63,49,55,36,7],  // 坎宫
  [52,22,26,41,38,10,61,53],// 艮宫
  [51,16,40,32,46,48,28,17],// 震宫
  [57,9,37,42,25,21,27,18], // 巽宫
  [30,56,50,64,4,59,6,13],  // 离宫
  [2,24,19,11,34,43,5,8],   // 坤宫
  [58,47,45,31,39,15,62,54],// 兑宫
];
const SHI = [6,1,2,3,4,5,4,3]; // 世爻位置（游魂=四爻、归魂=三爻）
const SHIYING = {}; // seq -> {palace, shi, ying}
const used = new Set();
PALACE_ORDER.forEach((palace, pi) => {
  palace.forEach((seq, idx) => {
    if (used.has(seq)) throw new Error(`seq ${seq} in two palaces`);
    used.add(seq);
    const shi = SHI[idx];
    const ying = shi > 3 ? shi - 3 : shi + 3;
    SHIYING[seq] = { palace: ['乾','坎','艮','震','巽','离','坤','兑'][pi], palaceIdx: pi, shi, ying };
  });
});
if (used.size !== 64) throw new Error(`shiyin coverage ${used.size}`);

const output = `// 梅花易数·六十四卦全量数据（自动合并生成，请勿手改）
const HEXAGRAMS = ${JSON.stringify(HEXAGRAMS)};\n\n// 上下卦组合(先天数) -> 卦\nconst GUA_INDEX = ${JSON.stringify(byCombo)};\n\n// 八宫世应\nconst SHIYING = ${JSON.stringify(SHIYING)};\n`;

await writeFile(path.join(src, 'hexagram-data.js'), output, 'utf8');
console.log(`OK: ${Object.keys(HEXAGRAMS).length} hexagrams, ${Object.keys(byCombo).length} combos, ${Object.keys(SHIYING).length} shiying, ${output.length} bytes`);