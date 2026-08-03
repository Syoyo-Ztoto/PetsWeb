(function () {
  window.PETS_BACKEND_CONFIG = {
    // 部署后端后填入，例如：https://your-vercel-app.vercel.app/api/search
    // 留空时，页面会继续使用现有高德 JS API 前端搜索方案。
    searchEndpoint: "",
    // 部署反馈后端后填入，例如：https://your-vercel-app.vercel.app/api/feedback
    // 留空时，用户反馈会暂存在当前浏览器本机。
    feedbackEndpoint: "",
  };
})();
