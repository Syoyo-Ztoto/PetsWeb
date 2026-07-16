(function () {
  const config = window.PETS_AMAP_CONFIG;
  let loadPromise = null;
  let map = null;
  const searchCache = new Map();
  const routeCache = new Map();

  function ensureConfig() {
    if (!config?.key || !config?.securityJsCode) {
      throw new Error("Missing AMap key or securityJsCode.");
    }
  }

  function loadScript() {
    ensureConfig();
    window._AMapSecurityConfig = {
      securityJsCode: config.securityJsCode,
    };

    return new Promise((resolve, reject) => {
      if (window.AMap) {
        resolve(window.AMap);
        return;
      }

      const script = document.createElement("script");
      const plugins = [
        "AMap.Geocoder",
        "AMap.PlaceSearch",
        "AMap.Walking",
        "AMap.Scale",
        "AMap.ToolBar",
      ].join(",");
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${config.key}&plugin=${plugins}`;
      script.async = true;
      script.onload = () => resolve(window.AMap);
      script.onerror = () => reject(new Error("Failed to load AMap JS API."));
      document.head.append(script);
    });
  }

  async function load() {
    if (loadPromise) return loadPromise;

    loadPromise = loadScript().then((AMap) => {
      const mapHost = document.querySelector("#map");
      let mapCanvas = mapHost.querySelector(".amap-canvas");
      if (!mapCanvas) {
        mapCanvas = document.createElement("div");
        mapCanvas.className = "amap-canvas";
        mapHost.append(mapCanvas);
      }

      const createdMap = new AMap.Map(mapCanvas, {
        center: [114.3048, 30.6101],
        zoom: 12,
        viewMode: "2D",
      });
      createdMap.addControl(new AMap.Scale());
      createdMap.addControl(new AMap.ToolBar({ position: "RT" }));

      return new Promise((resolve, reject) => {
        let isSettled = false;
        const timeoutId = window.setTimeout(() => {
          if (isSettled) return;
          isSettled = true;
          reject(new Error("AMap map render timeout."));
        }, 5000);

        createdMap.on("complete", () => {
          if (isSettled) return;
          isSettled = true;
          window.clearTimeout(timeoutId);
          map = createdMap;
          resolve(AMap);
        });
      });
    });

    return loadPromise;
  }

  function isReady() {
    return Boolean(window.AMap && map);
  }

  function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
      let isSettled = false;
      const timeoutId = window.setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        reject(new Error(`地址解析超时：${address}`));
      }, 3500);

      const geocoder = new AMap.Geocoder({
        city: config.city,
        citylimit: true,
      });

      geocoder.getLocation(address, (status, result) => {
        if (isSettled) return;
        isSettled = true;
        window.clearTimeout(timeoutId);

        const geocode = result?.geocodes?.[0];
        if (status !== "complete" || !geocode?.location) {
          reject(new Error(`无法解析地址：${address}`));
          return;
        }

        resolve({
          lat: geocode.location.getLat(),
          lng: geocode.location.getLng(),
          label: `${address || geocode.formattedAddress}附近`,
        });
      });
    });
  }

  function searchKeyword(origin, radiusKm, keyword) {
    return new Promise((resolve) => {
      let isSettled = false;
      const timeoutId = window.setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        console.warn("AMap PlaceSearch timeout", keyword);
        resolve([]);
      }, 4500);

      const placeSearch = new AMap.PlaceSearch({
        city: config.city,
        citylimit: true,
        pageSize: 18,
        pageIndex: 1,
        extensions: "all",
      });

      placeSearch.searchNearBy(
        keyword,
        [origin.lng, origin.lat],
        Math.round(radiusKm * 1000),
        (status, result) => {
          if (isSettled) return;
          isSettled = true;
          window.clearTimeout(timeoutId);

          if (status !== "complete") {
            console.warn("AMap PlaceSearch failed", keyword, status, result);
            resolve([]);
            return;
          }

          const pois = result?.poiList?.pois || [];
          resolve(pois.map((poi) => PlaceLogic.normalizeAmapPoi(poi, keyword)));
        }
      );
    });
  }

  function buildSearchCacheKey(origin, radiusKm, category, keywords) {
    const roundedLng = origin.lng.toFixed(5);
    const roundedLat = origin.lat.toFixed(5);
    return [
      roundedLng,
      roundedLat,
      radiusKm,
      category || "unknown",
      Array.from(new Set(keywords)).join(","),
    ].join("|");
  }

  async function searchNearbyPlaces({ origin, radiusKm, category, keywords }) {
    const uniqueKeywords = Array.from(new Set(keywords));
    const cacheKey = buildSearchCacheKey(origin, radiusKm, category, uniqueKeywords);
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey);
    }

    const batches = await Promise.all(
      uniqueKeywords.map((keyword) => searchKeyword(origin, radiusKm, keyword))
    );
    const places = PlaceLogic.mergePlaces([], batches.flat());
    searchCache.set(cacheKey, places);
    return places;
  }

  function buildRouteCacheKey(origin, place) {
    return [
      origin.lng.toFixed(5),
      origin.lat.toFixed(5),
      place.lng.toFixed(5),
      place.lat.toFixed(5),
    ].join("|");
  }

  function getWalkingDistance(origin, place) {
    const cacheKey = buildRouteCacheKey(origin, place);
    if (routeCache.has(cacheKey)) {
      return Promise.resolve(routeCache.get(cacheKey));
    }

    return new Promise((resolve) => {
      let isSettled = false;
      const timeoutId = window.setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        resolve(null);
      }, 3500);

      const walking = new AMap.Walking({ city: config.city });
      walking.search(
        [origin.lng, origin.lat],
        [place.lng, place.lat],
        (status, result) => {
          if (isSettled) return;
          isSettled = true;
          window.clearTimeout(timeoutId);

          const distance = Number(result?.routes?.[0]?.distance);
          const routeDistanceMeters = Number.isFinite(distance) ? distance : null;
          routeCache.set(cacheKey, routeDistanceMeters);
          resolve(routeDistanceMeters);
        }
      );
    });
  }

  async function enrichRouteDistances({ origin, places, limit = 12 }) {
    if (!window.AMap?.Walking) return places;

    const targetPlaces = places.slice(0, limit);
    const untouchedPlaces = places.slice(limit);
    const enrichedPlaces = [];

    for (let index = 0; index < targetPlaces.length; index += 4) {
      const batch = targetPlaces.slice(index, index + 4);
      const batchResults = await Promise.all(
        batch.map(async (place) => {
          const routeDistanceMeters = await getWalkingDistance(origin, place);
          if (!Number.isFinite(routeDistanceMeters)) return place;
          return {
            ...place,
            routeDistanceMeters,
            routeDistanceKm: routeDistanceMeters / 1000,
            distanceSource: "amap-walking",
          };
        })
      );
      enrichedPlaces.push(...batchResults);
    }

    return [...enrichedPlaces, ...untouchedPlaces];
  }

  window.PetsAmap = {
    load,
    isReady,
    geocodeAddress,
    searchNearbyPlaces,
    enrichRouteDistances,
    get map() {
      return map;
    },
  };
})();
