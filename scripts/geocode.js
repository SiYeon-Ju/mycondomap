const fs = require("fs");
const path = require("path");

const REST_KEY = process.env.KAKAO_REST_KEY;
if (!REST_KEY) {
  console.error("KAKAO_REST_KEY 환경변수 없음");
  process.exit(1);
}

const CAPITAL_BBOX = { latMin: 36.5, latMax: 38.3, lngMin: 126.2, lngMax: 127.9 };
const SOURCES = [
  { csv: "jeju_condo_info.csv", 권역: "제주", queryPrefix: "제주", bbox: { latMin: 33.0, latMax: 33.6, lngMin: 126.0, lngMax: 127.0 } },
  { csv: "gyeonggi_incheon_hotel_info.csv", 권역: "경기인천", queryPrefix: "", bbox: CAPITAL_BBOX },
  { csv: "seoul_hotel_info.csv", 권역: "서울", queryPrefix: "서울", bbox: CAPITAL_BBOX },
];

function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some(f => f !== "")) rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); if (row.some(f => f !== "")) rows.push(row); }
  return rows;
}

function readRows(source) {
  const filePath = path.join(__dirname, "..", source.csv);
  const rows = parseCsv(fs.readFileSync(filePath, "utf8"));
  return rows.slice(1);
}

function inBbox(doc, bbox) {
  const lat = Number(doc.y), lng = Number(doc.x);
  return lat >= bbox.latMin && lat <= bbox.latMax && lng >= bbox.lngMin && lng <= bbox.lngMax;
}

async function geocodeOnce(query, bbox) {
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${REST_KEY}` } });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const docs = data.documents || [];
  return docs.find(d => inBbox(d, bbox)) || null;
}

function backoffPhrases(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const out = [];
  for (let n = tokens.length; n >= 1; n--) out.push(tokens.slice(0, n).join(" "));
  return out;
}

async function geocode(지역, 콘도명, queryPrefix, bbox) {
  const cleaned = 콘도명.replace(/\([^)]*\)/g, "").replace(/[_&.]/g, " ").replace(/\s+/g, " ").trim();
  const noSuffixWords = cleaned.replace(/(호텔|리조트|펜션|앤리조트)/g, " ").replace(/\s+/g, " ").trim();
  const prefix = queryPrefix ? `${queryPrefix} ` : "";

  const phrases = [...new Set([...backoffPhrases(cleaned), ...backoffPhrases(noSuffixWords)])];
  const queries = [`${prefix}${지역} ${콘도명}`];
  for (const phrase of phrases) {
    queries.push(`${prefix}${지역} ${phrase}`);
    queries.push(phrase);
  }
  queries.push(cleaned.replace(/\s+/g, ""));

  const seen = new Set();
  for (const raw of queries) {
    const q = raw.trim();
    if (!q || seen.has(q)) continue;
    seen.add(q);
    const place = await geocodeOnce(q, bbox);
    if (place) return place;
  }
  return null;
}

async function main() {
  const condos = [];
  let totalRows = 0;

  for (const source of SOURCES) {
    const dataRows = readRows(source);
    totalRows += dataRows.length;
    for (const r of dataRows) {
      const [지역, 콘도명, 룸타입, 확정금액, 공제방법, 본인부담금] = r;
      const place = await geocode(지역, 콘도명, source.queryPrefix, source.bbox);
      if (!place) {
        console.warn(`[${source.권역}] 매칭 실패: ${지역} ${콘도명}`);
        continue;
      }
      condos.push({
        권역: source.권역, 지역, 콘도명, 룸타입, 확정금액, 공제방법, 본인부담금,
        lat: Number(place.y),
        lng: Number(place.x),
      });
      console.log(`[${source.권역}] OK: ${콘도명} -> ${place.place_name}`);
    }
  }

  fs.writeFileSync(
    path.join(__dirname, "..", "condos.json"),
    JSON.stringify(condos, null, 2),
    "utf8"
  );
  console.log(`\n완료: ${condos.length}/${totalRows}개 지오코딩됨 -> condos.json`);
}

main();
