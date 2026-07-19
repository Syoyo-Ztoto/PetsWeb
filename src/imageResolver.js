(function () {
  const DEFAULT_SCREENSHOT_BASE =
    "https://image.thum.io/get/width/900/crop/480/noanimate/https://www.bing.com/images/search?q=";

  const config = window.PETS_IMAGE_CONFIG || {
    screenshotSearchBaseUrl: DEFAULT_SCREENSHOT_BASE,
  };

  function getSearchScreenshotUrl(place) {
    const query = place.imageSearchQuery || `${place.name} ${place.address} 实景 图片`;
    if (!config.screenshotSearchBaseUrl) return "";
    return `${config.screenshotSearchBaseUrl}${encodeURIComponent(query)}`;
  }

  function getSearchPageUrl(place) {
    const query = place.imageSearchQuery || `${place.name} ${place.address} 实景 图片`;
    return `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;
  }

  window.ImageResolver = {
    getSearchScreenshotUrl,
    getSearchPageUrl,
  };
})();
