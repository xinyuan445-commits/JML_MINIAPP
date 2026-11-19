# 金米龙生产现场看板（独立项目）

本项目只包含“生产现场看板”，不包含管理后台登录、菜单、账号、角色及其他报表页面。项目内置独立只读 API：

`GET /api/mo/dashboard/operations`

浏览器请求同源 `/api`，Node 服务转发到只监听 `127.0.0.1:8891` 的内置 Python API。Python API直接读取业务MySQL和U8 SQL Server，不依赖管理后台5001，也不开放新增、修改或删除接口。

## 默认地址

- 端口：`8890`
- 本机访问：`http://127.0.0.1:8890`
- 局域网访问：`http://部署电脑的实际IP:8890`

服务默认监听 `0.0.0.0`。部署电脑变化时不需要修改代码，启动日志会自动列出当前电脑可用的 IPv4 地址。

如果项目目录存在 `certs/board.jml.goldenchameleon.cn.pfx`，服务会自动改为HTTPS；正式域名访问地址为 `https://board.jml.goldenchameleon.cn:8890`。证书文件不进入版本管理。

已加入 `goldenchameleon.cn` 域的电脑会自动信任企业CA。未加入域的电脑需要先把 `certs/goldenchameleon-DC01-CA.cer` 安装到“受信任的根证书颁发机构”；该文件只有CA公钥，不包含私钥。

## 环境要求

- Node.js 20.19 或更高版本
- Python 3.12
- Microsoft ODBC Driver 17 for SQL Server
- 可访问业务MySQL和U8 SQL Server

## 安装与启动

```powershell
npm ci
python -m pip install -r api/requirements.txt
npm run build
npm start
```

开发模式需要分别启动 API 和前端：

```powershell
npm run dev:api
npm run dev
```

开发模式和正式服务都使用端口 `8890`，并监听所有网卡。正式运行前必须先执行 `npm run build`。

## 部署配置

复制 `.env.example` 为 `.env`，或者在启动进程中设置同名环境变量：

```text
PORT=8890
HOST=0.0.0.0
HTTPS_PFX_PATH=certs/board.jml.goldenchameleon.cn.pfx
# HTTPS_PFX_PASSPHRASE=仅在PFX设置密码时填写
DASHBOARD_API_MODE=embedded
DASHBOARD_API_PORT=8891
DB2_HOST=业务MySQL地址
DB2_USER=只读账号
DB2_PASSWORD=密码
DB2_NAME=数据库名
U8_DB_SERVER=U8数据库地址
U8_DB_NAME=UFDATA_008_2021
U8_DB_USER=只读账号
U8_DB_PASSWORD=密码
```

- `PORT`：独立看板端口，默认 `8890`。
- `HOST`：保持 `0.0.0.0`，即可同时使用 `127.0.0.1` 和部署电脑局域网 IP。
- `HTTPS_PFX_PATH`：可选，PFX证书路径；相对路径按项目目录解析。证书存在时8890使用HTTPS。
- `HTTPS_PFX_PASSPHRASE`：可选，仅在PFX设置了密码时填写。
- `DASHBOARD_API_MODE`：默认 `embedded`，由看板进程自动启动内置API。
- `DASHBOARD_API_PORT`：内置API回环端口，默认 `8891`，无需开放防火墙。
- `DB2_*`、`U8_DB_*`：仅写入部署机 `.env`，应使用只读数据库账号。

兼容回退模式：设置 `DASHBOARD_API_MODE=external` 和 `DASHBOARD_API_TARGET` 后，可临时继续使用外部WebAPI；正常部署不使用该模式。

`.env` 不进入版本管理。修改环境变量后需要重启独立看板服务。

## 验证

```powershell
Invoke-RestMethod https://board.jml.goldenchameleon.cn:8890/healthz
Invoke-RestMethod https://board.jml.goldenchameleon.cn:8890/api/mo/dashboard/operations
```

第一条会返回 `api_mode: embedded`，第二条验证内置API、MySQL和U8的完整链路。

局域网访问前确认部署电脑防火墙允许 TCP `8890`。如果端口被占用，可通过 `PORT` 改为其他空闲端口。

## 维护说明

本项目从管理后台生产现场看板独立出来，当前保留：

- 在制、计划完工、逾期、返工统计
- 工单与工序进度矩阵
- 工序详情、A/A1/A2/C数量和可接收计算公式
- 计划开工、计划完工及原计划日期
- 深浅主题、显示已关闭、自动刷新和Excel导出
- 展示方式可选择“翻页”或“自动循环滚动”，首次打开默认翻页，选择结果保存在当前浏览器

独立版不包含管理后台的“返回登录/操作页”按钮。后续调整看板业务规则时，需要同步维护 `jml_admin` 和本项目，避免两个版本规则不一致。

修改后执行：

```powershell
python -m unittest discover -s api/tests -v
npm run build
```

`api/dashboard_operations.py` 当前与管理后台同名计算模块保持一致；修改数量、状态、领料或产能规则时必须同步核对两份文件，并用真实接口做结果对比。
