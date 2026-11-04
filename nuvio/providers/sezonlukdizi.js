@provider {"id":"sezonlukdizi-proxy","name":"SezonlukDizi (Proxy)","types":["tv"],"domain":"sezonlukdizi.cc","formats":["m3u8"],"sample":"tt0903747:tv:1:1"}
(function () {
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36";
  var BASE = "https://sezonlukdizi.cc";
  
  // Senin Codespaces Proxy Adresin
  var PROXY_API = "https://congenial-meme-wq95v5p9pg525j7j-3000.app.github.dev/api/sezonluk?url=";

  function text(url, opts) {
    var o = opts || {}, headers = { "User-Agent": UA };
    if (o.headers) for (var k in o.headers) headers[k] = o.headers[k];
    return fetch(url, { method: o.method || "GET", headers: headers, body: o.body }).then(function(r) { return r.ok ? r.text() : ""; });
  }

  function postForm(url, body) {
    return text(url, { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded" }, body: body });
  }

  function abs(href) { return (!href) ? null : (/^https?:/i.test(href) ? href : BASE + href); }

  function titleOf(id, type) {
    return text("https://v3-cinemeta.strem.io/meta/" + (type === "tv" ? "series" : "movie") + "/" + id + ".json")
      .then(function(b) { return String(JSON.parse(b).meta.name || "").trim(); }).catch(function() { return ""; });
  }

  function getStreams(tmdbId, mediaType, season, episode) {
    var want = parseInt(season, 10) || 1, wantEp = parseInt(episode, 10) || 1;

    return titleOf(tmdbId, mediaType).then(function(title) {
      if (!title) return [];
      
      // 1. Diziyi sitede ara
      return postForm(BASE + "/ajax/arama.asp", "q=" + encodeURIComponent(title)).then(function(raw) {
        try {
          var list = JSON.parse(raw).results.diziler.results || [];
          var url = "";
          for(var i=0; i<list.length; i++) {
             if (list[i].title.toLowerCase().indexOf(title.toLowerCase()) !== -1) { url = abs(list[i].url); break; }
          }
          if (!url && list.length > 0) url = abs(list[0].url);
          if (!url) return [];

          // 2. Dizi sayfasına gidip hedef bölümün URL'sini bul
          return text(url).then(function(html) {
             var re = /<tr>[\s\S]*?<\/tr>/g, m, fallback = null;
             while ((m = re.exec(html)) !== null) {
               var match = /href=["']([^"']+\.html)["']/.exec(m[0]);
               if (!match || match[1].indexOf("-sezon-") === -1) continue;
               var marks = /(\d+)-sezon-(\d+)-bolum/.exec(match[1]);
               var epUrl = abs(match[1]);
               if (parseInt(marks[1], 10) === want && parseInt(marks[2], 10) === wantEp) return epUrl;
               if (!fallback) fallback = epUrl;
             }
             return fallback;
          }).then(function(episodeUrl) {
             if (!episodeUrl) return [];
             
             // 3. Bölüm URL'sini Node.js Proxy'e yolla ve m3u8 sonuçlarını bekle
             return fetch(PROXY_API + encodeURIComponent(episodeUrl))
               .then(function(r) { return r.json(); })
               .then(function(data) { return Array.isArray(data) ? data : []; })
               .catch(function() { return []; });
          });
        } catch(e) { return []; }
      });
    });
  }

  module.exports = { getStreams };
})();

var __origGetStreams = module.exports.getStreams;
module.exports.getStreams = function (id, mediaType, season, episode) {
  var raw = String(id || "");
  if (!/^\d+$/.test(raw)) return __origGetStreams(raw, mediaType, season, episode);
  var tv = mediaType !== "movie", h = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36", "Accept": "application/json" };
  var api = "https://www.wikidata.org/w/api.php?format=json", prop = tv ? "P4983" : "P4947";
  
  function fromTmdb() {
    return fetch("https://api.themoviedb.org/3/" + (tv ? "tv" : "movie") + "/" + raw + "/external_ids?api_key=" + (typeof TMDB_API_KEY !== "undefined" ? TMDB_API_KEY : ""), { headers: h })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return String((j && j.imdb_id) || ""); }).catch(function () { return ""; });
  }
  function fromWikidata() {
    return fetch(api + "&action=query&list=search&srlimit=1&srsearch=" + encodeURIComponent("haswbstatement:" + prop + "=" + raw), { headers: h })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { var hits = (j && j.query && j.query.search) || []; return hits.length ? fetch(api + "&action=wbgetentities&props=claims&ids=" + hits[0].title, { headers: h }) : null; })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (j) {
        var e = (j && j.entities) || {};
        for (var k in e) {
          var rows = ((e[k] || {}).claims || {}).P345 || [];
          for (var i = 0; i < rows.length; i++) {
            var v = rows[i] && rows[i].mainsnak && rows[i].mainsnak.datavalue && rows[i].mainsnak.datavalue.value;
            if (/^tt\d+$/.test(String(v || ""))) return v;
          }
        }
        return "";
      }).catch(function () { return ""; });
  }
  return fromTmdb().then(function (imdb) { return imdb || fromWikidata(); }).then(function (imdb) {
    return __origGetStreams(imdb || raw, mediaType, season, episode);
  }).catch(function () { return []; });
};
