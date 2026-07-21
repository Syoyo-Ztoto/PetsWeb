const WUHAN_DEFAULT_ORIGINS = {
  武汉天地: { lat: 30.6101, lng: 114.3048, label: "武汉天地附近" },
  汉口江滩: { lat: 30.6076, lng: 114.313, label: "汉口江滩附近" },
  光谷: { lat: 30.5065, lng: 114.4079, label: "光谷附近" },
  街道口: { lat: 30.5323, lng: 114.3507, label: "街道口附近" },
  武昌: { lat: 30.5534, lng: 114.315, label: "武昌附近" },
  汉阳: { lat: 30.5542, lng: 114.2656, label: "汉阳附近" },
};

const WUHAN_BOUNDS = {
  minLat: 30.49,
  maxLat: 30.63,
  minLng: 114.24,
  maxLng: 114.43,
};

const CATEGORY_LABELS = {
  lawn: "草坪/江滩",
  park: "公园/绿道",
  mall: "商场/商圈",
  restaurant: "餐饮/咖啡",
  hotel: "酒店/住宿",
  pet: "宠物服务",
};

const CATEGORY_KEYWORDS = {
  lawn: ["江滩公园", "草坪公园", "滨江公园"],
  park: ["公园", "绿道", "风景区"],
  mall: ["商场", "购物中心", "商圈"],
  restaurant: ["宠物友好咖啡", "可带狗餐厅", "咖啡"],
  hotel: ["宠物友好酒店", "可带狗民宿", "携宠民宿"],
  pet: ["宠物服务", "宠物医院", "宠物美容"],
};

const state = {
  origin: WUHAN_DEFAULT_ORIGINS["武汉天地"],
  radiusKm: 5,
  category: "lawn",
  places: [],
  localPlaces: window.WUHAN_PLACES || [],
  hasSearched: false,
  useAmap: false,
  isLoading: false,
  realMapReady: false,
  amapMarkers: [],
};

const elements = {
  form: document.querySelector("#search-form"),
  submitButton: document.querySelector("#search-form button[type='submit']"),
  address: document.querySelector("#address"),
  resultTitle: document.querySelector("#result-title"),
  resultCount: document.querySelector("#result-count"),
  resultsList: document.querySelector("#results-list"),
  map: document.querySelector("#map"),
  mapNote: document.querySelector("#map-note"),
  markerLayer: document.querySelector("#marker-layer"),
  originMarker: document.querySelector("#origin-marker"),
  dialog: document.querySelector("#place-dialog"),
  dialogClose: document.querySelector("#dialog-close"),
  dialogImage: document.querySelector("#dialog-image"),
  dialogCategory: document.querySelector("#dialog-category"),
  dialogTitle: document.querySelector("#dialog-title"),
  dialogEvidence: document.querySelector("#dialog-evidence"),
  dialogAddress: document.querySelector("#dialog-address"),
  dialogDistance: document.querySelector("#dialog-distance"),
  dialogPhone: document.querySelector("#dialog-phone"),
  dialogUpdated: document.querySelector("#dialog-updated"),
  dialogNav: document.querySelector("#dialog-nav"),
  feedbackButton: document.querySelector("#feedback-button"),
};

function resolveLocalOrigin(address) {
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
  return PlaceLogic.buildAmapNavigationUrl(place);
}

function getPlaceImageHtml(place) {
  if (place.image && place.imageSource === "amap") {
    return `<img src="${place.image}" alt="${place.name}" loading="lazy" />`;
  }

  const screenshotUrl = window.ImageResolver?.getSearchScreenshotUrl(place) || "";
  const searchPageUrl = window.ImageResolver?.getSearchPageUrl(place) || "#";
  if (screenshotUrl) {
    return `
      <a class="place-shot" href="${searchPageUrl}" target="_blank" rel="noreferrer" aria-label="查看${place.name}图片搜索">
        <img src="${screenshotUrl}" alt="${place.name}线上图片搜索截图" loading="lazy" />
        <span>高德暂无图片 · 线上搜索截图</span>
      </a>
    `;
  }

  return `
    <a class="place-image-empty" href="${searchPageUrl}" target="_blank" rel="noreferrer">
      <span>高德暂无图片</span>
      <strong>打开线上图片搜索</strong>
    </a>
  `;
}

