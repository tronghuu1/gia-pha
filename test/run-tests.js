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

(function () {
  // Bảng cũ đặt tên cột là que_quan, bảng mới là noi_sinh. Cả hai phải đọc được.
  var cu = A.rowsToPeople(A.parseCSV('id,ho_ten,que_quan\n1,Nguyễn A,Hà Nam\n'));
  eq(cu[0].origin, 'Hà Nam', 'bang cu dat ten cot que_quan van doc duoc');
  var moi = A.rowsToPeople(A.parseCSV('id,ho_ten,noi_sinh\n1,Nguyễn A,Hà Nội\n'));
  eq(moi[0].origin, 'Hà Nội', 'bang moi dat ten cot noi_sinh doc duoc');
  var tv = A.rowsToPeople(A.parseCSV('id,ho_ten,Nơi sinh\n1,Nguyễn A,Huế\n'));
  eq(tv[0].origin, 'Huế', 'tieu de tieng Viet co dau cung doc duoc');
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

  // Gia phả cũ hay chỉ còn ngày giỗ, không rõ năm mất
  var mo = A.normalize({ id: 'w', name: 'Cu ong', gio: '15/9', death: 'không rõ' });
  ok(mo.dead === true, 'ghi khong ro vao o nam mat van tinh la da khuat');
  eq([mo.giod.d, mo.giod.m], [15, 9], 'ngay gio am lich van doc duoc');
  ok(mo.dd === null, 'khong bia ra ngay mat cu the');
  eq(A.yearsText(mo), 'đã mất', 'the hien chu da mat khi khong co nam nao');

  var moCoSinh = A.normalize({ id: 'v', name: 'Cu ba', birth: '1918', death: 'không rõ', gio: '01/11' });
  eq(A.yearsText(moCoSinh), '1918', 'co nam sinh thi hien nam sinh');
  ok(moCoSinh.dead === true, 'van danh dau la da khuat');
})();

/* ---------- 5. dựng cây ---------- */
group('5. Dung cay tu du lieu mau');
noThrow(function () { A.setPeople(A.DEMO.map(A.normalize), 'demo'); }, 'setPeople chay tron ven');
eq(A.State.people.length, 19, 'du 19 nguoi trong du lieu mau');
eq(A.State.pos.size, 19, 'moi nguoi deu co toa do');
eq(A.State.maxDepth, 3, 'cay sau 4 doi');
eq(A.State.genCount, 4, 'dem dung 4 doi theo du lieu');
(function () {
  // Gập bớt nhánh thì phần hiện ngắn lại, nhưng số đời của họ không đổi
  A.State.collapsed = new Set(['3', '5', '7']);
  A.redrawTree();
  ok(A.State.maxDepth < 3, 'phan dang hien ngan lai');
  eq(A.State.genCount, 4, 'so doi cua ca ho van la 4');
  A.unfoldAll();
})();
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
  // Mạch độc đinh mở đầu: chia chi phải nhảy qua, không dồn cả họ vào một chi
  var ds = [
    { id: 'T', name: 'Cụ Tổ', gender: 'Nam' },
    { id: 'L', name: 'Con Một', gender: 'Nam', father: 'T' },
    { id: 'A', name: 'Cháu Cả', gender: 'Nam', father: 'L' },
    { id: 'B', name: 'Cháu Hai', gender: 'Nam', father: 'L' },
    { id: 'C', name: 'Cháu Ba', gender: 'Nữ', father: 'L' },
    { id: 'A1', name: 'Chắt', gender: 'Nam', father: 'A' }
  ];
  A.setPeople(ds.map(A.normalize), 'demo');
  eq(A.State.chiList.length, 3, 'nhay qua mach doc dinh de chia dung 3 chi');
  eq(A.State.chiList.map(function (c) { return c.name; }), ['Cháu Cả', 'Cháu Hai', 'Cháu Ba'], 'ten cac chi lay tu doi co nhieu con');
  ok(A.State.chi.get('A1') && A.State.chi.get('A1').id === 'A', 'chat theo chi cua ong noi');
  ok(!A.State.chi.get('T'), 'cu to khong thuoc chi nao');
  ok(!A.State.chi.get('L'), 'nguoi doc dinh khong thuoc chi nao');
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
})();
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

/* Nút Thêm người trên thanh trên cùng chỉ dành cho quản trị */
(function () {
  var btn = env.dom.document.querySelector('#btnAdd');
  var urlCu = A.Api.url;
  A.Api.url = 'https://script.google.com/macros/s/x/exec';

  A.setSession(null);
  A.updateChrome();
  ok(btn.hidden, 'chua dang nhap thi khong thay nut Them nguoi');

  A.setSession({ user: 'bt', name: 'Bien tap', role: 'bien_tap', branches: ['3'] });
  A.updateChrome();
  ok(btn.hidden, 'bien tap cung khong thay nut Them nguoi tren thanh tren cung');

  A.setSession({ user: 'ad', name: 'Quan tri', role: 'quan_tri', branches: [] });
  A.updateChrome();
  ok(!btn.hidden, 'quan tri thay nut Them nguoi');

  // Biên tập vẫn phải thêm được qua màn hình chi tiết
  A.setSession({ user: 'bt', name: 'Bien tap', role: 'bien_tap', branches: ['3'] });
  var host = env.dom.document.querySelector('#modalHost');
  host.innerHTML = '';
  A.openPerson(null);
  ok(!host.firstChild, 'bien tap goi Them nguoi tay khong thi bi chan');

  A.openPerson(null, { father: '3' });
  ok(!!host.firstChild, 'nhung Them con tu mot nguoi trong nhanh thi mo duoc');
  host.innerHTML = '';

  A.openPerson(null, { spouse: ['9'] });
  ok(!!host.firstChild, 'Them vo tu mot nguoi trong nhanh cung mo duoc');
  host.innerHTML = '';

  A.setSession({ user: 'ad', name: 'Quan tri', role: 'quan_tri', branches: [] });
  A.openPerson(null);
  ok(!!host.firstChild, 'quan tri van them nguoi tay khong duoc');
  host.innerHTML = '';

  A.Api.url = urlCu;
  A.setSession(null);
})();

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

