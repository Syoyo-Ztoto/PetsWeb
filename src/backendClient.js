(function () {
  const config = window.PETS_BACKEND_CONFIG || {};

  function getSearchEndpoint() {
    return String(config.searchEndpoint || "").trim();
  }

  function getFeedbackEndpoint() {
    return String(config.feedbackEndpoint || "").trim();
  }

  function isReady() {
    return Boolean(getSearchEndpoint());
  }

  function canSubmitFeedback() {
    return Boolean(getFeedbackEndpoint());
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

  async function submitFeedback(payload) {
    const endpoint = getFeedbackEndpoint();
    if (!endpoint) throw new Error("反馈后端接口未配置");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "反馈提交失败");
    }
    return data;
  }

  window.PetsBackend = {
    canSubmitFeedback,
    isReady,
    searchPlaces,
    submitFeedback,
  };
})();