function setLoading(isLoading, label) {
  state.isLoading = isLoading;
  elements.submitButton.disabled = isLoading;
  elements.submitButton.textContent = isLoading ? "搜索中..." : "搜索";
  elements.resultCount.textContent = isLoading
    ? "搜索中..."
    : label || elements.resultCount.textContent;
}

function setMapNote(message) {
  if (!elements.mapNote) return;
  elements.mapNote.textContent = message;
}

function clearAmapMarkers() {
  if (!window.PetsAmap?.map) return;
  state.amapMarkers.forEach((marker) => marker.setMap(null));
  state.amapMarkers = [];
}

function renderRealMapMarkers(places) {
  if (!window.PetsAmap?.map || !window.AMap) return false;

  clearAmapMarkers();

  const originMarker = new AMap.Marker({
    position: [state.origin.lng, state.origin.lat],
    title: "出发点",
    label: { content: "出发点", direction: "top" },
  });
  originMarker.setMap(window.PetsAmap.map);
  state.amapMarkers.push(originMarker);

  places.forEach((place) => {
    const marker = new AMap.Marker({
      position: [place.lng, place.lat],
      title: place.name,
      label: {
        content: PlaceLogic.getStatusLabel(place),
        direction: "top",
      },
    });
    marker.on("click", () => openDialog(place));
    marker.setMap(window.PetsAmap.map);
    state.amapMarkers.push(marker);
  });

  window.PetsAmap.map.setCenter([state.origin.lng, state.origin.lat]);
  if (state.amapMarkers.length > 1) {
    window.PetsAmap.map.setFitView(state.amapMarkers, false, [80, 80, 80, 80]);
  }

  return true;
}