/* ---------- 11e. cách phân biệt nam, nữ, đã mất ---------- */
group('11e. Phan biet nam nu da mat');
(function () {
  A.setPeople(A.DEMO.map(A.normalize), 'demo');

  var namSong = A.State.byId.get('7');   // Nguyễn Văn Bình, nam, còn sống
  var nuSong  = A.State.byId.get('4');   // Lê Thị Mai, nữ, còn sống
  var namMat  = A.State.byId.get('1');   // Nguyễn Văn Đại, nam, đã mất
  var nuMat   = A.State.byId.get('2');   // Trần Thị Nhàn, nữ, đã mất

  eq(A.ring(namSong), 'var(--male)', 'nam con song mang mau nam');
  eq(A.ring(nuSong), 'var(--female)', 'nu con song mang mau nu');
  eq(A.ring(namMat), 'var(--male)', 'nam da mat van mang mau nam');
  eq(A.ring(nuMat), 'var(--female)', 'nu da mat van mang mau nu, khong bi nuot mat gioi tinh');
  ok(A.ring(nuMat) !== 'var(--gold)', 'vong quanh anh khong con bi dung de bao da mat');

  eq(A.sexGlyph(namSong), '♂', 'ky hieu nam');
  eq(A.sexGlyph(nuSong), '♀', 'ky hieu nu');
  eq(A.sexGlyph(A.normalize({ id: 'x', name: 'Chua ro' })), '', 'chua khai gioi tinh thi khong ve ky hieu');

  var card = env.dom.document.querySelector('#cards .card[data-id="2"]');
  ok(!!card, 'tim thay the cua nguoi da mat');
  ok(card.classList.contains('gone'), 'the nguoi da mat co lop rieng de doi nen va dai tang');
  var live = env.dom.document.querySelector('#cards .card[data-id="4"]');
  ok(!live.classList.contains('gone'), 'the nguoi con song khong co lop do');

  var av = card.querySelector('.ava');
  ok(!!av, 'the co vung anh dai dien');
  eq(av.style['--ring'], 'var(--female)', 'vung anh nhan mau nu');
  var sex = av.querySelector('.sex');
  ok(!!sex && sex.textContent === '♀', 'co huy hieu gioi tinh tren anh');
  ok(!!av.querySelector('.ph'), 'anh nam trong lop bo trong rieng de bo huy hieu ra ngoai');

  var yr = card.querySelector('.yr');
  ok(!!yr.querySelector('.cross'), 'nam mat co dau chu thap di kem');
  ok(yr.textContent.indexOf('1922') >= 0 && yr.textContent.indexOf('2001') >= 0, 'hien du nam sinh va nam mat');
  ok(!live.querySelector('.yr .cross'), 'nguoi con song khong co dau chu thap');
})();

/* ---------- 11h. màn hình trống và quyền đổi nguồn ---------- */
group('11h. Man hinh trong va quyen doi nguon');
(function () {
  var doc = env.dom.document;
  var urlCu = A.Api.url, sheetCu = A.State.sheetId;

  // Chưa nối nguồn bao giờ
  A.Api.url = ''; A.State.sheetId = ''; A.setSession(null);
  A.setPeople([], 'demo');
  var e = doc.querySelector('#stage .empty');
  ok(!!e, 'co man hinh trong');
  ok(e.textContent.indexOf('Chưa nối nguồn') >= 0, 'noi dung chua noi nguon', e.textContent.slice(0, 60));
  var nut = e.querySelectorAll('button').map(function (x) { return x.textContent; });
  ok(nut.join('|').indexOf('Nối nguồn dữ liệu') >= 0, 'moi nguoi noi nguon duoc khi chua co gi');

  // Đã nối nguồn nhưng lượt tải này không có ai
  A.Api.url = 'https://script.google.com/macros/s/x/exec';
  A.setPeople([], 'script');
  e = doc.querySelector('#stage .empty');
  ok(e.textContent.indexOf('Không nhận được danh sách') >= 0, 'noi dung tai hut, khong doi lai thanh chua cau hinh', e.textContent.slice(0, 60));
  nut = e.querySelectorAll('button').map(function (x) { return x.textContent; });
  ok(nut.indexOf('Thử lại') >= 0, 'co nut thu lai');
  ok(nut.indexOf('Nối nguồn dữ liệu') < 0, 'khong moi nguoi thuong doi nguon nua');
  ok(nut.indexOf('Nguồn dữ liệu') < 0, 'nguoi chua dang nhap khong thay nut nguon du lieu');

  // Quản trị thì vẫn đổi được nguồn
  A.setSession({ user: 'ad', name: 'Quản trị', role: 'quan_tri', branches: [] });
  A.setPeople([], 'script');
  e = doc.querySelector('#stage .empty');
  nut = e.querySelectorAll('button').map(function (x) { return x.textContent; });
  ok(nut.indexOf('Nguồn dữ liệu') >= 0, 'quan tri van doi duoc nguon');

  // Không còn chữ ĐỜI lơ lửng trên màn hình trống
  eq(doc.querySelector('#rails').childNodes.length, 0, 'khong ve thanh phan doi khi chua co ai');

  // Hộp cài đặt: người thường không thấy phần nguồn dữ liệu
  A.setSession(null);
  A.openSetup();
  var mb = doc.querySelector('.modal .mb');
  ok(mb.innerHTML.indexOf('do quản trị đặt sẵn') >= 0 || mb.textContent.indexOf('do quản trị đặt sẵn') >= 0,
     'bao cho nguoi thuong biet nguon do quan tri dat');
  doc.querySelector('#modalHost').innerHTML = '';

  A.setSession({ user: 'ad', name: 'Quản trị', role: 'quan_tri', branches: [] });
  A.openSetup();
  mb = doc.querySelector('.modal .mb');
  ok(mb.textContent.indexOf('do quản trị đặt sẵn') < 0, 'quan tri khong bi chan');
  doc.querySelector('#modalHost').innerHTML = '';

  A.Api.url = urlCu; A.State.sheetId = sheetCu; A.setSession(null);
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
})();

