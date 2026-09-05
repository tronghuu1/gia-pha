/**
 * Giả lập các dịch vụ của Google Apps Script để chạy apps-script.gs bằng Node.
 *
 * Bảng tính giả giữ dữ liệu trong mảng, đủ cho getRange, setValues, deleteRow.
 * Utilities dùng crypto của Node nên phép băm mật khẩu và chữ ký thẻ đăng nhập
 * chạy đúng thuật toán thật chứ không phải hàng nhái.
 */

var crypto = require('crypto');

function makeSheet(name) {
  var data = [];

  function ensure(rows, cols) {
    while (data.length < rows) data.push([]);
    for (var i = 0; i < data.length; i++) {
      while (data[i].length < cols) data[i].push('');
    }
  }

  function range(row, col, numRows, numCols) {
    numRows = numRows == null ? 1 : numRows;
    numCols = numCols == null ? 1 : numCols;
    return {
      getDisplayValues: function () {
        ensure(row + numRows - 1, col + numCols - 1);
        var out = [];
        for (var r = 0; r < numRows; r++) {
          var line = [];
          for (var c = 0; c < numCols; c++) line.push(String(data[row - 1 + r][col - 1 + c] == null ? '' : data[row - 1 + r][col - 1 + c]));
          out.push(line);
        }
        return out;
      },
      getValues: function () { return this.getDisplayValues(); },
      setValues: function (vals) {
        ensure(row + vals.length - 1, col + vals[0].length - 1);
        for (var r = 0; r < vals.length; r++) {
          for (var c = 0; c < vals[r].length; c++) data[row - 1 + r][col - 1 + c] = String(vals[r][c]);
        }
        return this;
      },
      setValue: function (v) { ensure(row, col); data[row - 1][col - 1] = String(v); return this; },
      setNumberFormat: function () { return this; },
      setFontWeight: function () { return this; }
    };
  }

  return {
    _data: data,
    getName: function () { return name; },
    getRange: range,
    getLastRow: function () {
      for (var i = data.length - 1; i >= 0; i--) {
        if (data[i].some(function (v) { return String(v || '').trim() !== ''; })) return i + 1;
      }
      return 0;
    },
    getMaxRows: function () { return Math.max(1000, data.length); },
    setFrozenRows: function () {},
    deleteRow: function (r) { data.splice(r - 1, 1); }
  };
}

function makeSpreadsheet() {
  var sheets = {};
  return {
    _sheets: sheets,
    getSheetByName: function (n) { return sheets[n] || null; },
    insertSheet: function (n) { sheets[n] = makeSheet(n); return sheets[n]; },
    getUrl: function () { return 'https://docs.google.com/spreadsheets/d/TEST/edit'; }
  };
}

function bytes(buf) {
  var out = [];
  for (var i = 0; i < buf.length; i++) out.push(buf[i] > 127 ? buf[i] - 256 : buf[i]);
  return out;
}
function unbytes(arr) {
  return Buffer.from(arr.map(function (b) { return b < 0 ? b + 256 : b; }));
}

function makeStubs() {
  var ss = makeSpreadsheet();
  var props = {};

  return {
    _ss: ss,

    SpreadsheetApp: {
      getActiveSpreadsheet: function () { return ss; }
    },

    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      getUuid: function () { return crypto.randomUUID(); },
      computeDigest: function (alg, str) {
        return bytes(crypto.createHash('sha256').update(String(str), 'utf8').digest());
      },
      computeHmacSha256Signature: function (payload, secret) {
        return bytes(crypto.createHmac('sha256', String(secret)).update(String(payload), 'utf8').digest());
      },
      base64EncodeWebSafe: function (input) {
        var buf = (typeof input === 'string') ? Buffer.from(input, 'utf8') : unbytes(input);
        return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
      },
      base64Decode: function (s) {
        return bytes(Buffer.from(String(s), 'base64'));
      },
      base64DecodeWebSafe: function (s) {
        return bytes(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
      },
      newBlob: function (data, type, nameArg) {
        var buf = Array.isArray(data) ? unbytes(data) : Buffer.from(String(data));
        return {
          getDataAsString: function () { return buf.toString('utf8'); },
          getName: function () { return nameArg; },
          getContentType: function () { return type; }
        };
      },
      formatDate: function (d) {
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
      }
    },

    PropertiesService: {
      getScriptProperties: function () {
        return {
          getProperty: function (k) { return Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null; },
          setProperty: function (k, v) { props[k] = String(v); }
        };
      }
    },

    LockService: {
      getScriptLock: function () {
        return { waitLock: function () {}, releaseLock: function () {} };
      }
    },

    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: function (s) {
        return { _content: s, setMimeType: function () { return this; }, getContent: function () { return this._content; } };
      }
    },

    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
      Permission: { VIEW: 'VIEW' },
      getFoldersByName: function () { return { hasNext: function () { return false; } }; },
      createFolder: function () {
        return {
          createFile: function () {
            return { getId: function () { return 'FAKEID'; }, setSharing: function () {} };
          }
        };
      }
    }
  };
}

module.exports = { makeStubs: makeStubs };
