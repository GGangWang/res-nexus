/* ============================================================
   资源纳管系统 — 原型数据层
   ============================================================ */
window.RH_DATA = (function () {
  const types = [
    {
      id: 'space',
      name: '区域空间',
      code: 'RS.SPACE',
      version: '1.3',
      category: 'space',
      icon: 'space',
      tone: '#2b7bff',
      desc: '可部署资源的物理空间单元，记录楼层、面积与环境约束，是实例挂载的基准位置。',
      instances: 24,
      pools: 6,
      updated: '10-14 09:20',
      owner: '张 伟',
      attrs: [
        { name: '名称', key: 'name', type: 'string', required: true, unit: '' },
        { name: '位置', key: 'location', type: 'string', required: true, unit: '' },
        { name: '楼层', key: 'floor', type: 'number', required: false, unit: 'F' },
        { name: '面积', key: 'area', type: 'number', required: false, unit: 'm²' },
        { name: '承重等级', key: 'loadLevel', type: 'enum', required: false, unit: '', options: 'A / B / C' },
        { name: '温控方式', key: 'hvac', type: 'enum', required: false, unit: '', options: '精密空调 / 自然通风' }
      ]
    },
    {
      id: 'board',
      name: '处理器单板',
      code: 'RS.BOARD',
      version: '2.1',
      category: 'hardware',
      icon: 'board',
      tone: '#12b76a',
      desc: '单板级处理器资源，记录网络接入、供电规格与固件版本，可独立挂载到资源池。',
      instances: 46,
      pools: 4,
      updated: '10-16 15:02',
      owner: '李 娜',
      attrs: [
        { name: '名称', key: 'name', type: 'string', required: true, unit: '' },
        { name: 'IP 地址', key: 'ip', type: 'ip', required: true, unit: '' },
        { name: '端口', key: 'port', type: 'number', required: true, unit: '' },
        { name: '电源', key: 'power', type: 'string', required: false, unit: '' },
        { name: '板卡型号', key: 'model', type: 'string', required: false, unit: '' },
        { name: '固件版本', key: 'firmware', type: 'string', required: false, unit: '' },
        { name: '插槽位置', key: 'slot', type: 'string', required: false, unit: '' }
      ]
    },
    {
      id: 'cluster',
      name: '复合处理器集群',
      code: 'RS.CLUSTER',
      version: '1.8',
      category: 'hardware',
      icon: 'cluster',
      tone: '#7a5af8',
      desc: '由多块处理器单板按总线拓扑组织而成的集群单元，含处理器板组织关系定义。',
      instances: 18,
      pools: 3,
      updated: '10-15 11:47',
      owner: '陈 立',
      attrs: [
        { name: '名称', key: 'name', type: 'string', required: true, unit: '' },
        { name: 'IP 地址', key: 'ip', type: 'ip', required: true, unit: '' },
        { name: '端口', key: 'port', type: 'number', required: true, unit: '' },
        { name: '电源', key: 'power', type: 'string', required: false, unit: '' },
        { name: '总线类型', key: 'bus', type: 'enum', required: true, unit: '', options: 'RapidIO / PCIe / 自定义' },
        { name: '处理器组织', key: 'org', type: 'string', required: false, unit: '' },
        { name: '单板数量', key: 'boardCount', type: 'number', required: false, unit: '块' }
      ]
    },
    {
      id: 'product',
      name: '真实产品',
      code: 'RS.PRODUCT',
      version: '1.5',
      category: 'system',
      icon: 'product',
      tone: '#f79009',
      desc: '接入纳管的成品设备整机，例如雷达信号处理机、测控终端，按整机维度参与调度。',
      instances: 21,
      pools: 3,
      updated: '10-13 17:35',
      owner: '周 敏',
      attrs: [
        { name: '名称', key: 'name', type: 'string', required: true, unit: '' },
        { name: 'IP 地址', key: 'ip', type: 'ip', required: true, unit: '' },
        { name: '端口', key: 'port', type: 'number', required: true, unit: '' },
        { name: '电源', key: 'power', type: 'string', required: false, unit: '' },
        { name: '厂商', key: 'vendor', type: 'string', required: false, unit: '' },
        { name: '序列号', key: 'sn', type: 'string', required: false, unit: '' },
        { name: '部署日期', key: 'deployDate', type: 'date', required: false, unit: '' }
      ]
    },
    {
      id: 'device',
      name: '程控装置',
      code: 'RS.DEVICE',
      version: '1.2',
      category: 'device',
      icon: 'device',
      tone: '#0891b2',
      desc: '可程控的信号切换与采集装置，支持本地、远程、自动多种控制模式。',
      instances: 12,
      pools: 2,
      updated: '10-11 10:08',
      owner: '王 昊',
      attrs: [
        { name: '名称', key: 'name', type: 'string', required: true, unit: '' },
        { name: 'IP 地址', key: 'ip', type: 'ip', required: true, unit: '' },
        { name: '端口', key: 'port', type: 'number', required: true, unit: '' },
        { name: '控制模式', key: 'ctrlMode', type: 'enum', required: true, unit: '', options: '本地 / 远程 / 自动' },
        { name: '通信协议', key: 'protocol', type: 'enum', required: false, unit: '', options: 'TCP / 串口 / CAN' },
        { name: '通道数', key: 'channels', type: 'number', required: false, unit: '路' }
      ]
    }
  ];

  const instances = [
    {
      id: 'i01', name: '张江 A 区 · 3F 主机房', type: 'space', code: 'INS-SP-0117',
      region: '华东区域', project: '张江计算中心', status: 'online', load: 78,
      spec: [
        { k: '楼层', v: '3F' }, { k: '面积', v: '420 m²' }, { k: '承重等级', v: 'A 级' }
      ],
      owner: '张 伟', deployed: '2024-03-11', tags: ['核心机房', '双路供电'],
      events: [
        { t: '10-17 09:12', txt: '环境温控策略更新为「精密空调-A」', lv: 'info' },
        { t: '10-14 14:30', txt: '新增 6 块处理器单板挂载', lv: 'ok' },
        { t: '09-28 11:05', txt: '承重等级由 B 调整为 A', lv: 'warn' }
      ]
    },
    {
      id: 'i02', name: '处理器单板 BX-3200-07', type: 'board', code: 'INS-BD-0421',
      region: '华东区域', project: '张江计算中心', status: 'online', load: 64,
      spec: [
        { k: 'IP 地址', v: '10.24.7.31' }, { k: '端口', v: '8081' }, { k: '电源', v: '220V / 8A' }
      ],
      owner: '李 娜', deployed: '2024-06-02', tags: ['RapidIO', '槽位 07'],
      events: [
        { t: '10-16 15:02', txt: '固件由 v3.2.1 升级至 v3.3.0', lv: 'ok' },
        { t: '10-08 22:41', txt: '端口 8081 短时不可达，已恢复', lv: 'warn' }
      ]
    },
    {
      id: 'i03', name: '复合集群 CLS-SH-02', type: 'cluster', code: 'INS-CL-0033',
      region: '华东区域', project: '张江计算中心', status: 'warning', load: 82,
      spec: [
        { k: 'IP 地址', v: '10.24.9.12' }, { k: '端口', v: '9000' }, { k: '总线', v: 'RapidIO' }
      ],
      owner: '陈 立', deployed: '2024-01-19', tags: ['8 板', '主备交换'],
      events: [
        { t: '10-18 08:03', txt: '板 3 温度 78℃，超过阈值 75℃', lv: 'warn' },
        { t: '10-15 11:47', txt: '处理器组织关系更新为 4×2', lv: 'info' }
      ]
    },
    {
      id: 'i04', name: '真实产品 雷达信号处理机 RSP-9', type: 'product', code: 'INS-PR-0207',
      region: '华东区域', project: '张江计算中心', status: 'online', load: 71,
      spec: [
        { k: 'IP 地址', v: '10.24.11.5' }, { k: '端口', v: '6001' }, { k: '电源', v: '380V 三相' }
      ],
      owner: '周 敏', deployed: '2023-11-08', tags: ['整机', '厂商在保'],
      events: [
        { t: '10-12 16:20', txt: '整机自检通过，无异常项', lv: 'ok' }
      ]
    },
    {
      id: 'i05', name: '程控装置 信号切换器 SW-11', type: 'device', code: 'INS-DV-0014',
      region: '华东区域', project: '张江计算中心', status: 'idle', load: 33,
      spec: [
        { k: 'IP 地址', v: '10.24.13.21' }, { k: '端口', v: '502' }, { k: '控制模式', v: '远程' }
      ],
      owner: '王 昊', deployed: '2025-02-14', tags: ['16 通道', '待激活'],
      events: [
        { t: '10-11 10:08', txt: '实例创建，等待首次连通性校验', lv: 'info' }
      ]
    },
    {
      id: 'i06', name: '临港试验场 · B 区 1F', type: 'space', code: 'INS-SP-0121',
      region: '华东区域', project: '临港试验场', status: 'online', load: 41,
      spec: [
        { k: '楼层', v: '1F' }, { k: '面积', v: '260 m²' }, { k: '承重等级', v: 'B 级' }
      ],
      owner: '孙 倩', deployed: '2024-09-05', tags: ['试验场地'],
      events: [{ t: '10-09 09:40', txt: '场地分区由 2 区调整为 3 区', lv: 'info' }]
    },
    {
      id: 'i07', name: '处理器单板 BX-3200-12', type: 'board', code: 'INS-BD-0438',
      region: '华东区域', project: '临港试验场', status: 'warning', load: 91,
      spec: [
        { k: 'IP 地址', v: '10.24.7.36' }, { k: '端口', v: '8082' }, { k: '电源', v: '220V / 8A' }
      ],
      owner: '李 娜', deployed: '2024-07-22', tags: ['槽位 12'],
      events: [
        { t: '10-17 21:15', txt: '负载持续 30 分钟高于 90%', lv: 'warn' }
      ]
    },
    {
      id: 'i08', name: '复合集群 CLS-BJ-01', type: 'cluster', code: 'INS-CL-0041',
      region: '华北区域', project: '亦庄智算基地', status: 'online', load: 55,
      spec: [
        { k: 'IP 地址', v: '10.25.3.18' }, { k: '端口', v: '9000' }, { k: '总线', v: 'PCIe' }
      ],
      owner: '陈 立', deployed: '2024-04-30', tags: ['6 板', 'PCIe 交换'],
      events: [{ t: '10-14 10:22', txt: '新增 2 块单板并完成总线重排', lv: 'ok' }]
    },
    {
      id: 'i09', name: '真实产品 测控终端 TCU-3', type: 'product', code: 'INS-PR-0221',
      region: '华北区域', project: '天津验证中心', status: 'offline', load: 0,
      spec: [
        { k: 'IP 地址', v: '10.25.8.9' }, { k: '端口', v: '6100' }, { k: '电源', v: '220V / 6A' }
      ],
      owner: '周 敏', deployed: '2023-08-16', tags: ['整机', '离线'],
      events: [
        { t: '10-18 06:40', txt: '心跳中断超过 30 分钟，已判定离线', lv: 'err' },
        { t: '10-18 07:02', txt: '已通知现场值守人员', lv: 'info' }
      ]
    },
    {
      id: 'i10', name: '程控装置 采集控制器 AC-07', type: 'device', code: 'INS-DV-0021',
      region: '华北区域', project: '亦庄智算基地', status: 'online', load: 28,
      spec: [
        { k: 'IP 地址', v: '10.26.4.7' }, { k: '端口', v: '503' }, { k: '控制模式', v: '自动' }
      ],
      owner: '王 昊', deployed: '2025-01-06', tags: ['8 通道', 'CAN'],
      events: [{ t: '10-15 13:18', txt: '切换至自动控制模式', lv: 'info' }]
    },
    {
      id: 'i11', name: '亦庄智算基地 · C 栋 2F', type: 'space', code: 'INS-SP-0140',
      region: '华北区域', project: '亦庄智算基地', status: 'online', load: 67,
      spec: [
        { k: '楼层', v: '2F' }, { k: '面积', v: '680 m²' }, { k: '承重等级', v: 'A 级' }
      ],
      owner: '赵 岩', deployed: '2024-05-21', tags: ['核心机房', '液冷'],
      events: [{ t: '10-13 15:00', txt: '液冷回路压力校验完成', lv: 'ok' }]
    },
    {
      id: 'i12', name: '处理器单板 BX-4100-03', type: 'board', code: 'INS-BD-0462',
      region: '西南区域', project: '成都天府节点', status: 'online', load: 48,
      spec: [
        { k: 'IP 地址', v: '10.26.5.14' }, { k: '端口', v: '8080' }, { k: '电源', v: '220V / 10A' }
      ],
      owner: '刘 洋', deployed: '2025-03-02', tags: ['槽位 03'],
      events: [{ t: '10-10 09:30', txt: '实例化完成并加入单板池', lv: 'ok' }]
    }
  ];

  const topology = {
    id: 'root', name: '资源纳管系统', level: 'root', code: 'SYS-ROOT', meta: '3 区域 · 5 项目 · 12 资源池',
    color: '#14181f', desc: '统一纳管区域空间、处理器单板、复合集群与程控装置的资源中台。',
    children: [
      {
        id: 'r-east', name: '华东区域', level: 'region', code: 'RG-EAST', meta: '2 项目 · 5 资源池 · 58%',
        color: '#0a59f7', owner: '张 伟', phone: '021-5080 2211', addr: '上海市浦东新区张江高科技园区',
        children: [
          {
            id: 'p-zj', name: '张江计算中心', level: 'project', code: 'PJ-ZJ-01', meta: '3 池 · 17 实例 · 68%',
            color: '#12b76a', owner: '陈 立', phase: '在运', started: '2023-11',
            children: [
              { id: 'pl-zj-bd', name: '处理器单板池', level: 'pool', code: 'PL-ZJ-BD', meta: '10 实例 · 68%', color: '#12b76a', kind: '处理器单板', used: 68, count: 10 },
              { id: 'pl-zj-cl', name: '复合集群池', level: 'pool', code: 'PL-ZJ-CL', meta: '4 实例 · 82%', color: '#7a5af8', kind: '复合处理器集群', used: 82, count: 4 },
              { id: 'pl-zj-dv', name: '程控装置池', level: 'pool', code: 'PL-ZJ-DV', meta: '3 实例 · 41%', color: '#0891b2', kind: '程控装置', used: 41, count: 3 }
            ]
          },
          {
            id: 'p-lg', name: '临港试验场', level: 'project', code: 'PJ-LG-02', meta: '2 池 · 15 实例 · 47%',
            color: '#12b76a', owner: '孙 倩', phase: '建设期', started: '2024-09',
            children: [
              { id: 'pl-lg-pr', name: '真实产品池', level: 'pool', code: 'PL-LG-PR', meta: '9 实例 · 55%', color: '#f79009', kind: '真实产品', used: 55, count: 9 },
              { id: 'pl-lg-bd', name: '处理器单板池', level: 'pool', code: 'PL-LG-BD', meta: '6 实例 · 32%', color: '#12b76a', kind: '处理器单板', used: 32, count: 6 }
            ]
          }
        ]
      },
      {
        id: 'r-north', name: '华北区域', level: 'region', code: 'RG-NORTH', meta: '2 项目 · 5 资源池 · 48%',
        color: '#0a59f7', owner: '赵 岩', phone: '010-6788 4402', addr: '北京市大兴区亦庄经济技术开发区',
        children: [
          {
            id: 'p-yz', name: '亦庄智算基地', level: 'project', code: 'PJ-YZ-01', meta: '3 池 · 29 实例 · 61%',
            color: '#12b76a', owner: '赵 岩', phase: '在运', started: '2024-05',
            children: [
              { id: 'pl-yz-bd', name: '处理器单板池', level: 'pool', code: 'PL-YZ-BD', meta: '18 实例 · 63%', color: '#12b76a', kind: '处理器单板', used: 63, count: 18 },
              { id: 'pl-yz-cl', name: '复合集群池', level: 'pool', code: 'PL-YZ-CL', meta: '6 实例 · 77%', color: '#7a5af8', kind: '复合处理器集群', used: 77, count: 6 },
              { id: 'pl-yz-pr', name: '真实产品池', level: 'pool', code: 'PL-YZ-PR', meta: '5 实例 · 44%', color: '#f79009', kind: '真实产品', used: 44, count: 5 }
            ]
          },
          {
            id: 'p-tj', name: '天津验证中心', level: 'project', code: 'PJ-TJ-03', meta: '2 池 · 16 实例 · 35%',
            color: '#12b76a', owner: '周 敏', phase: '在运', started: '2023-08',
            children: [
              { id: 'pl-tj-dv', name: '程控装置池', level: 'pool', code: 'PL-TJ-DV', meta: '9 实例 · 35%', color: '#0891b2', kind: '程控装置', used: 35, count: 9 },
              { id: 'pl-tj-pr', name: '真实产品池', level: 'pool', code: 'PL-TJ-PR', meta: '7 实例 · 29%', color: '#f79009', kind: '真实产品', used: 29, count: 7 }
            ]
          }
        ]
      },
      {
        id: 'r-southwest', name: '西南区域', level: 'region', code: 'RG-SW', meta: '1 项目 · 2 资源池 · 52%',
        color: '#0a59f7', owner: '刘 洋', phone: '028-8551 3390', addr: '四川省成都市天府新区科学城',
        children: [
          {
            id: 'p-cd', name: '成都天府节点', level: 'project', code: 'PJ-CD-01', meta: '2 池 · 20 实例 · 52%',
            color: '#12b76a', owner: '刘 洋', phase: '在运', started: '2025-03',
            children: [
              { id: 'pl-cd-bd', name: '处理器单板池', level: 'pool', code: 'PL-CD-BD', meta: '12 实例 · 58%', color: '#12b76a', kind: '处理器单板', used: 58, count: 12 },
              { id: 'pl-cd-cl', name: '复合集群池', level: 'pool', code: 'PL-CD-CL', meta: '8 实例 · 46%', color: '#7a5af8', kind: '复合处理器集群', used: 46, count: 8 }
            ]
          }
        ]
      }
    ]
  };

  return { types, instances, topology };
})();
