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
  return n >= 10000 ? Math.round(n / 10000) + "만" : n + "원";
}

function makePin(text, extraClass, onClick) {
  const el = document.createElement("div");
  el.className = "price-pin" + (extraClass ? " " + extraClass : "");
  el.textContent = text;
  el.style.position = "relative";
  if (onClick) el.addEventListener("click", onClick);
  return el;
}

function addToItineraryHtml() {
  const trip = currentTrip();
  const options = (trip ? trip.days : []).map(d => `<option value="${d.id}">${d.label}</option>`).join("");
  return `
    <button id="addToItinerary" type="button">📅 일정에 추가</button>
    <div id="itineraryForm">
      <select id="itineraryDaySelect">
        ${options}
        <option value="__new__">+ 새 Day</option>
      </select>
      <div class="time-row">
        <input id="itineraryTimeInput" type="time" aria-label="시작 시각">
        <span>~</span>
        <input id="itineraryEndTimeInput" type="time" aria-label="종료 시각">
        <button id="itineraryConfirm" type="button">추가</button>
      </div>
    </div>
  `;
}

function showDetail(c) {
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
          currentDetailItem = { name: r.place_name, type: "food", lat: Number(r.y), lng: Number(r.x) };
          document.getElementById("detailBody").innerHTML =
            `<h2>${r.place_name}</h2><div class="row">${r.road_address_name || r.address_name}</div>
             <div class="row"><span class="label">카테고리</span> ${r.category_name}</div>
             ${addToItineraryHtml()}`;
          document.getElementById("detailCard").hidden = false;
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
  day.stops = day.stops.filter(s => s.id !== stopId);
  saveItinerary();
  renderTimeline();
  drawItineraryOverlay();
}

function editStopTime(dayId, stopId) {
  const day = findDay(dayId);
  const stop = day && day.stops.find(s => s.id === stopId);
  if (!stop) return;
  const current = stop.time + (stop.endTime ? `~${stop.endTime}` : "");
  const next = prompt("시각 (예: 10:00~11:00, 비우면 미정)", current);
  if (next === null) return;
  const [start, end] = next.split("~").map(s => s.trim());
  stop.time = start || "";
  stop.endTime = end || "";
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

function renderDayTabs() {
  const el = document.getElementById("dayTabs");
  const trip = currentTrip();
  const days = trip ? trip.days : [];
  el.innerHTML = days.map(d =>
    `<button data-day="${d.id}" class="${d.id === selectedDayId ? "active" : ""}">${d.label}</button>`
  ).join("") + `<button class="addDayBtn" id="addDayBtn">+ Day 추가</button>`;

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
}

function stopIcon(type) {
  return type === "food" ? "🍴" : type === "place" ? "📍" : "🏨";
}

function timeRangeLabel(stop) {
  if (!stop.time) return "미정";
  return stop.endTime ? `${stop.time}~${stop.endTime}` : stop.time;
}

function stopCard(day, stop, icon) {
  return `
    <div class="timeline-stop" data-stop="${stop.id}">
      <div class="t-time">${timeRangeLabel(stop)}</div>
      <div class="t-line"><div class="t-dot"></div><div class="t-bar"></div></div>
      <div class="t-card">
        <div class="t-name">${icon} ${stop.name}</div>
        <div class="t-actions">
          <button data-act="goto" data-day="${day.id}" data-stop="${stop.id}">지도보기</button>
          <button data-act="edit" data-day="${day.id}" data-stop="${stop.id}">수정</button>
          <button data-act="delete" data-day="${day.id}" data-stop="${stop.id}">삭제</button>
        </div>
      </div>
    </div>
  `;
}

function renderTimeline() {
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
      else if (act === "edit") editStopTime(dayId, stopId);
      else if (act === "goto") {
        const d = findDay(dayId);
        const s = d.stops.find(x => x.id === stopId);
        if (s) map.panTo(new kakao.maps.LatLng(s.lat, s.lng));
      }
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
    });
  });
}

function showItineraryPanel() {
  document.getElementById("sheet").hidden = true;
  document.getElementById("itineraryPanel").hidden = false;
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

  document.getElementById("locateBtn").addEventListener("click", () => {
    if (!navigator.geolocation) { alert("이 브라우저는 위치 기능을 지원하지 않아요."); return; }
    const btn = document.getElementById("locateBtn");
    if (btn.classList.contains("loading")) return; // 이미 진행 중이면 재클릭 무시
    const status = document.getElementById("locateStatus");
    btn.classList.add("loading");
    status.hidden = false;
    status.textContent = "위치 찾는 중";

    let best = null;
    let lastError = null;
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        status.textContent = `위치 정밀도 높이는 중 (오차 ${Math.round(pos.coords.accuracy)}m)`;
      },
      err => { lastError = err; },
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
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
    }, 4000);
  });

  document.getElementById("detailCard").addEventListener("click", e => {
    if (e.target.id === "addToItinerary") {
      document.getElementById("itineraryForm").classList.toggle("open");
    } else if (e.target.id === "itineraryConfirm") {
      if (!requireItineraryReady()) return;
      const select = document.getElementById("itineraryDaySelect");
      const time = document.getElementById("itineraryTimeInput").value;
      const endTime = document.getElementById("itineraryEndTimeInput").value;
      let dayId = select.value;
      if (dayId === "__new__") dayId = addDay().id;
      addStopToDay(dayId, time, endTime);
      document.getElementById("itineraryForm").classList.remove("open");
      selectedDayId = dayId;
      document.getElementById("detailCard").hidden = true;
      showItineraryPanel();
    }
  });

  let placeSearchDebounce;
  document.getElementById("placeSearchInput").addEventListener("input", e => {
    clearTimeout(placeSearchDebounce);
    const q = e.target.value.trim();
    const resultsEl = document.getElementById("placeSearchResults");
    if (!q) { resultsEl.innerHTML = ""; return; }
    placeSearchDebounce = setTimeout(() => {
      const ps = new kakao.maps.services.Places();
      ps.keywordSearch(q, (results, status) => {
        if (status !== kakao.maps.services.Status.OK) { resultsEl.innerHTML = ""; return; }
        renderPlaceSearchResults(results.slice(0, 10));
      });
    }, 400);
  });
});