/* ---------- 11g. đường nối cha mẹ tới con ---------- */
group('11g. Duong noi cha me toi con');
function soiDuongNoi(A) {
  var loi = [];
  A.State.pos.forEach(function (pos, id) {
    var p = A.State.byId.get(id);
    if (!p || (!p.father && !p.mother)) return;
    if (pos.spouseOf) return;               // thẻ đứng ở vị trí vợ chồng thì không có đường xuống
    var lk = (A.State.links || []).filter(function (L) { return L.kids.indexOf(id) >= 0; });
    if (lk.length !== 1) { loi.push(p.name + ': co ' + lk.length + ' duong noi'); return; }
    var L = lk[0];
    var cap = [L.anchor, L.spouse].filter(Boolean);
    if (p.father && p.mother) {
      if (cap.indexOf(p.father) < 0 || cap.indexOf(p.mother) < 0) {
        loi.push(p.name + ': noi vao ' + cap.join('+') + ' thay vi ' + p.father + '+' + p.mother);
      }
    } else if (cap.indexOf(p.father || p.mother) < 0) {
      loi.push(p.name + ': noi vao sai nguoi');
    }
    // Hình học: thanh ngang phải chạm được cả điểm rơi cha mẹ lẫn đường lên con
    var eps = 0.01;
    if (L.fromX < L.busLo - eps || L.fromX > L.busHi + eps) {
      loi.push(p.name + ': thanh ngang khong voi toi diem roi cha me');
    }
    var cx = A.State.pos.get(id).x + A.CARD_W / 2;
    if (cx < L.busLo - eps || cx > L.busHi + eps) {
      loi.push(p.name + ': thanh ngang khong voi toi duong len con');
    }
  });
  return loi;
}
(function () {
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
  ok(A.State.links.length > 0, 'co ghi lai cac moi noi');
  var loi = soiDuongNoi(A);
  ok(loi.length === 0, 'moi nguoi con roi dung xuong cap cha me cua minh', loi.slice(0, 3).join(' | '));

  /* Chính là cảnh ông Thể sinh ông Lý: nhà một người con, mà người con đó lại
     có vợ. Điểm rơi của cha mẹ nằm ở khe giữa hai cụ, còn đường lên con nằm ở
     giữa thẻ người con, hai chỗ lệch nhau. Thanh ngang trước đây dài bằng
     không nên cây nhìn như bị đứt làm đôi. */
  var motCon = [
    { id: 'A', name: 'Ông Tổ', gender: 'Nam', spouse: 'B' },
    { id: 'B', name: 'Bà Tổ', gender: 'Nữ', spouse: 'A' },
    { id: 'C', name: 'Con Một', gender: 'Nam', father: 'A', mother: 'B', spouse: 'D' },
    { id: 'D', name: 'Dâu Cả', gender: 'Nữ', spouse: 'C' }
  ];
  A.setPeople(motCon.map(A.normalize), 'demo');
  eq(soiDuongNoi(A), [], 'nha mot con van noi lien mach');
  var L1 = A.State.links.filter(function (L) { return L.kids.indexOf('C') >= 0; })[0];
  ok(!!L1, 'tim thay duong noi toi nguoi con');
  ok(L1.busHi - L1.busLo > 1, 'thanh ngang co do dai that su', 'dai ' + (L1.busHi - L1.busLo));
  ok(L1.busLo <= L1.fromX && L1.fromX <= L1.busHi, 'thanh ngang cham diem roi cua cha me');
  ok(L1.busLo <= L1.kidX[0] && L1.kidX[0] <= L1.busHi, 'thanh ngang cham duong len con');
  ok(Math.abs(L1.fromX - L1.kidX[0]) > 1, 'hai dau that su lech nhau, dung canh gay loi truoc day');

  // Nhà một con mà người con chưa có vợ: hai đầu trùng nhau, vẫn phải liền
  var motConDoc = [
    { id: 'A', name: 'Ông Tổ', gender: 'Nam', spouse: 'B' },
    { id: 'B', name: 'Bà Tổ', gender: 'Nữ', spouse: 'A' },
    { id: 'C', name: 'Con Một', gender: 'Nam', father: 'A', mother: 'B' }
  ];
  A.setPeople(motConDoc.map(A.normalize), 'demo');
  eq(soiDuongNoi(A), [], 'hai dau trung nhau van tinh la lien mach');

  // Cha mẹ một con nhưng không khai vợ chồng: điểm rơi ngay giữa thẻ cha
  var moCoi = [
    { id: 'A', name: 'Ông Một Mình', gender: 'Nam' },
    { id: 'C', name: 'Con', gender: 'Nam', father: 'A' }
  ];
  A.setPeople(moCoi.map(A.normalize), 'demo');
  eq(soiDuongNoi(A), [], 'cha don than mot con van noi lien mach');

  // Ông có hai vợ, con riêng mỗi bên phải rơi xuống đúng khe của cặp mình
  var ds = [
    { id: 'A', name: 'Ông Cả', gender: 'Nam', spouse: 'B,C' },
    { id: 'B', name: 'Vợ Cả', gender: 'Nữ', spouse: 'A' },
    { id: 'C', name: 'Vợ Hai', gender: 'Nữ', spouse: 'A' },
    { id: 'D', name: 'Con Bà Cả', gender: 'Nam', father: 'A', mother: 'B' },
    { id: 'E', name: 'Con Bà Hai', gender: 'Nữ', father: 'A', mother: 'C' },
    { id: 'F', name: 'Con Bà Hai Nữa', gender: 'Nam', father: 'A', mother: 'C' }
  ];
  A.setPeople(ds.map(A.normalize), 'demo');
  eq(soiDuongNoi(A), [], 'hai ba vo thi con ai ve nha nay');

  var lD = A.State.links.filter(function (L) { return L.kids.indexOf('D') >= 0; })[0];
  var lE = A.State.links.filter(function (L) { return L.kids.indexOf('E') >= 0; })[0];
  eq(lD.spouse, 'B', 'con ba ca treo duoi cap A va B');
  eq(lE.spouse, 'C', 'con ba hai treo duoi cap A va C');
  ok(lE.kids.indexOf('F') >= 0, 'hai con cung me nam chung mot duong');
  ok(lD.fromX < lE.fromX, 'diem roi cua ba ca nam ben trai diem roi cua ba hai');

  // Điểm rơi phải nằm trong khe giữa hai thẻ, không cắt ngang thẻ nào
  [lD, lE].forEach(function (L, i) {
    var xs = [];
    A.State.pos.forEach(function (pos, id) { if (pos.y === 0) xs.push({ id: id, x: pos.x }); });
    var deLen = xs.some(function (o) { return L.fromX > o.x + 2 && L.fromX < o.x + A.CARD_W - 2; });
    ok(!deLen, 'diem roi thu ' + (i + 1) + ' nam trong khe, khong cat ngang the nao');
  });

  A.setPeople(A.DEMO.map(A.normalize), 'demo');
})();

