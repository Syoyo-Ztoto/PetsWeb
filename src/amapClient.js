(function () {
  const config = window.PETS_AMAP_CONFIG;
  let loadPromise = null;
  let map = null;

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
      document.querySelector("#map").replaceChildren();
      map = new AMap.Map("map", {
        center: [114.3048, 30.6101],
        zoom: 12,
        viewMode: "2D",
      });
      map.addControl(new AMap.Scale());
      map.addControl(new AMap.ToolBar({ position: "RT" }));
      return AMap;
    });

    return loadPromise;
  }

  function isReady() {
    return Boolean(window.AMap && map);
  }

  function geocodeAddress(address) {
    return new Promise((resolve, reject) => {
      const geocoder = new AMap.Geocoder({
        city: config.city,
        citylimit: true,
      });

      geocoder.getLocation(address, (status, result) => {
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
      const placeSearch = new AMap.PlaceSearch({
        city: config.city,
        citylimit: true,
        pageSize: 25,
        pageIndex: 1,
        extensions: "all",
      });

      placeSearch.searchNearBy(
        keyword,
        [origin.lng, origin.lat],
        Math.round(radiusKm * 1000),
        (status, result) => {
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

  async function searchNearbyPlaces({ origin, radiusKm, keywords }) {
    const uniqueKeywords = Array.from(new Set(keywords));
    const batches = await Promise.all(
      uniqueKeywords.map((keyword) => searchKeyword(origin, radiusKm, keyword))
    );
    return PlaceLogic.mergePlaces([], batches.flat());
  }

  window.PetsAmap = {
    load,
    isReady,
    geocodeAddress,
    searchNearbyPlaces,
    get map() {
      return map;
    },
  };
})();
