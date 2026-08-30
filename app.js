let map, condos = [], condoOverlays = [], foodOverlays = [], itineraryOverlays = [], meOverlay = null;
let itinerary = { trips: [] };
let selectedTripId = null;
let selectedDayId = null;
let currentDetailItem = null;

const firebaseConfig = {
  apiKey: "AIzaSyBNH9DE1c8gBTRBhmxVZoflM_4I-b_19lk",
  authDomain: "mycondomap-9d10b.firebaseapp.com",
  projectId: "mycondomap-9d10b",
  storageBucket: "mycondomap-9d10b.firebasestorage.app",
  messagingSenderId: "575323061922",
  appId: "1:575323061922:web:59394d90eef9d0323ca1fb",
  measurementId: "G-218GV5JFTE",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let itineraryUnsub = null;
let itineraryReady = false; // 서버에서 최초 1회 데이터 받기 전엔 저장(덮어쓰기) 금지 — 안 그러면 로그인 직후 빈 상태로 기존 데이터를 지워버릴 수 있음

function itineraryDocId() {
  return localStorage.getItem("condo_auth_id");
}

function startItinerarySync() {
  const id = itineraryDocId();
  if (!id) return;
  itineraryReady = false;
  if (itineraryUnsub) itineraryUnsub();
  itineraryUnsub = db.collection("itineraries").doc(id).onSnapshot(snap => {
    itinerary = snap.exists ? snap.data() : { trips: [] };
    if (!itinerary.trips) itinerary.trips = [];
    itineraryReady = true;
    if (!selectedTripId || !itinerary.trips.find(t => t.id === selectedTripId)) {
      selectedTripId = itinerary.trips[0] ? itinerary.trips[0].id : null;
      selectedDayId = null;
    }
    if (!document.getElementById("itineraryPanel").hidden) renderAll();
  }, error => {
    console.error("Firestore 동기화 실패:", error);
    alert("일정 서버 연결에 실패했어요: " + error.message);
  });
}

function saveItinerary() {
  if (!itineraryReady) {
    console.warn("아직 서버 데이터 로딩 전이라 저장을 건너뜀 (데이터 유실 방지)");
    return;
  }
  const id = itineraryDocId();
  if (!id) return;
  db.collection("itineraries").doc(id).set(itinerary);
}
function requireItineraryReady() {
  if (!itineraryReady) {
    alert("일정 데이터를 아직 불러오는 중이에요. 잠시 후 다시 시도해줘.");
    return false;
  }
  return true;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function currentTrip() {
  return itinerary.trips.find(t => t.id === selectedTripId) || null;
}

// 계정 추가하려면 이 배열에 {id, pw} 항목만 늘리면 됨.
// 같은 id로 로그인하는 사람들끼리 일정(Firestore 문서)을 공유함.
const ACCOUNTS = [
  { id: "wntldus12", pw: "seeyj12@@" },
];

if (localStorage.getItem("condo_auth") === "ok") {
  document.getElementById("loginGate").style.display = "none";
  startItinerarySync();
}
document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = document.getElementById("loginId").value;
  const pw = document.getElementById("loginPw").value;
  const account = ACCOUNTS.find(a => a.id === id && a.pw === pw);
  if (account) {
    localStorage.setItem("condo_auth", "ok");
    localStorage.setItem("condo_auth_id", account.id);
    document.getElementById("loginGate").style.display = "none";
    startItinerarySync();
  } else {
    document.getElementById("loginError").hidden = false;
  }
});

