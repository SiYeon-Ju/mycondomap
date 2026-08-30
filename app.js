let map, condos = [], condoOverlays = [], foodOverlays = [];

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

function showDetail(c) {
  const body = document.getElementById("detailBody");
  body.innerHTML = `
    <h2>${c.콘도명}</h2>
    <div class="row"><span class="label">지역</span> ${c.지역}</div>
    <div class="row"><span class="label">룸타입</span> ${c.룸타입}</div>
    <div class="row"><span class="label">확정금액</span> ${c.확정금액}</div>
    <div class="row"><span class="label">공제방법</span> ${c.공제방법}</div>
    <div class="row"><span class="label">본인부담금</span> ${c.본인부담금}</div>
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
          document.getElementById("detailBody").innerHTML =
            `<h2>${r.place_name}</h2><div class="row">${r.road_address_name || r.address_name}</div>
             <div class="row"><span class="label">카테고리</span> ${r.category_name}</div>`;
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
      document.querySelectorAll(".filter-btn[data-region]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilter(btn.dataset.region);
    });
  });

  document.getElementById("foodBtn").addEventListener("click", searchNearbyFood);
  document.getElementById("detailClose").addEventListener("click", () => {
    document.getElementById("detailCard").hidden = true;
  });
});
