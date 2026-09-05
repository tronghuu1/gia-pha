/**
 * Kiểm thử apps-script.gs, phần giữ quyền thật sự của hệ thống.
 *
 * Chạy:  node test/run-tests-server.js
 * Gọi thẳng doPost như trình duyệt vẫn gọi, nên kiểm được cả luồng đăng nhập,
 * ghi dữ liệu và ranh giới nhánh chứ không chỉ từng hàm rời rạc.
 */

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var makeStubs = require('./gas-stubs.js').makeStubs;

var ROOT = path.join(__dirname, '..');

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
function eq(a, b, label) {
  var x = JSON.stringify(a), y = JSON.stringify(b);
  ok(x === y, label, x === y ? '' : 'nhan ' + x + ', cho doi ' + y);
}

/* ================== nạp script ================== */
var src = fs.readFileSync(path.join(ROOT, 'apps-script.gs'), 'utf8');
var stubs = makeStubs();
var sandbox = Object.assign({ console: console }, stubs);
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'apps-script.gs' });
var S = sandbox;

console.log('KIEM THU CONG GHI APPS SCRIPT');
console.log('  nap script: OK (' + src.split('\n').length + ' dong)');

/* Mỗi lượt gọi trong Apps Script là một lần chạy mới, bộ nhớ đệm bảng không
   sống qua lượt. Mô phỏng lại đúng như vậy. */
function post(body) {
  S._sheetCache = {};
  var res = S.doPost({ postData: { contents: JSON.stringify(body) } });
  return JSON.parse(res.getContent());
}

/* ================== 1. lập tài khoản đầu tiên ================== */
group('1. Lap tai khoan quan tri dau tien');
(function () {
  var st = post({ action: 'auth_state' });
  ok(st.ok === true && st.needsSetup === true, 'bang trong thi bao chua co tai khoan');

  var bad = post({ action: 'init_admin', user: 'ad', pass: '123456', name: 'A' });
  ok(bad.ok === false && /3 ký tự/.test(bad.error), 'chan ten dang nhap qua ngan', bad.error);

  var bad2 = post({ action: 'init_admin', user: 'admin', pass: '123', name: 'A' });
  ok(bad2.ok === false && /6 ký tự/.test(bad2.error), 'chan mat khau qua ngan', bad2.error);

  var r = post({ action: 'init_admin', user: 'ADMIN', pass: 'matkhau123', name: 'Nguyễn Trọng' });
  ok(r.ok === true && !!r.token, 'lap duoc tai khoan quan tri');
  eq(r.account.user, 'admin', 'ten dang nhap chuyen ve chu thuong');
  eq(r.account.role, 'quan_tri', 'tai khoan dau tien la quan tri');

  var again = post({ action: 'init_admin', user: 'admin2', pass: 'matkhau123' });
  ok(again.ok === false && /Đã có tài khoản/.test(again.error), 'khong lap quan tri lan hai');

  var st2 = post({ action: 'auth_state' });
  ok(st2.needsSetup === false, 'sau khi lap thi khong con bao thieu tai khoan');
})();

/* ================== 2. đăng nhập ================== */
group('2. Dang nhap');
var adminToken = '';
(function () {
  var wrong = post({ action: 'login', user: 'admin', pass: 'sai' });
  ok(wrong.ok === false && /Sai tên đăng nhập hoặc mật khẩu/.test(wrong.error), 'sai mat khau bi tu choi');

  var nouser = post({ action: 'login', user: 'khongco', pass: 'matkhau123' });
  ok(nouser.ok === false && /Sai tên đăng nhập hoặc mật khẩu/.test(nouser.error),
     'khong tiet lo tai khoan co ton tai hay khong');

  var r = post({ action: 'login', user: 'Admin', pass: 'matkhau123' });
  ok(r.ok === true && !!r.token, 'dang nhap dung thi nhan duoc the');
  adminToken = r.token;

  var me = post({ action: 'me', token: adminToken });
  ok(me.ok === true && me.account.user === 'admin', 'the dung thi doc duoc thong tin tai khoan');

  var tampered = adminToken.slice(0, -3) + 'aaa';
  var bad = post({ action: 'me', token: tampered });
  ok(bad.ok === false, 'the bi sua chu ky thi bi tu choi');

  var fake = Buffer.from('admin|' + (Date.now() + 99999999)).toString('base64') + '.giachukybaday';
  ok(post({ action: 'me', token: fake }).ok === false, 'the tu che khong co chu ky dung thi bi tu choi');
})();