function minPrice(str) {
  const m = str.replace(/,/g, "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function fmtWon(n) {
  if (n < 10000) return n.toLocaleString() + "원";
  const man = n / 10000;
  // 3.5만을 "4만"으로 올려 보여주면 실제보다 비싸 보이므로 소수 첫째자리까지 유지
  return (Number.isInteger(man) ? man : man.toFixed(1)) + "만";
}

function makePin(text, extraClass, onClick) {
  const el = document.createElement("div");
  el.className = "price-pin" + (extraClass ? " " + extraClass : "");
  el.textContent = text;
  el.style.position = "relative";
  if (onClick) el.addEventListener("click", onClick);
  return el;
}

function roundToHour(hhmm) {
  const h = hhmm ? Number(hhmm.split(":")[0]) || 0 : 0;
  return `${String(Math.min(23, h)).padStart(2, "0")}:00`;
}

function suggestedStartTime() {
  const day = findDay(selectedDayId);
  if (!day) return "00:00";
  const { timed } = sortedStops(day);
  if (!timed.length) return "00:00";
  const last = timed[timed.length - 1];
  return roundToHour(last.endTime || last.time || "00:00");
}

function hourOptionsHtml(selected) {
  let html = `<option value="" ${!selected ? "selected" : ""}>미정</option>`;
  for (let h = 0; h < 24; h++) {
    const v = `${String(h).padStart(2, "0")}:00`;
    html += `<option value="${v}" ${v === selected ? "selected" : ""}>${v}</option>`;
  }
  return html;
}

function addToItineraryHtml() {
  const tripOptions = itinerary.trips
    .map(t => `<option value="${t.id}" ${t.id === selectedTripId ? "selected" : ""}>${t.name}</option>`)
    .join("");
  const kakaoAppUrl = currentDetailItem
    ? `kakaomap://look?p=${currentDetailItem.lat},${currentDetailItem.lng}`
    : "";
  return `
    <div class="add-itinerary-row">
      <button id="addToItinerary" type="button">📅 일정에 추가</button>
      <a class="k-badge" href="${kakaoAppUrl}" aria-label="카카오맵 앱에서 보기">K</a>
    </div>
    <div id="itineraryForm">
      <select id="itineraryTripSelect">
        ${tripOptions}
        <option value="__newtrip__">+ 새 여행</option>
      </select>
      <input id="newTripNameInput" type="text" placeholder="여행 이름 (예: 260831제주여행)" style="display:${itinerary.trips.length ? "none" : "block"}">
      <select id="itineraryDaySelect"></select>
      <div class="time-row">
        <select id="itineraryTimeInput" aria-label="시작 시각">${hourOptionsHtml(suggestedStartTime())}</select>
        <span>~</span>
        <select id="itineraryEndTimeInput" aria-label="종료 시각">${hourOptionsHtml("")}</select>
        <button id="itineraryConfirm" type="button">추가</button>
      </div>
    </div>
  `;
}

function populateDaySelect() {
  const tripSelect = document.getElementById("itineraryTripSelect");
  const daySelect = document.getElementById("itineraryDaySelect");
  const newTripInput = document.getElementById("newTripNameInput");
  if (!tripSelect || !daySelect) return;
  const tripId = tripSelect.value;
  if (tripId === "__newtrip__") {
    if (newTripInput) newTripInput.style.display = "block";
    daySelect.innerHTML = `<option value="__new__">+ 1일차 생성</option>`;
    return;
  }
  if (newTripInput) newTripInput.style.display = "none";
  const trip = itinerary.trips.find(t => t.id === tripId);
  const days = trip ? trip.days : [];
  daySelect.innerHTML = days.map(d => `<option value="${d.id}">${d.label}</option>`).join("")
    + `<option value="__new__">+ 새 Day</option>`;
}

function showDetail(c) {
  closeAiResults();
  currentDetailItem = { name: c.콘도명, type: "condo", lat: c.lat, lng: c.lng, 본인부담금: c.본인부담금 };
  const body = document.getElementById("detailBody");
  body.innerHTML = `
    <h2>${c.콘도명}</h2>
    <div class="row"><span class="label">지역</span> ${c.지역}</div>
    <div class="row"><span class="label">룸타입</span> ${c.룸타입}</div>
    <div class="row"><span class="label">확정금액</span> ${c.확정금액}</div>
    <div class="row"><span class="label">공제방법</span> ${c.공제방법}</div>
    <div class="row"><span class="label">본인부담금</span> ${c.본인부담금}</div>
    ${addToItineraryHtml()}
  `;
  document.getElementById("detailCard").hidden = false;
  populateDaySelect();
}

function renderCondoMarkers(list) {
  condoOverlays.forEach(o => o.setMap(null));
  condoOverlays = [];
  list.forEach(c => {
    const pos = new kakao.maps.LatLng(c.lat, c.lng);
    const pin = makePin(fmtWon(minPrice(c.본인부담금)) + "~", "", () => showDetail(c));
    const overlay = new kakao.maps.CustomOverlay({
      position: pos, content: pin, yAnchor: 1.4, clickable: true,
    });
    overlay.setMap(map);
    condoOverlays.push(overlay);
  });
}

function renderList(list) {
  const el = document.getElementById("sheetList");
  el.innerHTML = list.map(c => `
    <div class="condo-row" data-name="${c.콘도명}">
      <div class="name">${c.콘도명} (${c.지역})</div>
      <div class="price">본인부담금 ${fmtWon(minPrice(c.본인부담금))}~</div>
    </div>
  `).join("");
  [...el.children].forEach((row, i) => {
    row.addEventListener("click", () => {
      const c = list[i];
      map.panTo(new kakao.maps.LatLng(c.lat, c.lng));
      showDetail(c);
    });
  });
}

function applyFilter(regionGroup) {
  const list = regionGroup === "all" ? condos : condos.filter(c => c.권역 === regionGroup);
  renderCondoMarkers(list);
  renderList(list);
  if (list.length) {
    const bounds = new kakao.maps.LatLngBounds();
    list.forEach(c => bounds.extend(new kakao.maps.LatLng(c.lat, c.lng)));
    map.setBounds(bounds);
  }
}

function searchNearbyFood() {
  foodOverlays.forEach(o => o.setMap(null));
  foodOverlays = [];
  const ps = new kakao.maps.services.Places();
  const center = map.getCenter();
  ["FD6", "CE7"].forEach(code => {
    ps.categorySearch(code, (results, status) => {
      if (status !== kakao.maps.services.Status.OK) return;
      results.forEach(r => {
        const pos = new kakao.maps.LatLng(r.y, r.x);
        const pin = makePin(r.place_name, "food", () => {
          closeAiResults();
          currentDetailItem = { name: r.place_name, type: "food", lat: Number(r.y), lng: Number(r.x) };
          document.getElementById("detailBody").innerHTML =
            `<h2>${r.place_name}</h2><div class="row">${r.road_address_name || r.address_name}</div>
             <div class="row"><span class="label">카테고리</span> ${r.category_name}</div>
             ${addToItineraryHtml()}`;
          document.getElementById("detailCard").hidden = false;
          populateDaySelect();
        });
        const overlay = new kakao.maps.CustomOverlay({
          position: pos, content: pin, yAnchor: 1.4, clickable: true,
        });
        overlay.setMap(map);
        foodOverlays.push(overlay);
      });
    }, { location: center, radius: 1500 });
  });
}

function addTrip(name) {
  const trip = { id: uid(), name, days: [] };
  itinerary.trips.push(trip);
  saveItinerary();
  return trip;
}

function deleteTrip(tripId) {
  itinerary.trips = itinerary.trips.filter(t => t.id !== tripId);
  saveItinerary();
  if (selectedTripId === tripId) {
    selectedTripId = itinerary.trips[0] ? itinerary.trips[0].id : null;
    selectedDayId = null;
  }
}

function ensureTrip() {
  let trip = currentTrip();
  if (!trip) {
    const name = prompt("여행 이름 (예: 260831제주여행)", "");
    if (name === null) return null;
    trip = addTrip(name.trim() || `여행${itinerary.trips.length + 1}`);
    selectedTripId = trip.id;
  }
  return trip;
}

function addDay() {
  const trip = ensureTrip();
  if (!trip) return null;
  const label = `Day${trip.days.length + 1}`;
  const day = { id: uid(), label, stops: [] };
  trip.days.push(day);
  saveItinerary();
  return day;
}

function findDay(dayId) {
  const trip = currentTrip();
  return trip ? trip.days.find(d => d.id === dayId) : null;
}

function addStopToDay(dayId, time, endTime) {
  if (!currentDetailItem) return;
  const day = findDay(dayId);
  if (!day) return;
  day.stops.push({ id: uid(), time: time || "", endTime: endTime || "", ...currentDetailItem });
  saveItinerary();
}

function deleteStop(dayId, stopId) {
  const day = findDay(dayId);
  if (!day) return;
  const stop = day.stops.find(s => s.id === stopId);
  if (!confirm(`"${stop ? stop.name : "이 일정"}"을(를) 삭제할까요?`)) return;
  day.stops = day.stops.filter(s => s.id !== stopId);
  saveItinerary();
  renderTimeline();
  drawItineraryOverlay();
}

let editingStopId = null;

function saveStopTimeEdit(dayId, stopId, start, end) {
  const day = findDay(dayId);
  const stop = day && day.stops.find(s => s.id === stopId);
  if (!stop) return;
  stop.time = start || "";
  stop.endTime = end || "";
  saveItinerary();
  editingStopId = null;
  renderTimeline();
  drawItineraryOverlay();
}

function swapStopTime(dayId, stopId, direction) {
  const day = findDay(dayId);
  if (!day) return;
  const { timed } = sortedStops(day);
  const idx = timed.findIndex(s => s.id === stopId);
  if (idx === -1) return;
  const otherIdx = direction === "up" ? idx - 1 : idx + 1;
  if (otherIdx < 0 || otherIdx >= timed.length) return;
  const a = timed[idx], b = timed[otherIdx];
  const at = a.time, aet = a.endTime;
  a.time = b.time; a.endTime = b.endTime;
  b.time = at; b.endTime = aet;
  saveItinerary();
  renderTimeline();
  drawItineraryOverlay();
}

function sortedStops(day) {
  const timed = day.stops.filter(s => s.time).sort((a, b) => a.time.localeCompare(b.time));
  const untimed = day.stops.filter(s => !s.time);
  return { timed, untimed };
}

function renderAll() {
  renderTripTabs();
  renderTripCost();
  renderDayTabs();
  renderTimeline();
  drawItineraryOverlay();
}

function tripCondoTotal(trip) {
  let total = 0;
  trip.days.forEach(day => {
    day.stops.forEach(s => {
      if (s.type === "condo" && s.본인부담금) total += minPrice(s.본인부담금);
    });
  });
  return total;
}

function renderTripCost() {
  const el = document.getElementById("tripCostSummary");
  const trip = currentTrip();
  if (!trip) { el.hidden = true; return; }
  const total = tripCondoTotal(trip);
  if (!total) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = `숙소 비용(최소) ${fmtWon(total)}~`;
}

function renderTripTabs() {
  const el = document.getElementById("tripTabs");
  el.innerHTML = itinerary.trips.map(t =>
    `<button data-trip="${t.id}" class="${t.id === selectedTripId ? "active" : ""}">${t.name}</button>`
  ).join("") + `<button class="addDayBtn" id="addTripBtn">+ 여행 추가</button>` +
    (currentTrip() ? `<button class="addDayBtn" id="deleteTripBtn">🗑 삭제</button>` : "");

  el.querySelectorAll("button[data-trip]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedTripId = btn.dataset.trip;
      const trip = currentTrip();
      selectedDayId = trip && trip.days[0] ? trip.days[0].id : null;
      renderAll();
    });
  });
  document.getElementById("addTripBtn").addEventListener("click", () => {
    if (!requireItineraryReady()) return;
    const name = prompt("여행 이름 (예: 260831제주여행)", "");
    if (name === null) return;
    const trip = addTrip(name.trim() || `여행${itinerary.trips.length + 1}`);
    selectedTripId = trip.id;
    selectedDayId = null;
    renderAll();
  });
  const delBtn = document.getElementById("deleteTripBtn");
  if (delBtn) delBtn.addEventListener("click", () => {
    if (!requireItineraryReady()) return;
    const t = currentTrip();
    if (!t) return;
    if (!confirm(`"${t.name}" 여행을 통째로 삭제할까요? 안의 Day/일정이 모두 사라져요.`)) return;
    deleteTrip(t.id);
    renderAll();
  });
}

