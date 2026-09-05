/**
 * GIA PHẢ VIỆT — cổng dữ liệu và phân quyền cho trang gia phả.
 *
 * Cách dùng:
 *   1. Mở Google Sheet chứa gia phả.
 *   2. Tiện ích mở rộng  ->  Apps Script.
 *   3. Xoá hết nội dung mẫu, dán toàn bộ file này vào.
 *   4. Triển khai  ->  Tuỳ chọn triển khai mới  ->  Ứng dụng web.
 *        Thực thi với tư cách : Tôi
 *        Ai có quyền truy cập : Bất kỳ ai
 *   5. Chép đường dẫn kết thúc bằng /exec, dán vào phần cài đặt của trang gia phả.
 *   6. Mở trang, bấm Đăng nhập, trang sẽ mời bạn lập tài khoản quản trị đầu tiên.
 *
 * Lần chạy đầu Google hỏi cấp quyền cho Sheet và Drive. Chọn tài khoản của bạn,
 * bấm Nâng cao -> Chuyển đến ... (không an toàn) -> Cho phép. Cảnh báo đó chỉ
 * vì script do bạn tự viết chưa qua thẩm định của Google.
 *
 * PHÂN QUYỀN
 *   quan_tri   toàn quyền, kể cả quản lý tài khoản
 *   bien_tap   chỉ sửa được những người thuộc các nhánh được giao
 *   nguoi_xem  chỉ xem
 * Ai cũng xem được toàn bộ cây, kể cả khi chưa đăng nhập, trừ khi bạn đổi
 * REQUIRE_LOGIN_TO_VIEW thành true.
 *
 * Một người được coi là thuộc nhánh R nếu R là chính họ, là tổ tiên của họ,
 * hoặc họ là vợ/chồng của một người thuộc nhánh R.
 */

/* ================== cấu hình ================== */

var SHEET_NAME    = 'GiaPha';       // tab chứa dữ liệu gia phả
var ACCOUNT_SHEET = 'TaiKhoan';     // tab chứa tài khoản
var PHOTO_FOLDER  = 'Gia pha - anh';// thư mục Drive chứa ảnh

var REQUIRE_LOGIN_TO_VIEW = false;  // true = phải đăng nhập mới xem được cây
var TOKEN_DAYS = 30;                // số ngày giữ đăng nhập

/* ================== cột dữ liệu ================== */

var COLS = [
  ['id',              'id'],
  ['ho_ten',          'name'],
  ['ten_thuong_goi',  'alias'],
  ['gioi_tinh',       'gender'],
  ['nam_sinh',        'birth'],
  ['nam_mat',         'death'],
  ['ngay_gio',        'gio'],
  ['anh',             'photo'],
  ['cha_id',          'father'],
  ['me_id',           'mother'],
  ['vo_chong_id',     'spouse'],
  ['vai_tro',         'role'],
  ['noi_sinh',        'origin'],
  ['noi_an_tang',     'burial'],
  ['ghi_chu',         'note']
];

var ACOLS = [
  ['tai_khoan',   'user'],
  ['ho_ten',      'name'],
  ['mat_khau',    'hash'],
  ['muoi',        'salt'],
  ['quyen',       'role'],
  ['nhanh_id',    'branches'],
  ['trang_thai',  'status'],
  ['ngay_tao',    'created']
];

/* ================== điểm vào ================== */

