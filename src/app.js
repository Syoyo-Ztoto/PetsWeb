const WUHAN_DEFAULT_ORIGINS = {
  "武汉天地": { lat: 30.6101, lng: 114.3048, label: "武汉天地附近" },
  "汉口江滩": { lat: 30.6076, lng: 114.313, label: "汉口江滩附近" },
  "光谷": { lat: 30.5065, lng: 114.4079, label: "光谷附近" },
  "街道口": { lat: 30.5323, lng: 114.3507, label: "街道口附近" },
  "武昌": { lat: 30.5534, lng: 114.315, label: "武昌附近" },
  "汉阳": { lat: 30.5542, lng: 114.2656, label: "汉阳附近" },
};

const WUHAN_BOUNDS = {
  minLat: 30.49,
  maxLat: 30.63,
  minLng: 114.24,
  maxLng: 114.43,
};

const state = {
  origin: WUHAN_DEFAULT_ORIGINS["武汉天地"],
  radiusKm: 5,
  category: "all",
  places: window.WUHAN_PLACES,
};

const elements = {
  form: document.querySelector("#search-form"),
  address: document.querySelector("#address"),
  resultTitle: document.querySelector("#result-title"),
  resultCount: document.querySelector("#result-count"),
  resultsList: document.querySelector("#results-list"),
  markerLayer: document.querySelector("#marker-layer"),
  originMarker: document.querySelector("#origin-marker"),
  filterChips: Array.from(document.querySelectorAll(".filter-chip")),
  dialog: document.querySelector("#place-dialog"),
  dialogClose: document.querySelector("#dialog-close"),
  dialogImage: document.querySelector("#dialog-image"),
  dialogCategory: document.querySelector("#dialog-category"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogEvidence: document.querySelector("#dialog-evidence"),
  dialogAddress: document.querySelector("#dialog-address"),
  dialogPhone: document.querySelector("#dialog-phone"),
  dialogUpdated: document.querySelector("#dialog-updated"),
  dialogNav: document.querySelector("#dialog-nav"),
  feedbackButton: document.querySelector("#feedback-button"),
};

function resolveOrigin(address) {
  const normalized = address.trim();
  const matchedKey = Object.keys(WUHAN_DEFAULT_ORIGINS).find((key) =>
    normalized.includes(key)
  );

  if (matchedKey) return WUHAN_DEFAULT_ORIGINS[matchedKey];

  return {
    lat: 30.5928,
    lng: 114.3055,
    label: `${normalized || "武汉"}附近`,
  };
}

function getPosition(point) {
  const x =
    ((point.lng - WUHAN_BOUNDS.minLng) /
      (WUHAN_BOUNDS.maxLng - WUHAN_BOUNDS.minLng)) *
    100;
  const y =
    (1 -
      (point.lat - WUHAN_BOUNDS.minLat) /
        (WUHAN_BOUNDS.maxLat - WUHAN_BOUNDS.minLat)) *
    100;

  return {
    left: `${Math.min(96, Math.max(4, x))}%`,
    top: `${Math.min(96, Math.max(4, y))}%`,
  };
}

function buildNavUrl(place) {
  const query = encodeURIComponent(`${place.name} ${place.address}`);
  return `https://uri.amap.com/search?keyword=${query}&center=${place.lng},${place.lat}`;
}

function renderMarkers(places) {
  elements.markerLayer.replaceChildren();

  const originPosition = getPosition(state.origin);
  elements.originMarker.style.left = originPosition.left;
  elements.originMarker.style.top = originPosition.top;

  places.forEach((place) => {
    const marker = document.createElement("button");
    const position = getPosition(place);
    marker.className = "place-marker";
    marker.type = "button";
    marker.dataset.tone = PlaceLogic.getConfidenceTone(place.confidence);
    marker.style.left = position.left;
    marker.style.top = position.top;
    marker.title = place.name;
    marker.addEventListener("click", () => openDialog(place));
    elements.markerLayer.append(marker);
  });
}

function renderCards(places) {
  elements.resultsList.replaceChildren();

  if (places.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "当前半径内没有匹配地点。可以扩大到 10 或 20 公里再试。";
    elements.resultsList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  places.forEach((place) => {
    const tone = PlaceLogic.getConfidenceTone(place.confidence);
    const article = document.createElement("article");
    article.className = "place-card";
    article.innerHTML = `
      <img src="${place.image}" alt="${place.name}" loading="lazy" />
      <div class="place-card__body">
        <div class="place-card__topline">
          <span>${place.categoryLabel}</span>
          <span>${PlaceLogic.formatDistance(place.distanceKm)}</span>
        </div>
        <h3>${place.name}</h3>
        <div class="status-row">
          <span class="status-pill" data-tone="${tone}">${PlaceLogic.getStatusLabel(place)}</span>
          <span class="confidence-pill">可信度 ${place.confidence}</span>
        </div>
        <p>${place.evidence}</p>
        <div class="tag-row">
          ${place.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </div>
        <div class="card-actions">
          <button type="button" data-action="detail">查看详情</button>
          <a href="${buildNavUrl(place)}" target="_blank" rel="noreferrer">导航</a>
        </div>
      </div>
    `;

    article
      .querySelector('[data-action="detail"]')
      .addEventListener("click", () => openDialog(place));
    fragment.append(article);
  });

  elements.resultsList.append(fragment);
}

function render() {
  const places = PlaceLogic.filterPlaces(
    state.places,
    state.origin,
    state.radiusKm,
    state.category
  );

  elements.resultTitle.textContent = state.origin.label;
  elements.resultCount.textContent = `${places.length} 个地点`;
  renderMarkers(places);
  renderCards(places);
}

function openDialog(place) {
  elements.dialogImage.src = place.image;
  elements.dialogImage.alt = place.name;
  elements.dialogCategory.textContent = place.categoryLabel;
  elements.dialogTitle.textContent = `${place.name} · ${PlaceLogic.getStatusLabel(place)}`;
  elements.dialogEvidence.textContent = place.evidence;
  elements.dialogAddress.textContent = place.address;
  elements.dialogPhone.textContent = place.phone;
  elements.dialogUpdated.textContent = place.updatedAt;
  elements.dialogNav.href = buildNavUrl(place);
  elements.feedbackButton.onclick = () => {
    const message = `反馈入口示例：${place.name}\n\n正式上线时这里会提交：是否成功带狗、日期、是否被阻止、照片和备注。`;
    window.alert(message);
  };
  elements.dialog.showModal();
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(elements.form);
  state.origin = resolveOrigin(String(formData.get("address") || ""));
  state.radiusKm = Number(formData.get("radius") || 5);
  render();
});

elements.filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    elements.filterChips.forEach((item) => item.classList.remove("is-active"));
    chip.classList.add("is-active");
    state.category = chip.dataset.category;
    render();
  });
});

elements.dialogClose.addEventListener("click", () => elements.dialog.close());

render();