/* ---------- 11d. xuất bản in ---------- */
group('11d. Xuat ban in va PDF');
(function () {
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
  var full = A.State.people.length;
  var doc = env.dom.document;

  noThrow(function () { A.openPrint(); }, 'mo duoc hop xuat PDF');

  // Cây, một trang lớn
  var r = A.setupPrint({ kind: 'tree', fit: 'one' });
  eq(r.kind, 'tree', 'in cay');
  ok(r.wmm > 0 && r.hmm > 0, 'tinh ra kho trang', r.wmm + 'x' + r.hmm + 'mm');
  ok(r.wmm <= 4800 && r.hmm <= 4800, 'kho trang khong vuot gioi han cua tep PDF');
  ok(!!doc.querySelector('#printHead'), 'co khoi tieu de ban in');
  ok(!doc.querySelector('#printList'), 'in cay thi khong kem ban ke');
  ok(!doc.querySelector('#printTable'), 'in cay thi khong kem bang');
  ok(doc.body.classList.contains('print-tree'), 'danh dau che do in cay');
  var css = doc.querySelector('#printPage');
  ok(!!css && /@page\{size:[\d.]+mm [\d.]+mm/.test(css.textContent), 'dat kho trang bang @page', css && css.textContent);
  A.teardownPrint();

  ok(!doc.querySelector('#printHead'), 'don sach khoi tieu de sau khi in');
  ok(!doc.querySelector('#printPage'), 'don sach kho trang sau khi in');
  ok(!doc.body.classList.contains('print-tree'), 'go danh dau che do in');
  eq(A.State.people.length, full, 'so nguoi tro lai nhu cu sau khi in');

  // Bản kê luôn là A4 dọc, đây là chỗ trước đây bảng bị kéo giãn theo bề rộng cây
  var L = A.setupPrint({ kind: 'list', note: true });
  eq([L.wmm, L.hmm], [210, 297], 'ban ke luon A4 doc du cay rong bao nhieu');
  ok(!!doc.querySelector('#printList'), 'co ban ke');
  ok(doc.body.classList.contains('print-list'), 'danh dau che do in ban ke');
  var pl = doc.querySelector('#printList').innerHTML;
  ok(/Đời thứ I\b/.test(pl), 'ban ke chia theo doi');
  ok(pl.indexOf('Nguyễn Văn Đại') >= 0, 'co ten nguoi trong ban ke');
  ok(/Con ông|Con bà/.test(pl), 'co dong cha me');
  ok(pl.indexOf('Con:') >= 0, 'co dong liet ke cac con');
  ok(pl.indexOf('Người khai lập chi họ tại Duy Tiên') >= 0, 'ghi chu duoc dua vao ban ke');
  A.teardownPrint();

  var L2 = A.setupPrint({ kind: 'list', note: false });
  ok(doc.querySelector('#printList').innerHTML.indexOf('Người khai lập chi họ tại Duy Tiên') < 0,
     'bo ghi chu khi khong chon');
  A.teardownPrint();

  // Vừa một khổ giấy thì phải thu nhỏ lại
  var one = A.setupPrint({ kind: 'tree', fit: 'one' }); A.teardownPrint();
  var a4 = A.setupPrint({ kind: 'tree', fit: 'fit', paper: 'a4' }); A.teardownPrint();
  var a3 = A.setupPrint({ kind: 'tree', fit: 'fit', paper: 'a3' }); A.teardownPrint();
  ok(a4.k < one.k, 'kho A4 thu nho hon so voi trang lon');
  ok(a3.k > a4.k, 'kho A3 cho phep to hon A4');
  eq([a4.wmm, a4.hmm], [297, 210], 'A4 nam ngang');
  eq([a3.wmm, a3.hmm], [420, 297], 'A3 nam ngang');

  // In riêng một chi
  ok(A.State.chiList.some(function (c) { return c.id === '3'; }), 'tim thay chi ong Hung');
  A.setupPrint({ kind: 'tree', fit: 'one', branch: '3' });
  ok(A.State.people.length < full, 'in mot chi thi cay nho lai', A.State.people.length + '/' + full);
  ok(A.State.byId.has('9') && A.State.byId.has('16'), 'con chau trong chi van co mat');
  ok(!A.State.byId.has('13'), 'nguoi chi khac khong lot vao');
  ok(!A.State.byId.has('1'), 'thuy to o tren khong lot vao');
  A.teardownPrint();

  // Quan trọng: lọc theo chi không được cắt mất quan hệ thật
  eq(A.State.people.length, full, 'ca dong ho tro lai day du');
  eq(A.State.byId.get('3').father, '1', 'ma cha cua goc chi khong bi xoa mat');
  eq(A.State.byId.get('9').father, '3', 'quan he trong chi con nguyen');
  ok(A.State.pos.size === full, 've lai duoc ca cay sau khi in');

  // Chọn cả hai thì in cây trước, xếp bản kê vào hàng chờ cho lượt in sau
  A.Print.next = null;
  A.setupPrint({ kind: 'tree', fit: 'one' });
  A.Print.next = { kind: 'list', note: true };
  ok(A.Print.next.kind === 'list', 'xep ban ke vao hang cho');
  A.teardownPrint();
  var L3 = A.setupPrint(A.Print.next);
  eq([L3.wmm, L3.hmm], [210, 297], 'luot in thu hai la ban ke A4 doc');
  A.teardownPrint();
  A.Print.next = null;

  // Nhánh đang gập trên màn hình vẫn phải in ra đầy đủ
  A.State.collapsed = new Set(['3']);
  A.redrawTree();
  ok(A.State.pos.size < full, 'tren man hinh dang gap bot');
  A.setupPrint({ kind: 'tree', fit: 'one' });
  eq(A.State.pos.size, full, 'ban in mo het nhanh');
  A.teardownPrint();
  eq(A.State.collapsed.size, 1, 'sau khi in tra lai dung nhanh dang gap');
  A.unfoldAll();
})();

/* ---------- 11f. gập nhánh ---------- */
group('11f. Gap nhanh tren cay ngang');
(function () {
  A.State.didAutoFit = true;          // tắt gập tự động để kiểm thủ công
  A.unfoldAll();
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
  var full = A.State.people.length;
  eq(A.State.pos.size, full, 'mo het thi ca 19 nguoi deu co cho');
  var rongMo = A.State.bbox.w;

  // Ông Hùng có con 9 và 11, cháu 16, 17, 18. Dâu rể về nhánh: 10 và 12.
  eq(A.countDesc('3'), 5, 'dem dung 5 nguoi huyet thong duoi ong Hung');
  eq(A.countHidden('3'), 7, 'gap nhanh thi an ca dau re, thanh 7 nguoi');
  eq(A.countDesc('16'), 0, 'nguoi khong co con thi dem bang khong');

  A.toggleFold('3');
  ok(A.isFolded('3'), 'da gap nhanh ong Hung');
  eq(A.State.pos.size, full - 7, 'sau khi gap thi an dung 7 nguoi');
  ok(A.State.bbox.w < rongMo, 'cay hep lai that su chu khong chi mo di', rongMo + ' -> ' + A.State.bbox.w);
  ok(!A.State.pos.has('9'), 'con trong nhanh bi an');
  ok(!A.State.pos.has('16'), 'chau trong nhanh bi an');
  ok(A.State.pos.has('3'), 'nguoi bi gap van hien');
  ok(A.State.pos.has('13'), 'nhanh khac khong bi anh huong');

  // Người bị ẩn không được biến thành một cây riêng đứng cạnh
  eq(A.State.blocks.length, 1, 'van chi co mot goc cay');

  var card = env.dom.document.querySelector('#cards .card[data-id="3"]');
  var fold = card && card.querySelector('.fold');
  ok(!!fold, 'the co nut gap');
  ok(fold.textContent.indexOf('7') >= 0, 'nut hien so nguoi dang an', fold.textContent);
  ok(fold.classList.contains('on'), 'nut sang khi dang gap');

  // Chọn một người đang bị ẩn thì phải tự mở đường xuống
  A.select('16', true);
  ok(!A.isFolded('3'), 'chon nguoi bi an thi tu mo nhanh cha ong');
  ok(A.State.pos.has('16'), 'nguoi do hien ra');
  eq(A.State.pos.size, full, 'ca cay tro lai day du');

  // Mở nhánh chỉ mở đúng một đời kế tiếp
  A.unfoldAll();
  A.State.collapsed = new Set(['1']);      // gập ngay ở thuỷ tổ
  A.redrawTree();
  eq(A.State.pos.size, 2, 'gap thuy to thi chi con hai cu');

  A.toggleFold('1');
  ok(A.State.pos.has('3') && A.State.pos.has('5') && A.State.pos.has('7'), 'mo ra thay doi con');
  ok(!A.State.pos.has('9') && !A.State.pos.has('16'), 'chua thay doi chau va doi chat');
  ok(A.State.collapsed.has('3') && A.State.collapsed.has('5') && A.State.collapsed.has('7'),
     'nhung nguoi con co con lai duoc gap san');
  ok(!A.State.collapsed.has('1'), 'thuy to da mo');

  A.toggleFold('3');
  ok(A.State.pos.has('9') && A.State.pos.has('11'), 'mo tiep mot doi nua');
  ok(!A.State.pos.has('16'), 'van chua toi doi chat');

  // Bấm gập hay mở thì chỗ đang nhìn phải đứng yên
  A.unfoldAll();
  // Đặt thẻ nằm gọn giữa khung nhìn, để phép kéo vào tầm mắt không xen vào
  A.State.t = { x: -500, y: 0, k: 0.8 };
  var truoc = A.State.pos.get('3');
  var manTruoc = { x: truoc.x * 0.8 - 500, y: truoc.y * 0.8 };
  A.toggleFold('3');
  var sau = A.State.pos.get('3');
  var manSau = { x: sau.x * A.State.t.k + A.State.t.x, y: sau.y * A.State.t.k + A.State.t.y };
  ok(Math.abs(manSau.x - manTruoc.x) < 0.01, 'the vua bam khong xe ngang',
     manTruoc.x.toFixed(1) + ' -> ' + manSau.x.toFixed(1));
  ok(Math.abs(manSau.y - manTruoc.y) < 0.01, 'the vua bam khong xe doc',
     manTruoc.y.toFixed(1) + ' -> ' + manSau.y.toFixed(1));
  ok(sau.x !== truoc.x, 'bo cuc that su co tinh lai, khong phai khong doi gi');

  // Mở ra ở gần đáy màn hình thì kéo lên cho thấy đời kế tiếp
  A.unfoldAll();
  A.State.collapsed = new Set(['3']);
  A.redrawTree();
  var pos3 = A.State.pos.get('3');
  A.State.t = { x: 0, y: 880 - pos3.y * 0.8, k: 0.8 };   // đẩy thẻ xuống sát đáy
  A.toggleFold('3');
  var p3 = A.State.pos.get('3');
  var duoi = (p3.y + A.ROW + A.CARD_H) * A.State.t.k + A.State.t.y;
  ok(duoi <= 900 - 15, 'doi ke tiep duoc keo vao trong khung nhin', 'day o ' + duoi.toFixed(0));
  ok(p3.y * A.State.t.k + A.State.t.y >= 15, 'the vua bam van con trong khung nhin');

  A.unfoldAll();
  A.State.t = { x: 0, y: 0, k: 1 };

  // Gập tự động khi cây quá rộng
  A.State.didAutoFit = false;
  A.unfoldAll();
  var d = A.autoFit(600);            // ép ngưỡng thật hẹp
  ok(d > 0, 'nhan ra cay qua rong va gap bot', 'gap tu doi ' + d);
  ok(A.State.collapsed.size > 0, 'co nhanh bi gap');
  ok(A.State.bbox.w <= 600 || d === 1, 'gap toi khi vua nguong');

  A.State.didAutoFit = true;
  A.unfoldAll();
  eq(A.State.collapsed.size, 0, 'mo het thi khong con nhanh nao bi gap');
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
})();

/* ---------- 11c. lọc danh sách cha, mẹ, vợ chồng ---------- */
group('11c. Loc danh sach cha me vo chong');
(function () {
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
  var ids = function (l) { return l.map(function (q) { return q.id; }); };
  var all = function (c) { return ids(c.pair || []).concat(ids(c.fit), ids(c.other)); };

  // Nguyễn Văn Trọng, sinh 1972, nam. Cha thật là số 3 sinh 1945.
  var ctx = { selfId: '9', year: 1972, gender: 'Nam', exclude: [] };

  var f = A.relCandidates('father', ctx);
  ok(ids(f.fit).indexOf('3') >= 0, 'cha that nam trong nhom phu hop');
  ok(all(f).indexOf('9') < 0, 'khong tu lam cha cua chinh minh');
  ok(all(f).indexOf('16') < 0, 'con chau bi loai han khoi o cha, tranh vong lap');
  ok(ids(f.fit).indexOf('4') < 0, 'nguoi nu khong nam trong nhom phu hop cua o cha');
  ok(ids(f.other).indexOf('4') >= 0, 'nguoi nu van chon duoc, nam o nhom it kha nang');
  ok(ids(f.fit).indexOf('14') < 0, 'nguoi sinh 1982 khong the la cha nguoi sinh 1972');
  ok(ids(f.other).indexOf('14') >= 0, 'nguoi sinh sau van chon duoc neu thuc su can');
  eq(f.fit[0] && f.fit[0].id, '7', 'nguoi sinh gan nhat ma van du tuoi thi len dau');

  var m = A.relCandidates('mother', ctx);
  ok(ids(m.fit).indexOf('4') >= 0, 'me that nam trong nhom phu hop');
  ok(ids(m.fit).indexOf('3') < 0, 'nguoi nam khong nam trong nhom phu hop cua o me');

  var s = A.relCandidates('spouse', ctx);
  ok(ids(s.fit).indexOf('10') >= 0, 'vo that nam trong nhom phu hop');
  ok(all(s).indexOf('3') < 0, 'khong the lay cha minh');
  ok(all(s).indexOf('16') < 0, 'khong the lay con minh');
  ok(all(s).indexOf('11') < 0, 'khong the lay em ruot');
  ok(ids(s.fit).indexOf('8') >= 0, 'nguoi nu khong cung huyet thong, chenh 14 tuoi, van duoc coi la phu hop');
  ok(ids(s.other).indexOf('7') >= 0, 'nguoi cung gioi tinh bi day xuong nhom it kha nang');
  ok(ids(s.fit).indexOf('2') < 0, 'cu ba sinh 1922 chenh 50 tuoi thi khong con phu hop');

  var s2 = A.relCandidates('spouse', { selfId: '9', year: 1972, gender: 'Nam', exclude: ['10'] });
  ok(all(s2).indexOf('10') < 0, 'nguoi da chon lam vo thi khong hien lai trong danh sach');

  // Đúng tình huống trong ảnh chụp: cha sinh sau con
  var young = A.relCandidates('father', { selfId: '', year: 1986, gender: 'Nam', exclude: [] });
  var late = A.State.people.filter(function (q) { return q.bd && q.bd.y > 1974; }).map(function (q) { return q.id; });
  var leaked = late.filter(function (id) { return ids(young.fit).indexOf(id) >= 0; });
  ok(leaked.length === 0, 'khong ai sinh sau 1974 loi vao nhom cha phu hop cua nguoi sinh 1986', leaked.join(','));

  // Đã chọn cha thì các bà vợ của ông ấy được tách lên nhóm riêng
  var kemCha = A.relCandidates('mother', { selfId: '', year: 1972, gender: '', exclude: [], pairWith: '3' });
  eq(ids(kemCha.pair), ['4'], 'chi co vo cua ong Hung nam trong nhom rieng');
  ok(/^Vợ của /.test(kemCha.pairLabel), 'nhan nhom noi ro la vo cua ai', kemCha.pairLabel);
  ok(ids(kemCha.fit).indexOf('4') < 0, 'khong lap lai o nhom phu hop');
  ok(all(kemCha).indexOf('4') >= 0, 'van con trong danh sach');

  var kemMe = A.relCandidates('father', { selfId: '', year: 1972, gender: '', exclude: [], pairWith: '4' });
  eq(ids(kemMe.pair), ['3'], 'chieu nguoc lai cung vay');
  ok(/^Chồng của /.test(kemMe.pairLabel), 'nhan doi thanh chong cua ai', kemMe.pairLabel);

  var khongCap = A.relCandidates('mother', { selfId: '', year: 1972, gender: '', exclude: [] });
  eq(khongCap.pair, [], 'chua chon cha thi khong co nhom rieng');
  eq(khongCap.pairLabel, '', 'va khong co nhan nhom');

  // Người không khai vợ chồng thì đừng dựng nhóm rỗng
  var trong = A.relCandidates('mother', { selfId: '', year: 0, gender: '', exclude: [], pairWith: '6' });
  ok(trong.pair.length <= 1, 'nguoi it vo chong thi nhom rieng ngan hoac khong co');

  // Không biết năm sinh thì không loại ai theo tuổi
  var noYear = A.relCandidates('father', { selfId: '', year: 0, gender: '', exclude: [] });
  var nam = A.State.people.filter(function (q) { return q.gender !== 'Nữ'; }).length;
  eq(ids(noYear.fit).length, nam, 'chua khai nam sinh thi moi nguoi nam deu duoc coi la phu hop');
})();

/* ---------- 11j. nạp lại không làm mất chỗ đang xem ---------- */
group('11j. Nap lai giu nguyen cho dang xem');
(function () {
  A.State.didAutoFit = true;
  A.unfoldAll();
  A.setPeople(A.DEMO.map(A.normalize), 'demo');

  // Người dùng đã kéo tới một chỗ nào đó
  A.State.t = { x: -640, y: -180, k: 0.9 };
  var neo = '9';
  var truoc = A.State.pos.get(neo);
  var man = { x: truoc.x * 0.9 - 640, y: truoc.y * 0.9 - 180 };

  // Nạp lại đúng danh sách đó, có neo
  A.setPeople(A.DEMO.map(A.normalize), 'demo', neo);
  var sau = A.State.pos.get(neo);
  var manSau = { x: sau.x * A.State.t.k + A.State.t.x, y: sau.y * A.State.t.k + A.State.t.y };
  ok(Math.abs(manSau.x - man.x) < 0.01, 'nguoi vua sua khong xe ngang sau khi nap lai');
  ok(Math.abs(manSau.y - man.y) < 0.01, 'khong xe doc');
  eq(A.State.t.k, 0.9, 'giu nguyen muc thu phong');

  // Thêm một người mới vào rồi nạp lại: cây dài ra nhưng chỗ neo vẫn đứng yên
  var them = A.DEMO.concat([{ id: 'X9', name: 'Cháu Mới', gender: 'Nam', father: '16' }]);
  A.setPeople(them.map(A.normalize), 'demo', neo);
  var sau2 = A.State.pos.get(neo);
  var manSau2 = { x: sau2.x * A.State.t.k + A.State.t.x, y: sau2.y * A.State.t.k + A.State.t.y };
  ok(Math.abs(manSau2.x - man.x) < 0.01, 'them nguoi moi cung khong lam xe cho neo',
     man.x.toFixed(1) + ' -> ' + manSau2.x.toFixed(1));
  ok(A.State.pos.has('X9'), 'nguoi moi da co mat');
  ok(A.State.people.length === 20, 'danh sach dai ra that su');

  // Không truyền neo thì khung nhìn cũng không tự nhảy về gốc nữa
  A.State.t = { x: -300, y: -100, k: 0.7 };
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
  eq([A.State.t.x, A.State.t.y, A.State.t.k], [-300, -100, 0.7], 'khong neo thi giu nguyen khung nhin');

  // Lần mở đầu tiên vẫn phải tự căn khung
  A.State.didAutoFit = false;
  A.State.t = { x: -300, y: -100, k: 0.7 };
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
  ok(A.State.t.x !== -300 || A.State.t.y !== -100, 'lan dau mo van tu can khung nhin');

  A.State.didAutoFit = true;
  A.unfoldAll();
  A.State.t = { x: 0, y: 0, k: 1 };
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
})();

/* ---------- 11i. ô chọn người có tìm kiếm ---------- */
group('11i. O chon nguoi co tim kiem');
(function () {
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
  var ctx = { selfId: '', year: 1972, gender: '', exclude: [] };
  var pk = A.personPicker('father', function () { return ctx; }, '');

  ok(!!pk.el && !!pk.el.querySelector('.pick-in'), 'co o go de tim');
  eq(pk.value, '', 'ban dau chua chon ai');

  var inp = pk.el.querySelector('.pick-in');
  var list = pk.el.querySelector('.pick-list');
  ok(list.hidden, 'danh sach dong luc dau');

  inp.onfocus();
  ok(!list.hidden, 'bam vao thi mo danh sach');
  var soTatCa = list.querySelectorAll('.pick-i').length;
  ok(soTatCa > 5, 'co nhieu nguoi de chon', 'thay ' + soTatCa);

  // Gõ không dấu vẫn ra
  inp.value = 'trong'; inp.oninput();
  var ten = list.querySelectorAll('.pick-i .pi-n').map(function (x) { return x.textContent; });
  ok(ten.length > 0 && ten.length < soTatCa, 'go vao thi loc bot', ten.length + '/' + soTatCa);
  ok(ten.join('|').indexOf('Nguyễn Văn Trọng') >= 0, 'go khong dau van tim ra ten co dau');

  inp.value = 'hung'; inp.oninput();
  ten = list.querySelectorAll('.pick-i .pi-n').map(function (x) { return x.textContent; });
  eq(ten, ['Nguyễn Văn Hùng'], 'loc dung mot nguoi');

  // Chọn bằng chuột
  list.querySelectorAll('.pick-i')[0].onclick();
  eq(pk.value, '3', 'bam vao thi nhan dung ma nguoi');
  ok(inp.value.indexOf('Nguyễn Văn Hùng') >= 0, 'o hien ten nguoi da chon');
  ok(pk.el.classList.contains('co'), 'danh dau la da chon');

  // Nút xoá
  pk.el.querySelector('.pick-x').onclick();
  eq(pk.value, '', 'bam dau nhan thi bo chon');

  // Gõ không khớp ai
  inp.onfocus(); inp.value = 'zzzz'; inp.oninput();
  eq(list.querySelectorAll('.pick-i').length, 0, 'khong ai khop thi khong co muc nao');
  ok(!!list.querySelector('.pick-empty'), 'bao khong tim thay');

  // Đặt giá trị từ bên ngoài, dùng khi tự điền bạn đời
  pk.value = '9';
  eq(pk.value, '9', 'dat duoc gia tri tu ben ngoai');
  ok(pk.el.querySelector('.pick-in').value.indexOf('Nguyễn Văn Trọng') >= 0, 'va hien dung ten');

  // Giữ lại người đang chọn kể cả khi họ không còn hợp lý
  var pk2 = A.personPicker('father', function () { return { selfId: '', year: 1900, gender: '', exclude: [] }; }, '16');
  pk2.el.querySelector('.pick-in').onfocus();
  var maCon = pk2.el.querySelectorAll('.pick-i').map(function (x) { return x.dataset.id; });
  ok(maCon.indexOf('16') >= 0, 'nguoi dang chon van con trong danh sach du sinh sau ca tram nam');
})();

/* ---------- 11a. tệp CSV mẫu ---------- */
group('11a. Tep mau-gia-pha.csv');
(function () {
  var p = path.join(ROOT, 'mau-gia-pha.csv');
  var raw = fs.readFileSync(p);
  ok(raw[0] === 0xEF && raw[1] === 0xBB && raw[2] === 0xBF,
     'co dau nhan dang UTF-8 o dau tep de Excel khong doan nham bang ma',
     'byte dau: ' + raw.slice(0, 3).toString('hex'));

  var txt = raw.toString('utf8');
  var rows = A.parseCSV(txt);
  eq(rows[0][0], 'id', 'dau nhan dang bi cat bo khi doc, cot dau van la id');
  eq(rows[0].length, 15, 'du 15 cot');

  var ps = A.rowsToPeople(rows);
  eq(ps.length, 10, 'doc duoc 10 nguoi mau');
  eq(ps[0].name, 'Nguyễn Văn Đại', 'dau tieng Viet doc ra dung');
  eq(rows[0][12], 'noi_sinh', 'cot thu 13 doi ten thanh noi_sinh');
  eq(ps[0].origin, 'Duy Tiên - Hà Nam', 'noi sinh co dau doc ra dung');
  eq(ps[0].role, 'Thuỷ tổ', 'vai tro co dau doc ra dung');

  // Không được lẫn ký tự thay thế của bảng mã hỏng
  ok(txt.indexOf('�') < 0, 'khong co ky tu hong trong tep');

  // Dựng thử cây từ chính tệp mẫu
  noThrow(function () { A.setPeople(ps, 'local'); }, 'dung duoc cay tu tep mau');
  eq(A.State.pos.size, 10, 'ca 10 nguoi trong tep mau deu co cho');
  A.setPeople(A.DEMO.map(A.normalize), 'demo');
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
