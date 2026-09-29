// 构建：组装单文件 HTML 原型（内联 base64 插图）
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const parts = {
  '/*__DATA__*/': join(root, 'src', 'hexagram-data.js'),
  '/*__ALGO__*/': join(root, 'src', 'algo.js'),
  '/*__CONTENT__*/': join(root, 'src', 'content.js'),
  '/*__APP__*/': join(root, 'src', 'app.js'),
};

let html = readFileSync(join(root, 'src', 'template.html'), 'utf8');

// 注入 JS 模块（去掉 module.exports 尾部，浏览器环境不需要）
for (const [marker, file] of Object.entries(parts)) {
  let code = readFileSync(file, 'utf8');
  if (file.endsWith('algo.js')) {
    // 移除 Node 导出段，避免浏览器报错
    code = code.replace(/\/\/ 测试辅助（Node）[\s\S]*$/, '');
  }
  html = html.replace(marker, code);
}

// 内联插图（占位符位于 app.js 运行时模板串中，须在注入之后替换）
const heroB64 = readFileSync(join(root, 'media', 'hero-ink-art-inline.jpg')).toString('base64');
html = html.replace('__HERO__', heroB64);

// 校验残留占位符
const leftovers = html.match(/__[A-Z_]+__/g);
if (leftovers) {
  console.error('残留占位符:', leftovers);
  process.exit(1);
}

// 白名单校验：不允许第三方脚本/链接/外部资源
if (/<script[^>]+src\s*=/i.test(html)) { console.error('检测到外部脚本'); process.exit(1); }
if (/https?:\/\/(?!)/i.test(html) && html.includes('href="http')) { console.error('检测到外部链接'); process.exit(1); }

const out = join(root, 'meihua-yishu-app.html');
writeFileSync(out, html, 'utf8');
console.log('OK 输出:', out, '大小:', (html.length / 1024).toFixed(0), 'KB');