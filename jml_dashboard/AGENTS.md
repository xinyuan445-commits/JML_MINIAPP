# 独立生产现场看板维护约定

- 本项目只维护生产现场看板，不加入管理后台登录、菜单、角色或其他报表页面。
- 默认端口为 `8890`，默认监听 `0.0.0.0`；不得把部署电脑的局域网 IP 写死到源码。
- 浏览器只访问同源 `/api`；正式服务由 `server.mjs` 自动启动只监听回环地址的 `api/app.py`，不要把8891开放到局域网。
- 默认使用项目内置只读API直连业务MySQL和U8，不依赖管理后台5001；`external`只作临时回退。
- 数据库账号和密码只放被忽略的 `.env`，不得写入源码、文档、日志或前端产物；生产环境优先使用只读账号。
- 修改看板业务规则、状态、数量、颜色、详情或Excel导出时，同时核对 `jml_admin/src/pages/mo/dashboard`，明确两个项目是否需要同步，避免口径分叉。
- 修改后至少执行 `python -m unittest discover -s api/tests -v` 和 `npm run build`，并验证 `/healthz`、页面地址及 `/api/mo/dashboard/operations`。
- `.env`、`node_modules`、`dist` 和运行时临时文件不得提交。