function doGet() {
  return json({ ok: true, message: 'Cổng gia phả đang hoạt động. Dán đường dẫn này vào phần cài đặt của trang.' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    var action = String(req.action || '');

    // Các việc không cần đăng nhập
    if (action === 'auth_state')  return json(authState_());
    if (action === 'init_admin')  return withLock_(function () { return json(initAdmin_(req)); });
    if (action === 'login')       return json(login_(req));

    var me = req.token ? verifyToken_(req.token) : null;

    if (action === 'me') {
      return json(me ? { ok: true, account: publicAccount_(me) } : { ok: false, error: 'Phiên đăng nhập đã hết hạn.' });
    }

    if (action === 'list') {
      if (REQUIRE_LOGIN_TO_VIEW && !me) return json({ ok: false, error: 'Cần đăng nhập để xem gia phả.' });
      // Trả luôn tình trạng tài khoản để trang chỉ phải gọi một lượt lúc mở.
      return json({
        ok: true,
        rows: list_(getSheet_()),
        sheetUrl: sheetUrl_(),
        account: me ? publicAccount_(me) : null,
        needsSetup: listAccounts_().length === 0
      });
    }

    // Từ đây trở xuống bắt buộc đăng nhập
    if (!me) return json({ ok: false, error: 'Bạn cần đăng nhập để thực hiện việc này.' });

    switch (action) {
      case 'save':
        return withLock_(function () {
          var sh = getSheet_();
          requireWrite_(sh, me, req.person);
          return json({ ok: true, id: save_(sh, req.person) });
        });

      case 'delete':
        return withLock_(function () {
          var sh = getSheet_();
          requireWrite_(sh, me, { id: String(req.id || '') });
          remove_(sh, String(req.id || ''));
          return json({ ok: true });
        });

      case 'photo':
        if (me.role === 'nguoi_xem') throw new Error('Tài khoản của bạn chỉ có quyền xem.');
        return json({ ok: true, url: photo_(req.data, req.name) });

      case 'accounts':
        requireAdmin_(me);
        return json({ ok: true, accounts: listAccounts_().map(publicAccount_) });

      case 'account_save':
        requireAdmin_(me);
        return withLock_(function () { return json({ ok: true, account: publicAccount_(saveAccount_(req.account, me)) }); });

      case 'account_delete':
        requireAdmin_(me);
        return withLock_(function () { deleteAccount_(String(req.user || ''), me); return json({ ok: true }); });

      case 'change_password':
        return withLock_(function () { changePassword_(me, req.oldPass, req.newPass); return json({ ok: true }); });

      default:
        return json({ ok: false, error: 'Không hiểu yêu cầu: ' + action });
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ================== phân quyền ================== */

function requireAdmin_(me) {
  if (me.role !== 'quan_tri') throw new Error('Chỉ tài khoản quản trị mới làm được việc này.');
}

/* Ném lỗi nếu tài khoản không được phép ghi lên người này. */
function requireWrite_(sh, me, person) {
  if (me.role === 'quan_tri') return;
  if (me.role === 'nguoi_xem') throw new Error('Tài khoản của bạn chỉ có quyền xem.');

  var branches = me.branches || [];
  if (!branches.length) throw new Error('Tài khoản của bạn chưa được giao nhánh nào để sửa.');

  var rows = list_(sh);
  var id = String(person && person.id || '').trim();
  var exists = id && rows.some(function (r) { return r.id === id; });

  if (exists) {
    if (!inAnyBranch_(rows, id, branches)) {
      throw new Error('Người này không thuộc nhánh bạn được giao, nên bạn không sửa được.');
    }
    return;
  }

  // Người mới: phải gắn vào nhánh được giao qua cha, mẹ hoặc vợ chồng.
  var links = [String(person.father || ''), String(person.mother || '')]
    .concat(String(person.spouse || '').split(/[,;|]/))
    .map(trim_).filter(String);

  var ok = links.some(function (x) { return inAnyBranch_(rows, x, branches); });
  if (!ok) throw new Error('Người mới phải gắn vào nhánh bạn được giao, qua cha, mẹ hoặc vợ chồng.');
}

function inAnyBranch_(rows, id, branches) {
  for (var i = 0; i < branches.length; i++) {
    if (inBranch_(rows, id, branches[i])) return true;
  }
  return false;
}

/* id thuộc nhánh root nếu root là chính nó, là tổ tiên, hoặc nó là vợ/chồng của người trong nhánh. */
function inBranch_(rows, id, root) {
  if (!id || !root) return false;
  var map = {};
  rows.forEach(function (r) { map[r.id] = r; });

  if (ancestorHas_(map, id, root)) return true;

  var self = map[id];
  if (!self) return false;

  var sps = String(self.spouse || '').split(/[,;|]/).map(trim_).filter(String);
  for (var i = 0; i < sps.length; i++) {
    if (ancestorHas_(map, sps[i], root)) return true;
  }

  // Trường hợp người kia khai vợ chồng một chiều
  for (var j = 0; j < rows.length; j++) {
    var o = rows[j];
    if (String(o.spouse || '').split(/[,;|]/).map(trim_).indexOf(id) < 0) continue;
    if (ancestorHas_(map, o.id, root)) return true;
  }
  return false;
}

function ancestorHas_(map, id, root) {
  var seen = {}, stack = [String(id)];
  while (stack.length) {
    var x = stack.pop();
    if (!x || seen[x]) continue;
    seen[x] = true;
    if (x === root) return true;
    var p = map[x];
    if (!p) continue;
    if (p.father) stack.push(trim_(p.father));
    if (p.mother) stack.push(trim_(p.mother));
  }
  return false;
}

/* ================== tài khoản ================== */

function authState_() {
  var accounts = listAccounts_();
  return { ok: true, needsSetup: accounts.length === 0, requireLogin: REQUIRE_LOGIN_TO_VIEW };
}

function initAdmin_(req) {
  if (listAccounts_().length) return { ok: false, error: 'Đã có tài khoản trong hệ thống, không lập quản trị lần nữa được.' };

  var user = normUser_(req.user);
  var pass = String(req.pass || '');
  if (user.length < 3) return { ok: false, error: 'Tên đăng nhập cần ít nhất 3 ký tự.' };
  if (pass.length < 6) return { ok: false, error: 'Mật khẩu cần ít nhất 6 ký tự.' };

  var acc = writeAccount_({
    user: user,
    name: String(req.name || '').trim() || user,
    role: 'quan_tri',
    branches: '',
    status: 'hoat_dong',
    created: today_()
  }, pass);

  return { ok: true, token: makeToken_(acc.user), account: publicAccount_(acc) };
}

function login_(req) {
  var user = normUser_(req.user);
  var acc = findAccount_(user);
  if (!acc) return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu.' };
  if (acc.status === 'khoa') return { ok: false, error: 'Tài khoản đã bị khoá.' };
  if (hash_(String(req.pass || ''), acc.salt) !== acc.hash) return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu.' };

  return { ok: true, token: makeToken_(acc.user), account: publicAccount_(acc) };
}

function changePassword_(me, oldPass, newPass) {
  var acc = findAccount_(me.user);
  if (!acc) throw new Error('Không tìm thấy tài khoản.');
  if (hash_(String(oldPass || ''), acc.salt) !== acc.hash) throw new Error('Mật khẩu hiện tại không đúng.');
  if (String(newPass || '').length < 6) throw new Error('Mật khẩu mới cần ít nhất 6 ký tự.');
  writeAccount_(acc, String(newPass));
}

function saveAccount_(a, me) {
  var user = normUser_(a && a.user);
  if (user.length < 3) throw new Error('Tên đăng nhập cần ít nhất 3 ký tự.');

  var role = String(a.role || 'bien_tap');
  if (['quan_tri', 'bien_tap', 'nguoi_xem'].indexOf(role) < 0) throw new Error('Quyền không hợp lệ.');

  var existing = findAccount_(user);

  // Thêm mới mà trùng tên thì phải báo, không được lặng lẽ ghi đè tài khoản
  // đang có. Bản cũ của trang không gửi cờ này nên vẫn chạy như trước.
  if (a.isNew === true && existing) {
    throw new Error('Tên đăng nhập @' + user + ' đã có người dùng rồi. Hãy đặt tên khác, hoặc đóng cửa sổ này và bấm Sửa ở tài khoản đó.');
  }
  if (a.isNew === false && !existing) {
    throw new Error('Không tìm thấy tài khoản @' + user + ' để sửa.');
  }

  var pass = String(a.pass || '');
  if (!existing && pass.length < 6) throw new Error('Tài khoản mới cần mật khẩu ít nhất 6 ký tự.');
  if (existing && pass && pass.length < 6) throw new Error('Mật khẩu mới cần ít nhất 6 ký tự.');

  // Không tự hạ quyền hoặc tự khoá mình, tránh khoá hết đường vào.
  if (existing && existing.user === me.user && (role !== 'quan_tri' || a.status === 'khoa')) {
    throw new Error('Không thể tự hạ quyền hoặc tự khoá tài khoản đang dùng.');
  }

  var branches = Array.isArray(a.branches) ? a.branches.join(',') : String(a.branches || '');

  return writeAccount_({
    user: user,
    name: String(a.name || '').trim() || user,
    role: role,
    branches: branches,
    status: String(a.status || 'hoat_dong'),
    created: existing ? existing.created : today_(),
    salt: existing ? existing.salt : '',
    hash: existing ? existing.hash : ''
  }, pass);
}

function deleteAccount_(user, me) {
  user = normUser_(user);
  if (user === me.user) throw new Error('Không thể xoá tài khoản đang đăng nhập.');

  var admins = listAccounts_().filter(function (x) { return x.role === 'quan_tri' && x.status !== 'khoa'; });
  var target = findAccount_(user);
  if (!target) throw new Error('Không tìm thấy tài khoản.');
  if (target.role === 'quan_tri' && admins.length <= 1) throw new Error('Phải còn ít nhất một tài khoản quản trị.');

  var sh = getAccountSheet_();
  var row = findAccountRow_(sh, user);
  if (row) sh.deleteRow(row);
}

function listAccounts_() {
  var sh = getAccountSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];

  var vals = sh.getRange(2, 1, last - 1, ACOLS.length).getDisplayValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var o = {};
    for (var c = 0; c < ACOLS.length; c++) o[ACOLS[c][1]] = trim_(vals[i][c]);
    if (!o.user) continue;
    o._row = i + 2;
    out.push(o);
  }
  return out;
}

function findAccount_(user) {
  user = normUser_(user);
  var all = listAccounts_();
  for (var i = 0; i < all.length; i++) if (all[i].user === user) return all[i];
  return null;
}

function findAccountRow_(sh, user) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var vals = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (var i = 0; i < vals.length; i++) if (normUser_(vals[i][0]) === user) return i + 2;
  return 0;
}

function writeAccount_(acc, plainPass) {
  var sh = getAccountSheet_();

  if (plainPass) {
    acc.salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    acc.hash = hash_(plainPass, acc.salt);
  }

  var line = ACOLS.map(function (c) { return String(acc[c[1]] == null ? '' : acc[c[1]]); });
  var row = findAccountRow_(sh, acc.user) || (sh.getLastRow() + 1);
  writeRow_(sh, row, ACOLS, line);

  acc._row = row;
  return acc;
}

function publicAccount_(a) {
  return {
    user: a.user,
    name: a.name,
    role: a.role,
    status: a.status || 'hoat_dong',
    branches: String(a.branches || '').split(/[,;|]/).map(trim_).filter(String)
  };
}

function normUser_(v) {
  return trim_(v).toLowerCase();
}

function hash_(pass, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + '::' + String(pass), Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/* ================== phiên đăng nhập ================== */
/* Thẻ đăng nhập tự chứng thực bằng chữ ký HMAC, không cần lưu ở đâu cả. */

function secret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('GP_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('GP_SECRET', s); }
  return s;
}

function makeToken_(user) {
  var exp = Date.now() + TOKEN_DAYS * 86400000;
  var payload = Utilities.base64EncodeWebSafe(user + '|' + exp);
  return payload + '.' + sign_(payload);
}

function sign_(payload) {
  var raw = Utilities.computeHmacSha256Signature(payload, secret_());
  return Utilities.base64EncodeWebSafe(raw);
}

function verifyToken_(token) {
  try {
    var parts = String(token).split('.');
    if (parts.length !== 2) return null;
    if (sign_(parts[0]) !== parts[1]) return null;

    var body = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString().split('|');
    if (Number(body[1]) < Date.now()) return null;

    var acc = findAccount_(body[0]);
    if (!acc || acc.status === 'khoa') return null;
    return publicAccount_(acc);
  } catch (err) {
    return null;
  }
}

/* ================== dữ liệu gia phả ================== */

function list_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];

  var values = sh.getRange(2, 1, last - 1, COLS.length).getDisplayValues();
  var rows = [];

  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    var o = {};
    for (var c = 0; c < COLS.length; c++) o[COLS[c][1]] = trim_(v[c]);
    if (!o.name) continue;
    if (!o.id) o.id = 'r' + (i + 2);
    o._row = i + 2;
    rows.push(o);
  }
  return rows;
}

