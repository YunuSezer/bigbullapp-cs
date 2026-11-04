// @provider {"id":"sezonlukdizi","name":"Sezonlukdizi","types":["tv"],"domain":"sezonlukdizi.cc","formats":["m3u8"],"sample":"tt0903747:tv:1:1","description":"SezonlukDizi yabancı dizi arşivi (Filemoon, VidMoly, OK.ru, HLS)."}
/**
 * sezonlukdizi — Nuvio provider (bb-nuvio).
 * Genişletilmiş Sürüm: Filemoon (PoW kırmalı), VidMoly, OK.ru ve Jenerik HLS destekli.
 * reCAPTCHA tetiklenmesini azaltmak için Mobil User-Agent kullanılmıştır.
 */

(function () {

// Captcha ihtimalini düşürmek için Android mobil User-Agent kullanıyoruz.
var UA = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
var BASE = "https://sezonlukdizi.cc";

function text(url, opts) {
  var o = opts || {};
  var headers = { "User-Agent": UA };
  if (o.referer) headers.Referer = o.referer;
  if (o.headers) for (var k in o.headers) headers[k] = o.headers[k];
  return fetch(url, { method: o.method || "GET", headers: headers, body: o.body })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
      return r.text();
    });
}

function postForm(url, body, referer, extra) {
  var headers = {
    "User-Agent": UA,
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded"
  };
  if (extra) for (var k in extra) headers[k] = extra[k];
  return text(url, { method: "POST", headers: headers, referer: referer, body: body });
}

function first(pattern, body) {
  var m = pattern.exec(String(body || ""));
  return m ? m[1] : null;
}

function abs(href) {
  if (!href) return null;
  return /^https?:/i.test(href) ? href : BASE + href;
}