function deleteDay(trip, dayId) {
  trip.days = trip.days.filter(d => d.id !== dayId);
  saveItinerary();
  if (selectedDayId === dayId) {
    selectedDayId = trip.days[0] ? trip.days[0].id : null;
  }
}

function renderDayTabs() {
  const el = document.getElementById("dayTabs");
  const trip = currentTrip();
  const days = trip ? trip.days : [];
  el.innerHTML = days.map(d =>
    `<button data-day="${d.id}" class="${d.id === selectedDayId ? "active" : ""}">${d.label}</button>`
  ).join("")
    + `<button class="addDayBtn" id="addDayBtn" aria-label="Day 추가">+</button>`
    + (selectedDayId ? `<button class="addDayBtn" id="deleteDayBtn" aria-label="Day 삭제">🗑</button>` : "");

  el.querySelectorAll("button[data-day]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedDayId = btn.dataset.day;
      renderDayTabs();
      renderTimeline();
      drawItineraryOverlay();
    });
  });
  document.getElementById("addDayBtn").addEventListener("click", () => {
    if (!requireItineraryReady()) return;
    const day = addDay();
    if (!day) return;
    selectedDayId = day.id;
    renderAll();
  });
  const delDayBtn = document.getElementById("deleteDayBtn");
  if (delDayBtn) delDayBtn.addEventListener("click", () => {
    if (!requireItineraryReady()) return;
    const day = findDay(selectedDayId);
    if (!trip || !day) return;
    if (!confirm(`"${day.label}"을(를) 삭제할까요? 안의 일정이 모두 사라져요.`)) return;
    deleteDay(trip, day.id);
    renderAll();
  });
}