/* ================== 3. thẻ hết hạn ================== */
group('3. The dang nhap het han');
(function () {
  var keep = S.TOKEN_DAYS;
  S.TOKEN_DAYS = -1;
  var expired = S.makeToken_('admin');
  S.TOKEN_DAYS = keep;
  ok(S.verifyToken_(expired) === null, 'the qua han bi tu choi');
  ok(S.verifyToken_(S.makeToken_('admin')) !== null, 'the con han duoc chap nhan');
})();

/* ================== 4. nạp dữ liệu gia phả ================== */
group('4. Ghi du lieu va noi vo chong');
var FAMILY = [
  { id: '1',  name: 'Nguyễn Văn Đại',  gender: 'Nam', birth: '1918', death: '12/03/1996', spouse: '2' },
  { id: '2',  name: 'Trần Thị Nhàn',   gender: 'Nữ',  birth: '1922', spouse: '1' },
  { id: '3',  name: 'Nguyễn Văn Hùng', gender: 'Nam', birth: '1945', father: '1', mother: '2', spouse: '4' },
  { id: '4',  name: 'Lê Thị Mai',      gender: 'Nữ',  birth: '1948', spouse: '3' },
  { id: '5',  name: 'Nguyễn Thị Lan',  gender: 'Nữ',  birth: '1950', father: '1', mother: '2', spouse: '6' },
  { id: '6',  name: 'Phạm Văn Tú',     gender: 'Nam', birth: '1946', spouse: '5' },
  { id: '9',  name: 'Nguyễn Văn Trọng', gender: 'Nam', birth: '1972', father: '3', mother: '4', spouse: '10' },
  { id: '10', name: 'Vũ Thị Hoa',      gender: 'Nữ',  birth: '1975', spouse: '9' },
  { id: '13', name: 'Phạm Thị Ngọc',   gender: 'Nữ',  birth: '1974', father: '6', mother: '5' }
];
(function () {
  var bad = 0;
  FAMILY.forEach(function (p) {
    var r = post({ action: 'save', token: adminToken, person: p });
    if (!r.ok) bad++;
  });
  ok(bad === 0, 'quan tri ghi duoc ca ' + FAMILY.length + ' nguoi');

  var list = post({ action: 'list' });
  ok(list.ok === true && list.rows.length === FAMILY.length, 'doc lai du so nguoi');
  ok(list.needsSetup === false, 'lenh list tra luon tinh trang tai khoan');
  ok(list.account === null, 'khong gui the thi khong co thong tin tai khoan');

  var withTok = post({ action: 'list', token: adminToken });
  ok(withTok.account && withTok.account.role === 'quan_tri', 'gui the thi tra ve tai khoan kem theo');

  // Ghi một chiều rồi kiểm tra đầu kia có được nối lại không
  post({ action: 'save', token: adminToken, person: { id: '20', name: 'Người mới', spouse: '9' } });
  var rows = post({ action: 'list' }).rows;
  var p9 = rows.filter(function (r) { return r.id === '9'; })[0];
  ok(String(p9.spouse).split(',').indexOf('20') >= 0, 'khai vo chong mot chieu thi dau kia duoc noi lai');

  post({ action: 'save', token: adminToken, person: { id: '20', name: 'Người mới', spouse: '' } });
  rows = post({ action: 'list' }).rows;
  p9 = rows.filter(function (r) { return r.id === '9'; })[0];
  ok(String(p9.spouse).split(',').indexOf('20') < 0, 'bo vo chong thi dau kia cung duoc go');

  var del = post({ action: 'delete', token: adminToken, id: '20' });
  ok(del.ok === true, 'xoa duoc nguoi vua them');
  ok(post({ action: 'list' }).rows.length === FAMILY.length, 'so nguoi tro ve nhu cu sau khi xoa');
})();

