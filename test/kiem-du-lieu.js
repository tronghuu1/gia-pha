/**
 * Soi một tệp CSV gia phả bằng chính bộ máy của index.html.
 *
 * Chạy:  node test/kiem-du-lieu.js <duong-dan.csv>
 *
 * Không khẳng định dữ liệu đúng với sự thật, chỉ bắt những lỗi máy thấy được:
 * mã trùng, mã cha mẹ trỏ vào khoảng không, vợ chồng khai một chiều, vòng lặp
 * tổ tiên, con sinh trước cha mẹ, và thẻ chồng lên nhau khi dựng cây.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var makeDom = require('./mini-dom.js').makeDom;

var file = process.argv[2];
if (!file) { console.log('Thieu duong dan CSV.'); process.exit(1); }

/* ---- nạp bộ máy của trang ---- */
var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
var dom = makeDom({ width: 1400, height: 900 });
var sandbox = {
  document: dom.document, console: console,
  setTimeout: setTimeout, clearTimeout: clearTimeout,
  AbortController: AbortController,
  localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
  location: { reload: function () {} }, navigator: {}, alert: function () {}, confirm: function () { return false; },
  addEventListener: function () {}, fetch: function () { return Promise.reject(new Error('x')); },
  Image: function () { var i = dom.createElement('img'); i.src = ''; return i; },
  Option: function (t, v) { var o = dom.createElement('option'); o.textContent = t; o.value = v; return o; },
  FileReader: function () {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'index.html' });
var A = sandbox;

/* ---- đọc tệp ---- */
var raw = fs.readFileSync(file, 'utf8');
var rows = A.parseCSV(raw);
var people = A.rowsToPeople(rows);

console.log('TEP  : ' + path.basename(file));
console.log('Cot  : ' + rows[0].length + '   Hang du lieu: ' + (rows.length - 1) + '   Nguoi doc duoc: ' + people.length);

var loi = [], nhac = [];

/* ---- mã trùng ---- */
var seen = {};
people.forEach(function (p) {
  if (seen[p.id]) loi.push('Ma trung: ' + p.id + ' (' + seen[p.id] + ' va ' + p.name + ')');
  seen[p.id] = p.name;
});

/* ---- mã cha mẹ và vợ chồng trỏ vào khoảng không ---- */
var raw2 = A.parseCSV(raw);
var map = A.mapHeaders(raw2[0]);
for (var r = 1; r < raw2.length; r++) {
  var row = raw2[r];
  var g = function (f) { return map[f] == null ? '' : String(row[map[f]] || '').trim(); };
  var id = g('id') || ('hang' + (r + 1));
  ['father', 'mother'].forEach(function (f) {
    var v = g(f);
    if (v && !seen[v]) loi.push('Nguoi ' + id + ' (' + g('name') + ') khai ' + f + '=' + v + ' nhung khong co ai mang ma do');
  });
  g('spouse').split(/[,;|]/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (v) {
    if (!seen[v]) loi.push('Nguoi ' + id + ' (' + g('name') + ') khai vo chong=' + v + ' nhung khong co ai mang ma do');
  });
}

/* ---- dựng cây ---- */
A.setPeople(people, 'local');
var S = A.State;

if (S.pos.size !== people.length) {
  loi.push('Chi xep duoc cho cho ' + S.pos.size + ' tren ' + people.length + ' nguoi');
}

/* ---- vợ chồng khai một chiều ---- */
people.forEach(function (p) {
  p.spouse.forEach(function (sid) {
    var q = S.byId.get(sid);
    if (q && q.spouse.indexOf(p.id) < 0) {
      nhac.push('Vo chong khai mot chieu: ' + p.name + ' -> ' + q.name + ' (cong ghi se tu noi lai khi luu)');
    }
  });
});

/* ---- vòng lặp tổ tiên ---- */
people.forEach(function (p) {
  var seenUp = {}, stack = [p.id], vong = false;
  while (stack.length) {
    var x = stack.pop();
    if (seenUp[x]) continue;
    seenUp[x] = 1;
    var q = S.byId.get(x);
    if (!q) continue;
    [q.father, q.mother].forEach(function (a) {
      if (!a) return;
      if (a === p.id) vong = true;
      stack.push(a);
    });
  }
  if (vong) loi.push('Vong lap to tien tai ' + p.name + ' (' + p.id + ')');
});

/* ---- con sinh trước cha mẹ ---- */
people.forEach(function (p) {
  if (!p.bd || !p.bd.y) return;
  [['cha', p.father], ['me', p.mother]].forEach(function (pair) {
    var q = S.byId.get(pair[1]);
    if (!q || !q.bd || !q.bd.y) return;
    if (q.bd.y > p.bd.y - 12) {
      loi.push(p.name + ' sinh ' + p.bd.y + ' ma ' + pair[0] + ' ' + q.name + ' sinh ' + q.bd.y);
    }
  });
});

/* ---- thẻ chồng lên nhau ---- */
var hang = {};
S.pos.forEach(function (pos, id) { (hang[pos.y] = hang[pos.y] || []).push({ id: id, x: pos.x }); });
Object.keys(hang).forEach(function (y) {
  var l = hang[y].sort(function (a, b) { return a.x - b.x; });
  for (var i = 1; i < l.length; i++) {
    if (l[i].x < l[i - 1].x + A.CARD_W - 0.01) {
      loi.push('The de len nhau: ' + l[i - 1].id + ' va ' + l[i].id);
    }
  }
});

/* ---- thống kê ---- */
console.log('So doi: ' + (S.maxDepth + 1) + '   Goc cay: ' + (S.blocks.length ? S.byId.get(S.blocks[0].id).name : '-'));
console.log('Chi   : ' + (S.chiList || []).map(function (c) { return c.name + ' (' + c.count + ')'; }).join(', '));
console.log('Da mat: ' + people.filter(function (p) { return p.dead; }).length +
            '   Co ngay gio: ' + people.filter(function (p) { return !!p.giod; }).length +
            '   Co nam sinh: ' + people.filter(function (p) { return p.bd && p.bd.y; }).length);

var moCoi = people.filter(function (p) { return !p.father && !p.mother && !p.spouse.length; });
if (moCoi.length) console.log('Khong noi voi ai: ' + moCoi.map(function (p) { return p.name; }).join(', '));

console.log('\n' + (loi.length ? 'LOI (' + loi.length + '):' : 'Khong co loi lien ket.'));
loi.forEach(function (x) { console.log('  X ' + x); });
if (nhac.length) {
  console.log('\nLUU Y (' + nhac.length + '):');
  nhac.forEach(function (x) { console.log('  - ' + x); });
}
process.exitCode = loi.length ? 1 : 0;
