const fs = require("fs");
const path = require("path");

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

function csvField(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

// Room-type words are glued directly to the condo name with no separator
// (e.g. "삼성거제호텔더블(기준2인)"), except when an underscore is present
// ("더비치펜션_거제커플룸(...)"). Longest-match against known room-type
// words peels the last one off the name.
const ROOM_KEYWORDS = [
  "디럭스더블", "디럭스트윈", "디럭스온돌", "디럭스패밀리", "슈페리어더블", "슈페리어트윈",
  "프리미어킹", "프리미어트윈", "프리미어더블", "패밀리트윈", "패밀리더블", "패밀리스위트",
  "온돌방", "커플룸", "단체룸", "가족룸", "주니어스위트", "비스타스위트", "팔러트윈",
  "스탠다드", "슈페리어", "디럭스", "프리미어", "패밀리", "트윈", "더블", "스위트",
  "온돌", "킹", "퀸", "싱글", "벨버디어", "오션뷰", "마운틴뷰", "가든뷰", "오션",
  "마운틴", "가든", "로얄", "듀플렉스", "풀사이드", "플러스", "오픈온돌",
].sort((a, b) => b.length - a.length);

function splitNameAndRooms(detail) {
  if (detail.includes("_")) {
    const idx = detail.indexOf("_");
    return { name: detail.slice(0, idx).trim(), rooms: detail.slice(idx + 1).trim() };
  }
  const parenIdx = detail.indexOf("(");
  const prefix = parenIdx === -1 ? detail : detail.slice(0, parenIdx);
  for (const kw of ROOM_KEYWORDS) {
    if (prefix.endsWith(kw) && prefix.length > kw.length) {
      return { name: prefix.slice(0, -kw.length).trim(), rooms: detail.slice(prefix.length - kw.length).trim() };
    }
  }
  return { name: prefix.trim(), rooms: detail.trim() };
}

function main() {
  const srcPath = path.join(__dirname, "..", "Gyeongsang_Accommodations_List.csv");
  const rows = parseCsv(fs.readFileSync(srcPath, "utf8"));
  const [, ...dataRows] = rows;

  const out = ["지역,콘도명,룸타입/평형,최근 1년간 확정금액 (min~max),공제방법,본인부담금 (min~max)"];
  for (const r of dataRows) {
    const [region, detail, priceRange, paymentMethod, deduction, additional] = r;
    const { name, rooms } = splitNameAndRooms(detail);
    const 본인부담금 = additional && additional.trim() ? `${deduction} (${additional.trim()})` : deduction;
    out.push([region, name, rooms, priceRange, paymentMethod, 본인부담금].map(csvField).join(","));
  }

  const outPath = path.join(__dirname, "..", "gyeongsang_hotel_info.csv");
  fs.writeFileSync(outPath, out.join("\n"), "utf8");
  console.log(`변환 완료: ${dataRows.length}행 -> gyeongsang_hotel_info.csv`);
}

main();