function stopIcon(type) {
  return type === "food" ? "🍴" : type === "place" ? "📍" : "🏨";
}

function timeRangeLabel(stop) {
  if (!stop.time) return "미정";
  return stop.endTime ? `${stop.time}~${stop.endTime}` : stop.time;
}

function timeRangeLines(stop) {
  if (!stop.time) return "미정";
  return stop.endTime ? `${stop.time}<br>~${stop.endTime}` : stop.time;
}

function stopCard(day, stop, icon) {
  const kakaoAppUrl = `kakaomap://look?p=${stop.lat},${stop.lng}`;
  const editing = stop.id === editingStopId;
  return `
    <div class="timeline-stop" data-stop="${stop.id}">
      <a class="k-badge" href="${kakaoAppUrl}" aria-label="카카오맵 앱에서 보기">K</a>
      <div class="t-time">${timeRangeLines(stop)}</div>
      <div class="t-line"><div class="t-dot"></div><div class="t-bar"></div></div>
      <div class="t-card">
        <div class="t-name">${icon} ${stop.name}</div>
        ${editing ? `
        <div class="time-row">
          <select class="edit-time-start" aria-label="시작 시각">${hourOptionsHtml(stop.time || "")}</select>
          <span>~</span>
          <select class="edit-time-end" aria-label="종료 시각">${hourOptionsHtml(stop.endTime || "")}</select>
        </div>
        <div class="t-actions">
          <button data-act="save-edit" data-day="${day.id}" data-stop="${stop.id}">저장</button>
          <button data-act="cancel-edit" data-day="${day.id}" data-stop="${stop.id}">취소</button>
        </div>
        ` : `
        <div class="t-actions">
          <button data-act="goto" data-day="${day.id}" data-stop="${stop.id}">지도보기</button>
          <button data-act="edit" data-day="${day.id}" data-stop="${stop.id}">수정</button>
          <button data-act="delete" data-day="${day.id}" data-stop="${stop.id}">삭제</button>
          ${stop.time ? `
          <span class="t-move">
            <button data-act="move-up" data-day="${day.id}" data-stop="${stop.id}" aria-label="위 일정과 시간 바꾸기">↑</button>
            <button data-act="move-down" data-day="${day.id}" data-stop="${stop.id}" aria-label="아래 일정과 시간 바꾸기">↓</button>
          </span>
          ` : ""}
        </div>
        `}
      </div>
    </div>
  `;
}

