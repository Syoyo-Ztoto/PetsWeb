(function () {
  const config = window.PETS_BACKEND_CONFIG || {};

  function getSearchEndpoint() {
    return String(config.searchEndpoint || "").trim();
  }

  function isReady() {
    return Boolean(getSearchEndpoint());
  }

  async function searchPlaces({ address, radiusKm, category }) {
    const endpoint = getSearchEndpoint();
    if (!endpoint) throw new Error("后端搜索接口未配置");

    const url = new URL(endpoint, window.location.href);
    url.searchParams.set("address", address || "武汉天地");
    url.searchParams.set("radius", String(radiusKm || 5));
    url.searchParams.set("category", category || "lawn");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "后端搜索失败");
    }
    return data;
  }

  window.PetsBackend = {
    isReady,
    searchPlaces,
  };
})();
