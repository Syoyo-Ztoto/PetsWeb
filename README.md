# 武汉宠物友好地图网页

这是一个静态网页版本，已经接入高德 JS API，用于验证“输入武汉地址 + 半径筛选 + 宠物友好地点推荐”的核心体验。

## 如何打开

双击 `index.html`，或访问已部署的 GitHub Pages 页面。

## 当前实现

- 城市固定为武汉。
- 支持输入任意武汉地址，由高德地理编码解析为经纬度。
- 支持 1 / 3 / 5 / 10 / 20 公里半径筛选。
- 支持按草坪/江滩、公园/绿道、商圈/餐饮筛选。
- 使用高德 JS API 展示真实地图。
- 使用高德 PlaceSearch 周边搜索返回真实 POI。
- 合并本地审核示例数据，优先展示更高可信度记录。
- 展示地点图片、距离、可信度、宠物友好状态、依据、电话和高德导航链接。

## 高德配置

配置文件在 `src/amapConfig.js`。

静态 GitHub Pages 无法隐藏前端 JS API Key 和安全密钥。请在高德控制台为 Key 配置域名白名单，至少包含：

- `https://syoyo-ztoto.github.io`
- `https://syoyo-ztoto.github.io/PetsWeb/`
- 本地调试时可临时加入 `http://localhost` 或直接打开文件对应的调试来源

不要把高德 Web 服务 Key 用在纯前端请求里。Web 服务 Key 应放在后端，由后端代理地理编码、POI 搜索、缓存和风控。

当前前端使用的是高德 JS API：

- `AMap.Map`：真实地图底图
- `AMap.Geocoder`：把用户输入的武汉地址解析为经纬度
- `AMap.PlaceSearch.searchNearBy`：按用户选择半径搜索附近 POI
- `AMap.Marker`：在地图上标记出发点和候选地点

如果部署页加载失败，优先检查浏览器控制台里的高德错误码，以及高德控制台里的服务平台、Key 限制和域名白名单。

## 后续真实数据增强

1. 新增后端服务，隐藏高德 Web 服务 Key。
2. 建立数据库表：地点、宠物友好状态、证据记录、用户反馈、运营审核任务。
3. 用后端定期缓存高德 POI，减少前端重复搜索。
4. 小红书/抖音内容不要直接抓取；优先走官方合作、人工录入摘要和用户授权反馈。

## 本地校验

使用 Codex 自带 Node.js 运行：

```powershell
& 'C:\Users\74731\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\placeLogic.test.js
```