function renderAiButtonState() {
  const day = findDay(selectedDayId);
  const btn = document.getElementById("aiFloatBtn");
  const ready = !!(day && day.stops.length);
  btn.classList.toggle("not-ready", !ready);
}

function renderTimeline() {
  renderAiButtonState();
  const el = document.getElementById("timeline");
  const day = findDay(selectedDayId);
  if (!day) {
    el.innerHTML = `<div class="timeline-empty">Day를 추가하고 핀을 눌러 '일정에 추가'로 담아보세요.</div>`;
    return;
  }
  if (!day.stops.length) {
    el.innerHTML = `<div class="timeline-empty">아직 담긴 일정이 없어요. 지도 핀을 눌러 '일정에 추가'해보세요.</div>`;
    return;
  }
  const { timed, untimed } = sortedStops(day);
  let html = "";
  if (untimed.length) {
    html += `<div class="timeline-section-label">미정</div>`;
    html += untimed.map(s => stopCard(day, s, stopIcon(s.type))).join("");
  }
  if (timed.length) {
    html += `<div class="timeline-section-label">시간순</div>`;
    html += timed.map(s => stopCard(day, s, stopIcon(s.type))).join("");
  }
  el.innerHTML = html;

  el.querySelectorAll("button[data-act]").forEach(btn => {
    const { act, day: dayId, stop: stopId } = btn.dataset;
    btn.addEventListener("click", () => {
      if (act === "delete") deleteStop(dayId, stopId);
      else if (act === "edit") { editingStopId = stopId; renderTimeline(); }
      else if (act === "cancel-edit") { editingStopId = null; renderTimeline(); }
      else if (act === "save-edit") {
        const row = btn.closest(".timeline-stop");
        const start = row.querySelector(".edit-time-start").value;
        const end = row.querySelector(".edit-time-end").value;
        saveStopTimeEdit(dayId, stopId, start, end);
      }
      else if (act === "goto") {
        const d = findDay(dayId);
        const s = d.stops.find(x => x.id === stopId);
        if (s) {
          map.setLevel(1);
          map.panTo(new kakao.maps.LatLng(s.lat, s.lng));
        }
      }
      else if (act === "move-up") swapStopTime(dayId, stopId, "up");
      else if (act === "move-down") swapStopTime(dayId, stopId, "down");
    });
  });
}

const AVG_SPEED_KMH = 25; // 이동수단 모르니 대략적인 시내 이동 평균으로 추정 (API 없이 직선거리 기반)

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function estimateTravelMinutes(a, b) {
  const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
  return Math.max(1, Math.round(km / AVG_SPEED_KMH * 60));
}

