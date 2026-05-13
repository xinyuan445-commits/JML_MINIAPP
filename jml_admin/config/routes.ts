export default [
  {
    path: '/user',
    layout: false,
    routes: [
      { path: '/user/login', name: 'login', component: './user/login' },
      { path: '/user', redirect: '/user/login' },
      { component: './exception/404', path: '/user/*' },
    ],
  },
  {
    path: '/board',
    name: 'board',
    icon: 'barChart',
    routes: [
      { path: '/board', redirect: '/board/production' },
      { path: '/board/production', name: 'production', icon: 'fundProjectionScreen', component: './mo/dashboard' },
      { path: '/board/gantt',         name: 'gantt',         icon: 'schedule',             component: './mo/gantt' },
      { path: '/board/process-gantt', name: 'process-gantt', icon: 'partitionOutlined',    component: './mo/process-gantt' },
    ],
  },
  {
    path: '/mo',
    name: 'mo',
    icon: 'setting',
    routes: [
      { path: '/mo', redirect: '/mo/process' },
      { path: '/mo/process',    name: 'process',    icon: 'tool',     component: './mo/process' },
      { path: '/mo/workstation',name: 'workstation',icon: 'desktop',  component: './mo/workstation' },
      { path: '/mo/route',      name: 'route',      icon: 'branches', component: './mo/route' },
      { path: '/mo/workorder',  name: 'workorder',  icon: 'fileText', component: './mo/workorder' },
    ],
  },
  { path: '/', redirect: '/board/production' },
  { component: './exception/404', path: '/*' },
];
