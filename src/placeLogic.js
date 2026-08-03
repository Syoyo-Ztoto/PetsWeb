(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PlaceLogic = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const EARTH_RADIUS_KM = 6371;

  function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function calculateDistanceKm(origin, place) {
    const lat1 = toRadians(origin.lat);
    const lat2 = toRadians(place.lat);
    const deltaLat = toRadians(place.lat - origin.lat);
    const deltaLng = toRadians(place.lng - origin.lng);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
  }

  function enrichWithDistance(place, origin) {
    return {
      ...place,
      distanceKm: calculateDistanceKm(origin, place),
    };
  }

  function getComparableDistanceKm(place) {
    if (Number.isFinite(place.routeDistanceKm)) return place.routeDistanceKm;
    if (Number.isFinite(place.routeDistanceMeters)) return place.routeDistanceMeters / 1000;
    return place.distanceKm;
  }

  function withWuhanPrefix(name) {
    const cleanName = String(name || "").trim();
    if (!cleanName) return "武汉目的地";
    return cleanName.startsWith("武汉") ? cleanName : `武汉${cleanName}`;
  }

  function buildAmapNavigationUrl(place) {
    const destinationName = encodeURIComponent(withWuhanPrefix(place.name));

    if (Number.isFinite(place.lng) && Number.isFinite(place.lat)) {
      return [
        "https://uri.amap.com/navigation",
        `?to=${place.lng},${place.lat},${destinationName}`,
        "&mode=car",
        "&policy=1",
        "&src=PetsWeb",
        "&coordinate=gaode",
        "&callnative=1",
      ].join("");
    }

    const keyword = encodeURIComponent(
      ["武汉", place.name, place.address].filter(Boolean).join(" ")
    );
    return `https://uri.amap.com/search?keyword=${keyword}&city=${encodeURIComponent("武汉")}`;
  }

  function filterPlaces(places, origin, radiusKm, category) {
    const filteredPlaces = places
      .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
      .filter((place) => isRelevantPlaceForCategory(place, category))
      .map((place) => enrichWithDistance(place, origin))
      .filter((place) => getComparableDistanceKm(place) <= radiusKm)
      .filter((place) => !category || category === "all" || place.category === category);

    return groupSearchResults(filteredPlaces).sort((a, b) => {
        const rankDiff = getCategoryRank(b, category) - getCategoryRank(a, category);
        if (rankDiff !== 0) return rankDiff;
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return getComparableDistanceKm(a) - getComparableDistanceKm(b);
      });
  }

  function isRejectedPoi(place) {
    const text = `${place.name || ""} ${place.type || ""} ${place.address || ""}`;
    return /停车|车库|加油|加气|充电站|维修|洗车|幼儿园|学校|小学|中学|大学|培训|早教|亲子|健康|调理|养生|美容院|诊所|门诊|药房|医院|厕所|卫生间|地铁站|公交|派出所|警务|银行|证券|保险|办事处|政务|政府|机关|委员会|街道办|社区服务|公司|企业|产业园|写字楼|住宅|小区|公寓|入口|出口|售票|收费站|服务中心|管理处|营业厅|网点|仓库|物流|码头|货运|篮球|足球|网球|羽毛球|乒乓|排球|台球|高尔夫|游泳|健身|跆拳道|武术|轮滑|滑板|体育馆|体育场|运动场|运动馆|球场|球馆|运动场馆/.test(text);
  }

  function isRelevantLeisurePlace(place) {
    if (isRejectedPoi(place)) return false;
    const text = `${place.name || ""} ${place.type || ""} ${place.categoryLabel || ""}`;
    return /江滩|公园|绿道|草坪|绿地|滨江|湿地|风景区|风景名胜|郊野|森林|广场/.test(text);
  }

  function isRelevantPlaceForCategory(place, category) {
    if (category === "lawn" || category === "park") {
      return isRelevantLeisurePlace(place);
    }
    if (category === "hotel") {
      return isRelevantHotelPlace(place);
    }
    return !isRejectedPoi(place);
  }

  function isExplicitPetFriendlyText(text) {
    return /宠物友好|可带狗|可带犬|可携宠|携宠|带狗|狗狗友好|宠物可入住|允许宠物|宠物入住|萌宠/.test(text);
  }

  function isHomestayText(text) {
    return /民宿|客栈|公寓|短租|露营地|营地/.test(text);
  }

  function isOrdinaryChainHotel(text) {
    return /亚朵|全季|汉庭|如家|锦江之星|城市便捷|维也纳|麗枫|丽枫|希尔顿|万豪|洲际|皇冠假日|香格里拉|凯悦|喜来登|宜必思|桔子酒店|速8|7天|七天|格林豪泰|尚客优|美居|铂尔曼|诺富特/.test(text);
  }

  function isRelevantHotelPlace(place) {
    if (isRejectedPoi(place)) return false;
    const text = `${place.name || ""} ${place.type || ""} ${place.address || ""}`;
    if (isExplicitPetFriendlyText(text) || isHomestayText(text)) return true;
    return !isOrdinaryChainHotel(text) && /酒店|宾馆|住宿|民宿|客栈|公寓酒店/.test(text);
  }

  function getCategoryRank(place, category) {
    const text = `${place.name || ""} ${place.type || ""} ${place.address || ""} ${place.petPolicyNote || ""}`;
    if (category === "hotel") {
      if (isExplicitPetFriendlyText(text)) return 300;
      if (isHomestayText(text)) return 200;
      return 100;
    }
    if (place.petStatus === "confirmed") return 200;
    if (place.petStatus === "limited") return 150;
    return 0;
  }

  function getCanonicalPlaceName(name) {
    const cleanName = String(name || "")
      .replace(/[（(].*?[）)]/g, "")
      .replace(/第?[一二三四五六七八九十0-9]+期/g, "")
      .replace(/[-—_].*$/g, "")
      .trim();

    const riverMatch = cleanName.match(/(.{1,8}?江滩)/);
    if (riverMatch) return riverMatch[1];

    const parkMatch = cleanName.match(/(.{1,12}?(?:公园|绿道|湿地|风景区|森林公园))/);
    if (parkMatch) return parkMatch[1];

    return cleanName || name;
  }

  function mergeGroupedPlace(existing, candidate) {
    const merged = existing.confidence >= candidate.confidence ? { ...existing } : { ...candidate };
    const other = merged.id === existing.id ? candidate : existing;

    merged.name = getCanonicalPlaceName(merged.name);
    merged.confidence = Math.max(existing.confidence || 0, candidate.confidence || 0);
    merged.image = existing.image || candidate.image || "";
    merged.imageSource = existing.imageSource === "amap" || candidate.imageSource === "amap"
      ? "amap"
      : existing.imageSource || candidate.imageSource || "none";
    merged.tags = Array.from(new Set([...(existing.tags || []), ...(candidate.tags || [])]));
    merged.evidence = existing.evidence || candidate.evidence;
    merged.address = existing.address && existing.address !== "暂无地址" ? existing.address : other.address;

    return merged;
  }

  function groupSearchResults(places) {
    const byKey = new Map();

    places.forEach((place) => {
      const canonicalName = getCanonicalPlaceName(place.name);
      const key = `${canonicalName}-${place.category || ""}`;
      const normalizedPlace = {
        ...place,
        name: canonicalName,
      };
      const existing = byKey.get(key);
      byKey.set(key, existing ? mergeGroupedPlace(existing, normalizedPlace) : normalizedPlace);
    });

    return Array.from(byKey.values());
  }

  function getStatusLabel(place) {
    if (place.petStatus === "confirmed") {
      return place.petPolicyNote ? "可带狗" : "已确认可带狗";
    }
    if (place.petStatus === "recent") {
      return "近期有人带狗";
    }
    if (place.petStatus === "limited") {
      return place.petPolicyNote ? "有狗狗肩高/座位限制" : "可带狗但有限制";
    }
    if (place.petStatus === "unverified") {
      return "待确认";
    }
    return "信息不足，建议先电话确认";
  }

  function getConfidenceTone(confidence) {
    if (confidence >= 80) return "strong";
    if (confidence >= 55) return "medium";
    if (confidence >= 30) return "weak";
    return "unknown";
  }

  function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  }

  function formatPlaceDistance(place) {
    const distanceLabel = Number.isFinite(place.routeDistanceMeters)
      ? `路线 ${formatDistance(place.routeDistanceMeters / 1000)}`
      : `直线 ${formatDistance(place.distanceKm || 0)}`;

    if (!Number.isFinite(place.drivingDurationSeconds)) {
      return distanceLabel;
    }

    const minutes = Math.max(1, Math.round(place.drivingDurationSeconds / 60));
    return `${distanceLabel} · 驾车约 ${minutes} 分钟`;
  }

  function parseLocation(location) {
    if (!location) return null;

    if (typeof location === "string") {
      const [lngText, latText] = location.split(",");
      const lng = Number(lngText);
      const lat = Number(latText);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    if (typeof location.getLng === "function" && typeof location.getLat === "function") {
      return { lng: location.getLng(), lat: location.getLat() };
    }

    if (Number.isFinite(location.lng) && Number.isFinite(location.lat)) {
      return { lng: location.lng, lat: location.lat };
    }

    return null;
  }

  function pickCategory(poi, keyword) {
    const text = `${poi.name || ""} ${poi.type || ""} ${keyword || ""}`;

    if (/宠物服务|宠物店|宠物医院|宠物美容|宠物寄养|萌宠|犬舍|猫舍/.test(text)) {
      return { category: "pet", categoryLabel: "宠物服务" };
    }
    if (/酒店|宾馆|住宿|民宿|公寓酒店|旅馆|客栈/.test(text)) {
      return { category: "hotel", categoryLabel: "酒店/住宿" };
    }
    if (/草坪|江滩|滨江|露营|绿地/.test(text)) {
      return { category: "lawn", categoryLabel: "草坪/江滩" };
    }
    if (/公园|绿道|景区|风景名胜/.test(text)) {
      return { category: "park", categoryLabel: "公园/绿道" };
    }
    if (/咖啡|餐饮|餐厅|西餐|火锅|茶饮|户外座位/.test(text)) {
      return { category: "restaurant", categoryLabel: "餐饮/咖啡" };
    }
    if (/商场|购物|商圈|商业街|步行街|天地|K11|万象城|MALL/i.test(text)) {
      return { category: "mall", categoryLabel: "商场/商圈" };
    }

    return { category: "park", categoryLabel: "地点候选" };
  }

  function pickPhoto(poi) {
    if (Array.isArray(poi.photos) && poi.photos.length > 0) {
      return poi.photos[0].url || poi.photos[0].src || "";
    }
    return "";
  }

  function buildImageSearchQuery(place) {
    return [place.name, place.address, "实景", "图片"]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizePhone(tel) {
    if (Array.isArray(tel)) {
      return tel.filter(Boolean).join(" / ") || "暂无公开电话";
    }
    return tel || "暂无公开电话";
  }

  function normalizeText(value, fallback) {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(" / ") || fallback;
    }
    if (value === null || value === undefined || value === "") {
      return fallback;
    }
    return String(value);
  }

  function estimateConfidence(poi, keyword) {
    const text = `${poi.name || ""} ${poi.type || ""} ${keyword || ""}`;
    let score = 32;

    if (/宠物|猫|狗|犬/.test(text)) score += 28;
    if (/草坪|江滩|绿道|公园|滨江/.test(text)) score += 14;
    if (/咖啡|餐厅|商场|街区|天地|酒店|民宿|宠物服务/.test(text)) score += 10;
    if (normalizePhone(poi.tel) !== "暂无公开电话") score += 6;
    if (Array.isArray(poi.photos) && poi.photos.length > 0) score += 6;

    return Math.min(score, 72);
  }

  function inferPetPolicy(poi, keyword, category) {
    const text = `${poi.name || ""} ${poi.type || ""} ${keyword || ""}`;

    if (category === "pet") {
      return {
        petStatus: "confirmed",
        petPolicyNote: "宠物服务场景，默认可带狗；异宠请事先确认",
      };
    }

    if (category === "hotel" && isExplicitPetFriendlyText(text)) {
      return {
        petStatus: "confirmed",
        petPolicyNote: "可带狗，入住前确认体型、清洁费和房型限制",
      };
    }

    if (category === "hotel" && isHomestayText(text)) {
      return {
        petStatus: "limited",
        petPolicyNote: "民宿优先，入住前确认狗狗体型、清洁费和房东规则",
      };
    }

    if (category === "restaurant" && isExplicitPetFriendlyText(text)) {
      return {
        petStatus: "limited",
        petPolicyNote: "可带狗，常见限制为牵绳、户外座位或狗狗肩高限制",
      };
    }

    return {
      petStatus: "unverified",
      petPolicyNote: "",
    };
  }

  function normalizeAmapPoi(poi, keyword) {
    const location = parseLocation(poi.location);
    const category = pickCategory(poi, keyword);
    const confidence = estimateConfidence(poi, keyword);
    const petPolicy = inferPetPolicy(poi, keyword, category.category);

    return {
      id: `amap-${poi.id || poi.name}`,
      source: "amap",
      name: poi.name || "未命名地点",
      type: normalizeText(poi.type, ""),
      category: category.category,
      categoryLabel: category.categoryLabel,
      lat: location ? location.lat : NaN,
      lng: location ? location.lng : NaN,
      confidence,
      petStatus: petPolicy.petStatus,
      petPolicyNote: petPolicy.petPolicyNote,
      address: normalizeText(poi.address || poi.pname, "暂无地址"),
      phone: normalizePhone(poi.tel),
      image: pickPhoto(poi),
      imageSource: pickPhoto(poi) ? "amap" : "none",
      imageSearchQuery: buildImageSearchQuery({
        name: poi.name || "未命名地点",
        address: normalizeText(poi.address || poi.pname, "武汉"),
      }),
      evidence:
        petPolicy.petPolicyNote
          ? `来自高德实时周边搜索。${petPolicy.petPolicyNote}。`
          : "来自高德实时周边搜索，并已过滤明显非休闲散步场景。尚未完成宠物政策核验，建议出发前电话确认或查看近期用户反馈。",
      updatedAt: new Date().toISOString().slice(0, 10),
      tags: ["高德实时数据", keyword || "周边搜索", petPolicy.petStatus === "unverified" ? "待确认" : "可带狗"],
    };
  }

  function mergePlaces(primaryPlaces, secondaryPlaces) {
    const byKey = new Map();

    [...primaryPlaces, ...secondaryPlaces].forEach((place) => {
      const key = `${place.name}-${place.address || ""}`
        .replace(/\s+/g, "")
        .toLowerCase();
      const existing = byKey.get(key);
      if (!existing || place.confidence > existing.confidence) {
        byKey.set(key, place);
      }
    });

    return Array.from(byKey.values());
  }

  return {
    calculateDistanceKm,
    buildAmapNavigationUrl,
    filterPlaces,
    getStatusLabel,
    getConfidenceTone,
    formatDistance,
    formatPlaceDistance,
    buildImageSearchQuery,
    groupSearchResults,
    isRelevantLeisurePlace,
    isRelevantPlaceForCategory,
    normalizeAmapPoi,
    mergePlaces,
  };
});