function drawItineraryOverlay() {
  itineraryOverlays.forEach(o => o.setMap(null));
  itineraryOverlays = [];
  const day = findDay(selectedDayId);
  if (!day) return;
  const { timed } = sortedStops(day);
  if (!timed.length) return;

  const path = timed.map(s => new kakao.maps.LatLng(s.lat, s.lng));
  const line = new kakao.maps.Polyline({ path, strokeWeight: 4, strokeColor: "#3d2b1f", strokeOpacity: 0.8 });
  line.setMap(map);
  itineraryOverlays.push(line);

  const tight = new Array(timed.length).fill(false);

  timed.forEach((s, i) => {
    if (i > 0) {
      const prev = timed[i - 1];
      const travelMin = estimateTravelMinutes(prev, s);
      const prevEnd = timeToMinutes(prev.endTime) ?? timeToMinutes(prev.time);
      const nextStart = timeToMinutes(s.time);
      let gapLabel = `🚗 약 ${travelMin}분`;
      if (prevEnd !== null && nextStart !== null) {
        const gap = nextStart - prevEnd;
        if (gap < travelMin) { tight[i] = true; gapLabel += ` (여유 ${gap}분 · 빠듯함)`; }
      }
      const midLat = (prev.lat + s.lat) / 2, midLng = (prev.lng + s.lng) / 2;
      const edgeLabel = document.createElement("div");
      edgeLabel.className = "edge-time" + (tight[i] ? " tight" : "");
      edgeLabel.textContent = gapLabel;
      const edgeOverlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(midLat, midLng), content: edgeLabel, yAnchor: 0.5,
      });
      edgeOverlay.setMap(map);
      itineraryOverlays.push(edgeOverlay);
    }

    const marker = document.createElement("div");
    marker.className = "route-marker";
    marker.innerHTML = `
      <div class="route-num${tight[i] ? " tight" : ""}">${i + 1}</div>
      <div class="route-label">${timeRangeLabel(s)} ${s.name}</div>
    `;
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(s.lat, s.lng), content: marker, yAnchor: 0.5, xAnchor: 0,
    });
    overlay.setMap(map);
    itineraryOverlays.push(overlay);
  });

  if (path.length === 1) {
    map.setCenter(path[0]);
    map.setLevel(4);
  } else {
    const bounds = new kakao.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    map.setBounds(bounds);
  }
}

function renderPlaceSearchResults(results) {
  const el = document.getElementById("placeSearchResults");
  el.innerHTML = results.map((r, i) => `
    <div class="place-row" data-i="${i}">
      <div><div class="p-name">${r.place_name}</div><div class="p-addr">${r.road_address_name || r.address_name}</div></div>
      <button>추가</button>
    </div>
  `).join("");
  [...el.children].forEach((row, i) => {
    row.addEventListener("click", () => {
      const r = results[i];
      currentDetailItem = { name: r.place_name, type: "place", lat: Number(r.y), lng: Number(r.x) };
      map.panTo(new kakao.maps.LatLng(r.y, r.x));
      document.getElementById("detailBody").innerHTML = `
        <h2>${r.place_name}</h2>
        <div class="row">${r.road_address_name || r.address_name}</div>
        <div class="row"><span class="label">카테고리</span> ${r.category_name || "-"}</div>
        ${addToItineraryHtml()}
      `;
      document.getElementById("detailCard").hidden = false;
      populateDaySelect();
    });
  });
}

const AI_PROXY_URL = "https://vercel-proxy-nine-eosin.vercel.app/api/suggest";
let aiPinOverlays = [];

