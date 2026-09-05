/**
 * Bộ kiểm thử cho index.html.
 *
 * Chạy:  node test/run-tests.js
 * Không cần cài gói nào. Nó nạp thẳng đoạn script trong index.html vào một
 * ngữ cảnh vm kèm DOM giả, rồi gọi đúng các hàm thật của trang.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var makeDom = require('./mini-dom.js').makeDom;

var ROOT = path.join(__dirname, '..');

/* ================== khung kiểm thử ================== */
var pass = 0, fail = 0, current = '';
var failures = [];

function group(name) { current = name; console.log('\n' + name); }

function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  v ' + label); }
  else {
    fail++;
    failures.push(current + ' -> ' + label + (detail ? '  [' + detail + ']' : ''));
    console.log('  X ' + label + (detail ? '  [' + detail + ']' : ''));
  }
}

function eq(actual, expected, label) {
  var a = JSON.stringify(actual), b = JSON.stringify(expected);
  ok(a === b, label, a === b ? '' : 'nhan ' + a + ', cho doi ' + b);
}

function noThrow(fn, label) {
  try { fn(); ok(true, label); }
  catch (e) { ok(false, label, e && e.message); }
}

/* ================== nạp trang ================== */
function loadApp() {
  var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  var m = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('Khong tach duoc doan script trong index.html');

  var dom = makeDom({ width: 1400, height: 900 });
  var store = {};

  var sandbox = {
    document: dom.document,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    AbortController: AbortController,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    location: { href: 'https://example.test/', reload: function () {} },
    navigator: { userAgent: 'test' },
    alert: function () {},
    confirm: function () { return false; },
    addEventListener: function () {},
    removeEventListener: function () {},
    fetch: function () { return Promise.reject(new Error('mang bi chan trong kiem thu')); },
    Image: function () {
      var im = dom.createElement('img');
      im.src = ''; im.alt = ''; im.loading = '';
      return im;
    },
    Option: function (text, value) {
      var o = dom.createElement('option');
      o.textContent = text == null ? '' : String(text);
      o.value = value == null ? '' : String(value);
      o.selected = false;
      return o;
    },
    FileReader: function () { this.readAsDataURL = function () {}; }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(m[1], sandbox, { filename: 'index.html:script' });

  return { app: sandbox, dom: dom, store: store, src: m[1] };
}

/* ================== bắt đầu ================== */
console.log('KIEM THU GIA PHA VIET');
var env, A;
try {
  env = loadApp();
  A = env.app;
  console.log('  nap script: OK (' + env.src.split('\n').length + ' dong)');
} catch (e) {
  console.log('  KHONG NAP DUOC SCRIPT: ' + e.message);
  process.exit(1);
}

/* ---------- 1. chuỗi và ngày tháng ---------- */
group('1. Chuoi va ngay thang');
eq(A.bare('Nguyễn Hữu Trọng'), 'nguyen huu trong', 'bo dau tieng Viet');
eq(A.bare('ĐỖ THỊ HẠNH'), 'do thi hanh', 'bo dau chu D gach va chu hoa');
eq(A.key('Họ và tên'), 'hovaten', 'chuan hoa ten cot');
eq(A.initials('Nguyễn Văn Đại'), 'Đ', 'chu cai dai dien lay tu ten');
eq(A.toRoman(4), 'IV', 'so La Ma 4');
eq(A.toRoman(9), 'IX', 'so La Ma 9');

eq(A.parseDate('1950'), { d: 0, m: 0, y: 1950, full: false }, 'chi nam');
eq(A.parseDate('05/09/1950'), { d: 5, m: 9, y: 1950, full: true }, 'ngay thang nam co so 0');
eq(A.parseDate('5/9/1950'), { d: 5, m: 9, y: 1950, full: true }, 'ngay thang nam khong so 0');
eq(A.parseDate('1950-09-05'), { d: 5, m: 9, y: 1950, full: true }, 'dinh dang ISO');
eq(A.parseDate('15/7'), { d: 15, m: 7, y: 0, full: false }, 'ngay gio am lich');
eq(A.parseDate(''), null, 'chuoi rong');
eq(A.fmtDate(A.parseDate('5/9/1950')), '05/09/1950', 'in lai ngay day du');

/* ---------- 2. âm lịch ---------- */
group('2. Am lich Viet Nam');
// Mùng 1 Tết các năm gần đây, đối chiếu lịch phổ thông
eq(A.solar2lunar(17, 2, 2026), { d: 1, m: 1, y: 2026, leap: 0 }, 'Tet Binh Ngo roi vao 17/02/2026');
eq(A.solar2lunar(29, 1, 2025), { d: 1, m: 1, y: 2025, leap: 0 }, 'Tet At Ty roi vao 29/01/2025');
eq(A.solar2lunar(10, 2, 2024), { d: 1, m: 1, y: 2024, leap: 0 }, 'Tet Giap Thin roi vao 10/02/2024');
eq(A.canChi(2026), 'Bính Ngọ', 'can chi nam 2026');
eq(A.canChi(1918), 'Mậu Ngọ', 'can chi nam 1918');

// Đổi xuôi rồi đổi ngược phải ra đúng ngày ban đầu
(function () {
  var bad = 0, n = 0, first = '';
  for (var y = 1900; y <= 2100; y += 7) {
    for (var mo = 1; mo <= 12; mo += 1) {
      for (var d = 1; d <= 28; d += 9) {
        n++;
        var L = A.solar2lunar(d, mo, y);
        var S = A.lunar2solar(L.d, L.m, L.y, L.leap);
        if (!S || S[0] !== d || S[1] !== mo || S[2] !== y) {
          bad++;
          if (!first) first = d + '/' + mo + '/' + y + ' -> ' + JSON.stringify(L) + ' -> ' + JSON.stringify(S);
        }
      }
    }
  }
  ok(bad === 0, 'doi xuoi roi nguoc khop tren ' + n + ' ngay tu 1900 den 2100', first);
})();

/* ---------- 3. đọc CSV ---------- */
group('3. Doc CSV');
(function () {
  var csv = 'id,ho_ten,ghi_chu\n1,"Nguyễn, Văn A","Ông nói ""xin chào"""\n2,Trần Thị B,\n';
  var rows = A.parseCSV(csv);
  eq(rows.length, 3, 'dem so hang');
  eq(rows[1][1], 'Nguyễn, Văn A', 'dau phay trong ngoac kep');
  eq(rows[1][2], 'Ông nói "xin chào"', 'ngoac kep long nhau');
  eq(rows[2][2], '', 'o trong cuoi hang');

  var multi = A.parseCSV('a,b\n"dong 1\ndong 2",x\n');
  eq(multi[1][0], 'dong 1\ndong 2', 'xuong dong trong o');
})();

(function () {
  var csv = 'Mã,Họ và tên,Giới tính,Năm sinh,Cha,Mẹ,Vợ chồng\n' +
            '1,Nguyễn Văn A,nam,1950,,,2\n' +
            '2,Lê Thị B,NỮ,1953,,,1\n' +
            '3,Nguyễn Văn C,Nam,1975,1,2,\n';
  var ps = A.rowsToPeople(A.parseCSV(csv));
  eq(ps.length, 3, 'doc du 3 nguoi tu tieu de tieng Viet co dau');
  eq(ps[0].gender, 'Nam', 'chuan hoa gioi tinh chu thuong');
  eq(ps[1].gender, 'Nữ', 'chuan hoa gioi tinh chu hoa co dau');
  eq(ps[2].father, '1', 'nhan cot cha');
  eq(ps[0].spouse, ['2'], 'nhan cot vo chong');
  eq(ps[0]._row, 2, 'nho so hang trong Sheet de mo dung dong');
})();

ok(A.fixPhoto('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing')
   === 'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOp&sz=w400', 'doi link Drive thanh anh hien duoc');
eq(A.extractId('https://docs.google.com/spreadsheets/d/1sjH0CANvtWYkoM0wYBAYfMTwWB/edit?gid=0'),
   '1sjH0CANvtWYkoM0wYBAYfMTwWB', 'tach ID tu dia chi Sheet');

/* ---------- 4. suy ngày giỗ từ ngày mất ---------- */
group('4. Ngay gio');
(function () {
  var p = A.normalize({ id: 'x', name: 'Test', death: '12/03/1996' });
  var L = A.solar2lunar(12, 3, 1996);
  ok(p.dead === true, 'co ngay mat thi danh dau da mat');
  eq([p.giod.d, p.giod.m], [L.d, L.m], 'tu quy ngay mat duong sang am');
  ok(p.gioAuto === true, 'danh dau la ngay gio suy ra');

  var q = A.normalize({ id: 'y', name: 'Test2', death: '12/03/1996', gio: '15/7' });
  eq([q.giod.d, q.giod.m], [15, 7], 'ngay gio khai tay duoc uu tien');

  var alive = A.normalize({ id: 'z', name: 'Test3', birth: '1990' });
  ok(alive.dead === false, 'khong co ngay mat thi con song');
})();

/* ---------- 5. dựng cây ---------- */
group('5. Dung cay tu du lieu mau');
noThrow(function () { A.setPeople(A.DEMO.map(A.normalize), 'demo'); }, 'setPeople chay tron ven');
eq(A.State.people.length, 19, 'du 19 nguoi trong du lieu mau');
eq(A.State.pos.size, 19, 'moi nguoi deu co toa do');
eq(A.State.maxDepth, 3, 'cay sau 4 doi');
ok(A.State.bbox.w > 0 && A.State.bbox.h > 0, 'khung cay co kich thuoc');

(function () {
  var rows = {};
  A.State.pos.forEach(function (p, id) { (rows[p.y] = rows[p.y] || []).push({ id: id, x: p.x }); });
  var overlap = [];
  Object.keys(rows).forEach(function (y) {
    var list = rows[y].sort(function (a, b) { return a.x - b.x; });
    for (var i = 1; i < list.length; i++) {
      if (list[i].x < list[i - 1].x + A.CARD_W - 0.01) {
        overlap.push(list[i - 1].id + ' va ' + list[i].id + ' tai y=' + y);
      }
    }
  });
  ok(overlap.length === 0, 'khong the nao de len nhau', overlap.join('; '));

  var ydiff = [];
  A.State.people.forEach(function (p) {
    if (!p.father) return;
    var c = A.State.pos.get(p.id), f = A.State.pos.get(p.father);
    if (!c || !f) return;
    if (Math.abs((c.y - f.y) - A.ROW) > 0.01) ydiff.push(p.name);
  });
  ok(ydiff.length === 0, 'con luon nam ngay duoi cha mot doi', ydiff.join(', '));
})();

eq(A.State.chiList.length, 3, 'nhan ra 3 chi tu 3 nguoi con cua thuy to');
(function () {
  var tong = A.State.chiList.reduce(function (n, c) { return n + c.count; }, 0);
  ok(tong === 17, 'moi nguoi tru thuy to va vo deu thuoc mot chi', 'tong ' + tong);
  var chi9 = A.State.chi.get('9');
  ok(chi9 && chi9.id === '3', 'nguoi so 9 thuoc chi ong Hung');
  var chi13 = A.State.chi.get('13');
  ok(chi13 && chi13.id === '5', 'nguoi so 13 thuoc chi ba Lan');
})();

/* ---------- 6. giỗ sắp tới ---------- */
group('6. Danh sach gio sap toi');
(function () {
  var list = A.upcomingGio(365);
  ok(list.length === 3, 'ba nguoi co ngay mat day du deu vao danh sach', 'nhan ' + list.length);
  var sorted = list.every(function (x, i) { return i === 0 || list[i - 1].jd <= x.jd; });
  ok(sorted, 'sap xep theo ngay gan nhat truoc');
  var inRange = list.every(function (x) { return x.diff >= 0 && x.diff <= 365; });
  ok(inRange, 'moi muc deu nam trong 365 ngay toi');
})();

/* ---------- 7. quyền theo nhánh ---------- */
group('7. Quyen ghi theo nhanh');
A.Api.url = 'https://script.google.com/macros/s/x/exec';

A.setSession(null);
ok(A.canEdit('9') === false, 'chua dang nhap thi khong sua duoc ai');

A.setSession({ user: 'admin', name: 'Quan tri', role: 'quan_tri', branches: [] });
ok(A.canEdit('9') === true && A.canEdit('1') === true, 'quan tri sua duoc moi nguoi');

A.setSession({ user: 'xem', name: 'Khach', role: 'nguoi_xem', branches: ['3'] });
ok(A.canEdit('9') === false, 'quyen chi xem thi khong sua duoc du co nhanh');

A.setSession({ user: 'trongnt', name: 'Trong', role: 'bien_tap', branches: ['3'] });
ok(A.canEdit('3') === true, 'sua duoc chinh goc nhanh duoc giao');
ok(A.canEdit('4') === true, 'sua duoc vo cua goc nhanh');
ok(A.canEdit('9') === true, 'sua duoc con trong nhanh');
ok(A.canEdit('10') === true, 'sua duoc dau ve trong nhanh');
ok(A.canEdit('16') === true, 'sua duoc chau doi thu tu trong nhanh');
ok(A.canEdit('13') === false, 'khong sua duoc nguoi thuoc chi khac');
ok(A.canEdit('14') === false, 'khong sua duoc nguoi thuoc chi thu ba');
ok(A.canEdit('1') === false, 'khong nguoc len sua duoc thuy to');
ok(A.canEdit('2') === false, 'khong nguoc len sua duoc vo thuy to');

A.setSession({ user: 'hai', name: 'Hai nhanh', role: 'bien_tap', branches: ['3', '7'] });
ok(A.canEdit('9') === true && A.canEdit('14') === true && A.canEdit('13') === false,
   'giao hai nhanh thi sua duoc ca hai, van chua nhanh con lai');

A.setSession({ user: 'trong', name: 'Trong', role: 'bien_tap', branches: [] });
ok(A.canEditAny() === false, 'bien tap chua duoc giao nhanh thi khong them duoc ai');

/* ---------- 8. tìm kiếm và dòng dõi ---------- */
group('8. Tim kiem va dong doi');
(function () {
  var hits = A.State.people.filter(function (p) { return A.bare(p.name).indexOf('trong') >= 0; });
  eq(hits.length, 1, 'go khong dau van tim ra Nguyen Van Trong');

  var line = A.lineage('9');
  ok(line.has('1') && line.has('3'), 'dong doi bao gom to tien');
  ok(line.has('16') && line.has('17'), 'dong doi bao gom con chau');
  ok(line.has('10'), 'dong doi bao gom vo');
  ok(!line.has('13'), 'dong doi khong lan sang chi khac');
})();

/* ---------- 9. giao diện không ném lỗi ---------- */
group('9. Giao dien dung duoc');
eq(A.State.people.length, env.dom.byId.cards.childNodes.length, 'so the ve ra bang so nguoi');
noThrow(function () { A.State.people.forEach(function (p) { A.openDrawer(p.id); }); }, 'mo ngan chi tiet cho ca 19 nguoi');
noThrow(function () { A.renderGio(); A.renderStats(); A.renderUserPop(); }, 've bang gio, thong ke, thong tin tai khoan');
noThrow(function () { A.paintFocus(); A.paintChi(); A.fitView(); }, 'to mau, loc va can khung');
noThrow(function () { A.openSetup(); }, 'mo hop cai dat');
noThrow(function () {
  A.setSession({ user: 'admin', name: 'Quan tri', role: 'quan_tri', branches: [] });
  A.openPerson(null);
  A.openPerson('9');
  A.openAccountForm(null);
  A.openAccountForm({ user: 'trongnt', name: 'Trong', role: 'bien_tap', branches: ['3'], status: 'hoat_dong' });
  A.openLogin();
}, 'mo cac bieu mau them nguoi va tai khoan');

/* ---------- 10. kiểm tra đường dẫn cổng ghi ---------- */
group('10. Kiem tra duong dan cong ghi');
(function () {
  A.openSetup();
  var mb = env.dom.document.querySelector('.modal .mb');
  ok(!!mb && typeof mb._validate === 'function', 'hop cai dat co ham kiem tra');
  if (!mb || !mb._validate) return;

  var inputs = mb.querySelectorAll('input');
  var iScript = inputs[0], iId = inputs[1];

  iScript.value = 'https://docs.google.com/spreadsheets/d/1sjH0CANvtWYkoM0wYBAYfMTwWB/edit';
  var msg = mb._validate();
  ok(/địa chỉ file Google Sheet/.test(msg), 'nhan ra dan nham dia chi Sheet');
  ok(iScript.value === '', 'xoa o cong ghi khi dan nham');
  ok(iId.value === '1sjH0CANvtWYkoM0wYBAYfMTwWB', 'chuyen ID xuong o chi xem');

  iScript.value = 'https://script.google.com/macros/s/AKfy/dev';
  ok(/\/exec/.test(mb._validate()), 'nhac khi dung ban dev thay vi exec');

  iScript.value = 'https://script.google.com/macros/s/AKfy/exec';
  ok(mb._validate() === '', 'duong dan dung thi khong bao gi');

  iScript.value = '';
  ok(mb._validate() === '', 'de trong thi khong bao gi');
})();

/* ---------- 11b. hai vợ và dữ liệu hỏng ---------- */
group('11b. Hai vo, con rieng moi ben, va du lieu hong');
(function () {
  var ds = [
    { id: 'A', name: 'Ông Cả', gender: 'Nam', birth: '1930', spouse: 'B,C' },
    { id: 'B', name: 'Bà Vợ Cả', gender: 'Nữ', birth: '1933', spouse: 'A' },
    { id: 'C', name: 'Bà Vợ Hai', gender: 'Nữ', birth: '1940', spouse: 'A' },
    { id: 'D', name: 'Con Bà Cả Một', gender: 'Nam', birth: '1955', father: 'A', mother: 'B' },
    { id: 'E', name: 'Con Bà Cả Hai', gender: 'Nữ', birth: '1958', father: 'A', mother: 'B' },
    { id: 'F', name: 'Con Bà Hai', gender: 'Nam', birth: '1965', father: 'A', mother: 'C' },
    { id: 'G', name: 'Cháu Nội', gender: 'Nam', birth: '1980', father: 'D' }
  ];
  noThrow(function () { A.setPeople(ds.map(A.normalize), 'demo'); }, 'dung duoc cay co hai vo');
  eq(A.State.pos.size, 7, 'ca bay nguoi deu co cho');

  var pA = A.State.pos.get('A'), pB = A.State.pos.get('B'), pC = A.State.pos.get('C');
  ok(pA.y === pB.y && pB.y === pC.y, 'chong va hai vo cung mot doi');
  var xs = [pA.x, pB.x, pC.x].sort(function (a, b) { return a - b; });
  ok(xs[1] - xs[0] >= A.CARD_W && xs[2] - xs[1] >= A.CARD_W, 'ba the khong de len nhau');

  ['D', 'E', 'F'].forEach(function (id) {
    ok(A.State.pos.get(id).y === pA.y + A.ROW, 'con ' + id + ' nam ngay duoi mot doi');
  });
  ok(A.State.pos.get('G').y === pA.y + 2 * A.ROW, 'chau noi nam duoi hai doi');

  // Quyền: giao nhánh bà vợ hai thì không chạm được con bà cả
  A.setSession({ user: 'x', name: 'x', role: 'bien_tap', branches: ['F'] });
  ok(A.canEdit('F') === true, 'sua duoc goc nhanh la con ba hai');
  ok(A.canEdit('D') === false, 'khong sua duoc con ba ca');
  ok(A.canEdit('A') === false, 'khong nguoc len sua duoc nguoi cha');
})();

(function () {
  var ds = [
    { id: 'X', name: 'Người Một', father: 'KHONGCO', mother: '', spouse: 'CUNGKHONGCO' },
    { id: 'Y', name: 'Người Hai', father: 'X', spouse: 'X' },
    { id: 'X', name: 'Trùng mã', birth: '1900' }
  ];
  noThrow(function () { A.setPeople(ds.map(A.normalize), 'demo'); }, 'khong sap khi ma cha me tro vao khoang khong');
  var x = A.State.byId.get('X');
  eq(x.father, '', 'ma cha khong ton tai bi bo di');
  eq(x.spouse, [], 'ma vo chong khong ton tai bi bo di');
  ok(A.State.pos.size >= 2, 'van xep duoc cho cho nhung nguoi con lai');

  noThrow(function () { A.setPeople([], 'demo'); }, 'khong sap khi khong co ai');
  eq(A.State.people.length, 0, 'danh sach rong');

  // Dựng lại dữ liệu mẫu cho các nhóm sau
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
})();

/* ---------- 11. thông báo lỗi của cổng ghi ---------- */
group('11. Thong bao loi cong ghi');
(function () {
  var done = false;
  A.Api.url = 'https://script.google.com/macros/s/x/exec';
  A.window = A.window || {};
  // Giả lập Google trả về trang HTML thay vì JSON
  A.fetch = function () {
    return Promise.resolve({ text: function () { return Promise.resolve('<!DOCTYPE html><html>...'); } });
  };
  return A.Api.call('list').then(function () {
    ok(false, 'phai bao loi khi nhan HTML');
  }, function (e) {
    ok(/không phải cổng ghi/.test(e.message), 'noi ro khi nhan HTML thay vi JSON', e.message);
    done = true;
  });
})().then(function () {
  return (function () {
    A.fetch = function () {
      return Promise.resolve({ text: function () { return Promise.resolve(JSON.stringify({ ok: false, error: 'Sai mat khau.' })); } });
    };
    return A.Api.call('login').then(function () {
      ok(false, 'phai chuyen tiep loi tu may chu');
    }, function (e) {
      ok(e.message === 'Sai mat khau.', 'chuyen nguyen van loi tu cong ghi');
    });
  })();
}).then(function () {
  return (function () {
    A.fetch = function () { return Promise.reject(new Error('Failed to fetch')); };
    return A.Api.call('list').then(function () {
      ok(false, 'phai bao loi khi khong goi duoc');
    }, function (e) {
      ok(/quyền truy cập là Bất kỳ ai/.test(e.message), 'goi y kiem tra quyen trien khai khi mat ket noi');
    });
  })();
}).then(finish, function (e) {
  ok(false, 'chuoi kiem thu bat dong bo', e && e.message);
  finish();
});

/* ================== tổng kết ================== */
function finish() {
  console.log('\n' + '='.repeat(52));
  console.log('DAT ' + pass + ' / ' + (pass + fail));
  if (fail) {
    console.log('\nCAC MUC HONG:');
    failures.forEach(function (f) { console.log('  - ' + f); });
    process.exitCode = 1;
  } else {
    console.log('Khong co loi.');
  }
}
