(function () {
  "use strict";

  var STATE_NAMES = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};
  var DEFAULTS = { weighting: "weighted", w: 4.35, sigma: "common", shape: "fat", nu: 4 };
  var W_OPTIONS = [1, 2, 3, 4, 4.35, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  var TOP_N = 15;

  var data, settings = Object.assign({}, DEFAULTS), view = "combined", query = "";
  var result;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function fmtIdx(x) {
    if (!isFinite(x)) return "–";
    if (x >= 100) return x.toFixed(0);
    if (x >= 10) return x.toFixed(1);
    if (x >= 1) return x.toFixed(2);
    if (x >= 0.01) return x.toFixed(3);
    return x.toExponential(1);
  }
  function fmtVotes(n) { return n.toLocaleString("en-US"); }
  function forecast(rec) {
    var m = rec.mu * 100;
    if (Math.abs(m) >= 99) return '<span class="matchup">no competitive race</span>';
    var cls = m > 0 ? "d" : m < 0 ? "r" : "";
    var lbl = Math.abs(m) < 0.05 ? "Even" : (m > 0 ? "D+" : "R+") + Math.abs(m).toFixed(1);
    return '<span class="' + cls + '">' + lbl + '</span><span class="matchup">' + Math.round(rec.p * 100) + "% D win</span>";
  }
  function plainForecast(rec) {
    var m = rec.mu * 100;
    if (Math.abs(m) >= 99) return "no competitive race";
    var lbl = Math.abs(m) < 0.05 ? "Even" : (m > 0 ? "D+" : "R+") + Math.abs(m).toFixed(1);
    return lbl + ", " + Math.round(rec.p * 100) + "% Democratic win chance";
  }

  function recompute(s) { return VPI.compute(s || settings, data); }

  // ---------- table ----------
  function renderTable() {
    var rows, key, label, extraHead = "", isW = settings.weighting === "weighted";
    var table = $("top-table");
    var hint = $("view-hint");
    var idxName = isW ? "Index (1.00 = average voter)" : "Index (1.00 = average race)";
    var list;
    if (view === "senate") {
      key = "indexSenate";
      list = result.senate.slice().sort(function (a, b) { return b[key] - a[key]; }).slice(0, TOP_N);
      hint.textContent = "Senate races only, by state. A state's index is the same for every voter in it.";
    } else {
      key = view === "house" ? "indexHouse" : "indexTotal";
      list = result.house.slice().sort(function (a, b) { return b[key] - a[key]; }).slice(0, TOP_N);
      hint.textContent = view === "house"
        ? "House races only."
        : "House race plus the voter's state Senate race (Senate weighted ×" + (settings.w === 4.35 ? "4.35" : settings.w) + ").";
    }
    var head = "<thead><tr><th class='num'>#</th><th>" + (view === "senate" ? "State" : "District") + "</th><th>Forecast</th>" +
      (isW ? "<th class='num'>Votes (2024)</th>" : "") +
      (view === "combined" ? "<th class='num'>Senate share</th>" : "") +
      "<th class='num'>" + esc(idxName) + "</th></tr></thead>";
    var body = list.map(function (o, i) {
      var rec = o.rec, id = view === "senate" ? (STATE_NAMES[rec.state] || rec.state) : rec.id;
      var share = view === "combined" ? '<td class="num">' + Math.round(100 * settings.w * o.Ps / o.Pt) + "%</td>" : "";
      return "<tr><td class='num rank'>" + (i + 1) + "</td><td class='id'>" + esc(id) + "<span class='matchup'>" + esc(rec.matchup) + "</span></td><td>" + forecast(rec) + "</td>" +
        (isW ? "<td class='num'>" + fmtVotes(rec.T) + "</td>" : "") + share +
        "<td class='num idx'>" + fmtIdx(o[key]) + "</td></tr>";
    }).join("");
    table.innerHTML = "<caption class='visually-hidden'>Top " + TOP_N + " " + view + " races</caption>" + head + "<tbody>" + body + "</tbody>";
  }

  // ---------- search ----------
  function allCombos() {
    var out = [];
    ["common", "implied"].forEach(function (sg) {
      ["fat", "normal"].forEach(function (sh) {
        [1, 4.35].forEach(function (w) {
          out.push(Object.assign({}, settings, { sigma: sg, shape: sh, w: w }));
        });
      });
    });
    return out;
  }
  function rankOf(res, kind, id) {
    var rows = kind === "senate" ? res.senate : res.house;
    var key = kind === "senate" ? "indexSenate" : kind === "house" ? "indexHouse" : "indexTotal";
    var rk = VPI.ranks(rows, key);
    for (var i = 0; i < rows.length; i++) if (rows[i].rec.id === id) return rk[i];
    return null;
  }
  function range(arr) {
    var lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr);
    return lo === hi ? String(lo) : lo + "–" + hi;
  }

  function matches(q) {
    q = q.trim();
    if (!q) return [];
    var u = q.toUpperCase().replace(/\s+/g, ""), l = q.toLowerCase();
    var out = [];
    data.house.forEach(function (r) {
      var nm = STATE_NAMES[r.state].toLowerCase();
      if (r.id === u || r.id.replace("-", "") === u.replace("-", "") || r.id.indexOf(u) === 0 && u.length >= 2 && /-/.test(u) || r.matchup.toLowerCase().indexOf(l) >= 0 && l.length >= 3) out.push({ kind: "house", id: r.id });
      else if ((u.length === 2 && r.state === u) || (l.length >= 3 && nm.indexOf(l) === 0)) out.push({ kind: "house", id: r.id });
    });
    data.senate.forEach(function (r) {
      var nm = STATE_NAMES[r.state].toLowerCase();
      if (r.matchup.toLowerCase().indexOf(l) >= 0 && l.length >= 3) out.push({ kind: "senate", id: r.id });
      else if ((u.length === 2 && r.state === u) || (l.length >= 3 && nm.indexOf(l) === 0)) out.push({ kind: "senate", id: r.id });
    });
    var seen = {}, uniq = [];
    out.forEach(function (m) { var k = m.kind + m.id; if (!seen[k]) { seen[k] = 1; uniq.push(m); } });
    return uniq;
  }

  function resultCard(m) {
    var isW = settings.weighting === "weighted", combos = allCombos().map(function (s) { return recompute(s); });
    if (m.kind === "house") {
      var o = result.house.filter(function (x) { return x.rec.id === m.id; })[0], rec = o.rec;
      var sen = data.senate.filter(function (s) { return s.state === rec.state; });
      var rcT = rankOf(result, "total", m.id), rcH = rankOf(result, "house", m.id);
      var rngT = range(combos.map(function (c) { return rankOf(c, "total", m.id); }));
      var rngH = range(combos.map(function (c) { return rankOf(c, "house", m.id); }));
      return '<div class="result"><h3>' + esc(rec.id) + ' <span class="matchup" style="display:inline">' + esc(rec.matchup) + "</span></h3>" +
        "<div>" + esc(plainForecast(rec)) + (isW ? " · " + fmtVotes(rec.T) + " votes in 2024" : "") + "</div><dl>" +
        "<dt>Combined index</dt><dd>" + fmtIdx(o.indexTotal) + " · rank " + rcT + " of " + result.house.length + "</dd>" +
        "<dt>House-only index</dt><dd>" + fmtIdx(o.indexHouse) + " · rank " + rcH + " of " + result.house.length + "</dd>" +
        "<dt>Senate race in " + esc(STATE_NAMES[rec.state]) + "</dt><dd>" + (sen.length ? esc(sen.map(function (s) { return s.matchup + " (" + plainForecast(s) + ")"; }).join("; ")) : "none in 2026") + "</dd>" +
        "<dt>Rank range across settings</dt><dd>combined " + rngT + " · House-only " + rngH + "</dd></dl>" +
        '<p class="hint">Range covers σ mode, curve shape and Senate weight 1 or 4.35 at the current Count setting.</p></div>';
    }
    var so = result.senate.filter(function (x) { return x.rec.id === m.id; })[0], sr = so.rec;
    var rs = rankOf(result, "senate", m.id), rngS = range(combos.map(function (c) { return rankOf(c, "senate", m.id); }));
    return '<div class="result"><h3>' + esc(STATE_NAMES[sr.state]) + " Senate <span class='matchup' style='display:inline'>" + esc(sr.matchup) + "</span></h3>" +
      "<div>" + esc(plainForecast(sr)) + (isW ? " · " + fmtVotes(sr.T) + " votes in 2024" : "") + "</div><dl>" +
      "<dt>Senate index</dt><dd>" + fmtIdx(so.indexSenate) + " · rank " + rs + " of " + result.senate.length + " contested seats</dd>" +
      "<dt>Rank range across settings</dt><dd>" + rngS + "</dd></dl></div>";
  }

  function renderResults() {
    var box = $("results");
    if (!query.trim()) { box.innerHTML = ""; return; }
    var ms = matches(query);
    if (!ms.length) { box.innerHTML = '<p class="hint">No match. Try a district like IA-01, a state, or a candidate name.</p>'; return; }
    if (ms.length === 1) { box.innerHTML = resultCard(ms[0]); return; }
    var shown = ms.slice(0, 12);
    var picks = shown.map(function (m) {
      var label = m.kind === "senate" ? STATE_NAMES[m.id] + " Senate" : m.id;
      return '<button type="button" data-kind="' + m.kind + '" data-id="' + esc(m.id) + '">' + esc(label) + "</button>";
    }).join("");
    box.innerHTML = '<p class="hint">' + ms.length + " matches" + (ms.length > shown.length ? " (showing " + shown.length + ")" : "") + '. Pick one:</p><div class="picks">' + picks + "</div>";
  }

  // ---------- wiring ----------
  function syncHints() {
    $("hint-weighting").textContent = settings.weighting === "weighted"
      ? "Chance that your own ballot is decisive. Smaller electorates score higher."
      : "How decisive each race is, ignoring how many people vote in it.";
  }
  function update() {
    result = recompute();
    syncHints();
    renderTable();
    renderResults();
  }
  function readControls() {
    settings.weighting = document.querySelector('input[name="weighting"]:checked').value;
    settings.sigma = document.querySelector('input[name="sigma"]:checked').value;
    settings.shape = document.querySelector('input[name="shape"]:checked').value;
    settings.w = parseFloat($("w").value);
  }
  function writeControls() {
    document.querySelector('input[name="weighting"][value="' + settings.weighting + '"]').checked = true;
    document.querySelector('input[name="sigma"][value="' + settings.sigma + '"]').checked = true;
    document.querySelector('input[name="shape"][value="' + settings.shape + '"]').checked = true;
    $("w").value = String(settings.w);
  }

  function init() {
    var sel = $("w");
    sel.innerHTML = W_OPTIONS.map(function (w) {
      return '<option value="' + w + '"' + (w === DEFAULTS.w ? " selected" : "") + ">" + (w === 4.35 ? "4.35 (default)" : w) + "</option>";
    }).join("");
    $("built").textContent = data.built;

    Array.prototype.forEach.call(document.querySelectorAll("input[type=radio], #w"), function (el) {
      el.addEventListener("change", function () { readControls(); update(); });
    });
    $("reset").addEventListener("click", function () { settings = Object.assign({}, DEFAULTS); writeControls(); update(); });
    $("q").addEventListener("input", function (e) { query = e.target.value; renderResults(); });
    $("results").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-id]");
      if (!b) return;
      $("results").innerHTML = resultCard({ kind: b.getAttribute("data-kind"), id: b.getAttribute("data-id") });
    });
    Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), function (b) {
      b.addEventListener("click", function () {
        view = b.getAttribute("data-view");
        Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        $("panel").setAttribute("aria-labelledby", b.id);
        renderTable();
      });
    });
    update();
  }

  fetch("data.json").then(function (r) { return r.json(); }).then(function (d) { data = d; init(); })
    .catch(function () { $("top-table").innerHTML = "<tr><td>Could not load data.json.</td></tr>"; });
})();