/* ================== 5. ranh giới nhánh ================== */
group('5. Ranh gioi nhanh phia may chu');
var bienTapToken = '';
(function () {
  var mk = post({
    action: 'account_save', token: adminToken,
    account: { user: 'trongnt', name: 'Trọng', pass: 'matkhau123', role: 'bien_tap', branches: ['3'], status: 'hoat_dong' }
  });
  ok(mk.ok === true, 'quan tri tao duoc tai khoan bien tap');
  eq(mk.account.branches, ['3'], 'nhanh duoc giao luu dung');

  var lg = post({ action: 'login', user: 'trongnt', pass: 'matkhau123' });
  ok(lg.ok === true, 'tai khoan bien tap dang nhap duoc');
  bienTapToken = lg.token;

  function save(person) { return post({ action: 'save', token: bienTapToken, person: person }); }

  ok(save({ id: '3', name: 'Nguyễn Văn Hùng', gender: 'Nam', birth: '1945', father: '1', mother: '2', spouse: '4' }).ok === true,
     'sua duoc chinh goc nhanh');
  ok(save({ id: '4', name: 'Lê Thị Mai', gender: 'Nữ', birth: '1948', spouse: '3' }).ok === true,
     'sua duoc vo cua goc nhanh');
  ok(save({ id: '9', name: 'Nguyễn Văn Trọng', gender: 'Nam', birth: '1972', father: '3', mother: '4', spouse: '10' }).ok === true,
     'sua duoc con trong nhanh');
  ok(save({ id: '10', name: 'Vũ Thị Hoa', gender: 'Nữ', birth: '1975', spouse: '9' }).ok === true,
     'sua duoc dau ve trong nhanh');

  var out1 = save({ id: '13', name: 'Phạm Thị Ngọc', gender: 'Nữ', birth: '1974', father: '6', mother: '5' });
  ok(out1.ok === false && /không thuộc nhánh/.test(out1.error), 'khong sua duoc nguoi thuoc chi khac');

  var out2 = save({ id: '1', name: 'Nguyễn Văn Đại', gender: 'Nam', birth: '1918' });
  ok(out2.ok === false && /không thuộc nhánh/.test(out2.error), 'khong nguoc len sua duoc thuy to');

  var newIn = save({ id: '', name: 'Nguyễn Minh Khôi', gender: 'Nam', birth: '2001', father: '9', mother: '10' });
  ok(newIn.ok === true, 'them duoc con moi cho nguoi trong nhanh');

  var newOut = save({ id: '', name: 'Người lạ', gender: 'Nam', birth: '2000' });
  ok(newOut.ok === false && /phải gắn vào nhánh/.test(newOut.error), 'khong them duoc nguoi khong gan vao nhanh');

  var newOut2 = save({ id: '', name: 'Con nhà khác', gender: 'Nam', birth: '2000', father: '6' });
  ok(newOut2.ok === false && /phải gắn vào nhánh/.test(newOut2.error), 'khong them duoc con cho nguoi ngoai nhanh');

  var delOut = post({ action: 'delete', token: bienTapToken, id: '13' });
  ok(delOut.ok === false && /không thuộc nhánh/.test(delOut.error), 'khong xoa duoc nguoi ngoai nhanh');

  var adminOnly = post({ action: 'accounts', token: bienTapToken });
  ok(adminOnly.ok === false && /quản trị/.test(adminOnly.error), 'bien tap khong xem duoc danh sach tai khoan');

  var mkAcc = post({ action: 'account_save', token: bienTapToken, account: { user: 'gia', pass: 'matkhau123', role: 'quan_tri' } });
  ok(mkAcc.ok === false, 'bien tap khong tu nang quyen cho ai duoc');

  ok(post({ action: 'save', person: { id: '9', name: 'X' } }).ok === false, 'khong co the thi khong ghi duoc');
  ok(post({ action: 'delete', id: '9' }).ok === false, 'khong co the thi khong xoa duoc');
})();