function renderFallbackMarkers(places) {
  if (!elements.markerLayer || !elements.originMarker) return;
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

function renderMarkers(places) {
  if (!renderRealMapMarkers(places)) {
    renderFallbackMarkers(places);
  }
}

function renderCards(places) {
  elements.resultsList.replaceChildren();

  if (!state.hasSearched) {
    const prompt = document.createElement("div");
    prompt.className = "empty-state";
    prompt.textContent =
      "请输入地址，选择地点类别和半径后点击搜索。页面不会在切换类别时自动请求高德，因此搜索会更快。";
    elements.resultsList.append(prompt);
    return;
  }

  if (state.isLoading) {
    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.textContent = `正在从高德搜索附近的${CATEGORY_LABELS[state.category]}...`;
    elements.resultsList.append(loading);
    return;
  }

  if (places.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `当前半径内没有匹配的${CATEGORY_LABELS[state.category]}。可以扩大到 10 或 20 公里再试。`;
    elements.resultsList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  places.forEach((place) => {
    const tone = PlaceLogic.getConfidenceTone(place.confidence);
    const article = document.createElement("article");
    article.className = "place-card";
    const tags = Array.isArray(place.tags) ? place.tags : [];
    article.innerHTML = `
      ${getPlaceImageHtml(place)}
      <div class="place-card__body">
        <div class="place-card__topline">
          <span>${place.categoryLabel}</span>
          <span>${PlaceLogic.formatPlaceDistance(place)}</span>
        </div>
        <h3>${place.name}</h3>
        <div class="status-row">
          <span class="status-pill" data-tone="${tone}">${PlaceLogic.getStatusLabel(place)}</span>
          <span class="confidence-pill">可信度 ${place.confidence}</span>
        </div>
        <p>${place.evidence}</p>
        <div class="tag-row">
          ${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
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

function getVisiblePlaces() {
  return PlaceLogic.filterPlaces(
    state.places,
    state.origin,
    state.radiusKm,
    state.category
  );
}

function render() {
  const places = getVisiblePlaces();
  elements.resultTitle.textContent = state.hasSearched
    ? `${state.origin.label} · ${CATEGORY_LABELS[state.category]}`
    : state.origin.label;
  if (!state.isLoading) {
    elements.resultCount.textContent = state.hasSearched
      ? `${places.length} 个地点`
      : "待搜索";
  }
  renderMarkers(places);
  renderCards(places);
}

async function refreshPlacesFromAmap() {
  state.hasSearched = true;

  if (!window.PetsAmap?.isReady()) {
    state.places = state.localPlaces;
    render();
    return;
  }

  setLoading(true);
  render();

  try {
    const keywords = CATEGORY_KEYWORDS[state.category] || CATEGORY_KEYWORDS.lawn;
    setMapNote(
      `正在搜索附近的${CATEGORY_LABELS[state.category]}，本次只查询当前类别以提升速度。`
    );
    const amapPlaces = await window.PetsAmap.searchNearbyPlaces({
      origin: state.origin,
      radiusKm: state.radiusKm,
      category: state.category,
      keywords,
    });

    const mergedPlaces = PlaceLogic.groupSearchResults(
      PlaceLogic.mergePlaces(state.localPlaces, amapPlaces)
    );
    const visiblePlaces = PlaceLogic.filterPlaces(
      mergedPlaces,
      state.origin,
      state.radiusKm,
      state.category
    );
    setMapNote(
      `正在计算前 ${Math.min(12, visiblePlaces.length)} 个地点的高德路线距离和驾车时间。`
    );
    const routeEnrichedPlaces = await window.PetsAmap.enrichRouteDistances({
      origin: state.origin,
      places: visiblePlaces,
      limit: 12,
    });

    state.places = PlaceLogic.mergePlaces(routeEnrichedPlaces, mergedPlaces);
    state.useAmap = true;
    setMapNote(
      `已搜索附近的${CATEGORY_LABELS[state.category]}，距离优先显示高德路线距离，并展示当前驾车预估时间。`
    );
  } catch (error) {
    console.error(error);
    state.places = state.localPlaces;
    setMapNote("高德实时搜索暂不可用，已切换为本地示例数据。请检查 Key、域名白名单和浏览器控制台。");
  } finally {
    setLoading(false);
    render();
  }
}

async function resolveOrigin(address) {
  if (window.PetsAmap?.isReady()) {
    try {
      return await window.PetsAmap.geocodeAddress(address || "武汉天地");
    } catch (error) {
      console.warn("Geocode failed, using local origin", error);
    }
  }
  return resolveLocalOrigin(address);
}

function openDialog(place) {
  elements.dialogImage.src =
    place.image && place.imageSource === "amap"
      ? place.image
      : window.ImageResolver?.getSearchScreenshotUrl(place) || "";
  elements.dialogImage.alt = place.name;
  elements.dialogCategory.textContent = place.categoryLabel;
  elements.dialogTitle.textContent = `${place.name} · ${PlaceLogic.getStatusLabel(place)}`;
  elements.dialogEvidence.textContent = place.evidence;
  elements.dialogAddress.textContent = place.address;
  elements.dialogDistance.textContent = PlaceLogic.formatPlaceDistance(place);
  elements.dialogPhone.textContent = place.phone;
  elements.dialogUpdated.textContent = place.updatedAt;
  elements.dialogNav.href = buildNavUrl(place);
  elements.feedbackButton.onclick = () => {
    const message = `反馈入口示例：${place.name}\n\n正式上线时这里会提交：是否成功带狗、日期、是否被阻止、照片和备注。`;
    window.alert(message);
  };
  elements.dialog.showModal();
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.form);
  state.origin = await resolveOrigin(String(formData.get("address") || ""));
  state.radiusKm = Number(formData.get("radius") || 5);
  state.category = String(formData.get("category") || "lawn");
  await refreshPlacesFromAmap();
});

elements.dialogClose.addEventListener("click", () => elements.dialog.close());

async function boot() {
  render();

  if (!window.PetsAmap) {
    setMapNote("未找到高德配置，当前使用本地示例数据。");
    return;
  }

  try {
    await window.PetsAmap.load();
    state.realMapReady = true;
    elements.map.classList.add("is-real-map");
    setMapNote("高德地图已加载。请输入地址并选择类别后点击搜索。");
    render();
  } catch (error) {
    console.error(error);
    setMapNote("高德地图加载失败，当前使用本地示例地图。请检查 Key、安全密钥、域名白名单和网络。");
    render();
  }
}

boot();