function save_(sh, person) {
  if (!person || !trim_(person.name)) throw new Error('Thiếu họ tên.');

  var id = trim_(person.id) || ('p' + Date.now().toString(36));
  person.id = id;

  var line = COLS.map(function (c) { return String(person[c[1]] == null ? '' : person[c[1]]); });
  var row = findRow_(sh, id) || (sh.getLastRow() + 1);
  writeRow_(sh, row, COLS, line);

  syncSpouses_(sh, id, String(person.spouse || ''));
  return id;
}

/* Vợ chồng phải trỏ về nhau, nếu không cây sẽ vẽ lệch. */
function syncSpouses_(sh, id, spouseCsv) {
  var wanted = spouseCsv.split(/[,;|]/).map(trim_).filter(String);
  var spCol = colIndex_('spouse'), idCol = colIndex_('id');
  var last = sh.getLastRow();
  if (last < 2) return;

  var ids = sh.getRange(2, idCol, last - 1, 1).getDisplayValues();
  var sps = sh.getRange(2, spCol, last - 1, 1).getDisplayValues();

  for (var i = 0; i < ids.length; i++) {
    var otherId = trim_(ids[i][0]);
    if (!otherId || otherId === id) continue;

    var cur = String(sps[i][0] || '').split(/[,;|]/).map(trim_).filter(String);
    var has = cur.indexOf(id) >= 0;
    var should = wanted.indexOf(otherId) >= 0;
    if (has === should) continue;

    var next = should ? cur.concat([id]) : cur.filter(function (x) { return x !== id; });
    sh.getRange(i + 2, spCol).setValue(next.join(','));
  }
}