/* ================== 6. quyền chỉ xem ================== */
group('6. Tai khoan chi xem');
(function () {
  post({ action: 'account_save', token: adminToken,
         account: { user: 'khach', name: 'Khách', pass: 'matkhau123', role: 'nguoi_xem', branches: [], status: 'hoat_dong' } });
  var t = post({ action: 'login', user: 'khach', pass: 'matkhau123' }).token;

  ok(post({ action: 'list', token: t }).ok === true, 'van xem duoc toan bo cay');
  var r = post({ action: 'save', token: t, person: { id: '9', name: 'X' } });
  ok(r.ok === false && /chỉ có quyền xem/.test(r.error), 'khong ghi duoc gi');
  ok(post({ action: 'photo', token: t, data: 'x' }).ok === false, 'khong tai anh len duoc');
})();

/* ================== 7. khoá và xoá tài khoản ================== */
group('7. Khoa va xoa tai khoan');
(function () {
  post({ action: 'account_save', token: adminToken,
         account: { user: 'tam', name: 'Tạm', pass: 'matkhau123', role: 'bien_tap', branches: ['3'], status: 'hoat_dong' } });
  var t = post({ action: 'login', user: 'tam', pass: 'matkhau123' }).token;
  ok(!!t, 'tai khoan moi dang nhap duoc');

  post({ action: 'account_save', token: adminToken,
         account: { user: 'tam', name: 'Tạm', role: 'bien_tap', branches: ['3'], status: 'khoa' } });
  ok(post({ action: 'login', user: 'tam', pass: 'matkhau123' }).ok === false, 'tai khoan bi khoa khong dang nhap duoc');
  ok(post({ action: 'save', token: t, person: { id: '9', name: 'X' } }).ok === false, 'the cu cua tai khoan bi khoa het hieu luc');

  var self = post({ action: 'account_delete', token: adminToken, user: 'admin' });
  ok(self.ok === false && /đang đăng nhập/.test(self.error), 'khong tu xoa tai khoan dang dung');

  var down = post({ action: 'account_save', token: adminToken,
                    account: { user: 'admin', name: 'Nguyễn Trọng', role: 'bien_tap', branches: [] } });
  ok(down.ok === false && /tự hạ quyền/.test(down.error), 'khong tu ha quyen minh xuong');

  ok(post({ action: 'account_delete', token: adminToken, user: 'tam' }).ok === true, 'xoa duoc tai khoan khac');
  ok(post({ action: 'account_delete', token: adminToken, user: 'tam' }).ok === false, 'xoa lan hai thi bao khong tim thay');
})();

/* ================== 8. đổi mật khẩu ================== */
group('8. Doi mat khau');
(function () {
  var wrong = post({ action: 'change_password', token: bienTapToken, oldPass: 'sai', newPass: 'matkhaumoi' });
  ok(wrong.ok === false && /hiện tại không đúng/.test(wrong.error), 'sai mat khau cu thi khong doi duoc');

  var short = post({ action: 'change_password', token: bienTapToken, oldPass: 'matkhau123', newPass: '123' });
  ok(short.ok === false && /6 ký tự/.test(short.error), 'mat khau moi qua ngan bi chan');

  var good = post({ action: 'change_password', token: bienTapToken, oldPass: 'matkhau123', newPass: 'matkhaumoi' });
  ok(good.ok === true, 'doi duoc mat khau');
  ok(post({ action: 'login', user: 'trongnt', pass: 'matkhaumoi' }).ok === true, 'dang nhap bang mat khau moi');
  ok(post({ action: 'login', user: 'trongnt', pass: 'matkhau123' }).ok === false, 'mat khau cu het tac dung');
})();

/* ================== 9. mật khẩu không lưu bản rõ ================== */
group('9. Luu tru mat khau');
(function () {
  var sh = stubs._ss.getSheetByName('TaiKhoan');
  var dump = JSON.stringify(sh._data);
  ok(dump.indexOf('matkhaumoi') < 0 && dump.indexOf('matkhau123') < 0, 'bang khong chua mat khau ban ro');

  var accs = post({ action: 'accounts', token: adminToken }).accounts;
  var leak = JSON.stringify(accs);
  ok(leak.indexOf('hash') < 0 && leak.indexOf('salt') < 0, 'danh sach tra ve khong kem chuoi bam va muoi');

  var a = S.findAccount_('admin');
  ok(a.hash.length === 64 && /^[0-9a-f]+$/.test(a.hash), 'chuoi bam dung dinh dang SHA-256 he 16');
  ok(S.hash_('matkhau123', a.salt) === a.hash, 'bam lai voi cung muoi thi ra cung ket qua');
  ok(S.hash_('matkhau123', 'muoikhac') !== a.hash, 'muoi khac thi ra ket qua khac');
})();

