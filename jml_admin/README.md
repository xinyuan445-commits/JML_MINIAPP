<h1 align="center">Ant Design Pro</h1>

项目维护入口：[管理后台交接](docs/管理后台交接20261022.md)、[后台权限管理](docs/后台权限管理.md)、[工序管理数据表](docs/工序管理相关数据表.md)、[工站代理人](docs/工站代理人.md)、[设备管理方案与实施记录](docs/设备管理方案.md)。模板默认说明与金米龙业务实现不一致时，以当前源码和这些业务文档为准。

设备管理入口为“工序配置 → 设备管理”。使用独立设备档案，不关联原设备表；2026-10-22已按32个工站建立同名设备，类型待分类、产能未配置，后续页面维护走审批。维修流程保持原样。

## 本地统一启动

在 `jml_admin` 目录执行：

```bash
npm start
```

该命令会先启动项目内的 `webapi/app.py`（端口 `5001`），健康检查通过后
再启动前端（端口 `8886`）。停止 `npm start` 时，由该命令启动的 WebAPI 也会
一并停止；如果 `5001` 上已有健康的 WebAPI，则直接复用且不会在退出时关闭它。

同时启动 `webapi/cleanup_station_proxies.py --loop` 工站代理到期清理任务，退出时停止本次启动的任务。独立部署静态前端和WebAPI时，需单独托管清理任务。

默认使用 Windows 的 `python` 命令。需要指定解释器时可设置
`WEBAPI_PYTHON`；只启动前端可执行 `npm run start:frontend`。

## 金米龙生产管理认证模式

本项目同时支持统一平台 OIDC 登录和原 Flask Session 登录，不在前端保存或转发 JWT。

### 统一平台模式

- 入口：`https://production.jml.goldenchameleon.cn`
- 统一认证中心：`https://auth.jml.goldenchameleon.cn/realms/jml`
- 统一平台代理完成 Keycloak 登录，并向 Flask API 注入
  `X-JML-Platform-Authenticated`、用户名、角色和 `X-JML-Proxy-Secret`。
- Flask 仅在 TCP 来源地址属于 `TRUSTED_PROXY_IPS` 且代理密钥匹配时信任平台身份；
  未提供平台身份标记时仍使用 JWKS 验证 JWT 作为兼容路径。
- `production-view` 只能查看；`production-admin` 和 `suite-admin` 可以写入。
- `/api/currentUser` 返回 `authSource: "oidc"`，审计用户名取经校验的平台用户名；JWT路径优先取
  `preferred_username`。退出生产管理时只返回统一门户，不退出 Keycloak，避免影响其他平台应用。

部署时，统一平台反向代理必须将 `/api` 直接转发到 Flask `5001`，使 Flask
看到的实际连接源地址为 `172.16.10.105`；页面资源可继续转发到前端 `8886`。
如果 `/api` 再经过本机 Umi/Node 代理，Flask 只会看到 `127.0.0.1`，OIDC 将按
安全策略拒绝，不会相信 `X-Forwarded-For`。

### 原地址 Session 模式

- 入口：`http://172.16.10.45:8886/user/login?redirect=%2F`
- 保留原账号、密码、Flask Session、权限和退出流程。
- 非可信来源即使伪造 `X-Auth-Request-*`、`X-JML-*` 或 `X-Forwarded-*`，
  也不会被识别为统一平台用户。

### 后端配置

配置样例位于 `webapi/.env.example`。至少需要设置：

```dotenv
OIDC_ENABLED=1
OIDC_ISSUER_URL=https://auth.jml.goldenchameleon.cn/realms/jml
OIDC_JWKS_URL=https://auth.jml.goldenchameleon.cn/realms/jml/protocol/openid-connect/certs
OIDC_AUDIENCE=jml-platform
OIDC_TOKEN_HEADER=X-Auth-Request-Access-Token
OIDC_VIEW_ROLES=production-view,production-admin,suite-admin
OIDC_WRITE_ROLES=production-admin,suite-admin
TRUSTED_PROXY_IPS=172.16.10.105
JML_PROXY_SECRET=<由部署环境注入>
JML_PLATFORM_URL=https://production.jml.goldenchameleon.cn
```

`JML_PROXY_SECRET` 必须由统一平台和 Flask 运行环境安全注入，不能提交到源码。
代理必须覆盖客户端传入的认证头，不能透传调用方伪造的同名头。

健康检查：`GET /healthz`；包含 OIDC 配置和数据库检查的就绪检查：
`GET /readyz`。二者均不要求登录。

### 本地验证

```bash
cd webapi
python -m pip install -r requirements-dev.txt
python -m pytest -q

cd ..
npm test -- --runInBand
npm run tsc
npm run build
```

<div align="center">

An out-of-box UI solution for enterprise applications as a React boilerplate.

