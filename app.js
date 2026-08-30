let map, condos = [], condoOverlays = [], foodOverlays = [], itineraryOverlays = [];
let itinerary = loadItinerary();
let selectedDayId = itinerary.days[0] ? itinerary.days[0].id : null;
let currentDetailItem = null;

function loadItinerary() {
  try {
    const raw = localStorage.getItem("itinerary");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { days: [] };
}
function saveItinerary() {
  localStorage.setItem("itinerary", JSON.stringify(itinerary));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const GATE_ID = "wntldus12";
const GATE_PW = "seeyj12@@";

if (localStorage.getItem("condo_auth") === "ok") {
  document.getElementById("loginGate").style.display = "none";
}
document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const id = document.getElementById("loginId").value;
  const pw = document.getElementById("loginPw").value;
  if (id === GATE_ID && pw === GATE_PW) {
    localStorage.setItem("condo_auth", "ok");
    document.getElementById("loginGate").style.display = "none";
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
  const options = itinerary.days.map(d => `<option value="${d.id}">${d.label}</option>`).join("");
  return `
    <button id="addToItinerary" type="button">📅 일정에 추가</button>
    <div id="itineraryForm">
      <select id="itineraryDaySelect">
        ${options}
        <option value="__new__">+ 새 Day</option>
      </select>
      <input id="itineraryTimeInput" type="time">
      <button id="itineraryConfirm" type="button">추가</button>
    </div>
  `;
}

function showDetail(c) {
  currentDetailItem = { name: c.콘도명, type: "condo", lat: c.lat, lng: c.lng };
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

function addDay() {
  const label = `Day${itinerary.days.length + 1}`;
  const day = { id: uid(), label, stops: [] };
  itinerary.days.push(day);
  saveItinerary();
  return day;
}

function addStopToDay(dayId, time) {
  if (!currentDetailItem) return;
  const day = itinerary.days.find(d => d.id === dayId);
  if (!day) return;
  day.stops.push({ id: uid(), time: time || "", ...currentDetailItem });
  saveItinerary();
}

function deleteStop(dayId, stopId) {
  const day = itinerary.days.find(d => d.id === dayId);
  if (!day) return;
  day.stops = day.stops.filter(s => s.id !== stopId);
  saveItinerary();
  renderTimeline();
  drawItineraryOverlay();
}

function editStopTime(dayId, stopId) {
  const day = itinerary.days.find(d => d.id === dayId);
  const stop = day && day.stops.find(s => s.id === stopId);
  if (!stop) return;
  const next = prompt("시각 (HH:MM, 비우면 미정)", stop.time || "");
  if (next === null) return;
  stop.time = next.trim();
  saveItinerary();
  renderTimeline();
  drawItineraryOverlay();
}

function sortedStops(day) {
  const timed = day.stops.filter(s => s.time).sort((a, b) => a.time.localeCompare(b.time));
  const untimed = day.stops.filter(s => !s.time);
  return { timed, untimed };
}

function renderDayTabs() {
  const el = document.getElementById("dayTabs");
  el.innerHTML = itinerary.days.map(d =>
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
    const day = addDay();
    selectedDayId = day.id;
    renderDayTabs();
    renderTimeline();
    drawItineraryOverlay();
  });
}

function stopCard(day, stop, icon) {
  return `
    <div class="timeline-stop" data-stop="${stop.id}">
      <div class="t-time">${stop.time || "미정"}</div>
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
  const day = itinerary.days.find(d => d.id === selectedDayId);
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
    html += untimed.map(s => stopCard(day, s, s.type === "food" ? "🍴" : "🏨")).join("");
  }
  if (timed.length) {
    html += `<div class="timeline-section-label">시간순</div>`;
    html += timed.map(s => stopCard(day, s, s.type === "food" ? "🍴" : "🏨")).join("");
  }
  el.innerHTML = html;

  el.querySelectorAll("button[data-act]").forEach(btn => {
    const { act, day: dayId, stop: stopId } = btn.dataset;
    btn.addEventListener("click", () => {
      if (act === "delete") deleteStop(dayId, stopId);
      else if (act === "edit") editStopTime(dayId, stopId);
      else if (act === "goto") {
        const d = itinerary.days.find(x => x.id === dayId);
        const s = d.stops.find(x => x.id === stopId);
        if (s) map.panTo(new kakao.maps.LatLng(s.lat, s.lng));
      }
    });
  });
}

function drawItineraryOverlay() {
  itineraryOverlays.forEach(o => o.setMap(null));
  itineraryOverlays = [];
  const day = itinerary.days.find(d => d.id === selectedDayId);
  if (!day) return;
  const { timed } = sortedStops(day);
  if (!timed.length) return;

  const path = timed.map(s => new kakao.maps.LatLng(s.lat, s.lng));
  const line = new kakao.maps.Polyline({ path, strokeWeight: 4, strokeColor: "#3d2b1f", strokeOpacity: 0.8 });
  line.setMap(map);
  itineraryOverlays.push(line);

  timed.forEach((s, i) => {
    const badge = document.createElement("div");
    badge.className = "price-pin";
    badge.textContent = `${i + 1}. ${s.name}`;
    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(s.lat, s.lng), content: badge, yAnchor: 1.4,
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

function showItineraryPanel() {
  document.getElementById("sheet").hidden = true;
  document.getElementById("itineraryPanel").hidden = false;
  if (!selectedDayId && itinerary.days.length) selectedDayId = itinerary.days[0].id;
  renderDayTabs();
  renderTimeline();
  drawItineraryOverlay();
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

  document.getElementById("foodBtn").addEventListener("click", () => {
    hideItineraryPanel();
    searchNearbyFood();
  });
  document.getElementById("detailClose").addEventListener("click", () => {
    document.getElementById("detailCard").hidden = true;
  });

  document.getElementById("itineraryBtn").addEventListener("click", showItineraryPanel);

  document.getElementById("detailCard").addEventListener("click", e => {
    if (e.target.id === "addToItinerary") {
      document.getElementById("itineraryForm").classList.toggle("open");
    } else if (e.target.id === "itineraryConfirm") {
      const select = document.getElementById("itineraryDaySelect");
      const time = document.getElementById("itineraryTimeInput").value;
      let dayId = select.value;
      if (dayId === "__new__") dayId = addDay().id;
      addStopToDay(dayId, time);
      document.getElementById("itineraryForm").classList.remove("open");
      selectedDayId = dayId;
      document.getElementById("detailCard").hidden = true;
      showItineraryPanel();
    }
  });
});