async function fetchAiSuggestions(stops) {
  const res = await fetch(AI_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stops: stops.map(s => ({ name: s.name, lat: s.lat, lng: s.lng })) }),
  });
  if (!res.ok) throw new Error(`AI 서버 오류 ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

function geocodePlaceName(name) {
  return new Promise(resolve => {
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(name, (results, status) => {
      if (status === kakao.maps.services.Status.OK && results.length) resolve(results[0]);
      else resolve(null);
    });
  });
}

function closeAiResults() {
  document.getElementById("aiResults").hidden = true;
  document.getElementById("aiBackdrop").hidden = true;
  aiPinOverlays.forEach(o => o.setMap(null));
  aiPinOverlays = [];
}

function renderAiResults(items) {
  const dayId = selectedDayId;
  const el = document.getElementById("aiResultsList");
  el.innerHTML = items.map(it => `
    <div class="ai-row">
      <div class="ai-name">${it.place.place_name}</div>
      <div class="ai-reason">${it.reason || ""}</div>
      <div class="ai-time">추천 시간: ${it.suggestedTime || "미정"}</div>
      <button class="ai-adopt" type="button">이 Day에 추가</button>
    </div>
  `).join("");
  [...el.children].forEach((row, i) => {
    const it = items[i];
    const r = it.place;
    row.querySelector(".ai-adopt").addEventListener("click", e => {
      const btn = e.target;
      if (btn.classList.contains("added")) return;
      currentDetailItem = { name: r.place_name, type: "place", lat: Number(r.y), lng: Number(r.x) };
      addStopToDay(dayId, suggestedStartTime(), "");
      currentDetailItem = null;
      btn.textContent = "추가됨";
      btn.classList.add("added");
      renderTimeline();
      drawItineraryOverlay();
    });
  });
  document.getElementById("aiBackdrop").hidden = false;
  document.getElementById("aiResults").hidden = false;
}

async function runAiSuggest() {
  if (document.getElementById("itineraryPanel").hidden) showItineraryPanel();
  const day = findDay(selectedDayId);
  if (!day || !day.stops.length) {
    alert("먼저 이 Day에 콘도나 장소를 하나 이상 담아야, 그 주변으로 AI가 추천해줄 수 있어요.");
    return;
  }
  if (!requireItineraryReady()) return;
  const btn = document.getElementById("aiFloatBtn");
  btn.classList.add("loading");
  try {
    const AI_RADIUS_KM = 1;
    const centerLat = day.stops.reduce((s, x) => s + x.lat, 0) / day.stops.length;
    const centerLng = day.stops.reduce((s, x) => s + x.lng, 0) / day.stops.length;

    const suggestions = await fetchAiSuggestions(day.stops);
    const geocoded = [];
    for (const s of suggestions) {
      const place = await geocodePlaceName(s.name);
      if (!place) continue;
      const distKm = haversineKm(centerLat, centerLng, Number(place.y), Number(place.x));
      if (distKm > AI_RADIUS_KM) continue; // 엉뚱한 지역 매칭 거름 (예: 콘도는 제주인데 이름 같은 곳이 강화도에 있는 경우)
      geocoded.push({ ...s, place });
      if (geocoded.length >= 3) break;
    }
    if (!geocoded.length) {
      alert("이 근처(1km 이내)에서 AI가 추천할 만한 곳을 못 찾았어요. 다시 시도해봐.");
      return;
    }
    aiPinOverlays.forEach(o => o.setMap(null));
    aiPinOverlays = geocoded.map(it => {
      const pos = new kakao.maps.LatLng(it.place.y, it.place.x);
      const pin = makePin(`✨ ${it.place.place_name}`, "ai-pin", null);
      const overlay = new kakao.maps.CustomOverlay({ position: pos, content: pin, yAnchor: 1.4 });
      overlay.setMap(map);
      return overlay;
    });
    const bounds = new kakao.maps.LatLngBounds();
    geocoded.forEach(it => bounds.extend(new kakao.maps.LatLng(it.place.y, it.place.x)));
    day.stops.forEach(s => bounds.extend(new kakao.maps.LatLng(s.lat, s.lng)));
    map.setBounds(bounds);
    renderAiResults(geocoded);
  } catch (e) {
    alert("AI 추천을 받아오지 못했어요: " + e.message);
  } finally {
    btn.classList.remove("loading");
  }
}

function showItineraryPanel() {
  document.getElementById("sheet").hidden = true;
  document.getElementById("itineraryPanel").hidden = false;
  document.getElementById("itineraryPanel").classList.remove("collapsed");
  if (!selectedTripId && itinerary.trips.length) selectedTripId = itinerary.trips[0].id;
  const trip = currentTrip();
  if (trip && !selectedDayId && trip.days.length) selectedDayId = trip.days[0].id;
  renderAll();
}

function hideItineraryPanel() {
  document.getElementById("itineraryPanel").hidden = true;
  document.getElementById("sheet").hidden = false;
  itineraryOverlays.forEach(o => o.setMap(null));
  itineraryOverlays = [];
  closeAiResults();
}

kakao.maps.load(() => {
  map = new kakao.maps.Map(document.getElementById("map"), {
    center: new kakao.maps.LatLng(33.38, 126.55),
    level: 11,
  });

  fetch("condos.json")
    .then(r => r.json())
    .then(data => {
      condos = data;
      applyFilter("all");
    });

  document.querySelectorAll(".filter-btn[data-region]").forEach(btn => {
    btn.addEventListener("click", () => {
      hideItineraryPanel();
      document.getElementById("sheet").classList.remove("collapsed");
      document.querySelectorAll(".filter-btn[data-region]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("searchInput").value = "";
      applyFilter(btn.dataset.region);
    });
  });

  document.getElementById("searchInput").addEventListener("input", e => {
    hideItineraryPanel();
    const q = e.target.value.trim();
    if (!q) {
      const activeBtn = document.querySelector(".filter-btn[data-region].active");
      applyFilter(activeBtn ? activeBtn.dataset.region : "all");
      return;
    }
    const list = condos.filter(c => c.콘도명.includes(q));
    renderCondoMarkers(list);
    renderList(list);
    if (list.length) {
      const bounds = new kakao.maps.LatLngBounds();
      list.forEach(c => bounds.extend(new kakao.maps.LatLng(c.lat, c.lng)));
      map.setBounds(bounds);
    }
  });

  document.getElementById("foodFloatBtn").addEventListener("click", () => {
    hideItineraryPanel();
    searchNearbyFood();
  });
  document.getElementById("detailClose").addEventListener("click", () => {
    document.getElementById("detailCard").hidden = true;
  });

  document.getElementById("itineraryFloatBtn").addEventListener("click", showItineraryPanel);
  document.getElementById("aiFloatBtn").addEventListener("click", runAiSuggest);

  document.getElementById("sheetHandle").addEventListener("click", () => {
    document.getElementById("sheet").classList.toggle("collapsed");
  });
  document.querySelector("#itineraryPanel .sheetHandle").addEventListener("click", () => {
    document.getElementById("itineraryPanel").classList.toggle("collapsed");
  });
  document.getElementById("aiResultsClose").addEventListener("click", closeAiResults);
  document.getElementById("aiBackdrop").addEventListener("click", closeAiResults);

  document.getElementById("locateBtn").addEventListener("click", () => {
    if (!navigator.geolocation) { alert("이 브라우저는 위치 기능을 지원하지 않아요."); return; }
    const btn = document.getElementById("locateBtn");
    if (btn.classList.contains("loading")) return; // 이미 진행 중이면 재클릭 무시
    const status = document.getElementById("locateStatus");
    btn.classList.add("loading");
    status.hidden = false;
    status.textContent = "위치 찾는 중";

    const GOOD_ENOUGH_ACCURACY_M = 50;
    const MAX_WAIT_MS = 20000;
    let best = null;
    let lastError = null;
    let finished = false;
    let watchId = null;
    let timeoutId = null;

    function finish() {
      if (finished) return;
      finished = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timeoutId);
      btn.classList.remove("loading");
      status.hidden = true;
      if (!best) {
        if (lastError && lastError.code === lastError.PERMISSION_DENIED) {
          alert("위치 권한이 거부됐어요. 브라우저 설정에서 위치 권한을 허용해주세요.");
        } else {
          alert("위치를 정확히 잡지 못했어요. 실외거나 신호가 좋은 곳에서 다시 시도해봐.");
        }
        return;
      }
      const loc = new kakao.maps.LatLng(best.coords.latitude, best.coords.longitude);
      map.setCenter(loc);
      map.setLevel(4);
      if (meOverlay) meOverlay.setMap(null);
      const dot = document.createElement("div");
      dot.className = "me-dot";
      meOverlay = new kakao.maps.CustomOverlay({ position: loc, content: dot, yAnchor: 0.5 });
      meOverlay.setMap(map);
    }

    watchId = navigator.geolocation.watchPosition(
      pos => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        status.textContent = `위치 정밀도 높이는 중 (오차 ${Math.round(pos.coords.accuracy)}m)`;
        if (pos.coords.accuracy <= GOOD_ENOUGH_ACCURACY_M) finish(); // 충분히 정확하면 굳이 더 안 기다림
      },
      err => { lastError = err; },
      { enableHighAccuracy: true, maximumAge: 0, timeout: MAX_WAIT_MS }
    );

    timeoutId = setTimeout(finish, MAX_WAIT_MS); // GPS 콜드스타트는 실제로 10~20초 넘게 걸릴 수 있어서 여유있게 기다림
  });

  document.getElementById("detailCard").addEventListener("click", e => {
    if (e.target.id === "addToItinerary") {
      document.getElementById("itineraryForm").classList.toggle("open");
    } else if (e.target.id === "itineraryConfirm") {
      if (!requireItineraryReady()) return;
      const time = document.getElementById("itineraryTimeInput").value;
      const endTime = document.getElementById("itineraryEndTimeInput").value;
      const tripSelect = document.getElementById("itineraryTripSelect");
      let tripId = tripSelect.value;
      if (tripId === "__newtrip__") {
        const nameInput = document.getElementById("newTripNameInput");
        const trip = addTrip((nameInput.value || "").trim() || `여행${itinerary.trips.length + 1}`);
        tripId = trip.id;
      }
      selectedTripId = tripId;
      const daySelect = document.getElementById("itineraryDaySelect");
      let dayId = daySelect.value;
      if (dayId === "__new__" || !dayId) dayId = addDay().id;
      addStopToDay(dayId, time, endTime);
      document.getElementById("itineraryForm").classList.remove("open");
      selectedDayId = dayId;
      document.getElementById("detailCard").hidden = true;
      showItineraryPanel();
    }
  });
  document.getElementById("detailCard").addEventListener("change", e => {
    if (e.target.id === "itineraryTripSelect") populateDaySelect();
  });

  let placeSearchDebounce;
  document.getElementById("placeSearchInput").addEventListener("input", e => {
    clearTimeout(placeSearchDebounce);
    const q = e.target.value.trim();
    const resultsEl = document.getElementById("placeSearchResults");
    document.getElementById("placeSearchClear").hidden = !q;
    if (!q) { resultsEl.innerHTML = ""; return; }
    placeSearchDebounce = setTimeout(() => {
      const ps = new kakao.maps.services.Places();
      ps.keywordSearch(q, (results, status) => {
        if (status !== kakao.maps.services.Status.OK) { resultsEl.innerHTML = ""; return; }
        renderPlaceSearchResults(results.slice(0, 3));
      });
    }, 400);
  });
  document.getElementById("placeSearchClear").addEventListener("click", () => {
    const input = document.getElementById("placeSearchInput");
    input.value = "";
    document.getElementById("placeSearchResults").innerHTML = "";
    document.getElementById("placeSearchClear").hidden = true;
    input.focus();
  });
});