[![CI](https://github.com/ant-design/ant-design-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/ant-design/ant-design-pro/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/ant-design/ant-design-pro.svg)](https://github.com/ant-design/ant-design-pro/releases)
[![Build With Utoo](https://img.shields.io/badge/build%20with-utoo-028fe4.svg)](https://utoo.land)
[![Build With Umi](https://img.shields.io/badge/build%20with-umi-028fe4.svg)](https://umijs.org/)
[![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)
[![Ant Design](https://badgen.net/badge/icon/Ant%20Design?icon=https://gw.alipayobjects.com/zos/antfincdn/Pp4WPgVDB3/KDpgvguMpGfqaHPjicRK.svg&label)](https://ant.design/)

Language: 🇺🇸 | [🇨🇳](./README.zh-CN.md)

<img width="1718" height="1191" alt="light theme preview" src="https://github.com/user-attachments/assets/74ad0b4a-e086-4955-8edd-9f2cff31aee8" />
<img width="1718" height="1191" alt="dark theme preview" src="https://github.com/user-attachments/assets/d4bcb7c1-42c7-4c0f-b130-1193a931f9f7" />

</div>

- Preview: https://preview.pro.ant.design
- Documentation: [docs/cheatsheet.en-US.md](./docs/cheatsheet.en-US.md)
- ChangeLog: https://github.com/ant-design/ant-design-pro/releases
- FAQ: [docs/cheatsheet.en-US.md#faq](./docs/cheatsheet.en-US.md#faq)
- **v6 Released!** — [What's new in v6](https://github.com/ant-design/ant-design-pro/releases/tag/v6.0.0)

## Features

- :bulb: **TypeScript**: A language for application-scale JavaScript
- :scroll: **Blocks**: Build page with block template
- :gem: **Neat Design**: Built on [Ant Design 6](https://ant.design/) specification
- :triangular_ruler: **Common Templates**: Typical templates for enterprise applications
- :rocket: **State of The Art Development**: Newest development stack of React 19/[Umi Max 4](https://umijs.org/)/[antd 6](https://ant.design/)/[utoopack](https://utoo.land)
- :iphone: **Responsive**: Designed for variable screen sizes
- :art: **Theming**: Customizable theme with [Tailwind CSS v4](https://tailwindcss.com/) + [antd-style](https://github.com/ant-design/antd-style)
- :globe_with_meridians: **International**: Built-in i18n solution
- :gear: **Best Practices**: Solid workflow to make your code healthy
- :1234: **Mock development**: Easy to use mock development solution
- :robot: **AI Assistant**: Built-in AI chatbot page powered by [Ant Design X](https://x.ant.design/)
- :white_check_mark: **UI Test**: Fly safely with unit and e2e tests

## Templates

```
- Welcome
- Dashboard
  - Analysis
  - Monitor
  - Workplace
- Form
  - Basic Form
  - Step Form
  - Advanced Form
- List
  - Search List (Articles/Projects/Applications)
  - Table List
  - Basic List
  - Card List
- Profile
  - Basic Profile
  - Advanced Profile
- Result
  - Success
  - Fail
- Exception
  - 403
  - 404
  - 500
- Account
  - Account Center
  - Account Settings
- AI Assistant
- User
  - Login
  - Register
  - Register Result
```

## Usage

### Get Started

Clone or download this repository to your local machine:

```bash
git clone --depth=1 https://github.com/ant-design/ant-design-pro.git myapp
cd myapp
```

### Installation

```bash
npm install
```

### Development

```bash
# Start development server (full version by default)
npm start
```

### Simplify to Simple Version

This project includes all blocks by default. If you need a minimal version, run:

```bash
npm run simple
```

This will:
- Remove extra page directories (dashboard, form, list/*, profile, result, exception, account, etc.)
- Remove extra mock files
- Replace routes with simple version
- Remove extra dependencies from package.json

**Note**: This operation is irreversible and will permanently delete files.

### Build

```bash
npm run build
```

## Browsers support

Modern browsers.

| [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/edge/edge_48x48.png" alt="Edge" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Edge | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/firefox/firefox_48x48.png" alt="Firefox" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Firefox | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/chrome/chrome_48x48.png" alt="Chrome" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Chrome | [<img src="https://raw.githubusercontent.com/alrra/browser-logos/master/src/safari/safari_48x48.png" alt="Safari" width="24px" height="24px" />](http://godban.github.io/browsers-support-badges/)</br>Safari |
| --- | --- | --- | --- |
| Edge | last 2 versions | last 2 versions | last 2 versions |

## 管理后台权限

新增后台账号、角色权限和工站人员配置页。启用前须运行 `webapi/init_admin_permissions.py` 初始化权限表并迁移原账号；工站配置另运行 `webapi/init_station_permissions.py` 初始化，已有配置不会覆盖。升级工站豁免人员功能也需再次执行该脚本创建独立名单表，不预填人员。详细步骤及双登录规则见 [后台权限管理](docs/后台权限管理.md)。后台维护线长、扫码员工、工站豁免人员、限时代理和工站权限总开关；管理后台与小程序报工服务须连接同一套业务 MySQL 库。总开关开启时，报工服务每次请求按当前登录员工检查工站绑定、有效代理或豁免资格；关闭时恢复原报工操作流程，保留人员配置。代理按北京时间判断有效期，到期立即失效，不依赖清理任务。工站豁免不提升后台管理权限，也不绕过员工有效状态、数量和照片等业务校验。代理配置及部署细节见 [工站代理人](docs/工站代理人.md)。

## Contributing

Any type of contribution is welcome, here are some examples of how you may contribute to this project:

- Use Ant Design Pro in your daily work.
- Submit [issues](http://github.com/ant-design/ant-design-pro/issues) to report bugs or ask questions.
- Propose [pull requests](http://github.com/ant-design/ant-design-pro/pulls) to improve our code.

<a href="https://openomy.app/github/ant-design/ant-design-pro" target="_blank" style="display: block; width: 100%;" align="center">
  <img src="https://openomy.app/svg?repo=ant-design/ant-design-pro&chart=bubble&latestMonth=3" target="_blank" alt="Contribution Leaderboard" style="display: block; width: 100%;" />
</a>
