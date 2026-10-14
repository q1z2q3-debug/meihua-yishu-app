/* =========================================================
   梅花易数·全息占 —— 应用逻辑（内存 store，无外部依赖）
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 状态 ---------- */
  var store = {
    tab: 'cast',
    method: 'time',
    result: null,          // fullCast 结果
    castNote: '',
    lunarMonth: 0,         // 排盘旺衰用农历月（0 = 未定，显示平）
    coins: [],             // 摇卦已掷结果 [6|7|8|9 ...]
    coinFace: [],          // 每次三钱的背数 [n,n,n,n,n,n]
    kbPage: 'home',
    kbHex: null,
    sceneOpen: 'shiye',
    san: null,          // 三元九维向量 [-1|0|1 ×9]，null = 尚未起卦
    sanEdited: false    // 用户是否手动微调过九维
  };

  /* ---------- 工具 ---------- */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function trigName(num) { return TRIGRAMS[num].name; }
  function trigXing(num) { return TRIGRAMS[num].xing; }

  // 卦画（六爻，自下而上）渲染，y 为 0/1，dong 为动爻标记数组
  function ylineHtml(y, dong, W, H) {
    var w = W || 26, h = H || 4, d = dong ? ' dong' : '';
    if (y === 1) {
      return '<span class="ys" style="width:' + w + 'px;height:' + h + 'px;background:var(--ink);border-radius:2px' + (dong ? ';background:var(--cinnabar)' : '') + '"></span>';
    }
    var gap = Math.max(5, Math.round(w * 0.42));
    var a = Math.round((w - gap) / 2), b = w - gap - a;
    return '<span class="ys" style="width:' + a + 'px;height:' + h + 'px;background:var(--ink);border-radius:2px' + (dong ? ';background:var(--cinnabar)' : '') + '"></span>' +
           '<span class="ys" style="width:' + b + 'px;height:' + h + 'px;background:var(--ink);border-radius:2px;margin-left:' + gap + 'px' + (dong ? ';background:var(--cinnabar)' : '') + '"></span>';
  }
  // lines: [初..上]，dongSet: 同序 bool 数组
  function pileHtml(lines, dongSet, w) {
    var out = '';
    for (var i = 0; i < 6; i += 1) {
      var d = dongSet ? dongSet[i] : false;
      out += '<div style="display:flex;align-items:center;gap:4px;width:100%">' +
             '<span style="width:12px;flex:0 0 12px;font-size:9px;color:var(--ink-soft)">' + (i + 1) + '</span>' +
             '<span style="display:flex;gap:2px;align-items:center">' + ylineHtml(lines[i], d, w) + '</span></div>';
    }
    return out;
  }
  // 简版卦画（竖排六线）用于小型卡片：lines 竖向排布，每条独立
  function miniPile(lines, w) {
    var out = '';
    for (var i = 5; i >= 0; i -= 1) {
      out += '<div style="display:flex;justify-content:center;align-items:center;gap:2px">' + ylineHtml(lines[i], false, w) + '</div>';
    }
    return out;
  }

  function iconSvg(name) {
    var svgs = {
      cast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4m0 4v4m0 4v2"/><path d="M5 5l14 10M5 15l14-10" opacity=".6"/><circle cx="12" cy="3" r="1.2" fill="currentColor" stroke="none"/></svg>',
      paipan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 5h16M4 10h10M4 15h16M4 20h8"/><path d="M16 15l4 0M14 18l6 0" opacity=".55"/></svg>',
      san: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="3.5" width="5" height="5" rx="1.2"/><rect x="15.5" y="3.5" width="5" height="5" rx="1.2"/><rect x="3.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" fill="currentColor" opacity=".18"/><rect x="15.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="3.5" y="15.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="15.5" width="5" height="5" rx="1.2"/><rect x="15.5" y="15.5" width="5" height="5" rx="1.2"/></svg>',
      kb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" opacity=".55"/><path d="M9 7h7M9 11h7" stroke-width="1.4" opacity=".6"/></svg>',
      about: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.2v.1"/></svg>'
    };
    return svgs[name] || '';
  }

  /* ---------- 应用壳 ---------- */
  function renderStatusbar() {
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    qs('#statusbar').innerHTML =
      '<span>' + hh + ':' + mm + '</span>' +
      '<span class="sb-right">' +
      '<svg viewBox="0 0 18 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="0.5" y="2" width="11" height="8" rx="2"/><path d="M13 4v4M15 5.5v1M17 3v6" stroke-linecap="round"/></svg>' +
      '<svg viewBox="0 0 22 12" fill="currentColor"><path d="M1 6.5a6 6 0 0 1 12 0h-.5a5.5 5.5 0 0 0-11 0H1zm4 0a2 2 0 0 1 4 0"/><rect x="1" y="8.5" width="4" height="2.5" rx="1" opacity=".9"/></svg>' +
      '</span>';
  }

  function renderNav() {
    var items = [
      { k: 'cast', label: '起卦' },
      { k: 'paipan', label: '排盘' },
      { k: 'san', label: '三元九维' },
      { k: 'kb', label: '知识库' },
      { k: 'about', label: '关于' }
    ];
    var d = '好';
    var html = items.map(function (it) {
      return '<div class="bn-item' + (store.tab === it.k ? ' on' : '') + '" data-action="tab" data-tab="' + it.k + '">' +
        iconSvg(it.k) + '<span>' + it.label + '</span></div>';
    }).join('');
    qs('#bottomnav').innerHTML = html;
  }

  /* ---------- 起卦屏 ---------- */
  function renderCast() {
    var html = '';
    var heroHtml = '<div class="hero">' +
      '<img src="data:image/jpeg;base64,__HERO__" alt="月下梅枝水墨插画" data-design-suite-media-slot="hero-ink-art">' +
      '<div class="hero-cap"><div class="t1">梅花易数·全息占</div><div class="t2">观象知机 · 明理趋吉</div></div>' +
      '</div>';
    html += heroHtml;

    // 水墨源流序言（v2.0.0：伏羲画卦 → 文王演易 → 孔子十翼 → 梅花易数观梅 → 本 App 承脉）
    html += '<div class="yb-slip">' +
      '<div class="yb-title">易之源流 · 观梅承脉</div>' +
      '<div class="yb-lines">' +
      SAN_YUANLIU.lines.map(function (ln, li) {
        return '<div class="yb-line"><div class="yb-t">' + ['一', '二', '三', '四'][li] + '</div><div class="yb-d">' + esc(ln) + '</div></div>';
      }).join('<div class="yb-flow">↓</div>') +
      '</div>' +
      '<div class="yb-sig">——' + esc(SAN_YUANLIU.title) + '</div>' +
      '</div>';

    html += '<div style="padding:0 20px 26px">';
    html += '<div class="method-tabs">' +
      '<div class="method-tab' + (store.method === 'time' ? ' on' : '') + '" data-action="method" data-m="time">时间起卦</div>' +
      '<div class="method-tab' + (store.method === 'coins' ? ' on' : '') + '" data-action="method" data-m="coins">铜钱摇卦</div>' +
      '</div>';

    // 时间起卦
    var zhiOpts = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    var monthOpts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    var dayOpts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
    var yearOpts = [];
    for (var y = 1900; y <= 2049; y += 1) {
      yearOpts.push('<option value="' + y + '">' + y + '年</option>');
    }
    var timeSel = function (id, arr, cur) {
      return '<select id="' + id + '">' + arr.map(function (v) {
        return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + v + '</option>';
      }).join('') + '</select>';
    };
    var sel = function (id, optsHtml, cur) {
      var out = '';
      if (cur === undefined || cur === null || cur === '') {
        out += '<option value="" selected>请选择</option>';
      }
      out += optsHtml;
      return '<select id="' + id + '">' + out + '</select>';
    };
    var nest = function (optsHtml) { return optsHtml; };

    html += '<div class="card form-card' + (store.method === 'time' ? ' on' : '') + '" id="form-time">';
    html += '<div class="field" style="margin-bottom:10px"><label>农历年份（按年支计）</label>' +
      '<select id="t-year"><option value="" selected>请选择年份</option>' + yearOpts.join('') + '</select></div>';
    html += '<div class="form-grid">' +
      '<div class="field"><label>年支</label>' + nest('<select id="t-zhi">' + zhiOpts.map(function (z) { return '<option value="' + z + '">' + z + '</option>'; }).join('') + '</select>') + '</div>' +
      '<div class="field"><label>农历月</label>' + timeSel('t-month', monthOpts, '') + '</div>' +
      '</div>';
    html += '<div class="form-grid" style="margin-top:10px">' +
      '<div class="field"><label>农历日</label>' + timeSel('t-day', dayOpts, '') + '</div>' +
      '<div class="field"><label>时辰</label>' + nest('<select id="t-shi">' + zhiOpts.map(function (z, i) { return '<option value="' + z + '">' + z + '时（' + [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21][i] + '点起）</option>'; }).join('') + '</select>') + '</div>' +
      '</div>';
    html += '<div class="tip" style="margin-top:10px">时间起卦为梅花易数传统之法：年支序·月·日之数得上卦，加时辰之数得下卦，总数取动爻。请按农历填写。</div>';
    html += '<div class="form-row"><button class="btn btn-primary" data-action="cast-time">起 卦</button></div>';
    html += '</div>';

    // 铜钱摇卦
    html += '<div class="card form-card' + (store.method === 'coins' ? ' on' : '') + '" id="form-coins">';
    html += '<div class="coin-zone">';
    html += '<div class="coin-stage" id="coin-stage">';
    if (store.coins.length === 0) {
      html += '<div style="color:var(--ink-soft);font-size:12px;letter-spacing:2px;font-family:var(--kai)">点击下方掷钱，共掷六次成一卦</div>';
    } else {
      for (var ci = 0; ci < 3; ci += 1) {
        var backs = store.coinFace[store.coinFace.length - 1] || 0;
        var isBack = ci < backs;
        html += '<div class="coin face' + (ci === 0 ? ' flip' : '') + '">' + (isBack ? '背' : '字') + '</div>';
      }
    }
    html += '</div>';
    html += '<div class="coin-slot" id="coin-slot">' + (store.coins.length > 0 ? '第 ' + store.coins.length + ' 爻：' + yaoName(store.coins[store.coins.length - 1]) : '三枚铜钱，背为阳，字为阴') + '</div>';
    html += '<div class="lines-track" id="lines-track">';
    for (var li = 0; li < 6; li += 1) {
      var done = li < store.coins.length;
      var mark = done ? yaoMark(store.coins[li]) : (li + 1);
      html += '<div class="line-cell' + (done ? ' done' : '') + '">' + mark + '</div>';
    }
    html += '</div>';
    html += '<div class="field" style="margin:10px 0"><label>当令之月（农历，用于旺衰判断）</label>' +
      '<select id="c-month"><option value="0" selected>未定（旺衰取平）</option>' +
      monthOpts.map(function (m) { return '<option value="' + m + '">' + m + '月</option>'; }).join('') + '</select></div>';
    html += '<div class="form-row">' +
      '<button class="btn btn-primary" data-action="throw-coin"' + (store.coins.length >= 6 ? ' disabled' : '') + '>' + (store.coins.length === 0 ? '掷 钱' : '掷 第 ' + (store.coins.length + 1) + ' 钱') + '</button>' +
      (store.coins.length ? '<button class="btn btn-ghost" data-action="reset-coins" style="flex:0 0 92px">重 置</button>' : '') +
      '</div>';
    html += '<div class="tip" style="margin-top:10px">三枚铜钱同掷：三背＝老阳(9动)，三字＝老阴(6动)，二背一字＝少阴(8)，一字二背＝少阳(7)。自下而上六爻。</div>';
    html += '</div>';
    html += '</div>';

    // 结果摘要
    if (store.result) {
      var r = store.result;
      var rel = relInfo(r);
      html += '<div class="card result-card">';
      html += '<div class="rc-head"><div><div class="rc-name">' + esc(r.ben.name) + ' · ' + esc(r.ben.full) + '</div>' +
        '<div class="rc-seq">' + esc(store.castNote) + ' ｜ 变 ' + esc(r.bian.full) + '</div></div>' +
        '<span class="badge ' + rel.badge + '">' + r.tiYongRelation + '</span></div>';
      html += '<div class="rc-six">';
      var dongB = [];
      for (var di = 0; di < 6; di += 1) dongB.push(r.dongLine === di + 1);
      html += pileHtml(r.benLines, dongB);
      html += '</div>';
      html += '<div class="rc-rel">' +
        '<span class="badge b-gold">体 ' + trigName(r.ti) + trigXing(r.ti) + ' / 用 ' + trigName(r.yong) + trigXing(r.yong) + '</span>' +
        '<span class="badge b-red">动爻 ' + r.dongLine + '</span>' +
        '</div>';
      html += '<div class="rc-rel" style="font-size:12.5px;color:var(--ink-soft);line-height:1.9">' + esc(rel.theme) + '</div>';
      html += '<div class="rc-go">' +
        '<button class="btn btn-ghost" data-action="reset-all" style="flex:0 0 92px">重新起卦</button>' +
        '<button class="btn btn-primary" data-action="goto-paipan">查看完整排盘</button>' +
        '</div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function yaoName(v) {
    return { 6: '老阴(动)', 7: '少阳', 8: '少阴', 9: '老阳(动)' }[v] || '';
  }
  function yaoMark(v) {
    return { 6: '⚋', 7: '⚊', 8: '⚋', 9: '⚊' }[v] || '';
  }

  function relInfo(r) {
    var rel = SCENE_DATA[r.tiYongRelation] || SCENE_DATA['比和'];
    return rel;
  }

  /* ---------- 起卦动作 ---------- */
  function doTimeCast() {
    var zhi = qs('#t-zhi').value;
    var month = parseInt(qs('#t-month').value, 10);
    var day = parseInt(qs('#t-day').value, 10);
    var shi = qs('#t-shi').value;
    var year = qs('#t-year').value;
    if (!year || !zhi || !month || !day || !shi) {
      showToast('请完整选择年月日时');
      return;
    }
    var cast = castByTime({ nianZhi: zhi, lunarMonth: month, lunarDay: day, shiChen: shi });
    store.lunarMonth = month;
    store.method = 'time';
    store.coins = [];
    store.coinFace = [];
    applyCast(cast, year + '年' + zhi + '·' + month + '月' + day + '日·' + shi + '时起卦');
  }

  function doThrowCoin() {
    if (store.coins.length >= 6) return;
    var backs = 0;
    var faces = [];
    for (var i = 0; i < 3; i += 1) {
      var b = Math.random() < 0.5;
      faces.push(b ? 2 : 0);
      if (b) backs += 1;
    }
    var val = { 0: 6, 1: 7, 2: 8, 3: 9 }[backs];
    store.coins.push(val);
    store.coinFace.push(backs);
    var cm = parseInt(qs('#c-month').value, 10);
    store.lunarMonth = cm || 0;
    // 渲染当前币面
    var stage = qs('#coin-stage');
    var slot = qs('#coin-slot');
    if (stage) {
      stage.innerHTML = '';
      for (var ci = 0; ci < 3; ci += 1) {
        var isBack = ci < backs;
        stage.innerHTML += '<div class="coin face flip">' + (isBack ? '背' : '字') + '</div>';
      }
    }
    if (slot) slot.textContent = '第 ' + store.coins.length + ' 爻：' + yaoName(val);
    if (store.coins.length >= 6) {
      var cast = castByCoins(store.coins.slice());
      applyCast(cast, '三枚铜钱六掷成卦：' + store.coins.join('·'));
    } else {
      renderScreen();
    }
  }

  function resetCoins() {
    store.coins = [];
    store.coinFace = [];
    if (store.result && store.method === 'coins') {
      store.result = null;
      store.castNote = '';
    }
    renderScreen();
  }

  function applyCast(cast, note) {
    var r = fullCast(cast);
    store.result = r;
    store.castNote = note;
    if (r.dongLine === 0) r.dongLine = 1; // 保底
    store.san = sanYuanFromCast(r);       // 起卦联动：自动映射九维
    store.sanEdited = false;
    renderScreen();
    showToast('卦成：' + r.ben.full + '（' + r.ben.name + '）');
  }

  /* ---------- 三元九维 · 19683 计算层 ---------- */
  // 先天八卦数 → 后天洛书宫位（SAN_DIMS 索引）：乾六5 兑七6 离九8 震三2 巽四3 坎一0 艮八7 坤二1
  var GUA_TO_PALACE = { 1: 5, 2: 6, 3: 8, 4: 2, 5: 3, 6: 0, 7: 7, 8: 1 };
  // 阳卦：乾震坎艮（一阳为主/纯阳）；阴卦：坤巽离兑
  var YANG_TRIGRAMS = [1, 4, 6, 7];

  // 九宫宫气映射（v2.0.0 洛书九宫观照）：
  // 1) 基础宫气：九宫各按自身五行 × 农历月令旺衰 → 旺相 +1 / 休 0 / 囚死 -1
  // 2) 体卦落宫主「我」：体卦旺相则其宫气旺、囚死则弱（与宫五行旺衰一致，显体之实）
  // 3) 用卦（动爻所在卦）落宫转枢为 0：事在变动未定
  // 4) 变卦化机：变上卦落宫显「事将往」气进 +1；变下卦落宫显「事将收」气敛 -1（不与体用宫冲突时）
  // 保留三进制编码：-1→0, 0→1, +1→2；坎一为最高位；中心态 9841；偏移 = Σ|v|
  function sanYuanFromCast(r) {
    var lm = store.lunarMonth || 0;
    var v = new Array(9);
    for (var i = 0; i < 9; i += 1) {
      var stage = lm ? getWangShuai(SAN_DIMS[i].xing, lm) : '平';
      v[i] = (stage === '旺' || stage === '相') ? 1 : (stage === '囚' || stage === '死') ? -1 : 0;
    }
    var tiP = GUA_TO_PALACE[r.ti] != null ? GUA_TO_PALACE[r.ti] : 4;
    var yongP = GUA_TO_PALACE[r.yong] != null ? GUA_TO_PALACE[r.yong] : 4;
    var wsT = lm ? getWangShuai(r.tiXing, lm) : '平';
    v[tiP] = (wsT === '旺' || wsT === '相') ? 1 : (wsT === '囚' || wsT === '死') ? -1 : 0;
    v[yongP] = 0; // 用卦即动爻所在之卦：事转枢
    var bUp = GUA_TO_PALACE[r.bian.upper];
    var bLo = GUA_TO_PALACE[r.bian.lower];
    if (bUp != null && bUp !== tiP && bUp !== yongP) v[bUp] = 1;
    if (bLo != null && bLo !== tiP && bLo !== yongP) v[bLo] = -1;
    return v;
  }

  // 三进制编码：-1→0, 0→1, +1→2；坎一为最高位 MSB
  function sanIndex(v) {
    var idx = 0;
    for (var i = 0; i < 9; i += 1) idx = idx * 3 + (v[i] + 1);
    return idx; // 0..19682
  }

  // 宫气凝聚度（偏宫程度）：Σ|v|，0..9（0=九宫俱枢，9=九宫俱动）
  function sanOffset(v) {
    var s = 0;
    for (var i = 0; i < 9; i += 1) s += Math.abs(v[i]);
    return s;
  }

  // 27 格局粗粒度模式：体/用/变 各取三宫多数票（体=坎坤震，用=巽中乾，变=兑艮离）
  function sanMode27(v) {
    function maj(a, b, c) {
      var s = (a > 0 ? 1 : a < 0 ? -1 : 0) + (b > 0 ? 1 : b < 0 ? -1 : 0) + (c > 0 ? 1 : c < 0 ? -1 : 0);
      return s > 0 ? 1 : (s < 0 ? -1 : 0);
    }
    return [maj(v[0], v[1], v[2]), maj(v[3], v[4], v[5]), maj(v[6], v[7], v[8])];
  }

  // 伏羲四象相位：体用两卦阴阳相合（阳卦乾震坎艮，阴卦坤巽离兑）
  // 太阳=体阳用阳 / 少阴=体阳用阴 / 少阳=体阴用阳 / 太阴=体阴用阴
  function sanPhaseFromCast(r) {
    if (!r) return -1;
    var tiYang = YANG_TRIGRAMS.indexOf(r.ti) >= 0;
    var yongYang = YANG_TRIGRAMS.indexOf(r.yong) >= 0;
    if (tiYang && yongYang) return 0;      // 太阳
    if (tiYang && !yongYang) return 1;     // 少阴
    if (!tiYang && yongYang) return 2;     // 少阳
    return 3;                              // 太阴
  }
  function sanPhDesc(phIdx) {
    return phIdx >= 0 && phIdx < SAN_PHASES.length ? SAN_PHASES[phIdx].desc : '未起卦，相位未定；起卦后以体用两卦阴阳合四象。';
  }

  // 三元九维整体白话语（动态综述）
  function sanSummary(v, mode, phIdx) {
    var m = SAN_MODE_27[sanModeKey(mode)];
    var ph = phIdx >= 0 ? SAN_PHASES[phIdx] : null;
    var off = sanOffset(v);
    var s = '';
    if (off === 0) {
      s = '九宫俱枢——此是「转化中」的中心态（第 9841 号）：宫气未聚、事未成形。宜静观宫气流转，暂缓发力，待气机凝聚后再行。';
    } else {
      s = '观此九宫宫气之象，' + (m ? m.idea : '') + ' 就四象相位而言，' + (ph ? ph.desc : '未起卦，相位未定。');
      s += ' 全「宫气凝聚度」为 ' + off + ' 分（满分 9）：' + (off >= 6 ? '宫气凝聚、格局笃定，宜顺势而行。' : off >= 3 ? '宫气聚散中平，宜审时而动、留转圜余地。' : '宫气多枢散、事未成局，宜静观自省、蓄力待时。');
    }
    return s;
  }
  function sanModeKey(mode) {
    return '' + mode[0] + mode[1] + mode[2];
  }
  function sanTern(v) {
    return v.map(function (x) { return x === -1 ? 0 : x === 1 ? 2 : 1; }).join('');
  }

  // 镜像卦短断（第五段）：当前卦的对偶提示
  function mirrorShort(r) {
    if (!r) return '';
    var m = mirrorOf(r.ben.seq);
    if (!m) return '';
    var other = HEXAGRAMS[String(m.seq)];
    var otherName = other ? other.name : '';
    return '镜像「' + otherName + '」（' + m.type + '对）：' + m.tip;
  }

  // 断语合成·短句版（联动段）：体用基准 × 27格局短句 × 四象时机 × 镜像短断
  function sanReadingShort(r, mode, mKey, phIdx) {
    var parts = [];
    if (r && r.tiYongRelation && SAN_TIYONG_DUAN[r.tiYongRelation]) {
      parts.push(SAN_TIYONG_DUAN[r.tiYongRelation]);
    }
    if (SAN_MODE_SHORT[mKey]) parts.push(SAN_MODE_SHORT[mKey]);
    if (phIdx >= 0 && SAN_PHASE_ACT[phIdx]) parts.push(SAN_PHASE_ACT[phIdx]);
    var mir = mirrorShort(r);
    if (mir) parts.push(mir);
    if (!parts.length) return '';
    return parts.join('；') + '。';
  }
  // 断语合成·完整版（合参卡）：短句版 + 偏移把握
  function sanReadingFull(r, mode, mKey, phIdx, off) {
    var s = sanReadingShort(r, mode, mKey, phIdx);
    if (s && off >= 0) s = s.slice(0, -1) + '；' + sanOffsetAct(off) + '。';
    return s;
  }

  /* ---------- 排盘屏 ---------- */
  function renderPaipan() {
    if (!store.result) {
      return '<div style="padding:20px"><div class="card empty-pai">' +
        '<div class="glyph">☯</div>' +
        '<p>尚未起卦</p>' +
        '<p style="font-size:12px;font-weight:400;margin-top:6px;letter-spacing:1px">请先于「起卦」页以时间或铜钱起卦</p>' +
        '<button class="btn btn-primary" data-action="tab" data-tab="cast">去起卦</button>' +
        '</div></div>';
    }
    var r = store.result;
    var rel = relInfo(r);
    var ws = getWangShuai(r.tiXing, store.lunarMonth);
    var wsY = getWangShuai(r.yongXing, store.lunarMonth);
    var dongB = [];
    for (var di = 0; di < 6; di += 1) dongB.push(r.dongLine === di + 1);
    var html = '';
    html += '<div style="padding:0 20px 26px">';
    html += '<div class="page-title"><div class="seal">卦</div><div><h2>全息排盘</h2><div class="sub">' + esc(store.castNote) + '</div></div></div>';

    // 主卦卡
    html += '<div class="card gua-main">' +
      '<div class="gua-head"><div><div class="gn">' + esc(r.ben.name) + ' · ' + esc(r.ben.full) + '</div>' +
      '<div class="guan">' + esc(r.ben.gua) + '</div></div>' +
      '<span class="badge ' + rel.badge + '">' + r.tiYongRelation + '</span></div>' +
      '<div class="water-fire">' +
      '<div class="wf-row"><span class="tag">上卦</span><div style="display:flex;gap:6px;align-items:center">' + trigName(r.upper) + trigXing(r.upper) + '（' + TRIGRAMS[r.upper].nature + '，先天数 ' + r.upper + '）</div></div>' +
      '<div class="wf-row"><span class="tag">下卦</span><div style="display:flex;gap:6px;align-items:center">' + trigName(r.lower) + trigXing(r.lower) + '（' + TRIGRAMS[r.lower].nature + '，先天数 ' + r.lower + '）</div></div>' +
      '<div class="wf-row"><span class="tag">动爻</span><div style="display:flex;gap:6px;align-items:center"><span class="badge b-red">' + r.dongLine + '</span> 第' + r.dongLine + '爻发动</div></div>' +
      '</div>' +
      '<div class="gua-desc">' + esc(r.ben.idea) + '</div>' +
      '</div>';

    // 五卦一览（含完整爻画）
    var cuoLines = r.benLines.map(function (l) { return 1 - l; });
    var zongLines = r.benLines.slice().reverse();
    html += '<div class="pai-section"><h3>五卦一览 <span class="en">BEN · BIAN · HU · CUO · ZONG</span></h3>';
    html += '<div class="guascape">' +
      miniGua('本卦', r.ben.name, r.ben.full, r.benLines, dongB) +
      miniGua('变卦', r.bian.name, r.bian.full + '（动爻之变）', r.bianLines, null) +
      miniGua('互卦', r.hu.name, r.hu.full + '（中四爻）', huLines(r), null) +
      miniGua('错卦', r.cuo.name, r.cuo.full + '（六爻全变）', cuoLines, null) +
      miniGua('综卦', r.zong.name, r.zong.full + '（初上颠倒）', zongLines, null) +
      '</div></div>';

    // 体用生克
    html += '<div class="pai-section"><h3>体用生克 <span class="en">TI & YONG</span></h3>';
    html += '<div class="card tiusheng">' +
      '<div class="ts-map">' +
      '<div class="ts-box"><div class="tt">体卦（己身）</div><div class="tg">' + trigName(r.ti) + '</div><div class="tx">' + trigXing(r.ti) + ' · ' + ws + '</div></div>' +
      '<div class="ts-arrow">→</div>' +
      '<div class="ts-box"><div class="tt">用卦（所问）</div><div class="tg">' + trigName(r.yong) + '</div><div class="tx">' + trigXing(r.yong) + ' · ' + wsY + '</div></div>' +
      '</div>' +
      '<div class="ts-rel" style="background:rgba(166,58,43,.06)"><div class="r1" style="color:var(--cinnabar)">' + r.tiYongRelation + '</div><div class="r2">' + esc(r.tiYongDesc) + '</div></div>' +
      '<div class="ts-rel" style="background:rgba(71,98,111,.05)"><div class="r2" style="font-size:12.5px">' + esc(WUXING_HINT[r.tiXing]) + '</div></div>' +
      '</div></div>';

    // 五行旺衰
    html += '<div class="pai-section"><h3>五行旺衰 <span class="en">MONTHLY QI</span></h3>';
    html += '<div class="card" style="padding:16px"><div class="ws-list">' +
      wsItem('体卦 ' + trigXing(r.ti), ws) +
      wsItem('用卦 ' + trigXing(r.yong), wsY) +
      '</div>' +
      '<div class="tip" style="margin-top:12px">以农历当月令察五行旺衰：旺、相者气盛事易成；休、囚、死者气弱事多迟。当前令 ' + (store.lunarMonth ? store.lunarMonth + '月' : '未定') + '</div>' +
      '</div></div>';

    // 世应
    html += '<div class="pai-section"><h3>世应之位 <span class="en">SHI & YING</span></h3>';
    html += '<div class="card" style="padding:16px">';
    if (r.palace) {
      html += '<div style="display:flex;justify-content:space-around;text-align:center">' +
        '<div><div class="tt" style="font-size:11px;color:var(--ink-soft);letter-spacing:2px;margin-bottom:6px">世爻</div><span class="badge b-red">第 ' + r.shi + ' 爻</span></div>' +
        '<div><div class="tt" style="font-size:11px;color:var(--ink-soft);letter-spacing:2px;margin-bottom:6px">应爻</div><span class="badge b-green">第 ' + r.ying + ' 爻</span></div>' +
        '<div><div class="tt" style="font-size:11px;color:var(--ink-soft);letter-spacing:2px;margin-bottom:6px">卦属</div><span class="badge b-gold">' + r.palace + ' 宫</span></div>' +
        '</div>';
      html += '<div class="tip" style="margin-top:12px">世爻为问卦之我，应爻为对方与外事。世应相生相合则内外相济，相冲相克则内外相阻。</div>';
    } else {
      html += '<div class="tip">八宫世应表缺失</div>';
    }
    html += '</div></div>';

    // 卦辞爻辞
    html += '<div class="pai-section"><h3>卦辞爻辞详解 <span class="en">GUACI & YAOCI</span></h3>';
    html += '<div class="card" style="padding:6px 0">' +
      '<div class="yao-item"><div class="ynum">卦辞</div><div class="ytext">' + esc(r.ben.gua) + '</div></div>' +
      r.ben.lines.map(function (line, i) {
        var d = r.dongLine === i + 1;
        return '<div class="yao-item' + (d ? ' dong' : '') + '"><div class="ynum">' + ['初', '二', '三', '四', '五', '上'][i] + (d ? ' ●动' : '') + '</div><div class="ytext">' + esc(line) + '</div></div>';
      }).join('') +
      '<div class="yao-item" style="background:rgba(168,134,58,.08)"><div class="ynum" style="color:var(--cinnabar)">变卦</div><div class="ytext">' + esc(r.bian.name) + ' · ' + esc(r.bian.full) + '（' + esc(r.bian.gua) + '）</div></div>' +
      '</div>' +
      '<div class="tip" style="margin-top:6px">动爻之辞为占断枢机：<strong>' + esc(r.ben.lines[r.dongLine - 1]) + '</strong></div>' +
      '</div>';

    // 应期
    html += '<div class="pai-section"><h3>应期之断 <span class="en">TIMING</span></h3>';
    html += '<div class="card" style="padding:16px">' + yingqiHtml(r) + '</div></div>';

    // 三元九维 · 认知观照（精简联动段）
    html += sanYuanMiniHtml(r);

    // 现代场景解读
    html += '<div class="pai-section"><h3>现代场景解读 <span class="en">FIVE DOMAINS</span></h3>';
    html += '<div class="scene-list">' + sceneItems(rel) + '</div>';
    html += '</div>';

    // 卦象·家宅调理建议
    html += jiazhaiHtml(r);

    html += '</div>';
    return html;
  }

  /* ---------- 卦象·家宅调理建议 ---------- */
  function jiazhaiHtml(r) {
    var ti = JIAZHAI_DATA[r.ti] || JIAZHAI_DATA[0];   // 体卦：己身所系，主调方位
    var yong = JIAZHAI_DATA[r.yong] || JIAZHAI_DATA[0]; // 用卦：动爻之机，动爻方位
    var h = '';
    h += '<div class="pai-section"><h3>卦象·家宅调理 <span class="en">JIAZHAI GUIDE</span></h3>';
    h += '<div class="card jz-card">';
    h += '<div class="jz-head"><div class="jz-fang">' + ti.fang + ' · ' + ti.gua + '（' + ti.xing + '）</div>' +
      '<div class="jz-theme">' + esc(ti.theme) + '</div></div>';
    h += jzRow('宜酒', ti.wine) + jzRow('宜画', ti.painting) + jzRow('主色', ti.color) +
      jzRow('中国结', ti.knot) + jzRow('佐饰', ti.deco) + jzRow('禁忌', ti.taboo, true);
    h += '<div class="jz-mini"><div><b>动爻之机 · ' + yong.fang + ' ' + yong.gua + '方</b></div>' +
      '<div>动爻居第 ' + r.dongLine + ' 爻，气动于「' + yong.fang + '·' + yong.gua + '」，此方宜次第调理：' + yong.painting.split('、')[0] + '、' + yong.color.split('、')[0] + '相佐最宜。</div></div>';
    h += '<div class="jz-note">' + JIAZHAI_TIP + '</div>';
    h += '</div></div>';
    return h;
  }

  function jzRow(tag, txt, taboo) {
    return '<div class="jz-row' + (taboo ? ' jz-taboo' : '') + '"><div class="jz-tag">' + tag + '</div>' +
      '<div class="jz-txt">' + esc(txt) + '</div></div>';
  }

  function wsItem(label, stage) {
    var v = { '旺': 100, '相': 78, '休': 55, '囚': 33, '死': 18, '平': 50 }[stage] || 50;
    var color = { '旺': '#a63a2b', '相': '#c0663f', '休': '#8a8a7a', '囚': '#7a98a2', '死': '#6d8a94', '平': '#a3a08f' }[stage] || '#a3a08f';
    return '<div class="ws-item"><span class="wn">' + label + '</span>' +
      '<span class="wbar"><span class="wfill" style="width:' + v + '%;background:' + color + '"></span></span>' +
      '<span style="flex:0 0 34px;text-align:right;color:var(--cinnabar);font-weight:700;font-family:var(--kai)">' + stage + '</span></div>';
  }

function miniGua(tag, name, full, lines, dongSet) {
    var pile = '';
    if (lines && lines.length === 6) {
      pile = '<div style="display:flex;flex-direction:column;gap:3px;margin-top:8px;align-items:center">' + miniPile(lines, 22) + '</div>';
    }
    return '<div class="card gua-mini">' +
      '<div style="flex:0 0 34px;text-align:center"><div style="font-family:var(--kai);font-size:26px;font-weight:700">' + name + '</div></div>' +
      '<div style="flex:1"><div class="gm-name">' + tag + '卦</div><div class="gm-sub">' + esc(full) + '</div>' + pile + '</div>' +
      '</div>';
  }

  function huLines(r) {
    var b = r.benLines;
    return [b[1], b[2], b[3], b[2], b[3], b[4]]; // 下互 = 2,3,4；上互 = 3,4,5
  }

  function yingqiHtml(r) {
    var ws = getWangShuai(r.tiXing, store.lunarMonth);
    var base = r.dongLine + (r.yong || 1); // 动爻数 + 用卦先天数
    var unit = (ws === '旺' || ws === '相') ? '日' : (ws === '休') ? '旬' : '月';
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
      '<span style="font-family:var(--kai);font-size:22px;font-weight:700;color:var(--cinnabar)">' + base + ' ' + unit + '</span>' +
      '<span class="badge ' + (ws === '平' ? 'b-gold' : (ws === '旺' || ws === '相' ? 'b-red' : 'b-green')) + '">体卦' + ws + '</span>' +
      '</div>' +
      '<div class="tip" style="line-height:2">' + YINGQI_RULE + '</div>' +
      '<div class="tip" style="margin-top:8px;color:var(--cinnabar)">此卦体卦' + ws + '，应期以' + (ws === '平' ? '动静之机' : unit + '计') + '，逢' + zhiFor(r) + '之时更验。</div>';
  }
  function zhiFor(r) {
    var z = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    return z[(r.dongLine + (r.yong || 1)) % 12];
  }

  function sceneItems(rel) {
    var items = [
      { k: 'shiye', icon: '业', name: '事业谋为', t: rel.scenes.shiye },
      { k: 'ganqing', icon: '情', name: '感情姻缘', t: rel.scenes.ganqing },
      { k: 'caiyun', icon: '财', name: '财运进退', t: rel.scenes.caiyun },
      { k: 'jiankang', icon: '康', name: '身心安康', t: rel.scenes.jiankang },
      { k: 'chuxing', icon: '行', name: '出行移徙', t: rel.scenes.chuxing }
    ];
    return items.map(function (it) {
      var open = store.sceneOpen === it.k;
      return '<div class="card scene-item' + (open ? ' open' : '') + '">' +
        '<div class="scene-head" data-action="scene-toggle" data-k="' + it.k + '">' +
        '<div class="sicon">' + it.icon + '</div><div class="sname">' + it.name + '</div><div class="sarrow">▼</div>' +
        '</div><div class="scene-body">' + esc(it.t) + '</div></div>';
    }).join('');
  }

  /* ---------- 知识库 ---------- */
  function renderKb() {
    if (store.kbPage === 'hexlist') return kbHexList();
    if (store.kbPage === 'hexdetail' && store.kbHex) return kbHexDetail(store.kbHex);
    if (store.kbPage === 'intro') return kbIntro();
    if (store.kbPage === 'classic') return kbClassic();
    // home
    var html = '';
    html += '<div style="padding:0 20px 26px">';
    html += '<div class="page-title"><div class="seal">典</div><div><h2>知识库</h2><div class="sub">习卦之法 · 观象之门</div></div></div>';
    html += '<div class="kb-entry" data-action="kb-nav" data-page="hexlist">' +
      '<div class="ke-icon">卦</div><div class="ke-main"><div class="ke-t">六十四卦详解</div><div class="ke-s">卦辞 · 爻辞 · 白话启发 · 世应归属</div></div><div class="ke-go">›</div></div>';
    html += '<div class="kb-entry" data-action="kb-nav" data-page="intro">' +
      '<div class="ke-icon">启</div><div class="ke-main"><div class="ke-t">起卦入门</div><div class="ke-s">梅花易数源流 · 时间与摇卦之法 · 体用旺衰</div></div><div class="ke-go">›</div></div>';
    html += '<div class="kb-entry" data-action="kb-nav" data-page="classic">' +
      '<div class="ke-icon">典</div><div class="ke-main"><div class="ke-t">经典原文</div><div class="ke-s">《梅花易数》观梅占等名篇节选</div></div><div class="ke-go">›</div></div>';
    html += '</div>';
    return html;
  }

  function kbHexList() {
    var html = '<div style="padding:0 20px 26px">';
    html += backRow('kb-nav', 'home', '知识库');
    html += '<div class="page-title"><div class="seal">卦</div><div><h2>六十四卦</h2><div class="sub">点击查看卦辞爻辞详解</div></div></div>';
    html += '<div class="kb-hex-grid">';
    for (var i = 1; i <= 64; i += 1) {
      var hx = HEXAGRAMS[String(i)];
      if (!hx) continue;
      var lines = hexagramLines(hx.upper, hx.lower);
      html += '<div class="kb-hex" data-action="kb-hex" data-seq="' + i + '">' +
        '<div class="hy">' + miniPile(lines, 16) + '</div>' +
        '<div class="hn">' + hx.name + '</div></div>';
    }
    html += '</div></div>';
    return html;
  }

  function kbHexDetail(seq) {
    var hx = HEXAGRAMS[String(seq)];
    if (!hx) return kbHexList();
    var lines = hexagramLines(hx.upper, hx.lower);
    var sy = SHIYING[String(seq)] || null;
    var html = '<div style="padding:0 20px 26px">';
    html += backRow('kb-nav', 'hexlist', '六十四卦');
    html += '<div class="card hex-detail">';
    html += '<div class="hd-top"><div class="hd-glyph">' + miniPile2(lines) + '</div>' +
      '<div><div class="hd-name">' + esc(hx.full) + '</div>' +
      '<div class="hd-seq">第 ' + hx.seq + ' 卦 · ' + TRIGRAMS[hx.upper].name + '上' + TRIGRAMS[hx.lower].name + '下 · ' +
      trigName(hx.upper) + trigXing(hx.upper) + '·' + trigName(hx.lower) + trigXing(hx.lower) +
      (sy ? ' · ' + sy.palace + '宫' : '') + '</div></div></div>';
    html += '<div class="hd-block"><div class="hd-t">卦辞</div><div class="hd-c">' + esc(hx.gua) + '</div></div>';
    html += '<div class="hd-block"><div class="hd-t">爻辞</div><div class="hd-c">' + hx.lines.map(function (l) {
      return '<div style="padding:5px 0;border-bottom:1px dashed var(--line)">' + esc(l) + '</div>';
    }).join('') + '</div></div>';
    html += '<div class="hd-block"><div class="hd-t">白话启发</div><div class="hd-c soft">' + esc(hx.idea) + '</div></div>';
    html += '</div></div>';
    return html;
  }

  function miniPile2(lines) {
    // 大字竖排卦画
    var out = '';
    for (var i = 5; i >= 0; i -= 1) {
      out += '<div style="display:flex;justify-content:center;margin:1px 0">' + ylineHtml(lines[i], false, 34, 5) + '</div>';
    }
    return out;
  }

  function kbIntro() {
    var html = '<div style="padding:0 20px 26px">';
    html += backRow('kb-nav', 'home', '知识库');
    html += '<div class="page-title"><div class="seal">启</div><div><h2>起卦入门</h2><div class="sub">明其法 · 然后可以占</div></div></div>';
    html += '<div class="card kb-text" style="padding:16px">' + KB_INTRO.map(function (b) {
      return '<h4>' + esc(b.h) + '</h4><div class="kt">' + esc(b.t) + '</div>';
    }).join('') + '</div>';
    html += '</div>';
    return html;
  }

  function kbClassic() {
    var html = '<div style="padding:0 20px 26px">';
    html += backRow('kb-nav', 'home', '知识库');
    html += '<div class="page-title"><div class="seal">典</div><div><h2>经典原文</h2><div class="sub">《梅花易数》名篇节选</div></div></div>';
    html += '<div style="display:flex;flex-direction:column;gap:12px">' + KB_CLASSICS.map(function (c) {
      return '<div class="card" style="padding:16px"><h4 style="font-family:var(--kai);font-size:15px;font-weight:700;letter-spacing:2px;margin-bottom:8px;color:var(--ink)">' + esc(c.title) + '</h4>' +
        '<div class="classic">' + esc(c.text) + '</div></div>';
    }).join('') + '</div>';
    html += '</div>';
    return html;
  }

  function backRow(action, page, label) {
    return '<div class="back-row" data-action="' + action + '" data-page="' + page + '"><span>‹</span><span>' + label + '</span></div>';
  }

  /* ---------- 关于 ---------- */
  function renderAbout() {
    var html = '';
    html += '<div style="padding:0 20px 26px">';
    html += '<div class="about-hero">' +
      '<div class="seal ah-seal">梅</div>' +
      '<div class="ah-t">梅花易数·全息占</div>' +
      '<div class="ah-s">观象知机 · 明理趋吉</div>' +
      '</div>';
    html += '<div class="card about-card"><h4>应用简介</h4><p>' + esc(ABOUT_DATA.intro) + '</p></div>';
    html += '<div class="card about-card"><h4>核心功能</h4><ul class="ac-list">' + ABOUT_DATA.features.map(function (f) {
      return '<li>' + esc(f) + '</li>';
    }).join('') + '</ul></div>';
    html += '<div class="card about-card"><h4>取数方法</h4><p>' + esc(ABOUT_DATA.method) + '</p></div>';
    html += '<div class="card about-card"><h4>明示</h4><p>' + esc(ABOUT_DATA.disclaimer) + '</p></div>';
    html += '<div class="card about-card"><h4>协助创作</h4><p>' + esc(ABOUT_DATA.credit) + '</p></div>';
    html += '<div class="card about-card"><h4>体系来源</h4><p>' + esc(SAN_CREDIT) + '</p></div>';
    html += '<div class="ver-line">版本 2.0.0 · 安卓原型</div>';
    html += '</div>';
    return html;
  }

  /* ---------- 三元九维 · 洛书九宫 19683 ---------- */
  // 洛书飞星格位：grid-area 行/列（巽四离九坤二 / 震三中五兑七 / 艮八坎一乾六）
  var PALACE_AREA = [
    '3 / 2', // 坎一 下中
    '1 / 3', // 坤二 右上
    '2 / 1', // 震三 左中
    '1 / 1', // 巽四 左上
    '2 / 2', // 中五 正中
    '3 / 3', // 乾六 右下
    '2 / 3', // 兑七 右中
    '3 / 1', // 艮八 左下
    '1 / 2'  // 离九 上中
  ];
  // 九宫盘单格：宫名 + 方位卦 + 三态循环 + 河图生成数 + 旺衰量化分
  function sanPalaceCell(v, idx) {
    var d = SAN_DIMS[idx];
    var val = v[idx];
    var cls = val === 1 ? ' sy-vp' : val === -1 ? ' sy-vn' : ' sy-vz';
    var keyWord = { 1: '行', 0: '转', '-1': '止' }['' + val];
    var desk = SAN_VALUE_TEXT['' + val];
    var stage = store.lunarMonth ? getWangShuai(d.xing, store.lunarMonth) : '平';
    var score = heTuScore ? heTuScore(d.xing, stage) : '';
    var area = PALACE_AREA[idx];
    return '<div class="sy-cell' + cls + '" data-action="san-cycle" data-d="' + idx + '" style="grid-area:' + area + '">' +
      '<div class="sy-dn"><b>' + d.name + '</b> · ' + d.key + ' · ' + d.gua + '</div>' +
      '<div class="sy-dv">' + val + '</div>' +
      '<div class="sy-dk">' + keyWord + '</div>' +
      '<div class="sy-ds">' + d.desc + '</div>' +
      (score !== '' ? '<div class="sy-dh">河图 ' + d.sheng + '/' + d.cheng + ' · ' + stage + ' ' + score + '</div>' : '') +
      '<div class="sy-dt">' + desk + '</div>' +
      '</div>';
  }

  // 完整 Tab 页
  function renderSan() {
    var h = '';
    h += '<div style="padding:0 20px 26px">';
    h += '<div class="page-title"><div class="seal">宫</div><div><h2>洛书九宫 · 宫气观照</h2><div class="sub">九宫三态 · 3⁹ = 19683 格局</div></div></div>';

    // 来源与状态提示
    var hasResult = !!store.result;
    if (hasResult && !store.san) store.san = sanYuanFromCast(store.result);
    if (!store.san) store.san = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 默认全零中心态
    if (hasResult) {
      h += '<div class="card sy-src"><div class="sy-src-t">起卦联动 · ' + esc(store.castNote) + '</div>' +
        '<div class="sy-src-s">由本卦「' + esc(store.result.ben.full) + '」按洛书九宫映射宫气；可点按各宫微调观照。</div></div>';
    } else {
      h += '<div class="card sy-src"><div class="sy-src-t">尚未起卦 · 全枢中心态</div>' +
        '<div class="sy-src-s">当前显示 3⁹ 格局中心（第 9841 号，宫气俱枢、转化中）。可点按各宫微调观照，或先起卦获得联动映射。</div></div>';
    }

    // 九宫盘（洛书飞星排布：巽四离九坤二 / 震三中五兑七 / 艮八坎一乾六）
    h += '<div class="pai-section"><h3>九宫盘 <span class="en">LO SHU PALACE · TAP TO CYCLE -1→0→+1</span></h3>';
    h += '<div class="sy-palace">';
    for (var pi = 0; pi < 9; pi += 1) h += sanPalaceCell(store.san, pi);
    h += '</div>';
    h += '<div class="sy-palace-tip">九宫飞星之序：坎一、坤二、震三、巽四、中五、乾六、兑七、艮八、离九。点按任意宫可在 -1（气敛·止）→ 0（气枢·转）→ +1（气旺·行）间循环，编号与解读实时更新。</div>';
    h += '</div>';

    // 标识卡
    var idx = sanIndex(store.san);
    var off = sanOffset(store.san);
    var tern = sanTern(store.san);
    var cDist = Math.abs(idx - 9841);
    h += '<div class="pai-section"><h3>格局标识 <span class="en">STATE ID</span></h3>';
    h += '<div class="card sy-id">' +
      '<div class="sy-id-row"><span class="sy-id-label">三进制码</span><span class="sy-id-code">' + tern + '</span></div>' +
      '<div class="sy-id-row"><span class="sy-id-label">格局编号</span><span class="sy-id-num">' + idx + ' <em>/ 19682</em></span></div>' +
      '<div class="sy-id-row"><span class="sy-id-label">宫气凝聚</span><span class="sy-id-num">' + off + ' <em>/ 9</em></span></div>' +
      '<div class="sy-id-row"><span class="sy-id-label">距中心</span><span class="sy-id-num">' + cDist + ' <em>（中心 9841）</em></span></div>' +
      '</div></div>';

    // 三元解读：体 / 用 / 变
    h += '<div class="pai-section"><h3>三元解读 <span class="en">TI · YONG · BIAN</span></h3>';
    h += '<div class="sy-triples">';
    for (var g = 0; g < SAN_GROUPS.length; g += 1) {
      var grp = SAN_GROUPS[g];
      var dims = grp.dims;
      var gv = dims.map(function (d) { return store.san[d]; });
      var gSum = gv.reduce(function (a, b) { return a + b; }, 0);
      var gTag = gSum > 0 ? '偏旺' : gSum < 0 ? '偏敛' : '居中';
      h += '<div class="card sy-trip">' +
        '<div class="sy-trip-head"><div class="sy-trip-name">' + grp.name + '</div><div class="sy-trip-en">' + grp.en + '</div>' +
        '<span class="badge ' + (gSum > 0 ? 'b-red' : gSum < 0 ? 'b-green' : 'b-gold') + '">' + gTag + '</span></div>' +
        '<div class="sy-trip-desc">' + grp.desc + '</div>' +
        '<div class="sy-trip-dims">' + dims.map(function (d, j) {
          var dm = SAN_DIMS[d];
          var dv = store.san[d];
          return '<div class="sy-td"><span class="sy-td-n">' + dm.name + '·' + dm.xing + '</span>' +
            '<span class="sy-td-v ' + (dv === 1 ? 'vp' : dv === -1 ? 'vn' : 'vz') + '">' + dv + '</span></div>';
        }).join('') + '</div>' +
        '</div>';
    }
    h += '</div></div>';

    // 27 格局
    var mode = sanMode27(store.san);
    var mKey = sanModeKey(mode);
    var mInfo = SAN_MODE_27[mKey] || { name: '衡 · 衡 · 中', idea: '三组主分量皆归中性。' };
    var mNames = [[1, '承'], [0, '衡'], [-1, '敛']];
    var uNames = [[1, '显'], [0, '衡'], [-1, '晦']];
    var bNames = [[1, '进'], [0, '守'], [-1, '归']];
    function nm(arr, v) { for (var k = 0; k < arr.length; k += 1) { if (arr[k][0] === v) return arr[k][1]; } return '·'; }
    h += '<div class="pai-section"><h3>27 格局 <span class="en">COARSE-GRAIN PROJECTION</span></h3>';
    h += '<div class="card sy-mode">' +
      '<div class="sy-mode-top"><div class="sy-mode-name">' + esc(mInfo.name) + '</div>' +
      '<div class="sy-mode-code">体' + mode[0] + ' · 用' + mode[1] + ' · 变' + mode[2] + '</div></div>' +
      '<div class="sy-mode-bar">' +
      '<span class="sy-mb-item' + (mode[0] === 1 ? ' on p' : mode[0] === -1 ? ' on n' : '') + '">体 ' + nm(mNames, mode[0]) + '</span><span class="sy-mb-arrow">→</span>' +
      '<span class="sy-mb-item' + (mode[1] === 1 ? ' on p' : mode[1] === -1 ? ' on n' : '') + '">用 ' + nm(uNames, mode[1]) + '</span><span class="sy-mb-arrow">→</span>' +
      '<span class="sy-mb-item' + (mode[2] === 1 ? ' on p' : mode[2] === -1 ? ' on n' : '') + '">变 ' + nm(bNames, mode[2]) + '</span>' +
      '</div>' +
      '<div class="sy-mode-idea">' + esc(mInfo.idea) + '</div>' +
      '<div class="sy-mode-note">体（坎坤震，根基我势）· 用（巽中乾，施用外事）· 变（兑艮离，时变机枢）——由 19683 细粒度宫气格局降维投影为 27 种粗粒度格局，用于快速识「此刻以何格局立身行事」。</div>' +
      '</div></div>';

    // 伏羲四象相位
    var phIdx = sanPhaseFromCast(store.result);
    var ph = phIdx >= 0 ? SAN_PHASES[phIdx] : null;
    var phName = ph ? ph.name : '未定';
    var phEn = ph ? ph.en : 'PENDING';
    var phAct = ph ? ph.act : '待起卦';
    var phDesc = ph ? ph.desc : sanPhDesc(-1);
    h += '<div class="pai-section"><h3>四象相位 <span class="en">FUXI FOUR SYMBOLS</span></h3>';
    h += '<div class="card sy-phase">' +
      '<div class="sy-ph-top"><div class="sy-ph-name">' + phName + '</div><div class="sy-ph-en">' + phEn + '</div>' +
      '<span class="badge b-red">' + phAct + '</span></div>' +
      '<div class="sy-ph-desc">' + esc(phDesc) + '</div>' +
      '<div class="sy-ph-cycle">' +
      SAN_PHASES.map(function (p, i) {
        var short = p.name;
        return '<div class="sy-phc' + (phIdx === i ? ' on' : '') + '"><span>' + ['太阳', '少阴', '少阳', '太阴'][i][0] + '</span>' + short + '</div>';
      }).join('<div class="sy-phc-arr">·</div>') +
      '</div>' +
      '<div class="sy-ph-note">四象由体用两卦阴阳相合：阳卦（乾震坎艮）、阴卦（坤巽离兑）。太阳外放、少阴外显内藏、少阳内蓄外发、太阴内敛守静——示此时进退宜忌。</div>' +
      '</div></div>';

    // 白话综述
    h += '<div class="pai-section"><h3>白话综述 <span class="en">PLAIN SUMMARY</span></h3>';
    h += '<div class="card sy-sum">' + esc(sanSummary(store.san, mode, phIdx)) + '</div></div>';

    // 与本卦合参·断语（完整版：体用基准 × 27格局 × 四象时机 × 偏移把握 × 镜像提示）
    if (hasResult) {
      var duan = sanReadingFull(store.result, mode, mKey, phIdx, off);
      if (duan) {
        h += '<div class="pai-section"><h3>与本卦合参 <span class="en">CAST &amp; STATE</span></h3>';
        h += '<div class="card sy-duan"><div class="sy-duan-t">观卦断语 · 骨神合参</div>' +
          '<div class="sy-duan-b">' + esc(duan) + '</div>' +
          '<div class="sy-duan-n">体用为骨定吉凶，九宫为神示时机，四象示进退，镜像示往复；所陈供文化研习与自我观照参考。</div></div></div>';
      }
    }

    // 功能说明 + 免责
    h += '<div class="sy-tip">' + SAN_TIP + '</div>';
    h += '</div>';
    return h;
  }

  // 排盘精简联动段
  function sanYuanMiniHtml(r) {
    if (!store.san) store.san = sanYuanFromCast(r);
    var v = store.san;
    var idx = sanIndex(v);
    var tern = sanTern(v);
    var mode = sanMode27(v);
    var mKey = sanModeKey(mode);
    var mInfo = SAN_MODE_27[mKey] || { name: '衡 · 衡 · 中' };
    var phIdx = sanPhaseFromCast(r);
    var ph = phIdx >= 0 ? SAN_PHASES[phIdx] : null;
    var duan = sanReadingShort(r, mode, mKey, phIdx);
    var h = '';
    h += '<div class="pai-section"><h3>洛书九宫 · 宫气观照 <span class="en">LO SHU STATE</span></h3>';
    h += '<div class="card sy-mini">' +
      '<div class="sy-mini-top"><div class="sy-mini-code">' + tern + '</div><div class="sy-mini-info">' +
      '<span class="sy-mini-num">第 ' + idx + ' 号</span><span class="badge b-red">' + (ph ? ph.name : '相位未定') + '</span></div></div>' +
      '<div class="sy-mini-row">格局：<b>' + esc(mInfo.name) + '</b>　（体' + mode[0] + '·用' + mode[1] + '·变' + mode[2] + '）</div>' +
      '<div class="sy-mini-row">相位：' + (ph ? ph.act : sanPhDesc(-1)) + (ph ? ' —— ' + esc(ph.desc.slice(0, 40)) + '…' : '') + '</div>';
    if (duan) {
      h += '<div class="sy-mini-duan">' + esc(duan) + '</div>';
    }
    h += '<button class="btn btn-mini" data-action="tab" data-tab="san" style="margin-top:12px;width:100%">进入完整宫气观照</button>' +
      '</div></div>';
    return h;
  }

  /* ---------- 渲染调度 ---------- */
  function renderScreen() {
    var map = {
      cast: renderCast,
      paipan: renderPaipan,
      san: renderSan,
      kb: renderKb,
      about: renderAbout
    };
    qs('#screen').innerHTML = '<div class="screen-inner">' + (map[store.tab] ? map[store.tab]() : '') + '</div>';
  }

  function renderAll() {
    renderStatusbar();
    renderNav();
    renderScreen();
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function showToast(msg) {
    var old = qs('#toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'toast';
    t.textContent = msg;
    t.style.cssText = 'position:absolute;bottom:78px;left:50%;transform:translateX(-50%);' +
      'background:rgba(47,42,36,.92);color:#f6f1e3;font-size:13px;letter-spacing:1px;' +
      'padding:9px 18px;border-radius:999px;z-index:99;max-width:80%;text-align:center;' +
      'box-shadow:0 6px 18px rgba(0,0,0,.3);font-family:var(--kai);animation:toastIn .25s ease';
    var st = document.createElement('style');
    st.textContent = '@keyframes toastIn{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}';
    document.head.appendChild(st);
    qs('.mh-app').appendChild(t);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2200);
  }

  /* ---------- 事件委托 ---------- */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    switch (action) {
      case 'tab': {
        var tab = el.getAttribute('data-tab');
        store.tab = tab;
        store.sceneOpen = 'shiye';
        document.getElementById('screen').scrollTop = 0;
        renderAll();
        break;
      }
      case 'method': {
        store.method = el.getAttribute('data-m');
        store.coins = [];
        store.coinFace = [];
        renderScreen();
        break;
      }
      case 'cast-time':
        doTimeCast();
        break;
      case 'throw-coin':
        doThrowCoin();
        break;
      case 'reset-coins':
        resetCoins();
        break;
      case 'reset-all':
        store.result = null;
        store.castNote = '';
        store.coins = [];
        store.coinFace = [];
        store.tab = 'cast';
        renderAll();
        break;
      case 'goto-paipan':
        store.tab = 'paipan';
        store.sceneOpen = 'shiye';
        document.getElementById('screen').scrollTop = 0;
        renderAll();
        break;
      case 'scene-toggle': {
        var k = el.getAttribute('data-k');
        store.sceneOpen = store.sceneOpen === k ? null : k;
        renderScreen();
        break;
      }
      case 'kb-nav':
        store.kbPage = el.getAttribute('data-page');
        document.getElementById('screen').scrollTop = 0;
        renderScreen();
        break;
      case 'kb-hex':
        store.kbHex = parseInt(el.getAttribute('data-seq'), 10);
        store.kbPage = 'hexdetail';
        document.getElementById('screen').scrollTop = 0;
        renderScreen();
        break;
      case 'san-cycle': {
        var d = parseInt(el.getAttribute('data-d'), 10);
        if (!store.san) store.san = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        store.san[d] = store.san[d] === -1 ? 0 : store.san[d] === 0 ? 1 : -1;
        store.sanEdited = true;
        renderScreen();
        break;
      }
      default:
        break;
    }
  });

  /* ---------- 启动 ---------- */
  renderAll();
})();