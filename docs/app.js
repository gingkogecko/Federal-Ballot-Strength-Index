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

  // State average: mean of the state's House-district indexes (voter-weighted when counting per voter).
  // Because each district's combined index already adds the state's Senate race, this is the
  // state's average House power plus its Senate power.
  function stateAgg(res, weighted) {
    var by = {};
    res.house.forEach(function (o) {
      var g = by[o.rec.state] || (by[o.rec.state] = { state: o.rec.state, n: 0, T: 0, h: 0, t: 0 });
      var wt = weighted ? o.rec.T : 1;
      g.n++; g.T += o.rec.T; g.W = (g.W || 0) + wt; g.h += wt * o.indexHouse; g.t += wt * o.indexTotal;
    });
    return Object.keys(by).map(function (k) {
      var g = by[k]; g.avgHouse = g.h / g.W; g.avgTotal = g.t / g.W; return g;
    });
  }
  function stateRank(list, st) {
    var s = list.slice().sort(function (a, b) { return b.avgTotal - a.avgTotal; });
    for (var i = 0; i < s.length; i++) if (s[i].state === st) return i + 1;
    return null;
  }

  // ---------- table ----------
  function renderTable() {
    var rows, key, label, extraHead = "", isW = settings.weighting === "weighted";
    var table = $("top-table");
    var hint = $("view-hint");
    var idxName = isW ? "Index (1.00 = average voter)" : "Index (1.00 = average race)";
    var list;
    if (view === "state") {
      var agg = stateAgg(result, isW).sort(function (a, b) { return b.avgTotal - a.avgTotal; }).slice(0, TOP_N);
      hint.textContent = "Average of each state's House district indexes" + (isW ? " (weighted by votes)" : "") + ", which already include the state's Senate race (Senate weighted ×" + (settings.w === 4.35 ? "4.35" : settings.w) + ").";
      table.innerHTML = "<caption class='visually-hidden'>Top " + TOP_N + " states by average combined index</caption><thead><tr><th class='num'>#</th><th>State</th><th>Senate race</th>" +
        (isW ? "<th class='num'>Votes (2024)</th>" : "") + "<th class='num'>Districts</th><th class='num'>House avg</th><th class='num'>" + esc(idxName) + "</th></tr></thead><tbody>" +
        agg.map(function (g, i) {
          var sen = data.senate.filter(function (x) { return x.state === g.state; });
          var senTxt = sen.length ? sen.map(function (x) { return forecast(x); }).join("") : '<span class="matchup">no race in 2026</span>';
          return "<tr><td class='num rank'>" + (i + 1) + "</td><td class='id'>" + esc(STATE_NAMES[g.state]) + "</td><td>" + senTxt + "</td>" +
            (isW ? "<td class='num'>" + fmtVotes(g.T) + "</td>" : "") + "<td class='num'>" + g.n + "</td><td class='num'>" + fmtIdx(g.avgHouse) + "</td><td class='num idx'>" + fmtIdx(g.avgTotal) + "</td></tr>";
        }).join("") + "</tbody>";
      return;
    }
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
  // Every combination of the user-facing choices, computed once (the data never changes while the page is open).
  var comboCache = null;
  function allCombos() {
    if (comboCache) return comboCache;
    comboCache = [];
    ["weighted", "unweighted"].forEach(function (wt) {
      ["common", "implied"].forEach(function (sg) {
        ["fat", "normal"].forEach(function (sh) {
          [1, 4.35].forEach(function (w) {
            var st = { weighting: wt, w: w, sigma: sg, shape: sh, nu: DEFAULTS.nu };
            comboCache.push({ s: st, res: recompute(st) });
          });
        });
      });
    });
    return comboCache;
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
    var u = q.toUpperCase().replace(/[\s.]/g, ""), l = q.toLowerCase(), out = [], keys = Object.keys(STATE_NAMES);
    // district code such as IA-01, ia1, AK-AL
    var dm = u.match(/^([A-Z]{2})-?(\d{1,2}|AL)$/);
    if (dm) {
      var id = dm[1] + "-" + (dm[2] === "AL" ? "AL" : ("0" + dm[2]).slice(-2));
      if (data.house.some(function (r) { return r.id === id; })) return [{ kind: "house", id: id }];
    }
    // state: postal code, full name, or name prefix. Always answered with the statewide result.
    var st = keys.filter(function (k) { return k === u || (l.length >= 3 && STATE_NAMES[k].toLowerCase() === l); });
    if (!st.length && l.length >= 3) st = keys.filter(function (k) { return STATE_NAMES[k].toLowerCase().indexOf(l) === 0; });
    if (st.length) return st.map(function (k) { return { kind: "state", id: k }; });
    // candidate names
    if (l.length >= 3) {
      data.house.forEach(function (r) { if (r.matchup.toLowerCase().indexOf(l) >= 0) out.push({ kind: "house", id: r.id }); });
      data.senate.forEach(function (r) { if (r.matchup.toLowerCase().indexOf(l) >= 0) out.push({ kind: "senate", id: r.id }); });
    }
    return out;
  }

  function resultCard(m) {
    var isW = settings.weighting === "weighted", combos = allCombos();
    if (m.kind === "state") {
      var agg = stateAgg(result, isW), g = agg.filter(function (x) { return x.state === m.id; })[0];
      var rk = stateRank(agg, m.id), rngSt = range(combos.map(function (c) { return stateRank(stateAgg(c.res, c.s.weighting === "weighted"), m.id); }));
      var sens = result.senate.filter(function (x) { return x.rec.state === m.id; });
      var senHtml = sens.length ? sens.map(function (x) {
        return esc(x.rec.matchup) + " (" + esc(plainForecast(x.rec)) + ") · Senate index " + fmtIdx(x.indexSenate) + " · rank " + rankOf(result, "senate", x.rec.id) + " of " + result.senate.length;
      }).join("<br>") : "none in 2026";
      var dists = result.house.filter(function (x) { return x.rec.state === m.id; }).sort(function (a, b) { return a.rec.id < b.rec.id ? -1 : 1; });
      var picksHtml = dists.map(function (x) { return '<button type="button" data-kind="house" data-id="' + esc(x.rec.id) + '">' + esc(x.rec.id) + "</button>"; }).join("");
      return '<div class="result"><h3>' + esc(STATE_NAMES[m.id]) + '</h3><div>' + g.n + " House district" + (g.n === 1 ? "" : "s") + (isW ? " · " + fmtVotes(g.T) + " votes in 2024" : "") + "</div><dl>" +
        "<dt>State average (combined)</dt><dd>" + fmtIdx(g.avgTotal) + " · rank " + rk + " of " + agg.length + " states</dd>" +
        "<dt>House-only average</dt><dd>" + fmtIdx(g.avgHouse) + "</dd>" +
        "<dt>Senate race</dt><dd>" + senHtml + "</dd>" +
        "<dt>Rank range across settings</dt><dd>state average " + rngSt + "</dd></dl>" +
        '<p class="hint">State average = the average of the state\'s House district combined indexes' + (isW ? " (weighted by votes)" : "") + ', each of which includes the state\'s Senate race. The rank range covers per voter vs per race, σ mode, curve shape and Senate weight 1 or 4.35. Districts:</p><div class="picks">' + picksHtml + "</div></div>";
    }
    if (m.kind === "house") {
      var o = result.house.filter(function (x) { return x.rec.id === m.id; })[0], rec = o.rec;
      var sen = data.senate.filter(function (s) { return s.state === rec.state; });
      var rcT = rankOf(result, "total", m.id), rcH = rankOf(result, "house", m.id);
      var rngT = range(combos.map(function (c) { return rankOf(c.res, "total", m.id); }));
      var rngH = range(combos.map(function (c) { return rankOf(c.res, "house", m.id); }));
      return '<div class="result"><p class="hint" style="margin:0 0 6px"><button type="button" class="ghost" data-kind="state" data-id="' + esc(rec.state) + '">&larr; ' + esc(STATE_NAMES[rec.state]) + '</button></p><h3>' + esc(rec.id) + ' <span class="matchup" style="display:inline">' + esc(rec.matchup) + "</span></h3>" +
        "<div>" + esc(plainForecast(rec)) + (isW ? " · " + fmtVotes(rec.T) + " votes in 2024" : "") + "</div><dl>" +
        "<dt>Combined index</dt><dd>" + fmtIdx(o.indexTotal) + " · rank " + rcT + " of " + result.house.length + "</dd>" +
        "<dt>House-only index</dt><dd>" + fmtIdx(o.indexHouse) + " · rank " + rcH + " of " + result.house.length + "</dd>" +
        "<dt>Senate race in " + esc(STATE_NAMES[rec.state]) + "</dt><dd>" + (sen.length ? esc(sen.map(function (s) { return s.matchup + " (" + plainForecast(s) + ")"; }).join("; ")) : "none in 2026") + "</dd>" +
        "<dt>Rank range across settings</dt><dd>combined " + rngT + " · House-only " + rngH + "</dd></dl>" +
        '<p class="hint">Range covers per voter vs per race, σ mode, curve shape and Senate weight 1 or 4.35.</p></div>';
    }
    var so = result.senate.filter(function (x) { return x.rec.id === m.id; })[0], sr = so.rec;
    var rs = rankOf(result, "senate", m.id), rngS = range(combos.map(function (c) { return rankOf(c.res, "senate", m.id); }));
    return '<div class="result"><p class="hint" style="margin:0 0 6px"><button type="button" class="ghost" data-kind="state" data-id="' + esc(sr.state) + '">&larr; ' + esc(STATE_NAMES[sr.state]) + '</button></p><h3>' + esc(STATE_NAMES[sr.state]) + " Senate <span class='matchup' style='display:inline'>" + esc(sr.matchup) + "</span></h3>" +
      "<div>" + esc(plainForecast(sr)) + (isW ? " · " + fmtVotes(sr.T) + " votes in 2024" : "") + "</div><dl>" +
      "<dt>Senate index</dt><dd>" + fmtIdx(so.indexSenate) + " · rank " + rs + " of " + result.senate.length + " contested seats</dd>" +
      "<dt>Rank range across settings</dt><dd>" + rngS + "</dd></dl></div>";
  }

  function renderResults() {
    var box = $("results");
    if (!query.trim()) { box.innerHTML = ""; return; }
    var ms = matches(query);
    if (!ms.length) { box.innerHTML = '<p class="hint">No match. Try a district like IA-01, a state name or postal code, or a candidate name.</p>'; return; }
    if (ms.length === 1) { box.innerHTML = resultCard(ms[0]); return; }
    var shown = ms.slice(0, 12);
    var picks = shown.map(function (m) {
      var label = m.kind === "senate" ? STATE_NAMES[m.id] + " Senate" : m.kind === "state" ? STATE_NAMES[m.id] : m.id;
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