function remove_(sh, id) {
  if (!id) throw new Error('Thiếu mã người cần xoá.');

  var row = findRow_(sh, id);
  if (!row) throw new Error('Không tìm thấy người này trong bảng.');
  sh.deleteRow(row);

  var last = sh.getLastRow();
  if (last < 2) return;

  ['father', 'mother'].forEach(function (f) {
    var col = colIndex_(f);
    var vals = sh.getRange(2, col, last - 1, 1).getDisplayValues();
    for (var i = 0; i < vals.length; i++) {
      if (trim_(vals[i][0]) === id) sh.getRange(i + 2, col).setValue('');
    }
  });

  var spCol = colIndex_('spouse');
  var sps = sh.getRange(2, spCol, last - 1, 1).getDisplayValues();
  for (var j = 0; j < sps.length; j++) {
    var cur = String(sps[j][0] || '').split(/[,;|]/).map(trim_).filter(String);
    if (cur.indexOf(id) < 0) continue;
    sh.getRange(j + 2, spCol).setValue(cur.filter(function (x) { return x !== id; }).join(','));
  }
}

/* ================== ảnh ================== */

function photo_(dataUrl, name) {
  var m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('Ảnh không hợp lệ.');

  var type = m[1];
  var ext = type.indexOf('png') >= 0 ? '.png' : (type.indexOf('webp') >= 0 ? '.webp' : '.jpg');
  var safe = String(name || 'anh').replace(/[\\\/:*?"<>|]/g, ' ').trim() || 'anh';

  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), type, safe + ' ' + Date.now() + ext);
  var file = folder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400';
}

