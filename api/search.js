const PlaceLogic = require("../src/placeLogic");

const AMAP_BASE_URL = "https://restapi.amap.com/v3";
const CITY = "武汉";
const MAX_RADIUS_KM = 20;
const ROUTE_LIMIT = 12;
const CACHE_TTL_MS = 10 * 60 * 1000;

const CATEGORY_KEYWORDS = {
  lawn: ["江滩公园", "草坪公园", "滨江公园"],
  park: ["公园", "绿道", "风景区"],
  mall: ["商场", "购物中心", "商圈"],
  restaurant: ["宠物友好咖啡", "可带狗餐厅", "宠物友好餐厅", "可携宠咖啡"],
  hotel: ["宠物友好酒店", "可带狗民宿", "携宠民宿"],
  pet: ["宠物服务", "宠物医院", "宠物美容"],
};

const responseCache = new Map();

function getCategoryKeywords(category) {
  return CATEGORY_KEYWORDS[category] || CATEGORY_KEYWORDS.lawn;
}

function parseSearchParams(query) {
  const address = String(query.address || "").trim() || "武汉天地";
  const radius = Number(query.radius || query.radiusKm || 5);
  const category = CATEGORY_KEYWORDS[query.category] ? query.category : "lawn";

  return {
    address,
    radiusKm: Math.min(MAX_RADIUS_KM, Math.max(1, Number.isFinite(radius) ? radius : 5)),
    category,
  };
}

function makeJsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(payload));
}

function getQueryFromRequest(req) {
  if (req.query) return req.query;
  const url = new URL(req.url || "/", "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

function getCache(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  responseCache.set(key, { createdAt: Date.now(), value });
}

async function amapGet(path, params, key) {
  const url = new URL(`${AMAP_BASE_URL}${path}`);
  Object.entries({ ...params, key }).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  });

  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.status !== "1") {
    throw new Error(data.info || `AMap request failed: ${path}`);
  }
  return data;
}

function parseLngLat(location) {
  const [lngText, latText] = String(location || "").split(",");
  const lng = Number(lngText);
  const lat = Number(latText);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lng, lat };
}

async function geocodeAddress(address, key) {
  const data = await amapGet(
    "/geocode/geo",
    {
      city: CITY,
      address: address.includes(CITY) ? address : `${CITY}${address}`,
    },
    key
  );
  const first = Array.isArray(data.geocodes) ? data.geocodes[0] : null;
  const location = parseLngLat(first?.location);
  if (!location) throw new Error("无法解析该武汉地址");
  return { ...location, label: `${address}附近` };
}

function uniquePois(pois) {
  const byKey = new Map();
  pois.forEach((poi) => {
    const key = poi.id || `${poi.name}-${poi.location}`;
    if (!byKey.has(key)) byKey.set(key, poi);
  });
  return Array.from(byKey.values());
}

async function searchAround(origin, radiusKm, category, key) {
  const keywords = getCategoryKeywords(category);
  const results = await Promise.all(
    keywords.map(async (keyword) => {
      const data = await amapGet(
        "/place/around",
        {
          city: CITY,
          citylimit: true,
          extensions: "all",
          keywords: keyword,
          location: `${origin.lng},${origin.lat}`,
          offset: 20,
          page: 1,
          radius: Math.round(radiusKm * 1000),
        },
        key
      );
      return (data.pois || []).map((poi) => ({ ...poi, __keyword: keyword }));
    })
  );
  return uniquePois(results.flat());
}

function getFirstRoute(routeData) {
  const route = routeData.route || {};
  const paths = Array.isArray(route.paths) ? route.paths : [];
  return paths[0] || null;
}

async function getWalkingRoute(origin, place, key) {
  const data = await amapGet(
    "/direction/walking",
    {
      origin: `${origin.lng},${origin.lat}`,
      destination: `${place.lng},${place.lat}`,
    },
    key
  );
  return getFirstRoute(data);
}

async function getDrivingRoute(origin, place, key) {
  const data = await amapGet(
    "/direction/driving",
    {
      origin: `${origin.lng},${origin.lat}`,
      destination: `${place.lng},${place.lat}`,
      strategy: 0,
    },
    key
  );
  return getFirstRoute(data);
}

async function enrichRouteMetrics(origin, places, key) {
  const enriched = [...places];
  const routeTargets = enriched.slice(0, ROUTE_LIMIT);

  for (const place of routeTargets) {
    try {
      const [walking, driving] = await Promise.all([
        getWalkingRoute(origin, place, key).catch(() => null),
        getDrivingRoute(origin, place, key).catch(() => null),
      ]);
      if (walking?.distance) {
        place.routeDistanceMeters = Number(walking.distance);
        place.routeDistanceKm = Number(walking.distance) / 1000;
      }
      if (driving?.distance) place.drivingDistanceMeters = Number(driving.distance);
      if (driving?.duration) place.drivingDurationSeconds = Number(driving.duration);
    } catch (error) {
      console.warn("Route enrichment failed", place.name, error.message);
    }
  }

  return enriched;
}

function buildSearchResponse({ origin, radiusKm, category, rawPois, localPlaces = [] }) {
  const normalizedPois = rawPois.map((poi) =>
    PlaceLogic.normalizeAmapPoi(poi, poi.__keyword || getCategoryKeywords(category)[0])
  );
  const mergedPlaces = PlaceLogic.groupSearchResults(
    PlaceLogic.mergePlaces(localPlaces, normalizedPois)
  );
  const places = PlaceLogic.filterPlaces(mergedPlaces, origin, radiusKm, category);

  return {
    source: "backend-amap",
    city: CITY,
    origin,
    radiusKm,
    category,
    places,
  };
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    makeJsonResponse(res, 204, {});
    return;
  }

  if (req.method && req.method !== "GET") {
    makeJsonResponse(res, 405, { error: "只支持 GET 请求" });
    return;
  }

  const apiKey = process.env.AMAP_WEB_SERVICE_KEY || process.env.AMAP_KEY;
  if (!apiKey) {
    makeJsonResponse(res, 500, {
      error: "后端缺少 AMAP_WEB_SERVICE_KEY 环境变量",
    });
    return;
  }

  try {
    const params = parseSearchParams(getQueryFromRequest(req));
    const cacheKey = JSON.stringify(params);
    const cached = getCache(cacheKey);
    if (cached) {
      makeJsonResponse(res, 200, { ...cached, cache: "hit" });
      return;
    }

    const origin = await geocodeAddress(params.address, apiKey);
    const rawPois = await searchAround(origin, params.radiusKm, params.category, apiKey);
    const response = buildSearchResponse({
      origin,
      radiusKm: params.radiusKm,
      category: params.category,
      rawPois,
    });
    const routeEnrichedPlaces = await enrichRouteMetrics(origin, response.places, apiKey);
    response.places = PlaceLogic.filterPlaces(
      routeEnrichedPlaces,
      origin,
      params.radiusKm,
      params.category
    );
    setCache(cacheKey, response);
    makeJsonResponse(res, 200, { ...response, cache: "miss" });
  } catch (error) {
    makeJsonResponse(res, 502, {
      error: error.message || "高德后端搜索失败",
    });
  }
}

module.exports = handler;
module.exports.buildSearchResponse = buildSearchResponse;
module.exports.getCategoryKeywords = getCategoryKeywords;
module.exports.parseSearchParams = parseSearchParams;