/* ================== 10. hàm xét nhánh ================== */
group('10. Ham xet nhanh');
(function () {
  var rows = post({ action: 'list' }).rows;
  ok(S.inBranch_(rows, '9', '3') === true, 'con chau thuoc nhanh');
  ok(S.inBranch_(rows, '3', '3') === true, 'chinh goc nhanh thuoc nhanh');
  ok(S.inBranch_(rows, '4', '3') === true, 'vo cua goc nhanh thuoc nhanh');
  ok(S.inBranch_(rows, '10', '3') === true, 'dau ve thuoc nhanh');
  ok(S.inBranch_(rows, '1', '3') === false, 'to tien khong thuoc nhanh cua con');
  ok(S.inBranch_(rows, '13', '3') === false, 'nguoi chi khac khong thuoc nhanh');
  ok(S.inBranch_(rows, '', '3') === false, 'ma rong thi khong thuoc nhanh nao');
  ok(S.inAnyBranch_(rows, '13', ['3', '5']) === true, 'giao nhieu nhanh thi xet ca hai');
})();

/* ================== 11. tệp mẫu khớp với cột của script ================== */
group('11. Tep mau khop voi cot cua script');
(function () {
  var raw = fs.readFileSync(path.join(ROOT, 'mau-gia-pha.csv'), 'utf8').replace(/^﻿/, '');
  var header = raw.split(/\r?\n/)[0].split(',').map(function (s) { return s.trim(); });
  var want = S.COLS.map(function (c) { return c[0]; });
  eq(header, want, 'tieu de tep mau trung khop thu tu cot trong apps-script.gs');

  var accWant = S.ACOLS.map(function (c) { return c[0]; });
  eq(accWant.length, 8, 'bang tai khoan co 8 cot');
  ok(accWant.indexOf('mat_khau') >= 0 && accWant.indexOf('muoi') >= 0, 'co cot chuoi bam va chuoi muoi');
})();

/* ================== 12. bảng cũ tự đổi tên cột ================== */
group('12. Bang cu tu doi ten cot');
(function () {
  var sh = stubs._ss.getSheetByName('GiaPha');
  var col = 13; // cột noi_sinh

  // Ghi một giá trị vào cột đó rồi hạ tiêu đề về tên cũ
  sh.getRange(2, col, 1, 1).setValue('Duy Tiên - Hà Nam');
  var oldHead = S.COLS.map(function (c) { return c[0]; });
  oldHead[col - 1] = 'que_quan';
  sh.getRange(1, 1, 1, oldHead.length).setValues([oldHead]);
  eq(sh.getRange(1, col, 1, 1).getDisplayValues()[0][0], 'que_quan', 'da ha tieu de ve ten cu');

  var before = post({ action: 'list' }).rows.length;
  eq(sh.getRange(1, col, 1, 1).getDisplayValues()[0][0], 'noi_sinh', 'tieu de cu tu doi sang noi_sinh');
  eq(sh.getRange(2, col, 1, 1).getDisplayValues()[0][0], 'Duy Tiên - Hà Nam', 'du lieu ben duoi khong bi dung toi');

  var after = post({ action: 'list' });
  eq(after.rows.length, before, 'so nguoi khong doi sau khi doi ten cot');
  ok(after.rows[0].origin === 'Duy Tiên - Hà Nam', 'gia tri van ve dung truong origin');
})();

/* ================== tổng kết ================== */
console.log('\n' + '='.repeat(52));
console.log('DAT ' + pass + ' / ' + (pass + fail));
if (fail) {
  console.log('\nCAC MUC HONG:');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exitCode = 1;
} else {
  console.log('Khong co loi.');
}