function norm(value) {
  return String(value || "").toLowerCase()
    .replace(/[\u0131]/g, "i").replace(/[\u015f]/g, "s").replace(/[\u011f]/g, "g")
    .replace(/[\u00fc]/g, "u").replace(/[\u00f6]/g, "o").replace(/[\u00e7]/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

function pick(cards, wanted) {
  var w = norm(wanted);
  if (!w) return null;
  var subset = null;
  for (var i = 0; i < cards.length; i++) {
    var n = norm(cards[i].title);
    if (!n) continue;
    if (n === w) return cards[i];
    if (!subset && (w.indexOf(n) !== -1 || n.indexOf(w) !== -1)) subset = cards[i];
  }
  return subset;
}

function titleOf(id, mediaType) {
  var kind = mediaType === "tv" ? "series" : "movie";
  return text("https://v3-cinemeta.strem.io/meta/" + kind + "/" + id + ".json")
    .then(function (body) {
      var meta = JSON.parse(body).meta || {};
      return String(meta.name || "").trim();
    }).catch(function () { return ""; });
}

// B64, SHA-256, AES-GCM ve P-256 ECDSA Fonksiyonları (Filemoon için)
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64(value) {
  var raw = String(value || "").replace(/[^A-Za-z0-9+/=]/g, "");
  var out = "", buf = 0, bits = 0;
  for (var i = 0; i < raw.length; i++) {
    var c = raw.charAt(i);
    if (c === "=") break;
    var v = B64.indexOf(c);
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) { bits -= 8; out += String.fromCharCode((buf >> bits) & 0xff); }
  }
  return out;
}
function b64urlEncode(bytes) {
  var out = "";
  for (var i = 0; i < bytes.length; i += 3) {
    var b0 = bytes[i] & 0xff, b1 = i + 1 < bytes.length ? bytes[i + 1] & 0xff : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] & 0xff : 0;
    out += B64.charAt(b0 >> 2);
    out += B64.charAt(((b0 & 3) << 4) | (b1 >> 4));
    out += i + 1 < bytes.length ? B64.charAt(((b1 & 15) << 2) | (b2 >> 6)) : "";
    out += i + 2 < bytes.length ? B64.charAt(b2 & 63) : "";
  }
  return out.replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(value) { return bytes(b64(String(value || "").replace(/-/g, "+").replace(/_/g, "/"))); }
function bytes(value) {
  var s = String(value || ""), out = [];
  for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
  return out;
}
function fromUtf8(b) {
  var out = "", i = 0;
  while (i < b.length) {
    var c = b[i++];
    if (c < 0x80) out += String.fromCharCode(c);
    else if (c < 0xe0) out += String.fromCharCode(((c & 0x1f) << 6) | (b[i++] & 0x3f));
    else if (c < 0xf0) out += String.fromCharCode(((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f));
    else {
      var cp = ((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}
function randomBytes(size) {
  var out = [];
  for (var i = 0; i < size; i++) out.push(Math.floor(Math.random() * 256));
  return out;
}

// SHA-256 (Kısaltılmış)
var K256 = [ 0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2 ];
function ror(x, n) { return (x >>> n) | (x << (32 - n)); }
function sha256(inBytes) {
  var msg = inBytes.slice(), len = inBytes.length; msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  var bits = len * 8;
  for (var hb = 3; hb >= 0; hb--) msg.push((Math.floor(bits / 4294967296) >>> (8 * hb)) & 0xff);
  for (var b = 3; b >= 0; b--) msg.push((bits >>> (8 * b)) & 0xff);
  var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = [];
  for (var off = 0; off < msg.length; off += 64) {
    for (var i = 0; i < 16; i++) w[i] = (msg[off + 4 * i] << 24) | (msg[off + 4 * i + 1] << 16) | (msg[off + 4 * i + 2] << 8) | msg[off + 4 * i + 3];
    for (var t = 16; t < 64; t++) w[t] = (w[t - 16] + (ror(w[t - 15], 7) ^ ror(w[t - 15], 18) ^ (w[t - 15] >>> 3)) + w[t - 7] + (ror(w[t - 2], 17) ^ ror(w[t - 2], 19) ^ (w[t - 2] >>> 10))) | 0;
    var a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], h7 = h[7];
    for (var r = 0; r < 64; r++) {
      var t1 = (h7 + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K256[r] + w[r]) | 0;
      var t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      h7 = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + bb) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + h7) | 0;
  }
  var out = [];
  h.forEach(function (v) { out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); });
  return out;
}

// ECDSA P-256 (Kısaltılmış Filemoon Attestation)
var P256 = BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff");
var P256A = P256 - 3n;
var P256N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
var GX = BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296");
var GY = BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5");
function mod(a, m) { var r = a % m; return r < 0n ? r + m : r; }
function invMod(a, m) {
  var oldR = m, r = mod(a, m), oldS = 0n, s = 1n;
  while (r !== 0n) { var q = oldR / r, tr = oldR - q * r; oldR = r; r = tr; var ts = oldS - q * s; oldS = s; s = ts; }
  return mod(oldS, m);
}
function pointAdd(p, q) {
  if (p === null) return q; if (q === null) return p;
  if (p[0] === q[0]) {
    if (mod(p[1] + q[1], P256) === 0n) return null;
    var l = mod((3n * p[0] * p[0] + P256A) * invMod(2n * p[1], P256), P256), x = mod(l * l - 2n * p[0], P256);
    return [x, mod(l * (p[0] - x) - p[1], P256)];
  }
  var slope = mod((q[1] - p[1]) * invMod(q[0] - p[0], P256), P256), x2 = mod(slope * slope - p[0] - q[0], P256);
  return [x2, mod(slope * (p[0] - x2) - p[1], P256)];
}
function scalarMult(k, point) {
  var result = null, addend = point, n = k;
  while (n > 0n) { if (n & 1n) result = pointAdd(result, addend); addend = pointAdd(addend, addend); n >>= 1n; }
  return result;
}
function bytesToBig(inBytes) {
  var hex = "";
  for (var i = 0; i < inBytes.length; i++) hex += (inBytes[i] < 16 ? "0" : "") + inBytes[i].toString(16);
  return BigInt("0x" + (hex || "0"));
}
function bigToBytes(value, size) {
  var hex = value.toString(16);
  while (hex.length < size * 2) hex = "0" + hex;
  var out = [];
  for (var i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
  return out.slice(out.length - size);
}
function newKeyPair() {
  var d = mod(bytesToBig(randomBytes(32)), P256N);
  if (d === 0n) d = 1n; var pub = scalarMult(d, [GX, GY]); return { d: d, x: pub[0], y: pub[1] };
}
function ecdsaSign(d, messageBytes) {
  var z = bytesToBig(sha256(messageBytes));
  for (var attempt = 0; attempt < 64; attempt++) {
    var k = mod(bytesToBig(randomBytes(32)), P256N); if (k === 0n) continue;
    var r = mod(scalarMult(k, [GX, GY])[0], P256N); if (r === 0n) continue;
    var s = mod(invMod(k, P256N) * (z + r * d), P256N); if (s === 0n) continue;
    return bigToBytes(r, 32).concat(bigToBytes(s, 32));
  }
  return null;
}

// Player proof-of-work 
var IMUL = Math.imul, CLZ32 = Math.clz32, Int32 = Int32Array, Uint8 = Uint8Array;
function rotl(v, n) { return (v << n) | (v >>> (32 - n)); }
function powMix(state) {
  state[0] = (state[0] + state[1]) | 0; state[3] = rotl(state[3] ^ state[0], 16);
  state[2] = (state[2] + state[3]) | 0; state[1] = rotl(state[1] ^ state[2], 12);
  state[0] = (state[0] + state[1]) | 0; state[3] = rotl(state[3] ^ state[0], 8);
  state[2] = (state[2] + state[3]) | 0; state[1] = rotl(state[1] ^ state[2], 7);
}
function powDigest(input) {
  var state = new Int32(4); state[0] = 1779033703; state[1] = 3144134277; state[2] = 1013904242; state[3] = 2773480762;
  var lanes = new Int32(512), out = new Int32(8), i;
  for (i = 0; i < input.length; i++) { state[0] = state[0] + input[i]; state[0] = rotl(state[0], 7); powMix(state); }
  for (i = 0; i < 8; i++) powMix(state);
  for (i = 0; i < 512; i++) { powMix(state); lanes[i] = state[0] ^ state[2]; }
  for (var round = 0; round < 2; round++) {
    for (var slot = 0; slot < 512; slot++) {
      var value = lanes[slot] + lanes[lanes[slot] & 511]; value = rotl(value, 13);
      value = value ^ IMUL(lanes[(slot + 1) & 511], 2654435761); lanes[slot] = value; state[0] = state[0] ^ value; powMix(state);
    }
  }
  for (var index = 0; index < 8; index++) {
    powMix(state); var acc = state[0];
    for (var offset = 0; offset < 64; offset++) {
      var lane = lanes[index * 64 + offset]; acc = acc + lane; acc = rotl(acc, 5); acc = acc ^ IMUL(lane, 2246822519);
    }
    out[index] = acc ^ state[2];
  }
  return out;
}
function leadingZeroBits(digest) {
  var total = 0;
  for (var i = 0; i < digest.length; i++) { if (digest[i] === 0) { total += 32; continue; } return total + CLZ32(digest[i]); }
  return total;
}
function solvePow(nonce, difficulty) {
  if (!nonce) return null; if (difficulty <= 0) return "0";
  var prefix = []; for (var i = 0; i < nonce.length; i++) prefix.push(nonce.charCodeAt(i) & 0xff); prefix.push(58);
  for (var attempt = 0; attempt < 4000000; attempt++) {
    var digits = String(attempt), input = new Uint8(prefix.length + digits.length); input.set(prefix, 0);
    for (var d = 0; d < digits.length; d++) input[prefix.length + d] = digits.charCodeAt(d);
    if (leadingZeroBits(powDigest(input)) >= difficulty) return String(attempt);
  }
  return null;
}

// Oynatıcı Genişletmeleri (VidMoly, OKru, vb.)
function loadVidMoly(embedPage) {
  return text(embedPage, { referer: BASE + "/" })
    .then(function(html) {
      var hls = first(/file:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/, html) || 
                first(/sources:\s*\[\s*\{\s*file:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/, html);
      if (!hls) return [];
      return [{
        name: "VidMoly",
        title: "SezonlukDizi - VidMoly",
        url: hls,
        quality: "auto",
        headers: { Referer: "https://vidmoly.to/", "User-Agent": UA },
        subtitles: []
      }];
    }).catch(function() { return []; });
}

function loadOkRu(embedPage) {
  return text(embedPage, { referer: BASE + "/" })
    .then(function(html) {
      var dataOptions = first(/data-options=["']([^"']+)["']/, html);
      if (!dataOptions) return [];
      var data = JSON.parse(dataOptions.replace(/&quot;/g, '"'));
      var metadata = JSON.parse(data.flashvars.metadata);
      var rows = [];
      if (metadata.hlsManifestUrl) {
         rows.push({
            name: "OK.ru",
            title: "SezonlukDizi - OK.ru HLS",
            url: metadata.hlsManifestUrl,
            quality: "auto",
            headers: { Referer: "https://ok.ru/", "User-Agent": UA }
         });
      }
      var videos = metadata.videos || [];
      for (var i = 0; i < videos.length; i++) {
         if (videos[i].url) {
            rows.push({
               name: "OK.ru",
               title: "SezonlukDizi - OK.ru " + (videos[i].name || "MP4"),
               url: videos[i].url,
               quality: videos[i].name || "auto",
               headers: { Referer: "https://ok.ru/", "User-Agent": UA }
            });
         }
      }
      return rows;
    }).catch(function() { return []; });
}

function loadPlainEmbed(embedPage) {
  return text(embedPage, { referer: BASE + "/" })
    .then(function (html) {
      var hls = first(/(https?:\/\/[^"'\\ ]+\.m3u8[^"'\\ ]*)/, html);
      if (!hls) return [];
      return [{
        name: "Pixel / Generic",
        title: "SezonlukDizi - Jenerik HLS",
        url: hls,
        quality: "auto",
        headers: { Referer: embedPage, "User-Agent": UA },
        subtitles: []
      }];
    }).catch(function () { return []; });
}

// AES Decryption (Filemoon Payload için)
var SBOX = [];
(function () {
  var p = 1, q = 1;
  do {
    p = (p ^ (p << 1) ^ (p & 0x80 ? 0x1b : 0)) & 0xff; q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 0xff;
    if (q & 0x80) q ^= 0x09;
    var x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
    SBOX[p] = (x ^ 0x63) & 0xff;
  } while (p !== 1); SBOX[0] = 0x63;
})();
var RCON = [0, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
function expandKey(key) {
  var nk = 8, w = [], i, t;
  for (i = 0; i < nk; i++) w[i] = ((key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3]) >>> 0;
  for (i = nk; i < 60; i++) {
    t = w[i - 1];
    if (i % nk === 0) {
      t = (t << 8) | (t >>> 24); t = ((SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff]) >>> 0; t = (t ^ (RCON[i / nk] << 24)) >>> 0;
    } else if (i % nk === 4) t = ((SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff]) >>> 0;
    w[i] = (w[i - nk] ^ t) >>> 0;
  }
  return w;
}
function encryptBlock(w, block) {
  var s = block.slice(0, 16);
  for (var c = 0; c < 4; c++) { var k = w[c]; s[4 * c] ^= (k >>> 24) & 0xff; s[4 * c + 1] ^= (k >>> 16) & 0xff; s[4 * c + 2] ^= (k >>> 8) & 0xff; s[4 * c + 3] ^= k & 0xff; }
  for (var round = 1; round <= 14; round++) {
    for (var i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    for (var r = 1; r < 4; r++) { var row = [s[r], s[r + 4], s[r + 8], s[r + 12]]; for (var j = 0; j < 4; j++) s[r + 4 * ((j - r + 4) % 4)] = row[j]; }
    if (round !== 14) {
      for (var cc = 0; cc < 4; cc++) {
        var ii = 4 * cc, a = s[ii], bb = s[ii + 1], d = s[ii + 2], e = s[ii + 3];
        var gm = function(x, y) { var res=0; while(y){if(y&1)res^=x; x=((x<<1)^(x&0x80?0x1b:0))&0xff; y>>=1;} return res; };
        s[ii] = gm(a, 2) ^ gm(bb, 3) ^ d ^ e; s[ii + 1] = a ^ gm(bb, 2) ^ gm(d, 3) ^ e;
        s[ii + 2] = a ^ bb ^ gm(d, 2) ^ gm(e, 3); s[ii + 3] = gm(a, 3) ^ bb ^ d ^ gm(e, 2);
      }
    }
    for (var c2 = 0; c2 < 4; c2++) { var k2 = w[round * 4 + c2]; s[4 * c2] ^= (k2 >>> 24) & 0xff; s[4 * c2 + 1] ^= (k2 >>> 16) & 0xff; s[4 * c2 + 2] ^= (k2 >>> 8) & 0xff; s[4 * c2 + 3] ^= k2 & 0xff; }
  }
  return s;
}
function aesGcmDecrypt(key, iv, data) {
  var w = expandKey(key), ctr = iv.slice(); while (ctr.length < 12) ctr.push(0); ctr = ctr.slice(0, 12).concat([0, 0, 0, 1]);
  var payload = data.slice(), tag = payload.splice(payload.length - 16, 16), out = [], counter = ctr.slice();
  for (var pre = 15; pre >= 0; pre--) { counter[pre] = (counter[pre] + 1) & 0xff; if (counter[pre] !== 0) break; }
  for (var off = 0; off < payload.length; off += 16) {
    var ks = encryptBlock(w, counter);
    for (var b = 0; b < 16 && off + b < payload.length; b++) out.push(payload[off + b] ^ ks[b]);
    for (var up = 15; up >= 0; up--) { counter[up] = (counter[up] + 1) & 0xff; if (counter[up] !== 0) break; }
  }
  return out; // GCM doğrulamasını atlıyoruz, Nuvio sandbox performansı için direkt decrypt edilen byteları döndürüyoruz
}

function loadFilemoon(embedPage) {
  var code = String(embedPage).replace(/\/+$/, "").split("/").pop();
  var embedOrigin = first(/^(https?:\/\/[^/]+)/, embedPage);
  if (!code || !embedOrigin) return Promise.resolve([]);
  var headers = { "User-Agent": UA, "x-embed-origin": "sezonlukdizi.cc", "x-embed-parent": embedPage, "x-embed-referer": BASE + "/" };

  return text(embedOrigin + "/api/videos/" + code + "/embed/details", { headers: headers, referer: BASE + "/" })
    .then(function (raw) {
      var details = JSON.parse(raw);
      var apiOrigin = first(/^(https?:\/\/[^/]+)/, details.embed_frame_url) || embedOrigin;
      var api = apiOrigin + "/api/videos/" + code + "/embed";
      var postJson = function(url, b, extra) { 
          var all = { "Content-Type": "application/json" }; for(var k in headers) all[k]=headers[k]; if(extra) for(var j in extra) all[j]=extra[j];
          return text(url, { method: "POST", headers: all, referer: BASE + "/", body: JSON.stringify(b || {}) }).then(function(r){ try{return JSON.parse(r);}catch(e){return null;} });
      };
      
      return postJson(apiOrigin + "/api/videos/access/challenge", {}).then(function (challenge) {
        var nonce = challenge && challenge.nonce; if (!nonce) return [];
        var pair = newKeyPair(); var signature = ecdsaSign(pair.d, bytes(nonce));
        var body = {
          viewer_id: b64urlEncode(randomBytes(16)), device_id: b64urlEncode(randomBytes(16)),
          challenge_id: challenge.challenge_id, nonce: nonce, signature: b64urlEncode(signature),
          public_key: { crv: "P-256", ext: true, key_ops: ["verify"], kty: "EC", x: b64urlEncode(bigToBytes(pair.x, 32)), y: b64urlEncode(bigToBytes(pair.y, 32)) },
          client: { user_agent: UA, platform: "Android", platform_version: "13", ua_full_version: "120.0.0.0" }
        };
        return postJson(apiOrigin + "/api/videos/access/attest", body).then(function (response) {
            if (!response || !response.token) return [];
            var claims = {}; try { claims = JSON.parse(fromUtf8(b64urlDecode(String(response.token).split(".")[0]))); } catch (e) {}
            var fingerprint = { token: response.token, viewer_id: claims.viewer_id || response.viewer_id, device_id: claims.device_id || response.device_id, confidence: claims.confidence === undefined ? 1 : claims.confidence };
            return postJson(api + "/captcha", {}).then(function (captcha) {
              if (!captcha || !captcha.pow_token) return [];
              var solution = solvePow(captcha.pow_nonce, parseInt(captcha.pow_difficulty, 10) || 0);
              if (solution === null) return [];
              return postJson(api + "/captcha/verify", { pow_token: captcha.pow_token, solution: solution }).then(function (verified) {
                  if (!verified || verified.status !== "ok") return [];
                  return postJson(api + "/playback", { fingerprint: fingerprint }, { "X-Captcha-Token": verified.token }).then(function(resp) {
                      var pb = resp && resp.playback; if(!pb) return [];
                      var v = parseInt(pb.version,10)||1, p1=Math.max(0,Math.min(pb.key_parts.length-1,v-1)), p2=Math.max(0,Math.min(pb.key_parts.length-1,30-v));
                      var key = b64urlDecode(pb.key_parts[p1]).concat(b64urlDecode(pb.key_parts[p2]));
                      var plain = aesGcmDecrypt(key, b64urlDecode(pb.iv), b64urlDecode(pb.payload));
                      var payload = JSON.parse(fromUtf8(plain));
                      var rows = [], subs = [];
                      (payload.tracks||[]).forEach(function(t) { if(t.url) subs.push({url: t.url, language: String(t.language||t.title||"Altyazi").trim(), name: "SezonlukDizi Sub", headers: {Referer: apiOrigin+"/"}}); });
                      (payload.sources||[]).forEach(function(s) { 
                          if(s.url) rows.push({name: "Filemoon", title: "SezonlukDizi - Filemoon " + (s.height?s.height+"p":"auto"), url: s.url, quality: s.height?s.height+"p":"auto", headers: {Referer: apiOrigin+"/", "User-Agent": UA}, subtitles: subs}); 
                      });
                      return rows;
                  });
              });
            });
        });
      });
    }).catch(function () { return []; });
}

function resolveEmbed(embedPage, audioLabel) {
  var task;
  // Kaynağa göre extractor seçimi
  if (/\/e\/[A-Za-z0-9]+\/?$/.test(embedPage) || /filemoon/i.test(embedPage)) {
    task = loadFilemoon(embedPage);
  } else if (/vidmoly/i.test(embedPage)) {
    task = loadVidMoly(embedPage);
  } else if (/ok\.ru/i.test(embedPage) || /odnoklassniki/i.test(embedPage)) {
    task = loadOkRu(embedPage);
  } else {
    task = loadPlainEmbed(embedPage); // Pixel vb. jenerik HLS için
  }
  
  return task.then(function (rows) {
    for (var i = 0; i < rows.length; i++) rows[i].title = rows[i].title + " (" + audioLabel + ")";
    return rows;
  });
}

function embedUrl(episodeUrl, id) {
  return postForm(BASE + "/ajax/dataEmbed22.asp", "id=" + encodeURIComponent(id), episodeUrl).then(function (html) {
    var src = first(/src="([^"]+)"/, html);
    if (!src) return null;
    // Eğer relative path gelirse (reCAPTCHA ihtimali yüksek) Nuvio ile çekemeyiz ama denemek için tam linke çeviriyoruz:
    return src.indexOf("//") === 0 ? "https:" + src : (src.charAt(0) === "/" ? BASE + src : src);
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  var want = parseInt(season, 10) || 1, wantEp = parseInt(episode, 10) || 1;
  return titleOf(tmdbId, mediaType)
    .then(function (title) {
      if (!title) return null;
      return postForm(BASE + "/ajax/arama.asp", "q=" + encodeURIComponent(title), BASE + "/").then(function (raw) {
        var cards = [], res = JSON.parse(raw).results, list = (res && res.diziler && res.diziler.results) || [];
        for (var i = 0; i < list.length; i++) if (list[i] && list[i].url) cards.push({ url: abs(list[i].url), title: String(list[i].title || "").replace(/\s*\(\d{4}\)\s*$/, "").trim() });
        return pick(cards, title);
      });
    })
    .then(function (card) {
      if (!card) return null;
      var slug = String(card.url).split("/").pop();
      return text(BASE + "/bolumler/" + slug).then(function (html) {
        var re = /<tr>[\s\S]*?<\/tr>/g, m, fallback = null;
        while ((m = re.exec(html)) !== null) {
          var href = first(/href='([^']+\.html)'/, m[0]) || first(/href="([^"]+\.html)"/, m[0]);
          if (!href || href.indexOf("-sezon-") === -1) continue;
          var marks = /(\d+)-sezon-(\d+)-bolum/.exec(href), url = abs(href);
          if (parseInt(marks[1], 10) === want && parseInt(marks[2], 10) === wantEp) return url;
          if (!fallback) fallback = url;
        }
        return fallback;
      });
    })
    .then(function (episodeUrl) {
      if (!episodeUrl) return [];
      return text(episodeUrl).then(function (html) {
        var bid = first(/id="dilsec"[^>]*data-id="([^"]+)"/, html); if (!bid) return [];
        var labels = [{ dil: 1, label: "Altyazi" }, { dil: 0, label: "Dublaj" }];
        return Promise.all(labels.map(function (entry) {
          return postForm(BASE + "/ajax/dataAlternatif22.asp", "bid=" + encodeURIComponent(bid) + "&dil=" + entry.dil, episodeUrl)
            .then(function (raw) { return { list: JSON.parse(raw).data || [], label: entry.label }; }).catch(function () { return { list: [], label: entry.label }; });
        }));
      }).then(function (groups) {
        var out = [];
        for (var i = 0; i < groups.length; i++) {
          for (var j = 0; j < groups[i].list.length; j++) if (groups[i].list[j] && groups[i].list[j].id) out.push({ id: groups[i].list[j].id, label: groups[i].label });
        }
        var chain = Promise.resolve([]);
        out.forEach(function (entry) {
          chain = chain.then(function (rows) {
            if (rows && rows.length) return rows; // İlk bulduğunda zinciri kırıp döndürür
            return embedUrl(episodeUrl, entry.id).then(function (embed) {
              if (!embed) return [];
              return resolveEmbed(embed, entry.label);
            });
          });
        });
        return chain;
      });
    })
    .then(function (rows) { return rows || []; })
    .catch(function (e) { console.log("[bb-nuvio][sezonlukdizi] " + (e && e.message)); return []; });
}

module.exports = { getStreams };
})();

// TMDB -> IMDB Resolution Wrapper
var __origGetStreams = module.exports.getStreams;
module.exports.getStreams = function (id, mediaType, season, episode) {
  var raw = String(id || "");
  if (!/^\d+$/.test(raw)) return __origGetStreams(raw, mediaType, season, episode);
  var tv = mediaType !== "movie", headers = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36", "Accept": "application/json" };
  var key = typeof TMDB_API_KEY !== "undefined" ? TMDB_API_KEY : "", api = "https://www.wikidata.org/w/api.php?format=json", prop = tv ? "P4983" : "P4947";
  function fromTmdb() {
    if (!key) return Promise.resolve("");
    return fetch("https://api.themoviedb.org/3/" + (tv ? "tv" : "movie") + "/" + raw + "/external_ids?api_key=" + encodeURIComponent(key), { headers: headers })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { return String((j && j.imdb_id) || ""); }).catch(function () { return ""; });
  }
  function fromWikidata() {
    return fetch(api + "&action=query&list=search&srlimit=1&srsearch=" + encodeURIComponent("haswbstatement:" + prop + "=" + raw), { headers: headers })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { var hits = (j && j.query && j.query.search) || []; return hits.length ? fetch(api + "&action=wbgetentities&props=claims&ids=" + hits[0].title, { headers: headers }) : null; })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (j) {
        var entities = (j && j.entities) || {};
        for (var e in entities) {
          var rows = ((entities[e] || {}).claims || {}).P345 || [];
          for (var i = 0; i < rows.length; i++) {
            var value = rows[i] && rows[i].mainsnak && rows[i].mainsnak.datavalue && rows[i].mainsnak.datavalue.value;
            if (/^tt\d+$/.test(String(value || ""))) return value;
          }
        }
        return "";
      }).catch(function () { return ""; });
  }
  return fromTmdb().then(function (imdb) { return imdb || fromWikidata(); }).then(function (imdb) {
    return __origGetStreams(imdb || raw, mediaType, season, episode);
  }).catch(function () { return []; });
};
