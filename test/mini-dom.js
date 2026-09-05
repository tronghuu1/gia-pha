/**
 * DOM tối giản đủ để chạy index.html ngoài trình duyệt.
 *
 * Không phải bản dựng lại đầy đủ. Nó chỉ hiện thực đúng những thứ trang gia
 * phả dùng tới: tạo phần tử, gắn con, lớp CSS, style, dataset, và một bộ chọn
 * hiểu được #id, .lop, thẻ, [data-id="x"] cùng quan hệ cha con cách nhau
 * khoảng trắng. Nội dung gán qua innerHTML không được phân tích thành cây,
 * nên phần giao diện dựng bằng innerHTML chỉ kiểm được là không ném lỗi.
 */

function makeDom(opts) {
  opts = opts || {};
  var byId = {};

  function classList(el) {
    return {
      add: function () {
        for (var i = 0; i < arguments.length; i++) {
          if (el._cls.indexOf(arguments[i]) < 0) el._cls.push(arguments[i]);
        }
      },
      remove: function () {
        for (var i = 0; i < arguments.length; i++) {
          var k = el._cls.indexOf(arguments[i]);
          if (k >= 0) el._cls.splice(k, 1);
        }
      },
      contains: function (c) { return el._cls.indexOf(c) >= 0; },
      toggle: function (c, on) {
        var has = el._cls.indexOf(c) >= 0;
        var want = (arguments.length > 1) ? !!on : !has;
        if (want && !has) el._cls.push(c);
        if (!want && has) el._cls.splice(el._cls.indexOf(c), 1);
        return want;
      }
    };
  }

  function style() {
    var s = {};
    s.setProperty = function (k, v) { s[k] = v; };
    s.removeProperty = function (k) { delete s[k]; };
    return s;
  }

  function createElement(tag) {
    var el = {
      tagName: String(tag).toUpperCase(),
      childNodes: [],
      parentNode: null,
      attrs: {},
      dataset: {},
      _cls: [],
      _text: '',
      _html: '',
      style: style(),
      hidden: false,
      disabled: false,
      value: '',
      checked: false,
      _listeners: {},
      clientWidth: opts.width || 1400,
      clientHeight: opts.height || 900,
      offsetWidth: 150,
      offsetHeight: 168
    };

    el.classList = classList(el);

    Object.defineProperty(el, 'className', {
      get: function () { return el._cls.join(' '); },
      set: function (v) { el._cls = String(v || '').split(/\s+/).filter(Boolean); }
    });

    Object.defineProperty(el, 'id', {
      get: function () { return el.attrs.id || ''; },
      set: function (v) { el.attrs.id = v; byId[v] = el; }
    });

    Object.defineProperty(el, 'textContent', {
      get: function () {
        if (el.childNodes.length) {
          return el.childNodes.map(function (c) { return c.textContent || ''; }).join('');
        }
        return el._text;
      },
      set: function (v) { el.childNodes = []; el._text = String(v == null ? '' : v); }
    });

    Object.defineProperty(el, 'innerHTML', {
      get: function () { return el._html; },
      // Cố ý không phân tích HTML: chỉ xoá con và ghi nhận chuỗi.
      set: function (v) { el.childNodes = []; el._text = ''; el._html = String(v == null ? '' : v); }
    });

    Object.defineProperty(el, 'firstChild', {
      get: function () { return el.childNodes[0] || null; }
    });

    el.appendChild = function (c) {
      if (!c) throw new Error('appendChild nhận giá trị rỗng');
      if (c._isFragment) {
        c.childNodes.slice().forEach(function (k) { el.appendChild(k); });
        c.childNodes = [];
        return c;
      }
      if (c.parentNode) c.parentNode.removeChild(c);
      c.parentNode = el;
      el.childNodes.push(c);
      el._html = '';
      return c;
    };

    el.insertBefore = function (c, ref) {
      var i = el.childNodes.indexOf(ref);
      if (i < 0) return el.appendChild(c);
      if (c.parentNode) c.parentNode.removeChild(c);
      c.parentNode = el;
      el.childNodes.splice(i, 0, c);
      return c;
    };

    el.removeChild = function (c) {
      var i = el.childNodes.indexOf(c);
      if (i >= 0) el.childNodes.splice(i, 1);
      c.parentNode = null;
      return c;
    };

    el.remove = function () { if (el.parentNode) el.parentNode.removeChild(el); };

    el.setAttribute = function (k, v) {
      el.attrs[k] = String(v);
      if (k === 'id') byId[v] = el;
      if (k.indexOf('data-') === 0) el.dataset[k.slice(5).replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); })] = String(v);
    };
    el.getAttribute = function (k) { return el.attrs[k] == null ? null : el.attrs[k]; };
    el.hasAttribute = function (k) { return el.attrs[k] != null; };
    el.removeAttribute = function (k) { delete el.attrs[k]; };

    el.addEventListener = function (t, fn) { (el._listeners[t] = el._listeners[t] || []).push(fn); };
    el.removeEventListener = function () {};
    el.dispatch = function (t, ev) {
      (el._listeners[t] || []).forEach(function (fn) { fn(ev || { target: el, preventDefault: function () {}, stopPropagation: function () {} }); });
      var on = el['on' + t];
      if (typeof on === 'function') on(ev || { target: el, preventDefault: function () {}, stopPropagation: function () {} });
    };

    el.focus = function () {};
    el.blur = function () {};
    el.scrollIntoView = function () {};
    el.getBoundingClientRect = function () { return { left: 0, top: 0, width: el.clientWidth, height: el.clientHeight, right: el.clientWidth, bottom: el.clientHeight }; };

    el.closest = function (sel) {
      var cur = el;
      while (cur) {
        if (matchesAny(cur, sel)) return cur;
        cur = cur.parentNode;
      }
      return null;
    };
    el.matches = function (sel) { return matchesAny(el, sel); };
    el.querySelector = function (sel) { return select(el, sel)[0] || null; };
    el.querySelectorAll = function (sel) { return select(el, sel); };

    return el;
  }

  /* ---- bộ chọn ---- */
  function matchOne(el, part) {
    part = part.trim();
    if (!part) return false;
    var m, rest = part;

    m = rest.match(/^([a-zA-Z][\w-]*)/);
    if (m) {
      if (el.tagName !== m[1].toUpperCase()) return false;
      rest = rest.slice(m[1].length);
    }
    var re = /(#[\w-]+)|(\.[\w-]+)|(\[[^\]]+\])/g, tok;
    while ((tok = re.exec(rest))) {
      var t = tok[0];
      if (t[0] === '#') { if (el.attrs.id !== t.slice(1)) return false; }
      else if (t[0] === '.') { if (el._cls.indexOf(t.slice(1)) < 0) return false; }
      else {
        var am = t.slice(1, -1).match(/^([\w-]+)(?:=["']?([^"'\]]*)["']?)?$/);
        if (!am) return false;
        var key = am[1];
        var val = el.attrs[key];
        if (key.indexOf('data-') === 0 && val == null) {
          val = el.dataset[key.slice(5).replace(/-(\w)/g, function (x, c) { return c.toUpperCase(); })];
        }
        if (val == null) return false;
        if (am[2] != null && String(val) !== am[2]) return false;
      }
    }
    return true;
  }

  function matchesAny(el, sel) {
    return String(sel).split(',').some(function (s) {
      var parts = s.trim().split(/\s+/);
      return matchOne(el, parts[parts.length - 1]) && matchAncestors(el, parts.slice(0, -1));
    });
  }

  function matchAncestors(el, parts) {
    if (!parts.length) return true;
    var want = parts.slice();
    var cur = el.parentNode;
    while (cur && want.length) {
      if (matchOne(cur, want[want.length - 1])) want.pop();
      cur = cur.parentNode;
    }
    return want.length === 0;
  }

  function walk(root, fn) {
    root.childNodes.forEach(function (c) { fn(c); walk(c, fn); });
  }

  function select(root, sel) {
    var out = [];
    String(sel).split(',').forEach(function (s) {
      var parts = s.trim().split(/\s+/);
      var last = parts[parts.length - 1];
      var anc = parts.slice(0, -1);
      walk(root, function (el) {
        if (matchOne(el, last) && matchAncestors(el, anc) && out.indexOf(el) < 0) out.push(el);
      });
    });
    return out;
  }

  /* ---- document ---- */
  var docEl = createElement('html');
  var body = createElement('body');
  docEl.appendChild(body);

  var document = {
    readyState: 'loading',
    title: '',
    documentElement: docEl,
    body: body,
    createElement: createElement,
    createTextNode: function (t) {
      var n = createElement('#text');
      n.nodeType = 3;
      n.textContent = t == null ? '' : String(t);
      return n;
    },
    createDocumentFragment: function () {
      var f = createElement('#fragment');
      f._isFragment = true;
      return f;
    },
    querySelector: function (sel) {
      if (/^#[\w-]+$/.test(sel) && byId[sel.slice(1)]) return byId[sel.slice(1)];
      return select(docEl, sel)[0] || null;
    },
    querySelectorAll: function (sel) { return select(docEl, sel); },
    addEventListener: function () {},
    getElementById: function (id) { return byId[id] || null; }
  };

  /* Dựng sẵn khung HTML tĩnh mà mã nguồn trông đợi. */
  var IDS = ['app', 'stage', 'canvas', 'links', 'cards', 'rails', 'famName', 'famSub', 'seal',
    'banner', 'toast', 'drawer', 'drwBody', 'drwFoot', 'drwClose', 'q', 'sugg',
    'btnGio', 'popGio', 'gioCnt', 'btnStat', 'popStat', 'btnAdd', 'btnUser', 'userLb',
    'popUser', 'btnCfg', 'zIn', 'zOut', 'zFit', 'modalHost'];

  var stage = null;
  IDS.forEach(function (id) {
    var tag = (id === 'links') ? 'svg' : (id === 'q' ? 'input' : 'div');
    var el = createElement(tag);
    el.id = id;
    if (id === 'stage') stage = el;
    if (/^pop/.test(id) || id === 'sugg') { el.classList.add('pop'); el.hidden = true; }
    body.appendChild(el);
  });
  // #cards, #links và #rails nằm trong #stage để bộ chọn "#cards .card" hoạt động
  byId.stage.appendChild(byId.canvas);
  byId.canvas.appendChild(byId.links);
  byId.canvas.appendChild(byId.cards);
  byId.stage.appendChild(byId.rails);
  byId.sugg.classList.remove('pop');

  return { document: document, byId: byId, createElement: createElement, select: select };
}

module.exports = { makeDom: makeDom };