function folder_() {
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}

/* ================== tiện ích ================== */

function getSheet_()        { return ensureSheet_(SHEET_NAME, COLS); }
function getAccountSheet_()  { return ensureSheet_(ACCOUNT_SHEET, ACOLS); }

/* Mỗi lần chạy chỉ dựng bảng một lần. Trước đây hàm này định dạng lại toàn bộ
   1000 dòng ở mọi lượt gọi, khiến việc lập tài khoản chờ hàng chục giây. */
var _sheetCache = {};

function ensureSheet_(name, cols) {
  if (_sheetCache[name]) return _sheetCache[name];

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  var fresh = false;

  if (!sh) { sh = ss.insertSheet(name); fresh = true; }

  var head = cols.map(function (c) { return c[0]; });
  var first = sh.getRange(1, 1, 1, cols.length).getDisplayValues()[0];

  // So cả dòng tiêu đề chứ không chỉ ô đầu, để bảng cũ tự đổi được tên cột
  // khi script đổi tên, ví dụ que_quan thành noi_sinh. Dữ liệu đọc theo vị
  // trí cột nên việc đổi tên tiêu đề không đụng gì tới nội dung bên dưới.
  var same = head.every(function (h, i) { return trim_(first[i]).toLowerCase() === h; });

  if (!same) {
    if (trim_(first[0]).toLowerCase() !== head[0]) fresh = true;
    sh.getRange(1, 1, 1, cols.length).setValues([head]);
    sh.getRange(1, 1, 1, cols.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }

  // Giữ ô ở dạng văn bản để Sheet không đổi 05/09/1950 thành ngày tháng.
  // Chỉ quét cả bảng đúng lúc mới dựng; sau đó chỉ đặt trên hàng vừa ghi.
  if (fresh) sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');

  _sheetCache[name] = sh;
  return sh;
}

/* Ghi một hàng, đặt định dạng văn bản cho đúng hàng đó rồi mới đổ giá trị. */
function writeRow_(sh, row, cols, values) {
  var rng = sh.getRange(row, 1, 1, cols.length);
  rng.setNumberFormat('@');
  rng.setValues([values]);
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return 0;

  var vals = sh.getRange(2, colIndex_('id'), last - 1, 1).getDisplayValues();
  for (var i = 0; i < vals.length; i++) if (trim_(vals[i][0]) === id) return i + 2;
  return 0;
}

function colIndex_(field) {
  for (var i = 0; i < COLS.length; i++) if (COLS[i][1] === field) return i + 1;
  throw new Error('Không có cột ' + field);
}

function sheetUrl_() { return SpreadsheetApp.getActiveSpreadsheet().getUrl(); }
function today_()    { return Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy'); }
function trim_(v)    { return String(v == null ? '' : v).trim(); }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
