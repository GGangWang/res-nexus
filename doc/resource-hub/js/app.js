/* ============================================================
   资源纳管系统 · 应用逻辑（Vue 3 Composition API + Element Plus）
   ============================================================ */
const { createApp, ref, reactive, computed, watch, nextTick, onMounted } = Vue;
const { ElMessage, ElMessageBox } = ElementPlus;

const app = createApp({
  setup() {
    /* ------------------------- 基础状态 ------------------------- */
    const view = ref('define');
    const globalQuery = ref('');
    const types = reactive(JSON.parse(JSON.stringify(window.RH_DATA.types)));
    const instances = reactive(JSON.parse(JSON.stringify(window.RH_DATA.instances)));

    const menus = computed(() => [
      { key: 'define', label: '资源定义', group: '资源定义', code: 'DEFINE', icon: 'layers', count: types.length },
      { key: 'instance', label: '资源实例化', group: '资源实例', code: 'INSTANCE', icon: 'grid', count: instances.length },
      { key: 'topo', label: '资源拓扑结构总览', group: '拓扑总览', code: 'TOPOLOGY', icon: 'share', count: countAllNodes() }
    ]);
    const currentMenu = computed(() => menus.value.find(m => m.key === view.value) || menus.value[0]);

    function toast(msg) {
      ElMessage({ message: msg, duration: 1700, offset: 62 });
    }
    function nowStr() {
      const d = new Date();
      const p = n => String(n).padStart(2, '0');
      return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    /* ------------------------- 公共字典 ------------------------- */
    const categories = [
      { key: 'all', label: '全部' },
      { key: 'space', label: '空间' },
      { key: 'hardware', label: '硬件' },
      { key: 'system', label: '系统' },
      { key: 'device', label: '装置' }
    ];
    const attrTypes = [
      { key: 'string', label: '文本' },
      { key: 'number', label: '数值' },
      { key: 'enum', label: '枚举' },
      { key: 'bool', label: '布尔' },
      { key: 'ip', label: 'IP 地址' },
      { key: 'date', label: '日期' },
      { key: 'text', label: '长文本' }
    ];
    const TYPE_LABEL = { string: '文本', number: '数值', enum: '枚举', bool: '布尔', ip: 'IP', date: '日期', text: '长文本' };
    const typeLabel = k => TYPE_LABEL[k] || k;
    const catLabel = k => (categories.find(c => c.key === k) || {}).label || k;
    const statusText = s => ({ online: '在线', warning: '告警', offline: '离线', idle: '待激活' }[s] || s);
    const statusDot = s => ({ online: 'ok', warning: 'warn', offline: 'err', idle: 'idle' }[s] || 'idle');
    const typeObj = id => types.find(t => t.id === id) || {};
    const typeName = id => typeObj(id).name || '未分类';
    const toneOf = id => typeObj(id).tone || '#7D8286';
    const loadTone = v => (v >= 85 ? 'err' : v >= 70 ? 'warn' : 'ok');
    const healthOf = it => {
      let h = 100;
      if (it.load > 85) h -= 4;
      if (it.status === 'warning') h -= 7;
      if (it.status === 'offline') h -= 62;
      if (it.status === 'idle') h -= 12;
      return h.toFixed(1);
    };
    const extraFields = it => [{ k: '所属资源池', v: `${it.project} · ${typeName(it.type)}池` }];

    /* ------------------------- 视图切换 ------------------------- */
    function clearSelection() {
      selectedTypeId.value = null;
      selectedInstId.value = null;
      selectedNodeId.value = null;
    }
    function switchView(k) {
      if (view.value === k) return;
      view.value = k;
      clearSelection();
      if (k === 'topo') {
        nextTick(() => { computeLayout(); nextTick(() => fitView(true)); });
      }
    }

    /* ------------------------- 资源定义 ------------------------- */
    const defineQuery = ref('');
    const defineCat = ref('all');
    const selectedTypeId = ref(null);

    const filteredTypes = computed(() => {
      const q = defineQuery.value.trim().toLowerCase();
      return types.filter(t => {
        const okCat = defineCat.value === 'all' || t.category === defineCat.value;
        if (!okCat) return false;
        if (!q) return true;
        return (t.name + t.code + t.desc + t.attrs.map(a => a.name).join('')).toLowerCase().includes(q);
      });
    });
    const catCount = k => (k === 'all' ? types.length : types.filter(t => t.category === k).length);

    const selectedType = computed(() => types.find(t => t.id === selectedTypeId.value) || null);
    function selectType(id) {
      selectedTypeId.value = selectedTypeId.value === id ? null : id;
      selectedInstId.value = null;
      selectedNodeId.value = null;
    }

    function onTypeCommand(cmd, t) {
      if (cmd === 'view') selectType(t.id);
      if (cmd === 'edit') { selectType(t.id); openTypeEdit(t); }
      if (cmd === 'copy') duplicateType(t);
      if (cmd === 'delete') deleteType(t);
    }

    /* ----- 类型弹窗 ----- */
    const typeDialogOpen = ref(false);
    const typeForm = reactive({ id: '', name: '', code: '', category: 'space', desc: '', owner: '张 伟', version: '1.0', attrs: [] });

    const iconFor = c => ({ space: 'space', hardware: 'board', system: 'product', device: 'device' }[c] || 'board');
    const toneFor = c => ({ space: '#2b7bff', hardware: '#12b76a', system: '#f79009', device: '#0891b2' }[c] || '#7a5af8');

    function openTypeCreate() {
      Object.assign(typeForm, {
        id: '', name: '', code: '', category: 'space', desc: '', owner: '张 伟', version: '1.0',
        attrs: [{ name: '名称', key: 'name', type: 'string', required: true, unit: '' }]
      });
      typeDialogOpen.value = true;
    }
    function openTypeEdit(t) {
      Object.assign(typeForm, JSON.parse(JSON.stringify({
        id: t.id, name: t.name, code: t.code, category: t.category, desc: t.desc,
        owner: t.owner, version: t.version, attrs: t.attrs
      })));
      typeDialogOpen.value = true;
    }
    function addFormAttr() {
      typeForm.attrs.push({ name: '', key: '', type: 'string', required: false, unit: '' });
    }
    function saveType() {
      const name = typeForm.name.trim();
      const code = typeForm.code.trim().toUpperCase();
      if (!name || !code) { ElMessage.warning('类型名称与编码为必填项'); return; }
      const attrs = typeForm.attrs.filter(a => a.name.trim()).map((a, i) => ({
        name: a.name.trim(),
        key: (a.key || 'field_' + (i + 1)).trim(),
        type: a.type,
        required: !!a.required,
        unit: a.unit || '',
        ...(a.options ? { options: a.options } : {})
      }));
      if (typeForm.id) {
        const t = types.find(x => x.id === typeForm.id);
        Object.assign(t, { name, code, category: typeForm.category, desc: typeForm.desc, owner: typeForm.owner, attrs, updated: nowStr() });
        toast(`「${name}」定义已更新`);
      } else {
        const id = code.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        types.push({
          id, name, code, version: '1.0', category: typeForm.category,
          icon: iconFor(typeForm.category), tone: toneFor(typeForm.category),
          desc: typeForm.desc || '未填写类型说明。', instances: 0, pools: 0,
          updated: nowStr(), owner: typeForm.owner, attrs
        });
        selectedTypeId.value = id;
        toast(`资源类型「${name}」已创建`);
      }
      typeDialogOpen.value = false;
    }
    function duplicateType(t) {
      const id = t.id + '-copy-' + (types.length + 1);
      const copy = JSON.parse(JSON.stringify(t));
      Object.assign(copy, {
        id, name: t.name + ' 副本', code: t.code + '.COPY', version: '1.0',
        instances: 0, pools: 0, updated: nowStr(), attrs: copy.attrs
      });
      types.push(copy);
      selectType(id);
      toast('已复制为新类型');
    }
    function deleteType(t) {
      ElMessageBox.confirm(
        `删除「${t.name}」后将解除 ${t.instances} 个实例的模板关联，此操作不可恢复。`,
        '删除资源类型',
        { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
      ).then(() => {
        const i = types.findIndex(x => x.id === t.id);
        if (i > -1) types.splice(i, 1);
        clearSelection();
        toast(`已删除「${t.name}」`);
      }).catch(() => {});
    }

    /* ----- 属性弹窗 ----- */
    const attrDialogOpen = ref(false);
    const attrTargetId = ref(null);
    const attrForm = reactive({ index: -1, name: '', key: '', type: 'string', unit: '', options: '', required: false });

    function openAttrCreate() {
      if (!selectedType.value) return;
      attrTargetId.value = selectedType.value.id;
      Object.assign(attrForm, { index: -1, name: '', key: '', type: 'string', unit: '', options: '', required: false });
      attrDialogOpen.value = true;
    }
    function openAttrEdit(i) {
      const t = selectedType.value;
      if (!t) return;
      const a = t.attrs[i];
      attrTargetId.value = t.id;
      Object.assign(attrForm, {
        index: i, name: a.name, key: a.key, type: a.type,
        unit: a.unit || '', options: a.options || '', required: !!a.required
      });
      attrDialogOpen.value = true;
    }
    function saveAttr() {
      const name = attrForm.name.trim();
      const key = attrForm.key.trim();
      if (!name || !key) { ElMessage.warning('属性名称与标识为必填项'); return; }
      const t = types.find(x => x.id === attrTargetId.value);
      if (!t) return;
      const payload = {
        name, key, type: attrForm.type, required: !!attrForm.required,
        unit: attrForm.unit.trim(),
        ...(attrForm.type === 'enum' ? { options: attrForm.options.trim() || '选项一 / 选项二' } : {})
      };
      if (attrForm.index > -1) t.attrs.splice(attrForm.index, 1, payload);
      else t.attrs.push(payload);
      t.updated = nowStr();
      attrDialogOpen.value = false;
      toast(attrForm.index > -1 ? `属性「${name}」已更新` : `已添加属性「${name}」`);
    }
    function removeAttr(i) {
      const t = selectedType.value;
      if (!t) return;
      const a = t.attrs[i];
      t.attrs.splice(i, 1);
      t.updated = nowStr();
      toast(`已移除属性「${a.name}」`);
    }
    function toggleRequired(i, v) {
      const t = selectedType.value;
      if (!t) return;
      t.attrs[i].required = !!v;
      t.updated = nowStr();
    }

    /* ------------------------- 资源实例化 ------------------------- */
    const fType = ref('');
    const fRegion = ref('');
    const fProject = ref('');
    const fStatus = ref('');
    const fQuery = ref('');
    const selectedInstId = ref(null);

    const regionOptions = computed(() => [...new Set(instances.map(i => i.region))]);
    const projectOptions = computed(() => {
      const src = fRegion.value ? instances.filter(i => i.region === fRegion.value) : instances;
      return [...new Set(src.map(i => i.project))];
    });
    watch(fRegion, () => {
      if (fProject.value && !projectOptions.value.includes(fProject.value)) fProject.value = '';
    });

    const filteredInstances = computed(() => {
      const q = fQuery.value.trim().toLowerCase();
      return instances.filter(i => {
        if (fType.value && i.type !== fType.value) return false;
        if (fRegion.value && i.region !== fRegion.value) return false;
        if (fProject.value && i.project !== fProject.value) return false;
        if (fStatus.value && i.status !== fStatus.value) return false;
        if (!q) return true;
        return (i.name + i.code + i.project + i.spec.map(s => s.v).join('')).toLowerCase().includes(q);
      });
    });
    function resetFilters() {
      fType.value = ''; fRegion.value = ''; fProject.value = ''; fStatus.value = ''; fQuery.value = '';
    }

    // 全量实例规模（列表为第 1 页样例 12 条）
    const TOTAL = 121;
    const stats = computed(() => ({
      total: TOTAL, online: 81, warning: 20, offline: 12, idle: 8,
      pOnline: 67, pWarn: 17, pOff: 17
    }));

    const selectedInst = computed(() => instances.find(i => i.id === selectedInstId.value) || null);
    function selectInstance(id) {
      selectedInstId.value = selectedInstId.value === id ? null : id;
      selectedTypeId.value = null;
      selectedNodeId.value = null;
    }

    /* ----- 实例化弹窗 ----- */
    const instDialogOpen = ref(false);
    const instForm = reactive({ type: 'board', name: '', region: '华东区域', project: '张江计算中心', ip: '' });
    function openInstanceCreate() {
      Object.assign(instForm, { type: 'board', name: '', region: '华东区域', project: '张江计算中心', ip: '' });
      instDialogOpen.value = true;
    }
    function saveInstance() {
      if (!instForm.name.trim()) { ElMessage.warning('请填写实例名称'); return; }
      const t = types.find(x => x.id === instForm.type) || types[0];
      const spec = [];
      ['IP 地址', '端口', '电源'].forEach(k => {
        const a = t.attrs.find(x => x.name.includes(k.replace(' 地址', '')));
        if (a) spec.push({ k: a.name, v: a.name.includes('IP') ? (instForm.ip || '待分配') : '待填写' });
      });
      if (!spec.length) t.attrs.slice(1, 4).forEach(a => spec.push({ k: a.name, v: '待填写' }));
      const n = instances.length + 1;
      instances.unshift({
        id: 'n' + Date.now(), name: instForm.name.trim(), type: t.id,
        code: 'INS-' + t.code.split('.').pop().slice(0, 2) + '-' + String(1000 + n),
        region: instForm.region, project: instForm.project, status: 'idle', load: 0,
        spec, owner: '张 伟', deployed: new Date().toISOString().slice(0, 10),
        tags: ['新建实例'], events: [{ t: nowStr(), txt: '实例已创建，等待连通性校验', lv: 'info' }]
      });
      instDialogOpen.value = false;
      toast('实例已创建，状态为待激活');
    }

    /* ------------------------- 拓扑 ------------------------- */
    const topoRaw = reactive(JSON.parse(JSON.stringify(window.RH_DATA.topology)));
    const layout = ref({ w: 900, h: 600, nodes: [], links: [] });
    const zoom = ref(1);
    const topoQuery = ref('');
    const selectedNodeId = ref(null);
    const canvas = ref(null);
    const panning = ref(false);
    const topoMode = ref('all');
    const topoViews = [
      { key: 'all', label: '全部层级' },
      { key: 'project', label: '到项目层' },
      { key: 'region', label: '到区域层' }
    ];

    const LEVEL_CFG = {
      root: { x: 0, w: 216, h: 58 },
      region: { x: 258, w: 178, h: 54 },
      project: { x: 496, w: 190, h: 56 },
      pool: { x: 730, w: 156, h: 52 }
    };
    const V_GAP = 12;
    const LEVEL_KICKER = { root: 'SYSTEM', region: 'AREA / 区域', project: 'PROJECT', pool: 'POOL' };
    const levelKicker = l => LEVEL_KICKER[l] || l;

    function countAllNodes() {
      let n = 0;
      (function w(x) { n++; (x.children || []).forEach(w); })(window.RH_DATA.topology);
      return n;
    }
    function findNode(id) {
      let hit = null;
      (function w(x) {
        if (hit) return;
        if (x.id === id) { hit = x; return; }
        (x.children || []).forEach(w);
      })(topoRaw);
      return hit;
    }
    function walkAll(node, fn, parent = null) {
      fn(node, parent);
      (node.children || []).forEach(c => walkAll(c, fn, node));
    }
    function descCount(n) {
      let c = 0;
      (n.children || []).forEach(x => { c += 1 + descCount(x); });
      return c;
    }
    function poolStats(n) {
      let pools = 0, inst = 0;
      walkAll(n, x => {
        if (x.level === 'pool') { pools++; inst += x.count || 0; }
      });
      return { pools, inst };
    }

    function computeLayout() {
      const nodes = [], links = [];
      let cursor = 0;
      (function walk(n, parent) {
        const cfg = LEVEL_CFG[n.level];
        n._x = cfg.x; n._w = cfg.w; n._h = cfg.h;
        const kids = (!n.collapsed && n.children) ? n.children : [];
        if (!kids.length) {
          n._y = cursor;
          cursor += cfg.h + V_GAP;
        } else {
          kids.forEach(k => walk(k, n));
          const a = kids[0], b = kids[kids.length - 1];
          n._y = (a._y + (b._y + b._h)) / 2 - cfg.h / 2;
          kids.forEach(k => {
            const x1 = n._x + n._w, y1 = n._y + n._h / 2;
            const x2 = k._x, y2 = k._y + k._h / 2, mx = (x1 + x2) / 2;
            links.push({ id: n.id + '>' + k.id, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}` });
          });
        }
        const m = (n.meta || '').match(/(\d+)%/);
        nodes.push({
          id: n.id, name: n.name, level: n.level, code: n.code, meta: n.meta, color: n.color,
          x: n._x, y: n._y, w: n._w, h: n._h, pct: m ? +m[1] : 0,
          childCount: (n.children || []).length, desc: descCount(n),
          collapsed: !!n.collapsed, parentId: parent ? parent.id : null
        });
      })(topoRaw, null);

      layout.value = { w: 916, h: Math.max(cursor - V_GAP + 8, 220), nodes, links };
    }

    function selectNodeById(id, center) {
      selectedNodeId.value = selectedNodeId.value === id ? null : id;
      selectedTypeId.value = null;
      selectedInstId.value = null;
      if (center && selectedNodeId.value) scrollToNode(id);
    }
    function scrollToNode(id) {
      const el = canvas.value; if (!el) return;
      const n = layout.value.nodes.find(x => x.id === id); if (!n) return;
      const cx = (n.x + 40) * zoom.value, cy = (n.y + n.h / 2) * zoom.value;
      el.scrollTo({ left: Math.max(cx - el.clientWidth / 2, 0), top: Math.max(cy - el.clientHeight / 2, 0), behavior: 'smooth' });
    }
    function toggleNode(id) {
      const n = findNode(id);
      if (!n || !n.children || !n.children.length) return;
      n.collapsed = !n.collapsed;
      computeLayout();
    }
    function expandAll() {
      topoMode.value = 'all';
      walkAll(topoRaw, n => { n.collapsed = false; });
      computeLayout();
      nextTick(() => fitView(true));
      toast('已展开全部层级');
    }
    watch(topoMode, m => {
      walkAll(topoRaw, n => {
        if (m === 'all') n.collapsed = false;
        else if (m === 'project') n.collapsed = n.level === 'project';
        else if (m === 'region') n.collapsed = n.level === 'region';
      });
      computeLayout();
      nextTick(() => fitView(true));
    });

    const selectedNode = computed(() => (selectedNodeId.value ? findNode(selectedNodeId.value) : null));
    const nodeMap = computed(() => {
      const m = {};
      layout.value.nodes.forEach(n => { m[n.id] = n; });
      return m;
    });
    const activeLinkIds = computed(() => {
      const s = new Set();
      const n = nodeMap.value[selectedNodeId.value];
      if (!n) return s;
      if (n.parentId) s.add(n.parentId + '>' + n.id);
      layout.value.nodes.filter(c => c.parentId === n.id).forEach(c => s.add(n.id + '>' + c.id));
      return s;
    });
    const matchIds = computed(() => {
      const q = topoQuery.value.trim().toLowerCase();
      const s = new Set();
      if (!q) return s;
      layout.value.nodes.forEach(n => {
        if ((n.name + n.code).toLowerCase().includes(q)) s.add(n.id);
      });
      return s;
    });
    const nodeTotal = countAllNodes();

    const nodeDetail = computed(() => {
      const n = selectedNode.value;
      if (!n) return null;
      const kids = n.children || [];
      const base = {
        kicker: { root: 'SYSTEM ROOT', region: 'REGION', project: 'PROJECT', pool: 'RESOURCE POOL' }[n.level],
        title: n.name, code: n.code, desc: n.desc || '',
        stats: [], facts: [], metrics: [], rows: [], rowsTitle: ''
      };
      const rowOf = c => ({ id: c.id, name: c.name, code: c.code, meta: c.meta, color: c.color });

      if (n.level === 'root') {
        const ps = poolStats(n);
        base.desc = n.desc;
        base.stats = [
          { k: 'REGIONS 区域', v: kids.length },
          { k: 'PROJECTS 项目', v: countLevel(n, 'project') },
          { k: 'POOLS 资源池', v: ps.pools },
          { k: 'INSTANCES 实例', v: ps.inst }
        ];
        base.facts = [
          { k: '系统编码', v: 'SYS-ROOT' },
          { k: '纳管模式', v: '分布式注册 · 两级同步' },
          { k: '同步周期', v: '60 秒 / 增量' },
          { k: '最近同步', v: '10-18 10:24' },
          { k: '纳管服务', v: '12/12 节点在线' }
        ];
        base.metrics = [{ k: '整体资源占用', v: 64 }, { k: '链路健康度', v: 98, tone: 'ok' }];
        base.rowsTitle = '下级区域 / REGIONS';
        base.rows = kids.map(rowOf);
      } else if (n.level === 'region') {
        const ps = poolStats(n);
        const avg = Math.round(kids.reduce((s, k) => s + (+((k.meta.match(/(\d+)%/) || [0, 0])[1])), 0) / Math.max(kids.length, 1));
        base.stats = [
          { k: 'PROJECTS 项目', v: kids.length },
          { k: 'POOLS 资源池', v: ps.pools },
          { k: 'INSTANCES 实例', v: ps.inst },
          { k: 'UTIL 平均占用', v: avg, u: '%' }
        ];
        base.facts = [
          { k: '区域编码', v: n.code },
          { k: '区域负责人', v: n.owner || '—' },
          { k: '联系方式', v: n.phone || '—' },
          { k: '覆盖位置', v: n.addr || '—' },
          { k: '下级项目', v: kids.map(k => k.name).join('、') }
        ];
        base.metrics = kids.map(k => ({ k: k.name, v: +((k.meta.match(/(\d+)%/) || [0, 0])[1]) }));
        base.rowsTitle = '下级项目 / PROJECTS';
        base.rows = kids.map(rowOf);
      } else if (n.level === 'project') {
        const ps = poolStats(n);
        const rate = +((n.meta.match(/(\d+)%/) || [0, 0])[1]);
        base.stats = [
          { k: 'POOLS 资源池', v: ps.pools },
          { k: 'INSTANCES 实例', v: ps.inst },
          { k: 'UTIL 占用', v: rate, u: '%' },
          { k: 'ONLINE 在线率', v: 97, u: '%' }
        ];
        base.facts = [
          { k: '项目编码', v: n.code },
          { k: '项目负责人', v: n.owner || '—' },
          { k: '建设阶段', v: n.phase || '—' },
          { k: '启动时间', v: n.started || '—' },
          { k: '所属区域', v: (nodeMap.value[n.id] && parentName(n.id)) || '—' }
        ];
        base.metrics = kids.map(k => ({ k: k.name, v: k.used || 0 }));
        base.rowsTitle = '资源池 / RESOURCE POOLS';
        base.rows = kids.map(rowOf);
      } else {
        const t = types.find(x => x.name === n.kind);
        const list = t ? instances.filter(i => i.type === t.id).slice(0, 5) : [];
        base.desc = `按「${n.kind}」类型组织的资源集合，实例挂载后自动继承类型属性模板。`;
        base.stats = [
          { k: 'INSTANCES 实例', v: n.count || 0 },
          { k: 'UTIL 占用', v: n.used || 0, u: '%' },
          { k: 'ONLINE 在线', v: Math.max((n.count || 0) - 1, 0) },
          { k: 'ALERTS 告警', v: n.used > 80 ? 2 : 0 }
        ];
        base.facts = [
          { k: '池编码', v: n.code },
          { k: '资源种类', v: n.kind },
          { k: '所属项目', v: parentName(n.id) },
          { k: '纳管策略', v: '自动注册 · 手工审批' },
          { k: '最近变更', v: '10-16 15:02' }
        ];
        base.metrics = [{ k: '容量占用', v: n.used || 0 }, { k: '实例在线率', v: 96, tone: 'ok' }];
        base.rowsTitle = '池内实例 / INSTANCES';
        base.rows = list.map(i => ({ id: i.id, name: i.name, code: i.code, meta: statusText(i.status), color: toneOf(i.type), instId: i.id }));
      }
      return base;
    });

    function countLevel(node, level) {
      let c = 0;
      walkAll(node, x => { if (x.level === level) c++; });
      return c;
    }
    function parentName(id) {
      let name = '—';
      walkAll(topoRaw, (x, p) => { if (x.id === id && p) name = p.name; });
      return name;
    }
    // 拓扑详情中点击列表行：池内实例 → 实例详情；其余 → 选中下级节点
    function onRowClick(r) {
      if (r.instId) {
        view.value = 'instance';
        selectedNodeId.value = null;
        selectedTypeId.value = null;
        selectedInstId.value = r.instId;
        return;
      }
      selectNodeById(r.id, true);
    }

    /* ----- 缩放 / 平移 ----- */
    let autoFit = true;
    function fitView(all) {
      const el = canvas.value;
      if (!el) return;
      const cw = el.clientWidth - 64;
      const ch = el.clientHeight - 70;
      if (cw < 120 || ch < 80) return;
      const byW = cw / layout.value.w;
      const byH = ch / layout.value.h;
      const z = all ? Math.min(byW, byH) : byW;
      zoom.value = Math.max(0.42, Math.min(1.12, +z.toFixed(3)));
    }
    function zoomBy(d) {
      autoFit = false;
      zoom.value = Math.max(0.42, Math.min(1.5, +(zoom.value + d).toFixed(2)));
    }
    function onWheel(e) {
      zoomBy(e.deltaY > 0 ? -0.06 : 0.06);
    }

    let panState = null;
    function startPan(e) {
      if (e.button !== 0) return;
      const el = canvas.value;
      panState = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
      panning.value = true;
      window.addEventListener('mousemove', onPanMove);
      window.addEventListener('mouseup', endPan);
    }
    function onPanMove(e) {
      if (!panState) return;
      const el = canvas.value;
      el.scrollLeft = panState.l - (e.clientX - panState.x);
      el.scrollTop = panState.t - (e.clientY - panState.y);
    }
    function endPan() {
      panState = null;
      panning.value = false;
      window.removeEventListener('mousemove', onPanMove);
      window.removeEventListener('mouseup', endPan);
    }

    /* ------------------------- 右侧详情类型 ------------------------- */
    const inspectorKind = computed(() => {
      if (selectedType.value) return 'type';
      if (selectedInst.value) return 'instance';
      if (selectedNode.value) return 'node';
      return null;
    });

    /* ------------------------- 生命周期 ------------------------- */
    onMounted(() => {
      computeLayout();
      nextTick(() => fitView(true));
      window.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          if (typeDialogOpen.value) typeDialogOpen.value = false;
          else if (attrDialogOpen.value) attrDialogOpen.value = false;
          else if (instDialogOpen.value) instDialogOpen.value = false;
          else clearSelection();
        }
      });
      let rt = null;
      window.addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => { if (autoFit) fitView(true); }, 180);
      });
    });

    function runGlobalSearch() {
      const q = globalQuery.value.trim().toLowerCase();
      if (!q) return;
      const hitType = types.find(t => (t.name + t.code).toLowerCase().includes(q));
      const hitInst = instances.find(i => (i.name + i.code).toLowerCase().includes(q));
      if (hitInst) { view.value = 'instance'; selectInstance(hitInst.id); toast(`定位到实例「${hitInst.name}」`); }
      else if (hitType) { view.value = 'define'; selectType(hitType.id); toast(`定位到类型「${hitType.name}」`); }
      else toast('未找到匹配的资源');
    }

    return {
      view, menus, currentMenu, switchView, toast,
      types, instances, categories, catCount, typeLabel, catLabel, typeName, toneOf,
      defineQuery, defineCat, filteredTypes, selectedTypeId, selectType, onTypeCommand,
      statusText, statusDot, loadTone, healthOf, extraFields,
      typeDialogOpen, typeForm, attrTypes, openTypeCreate, openTypeEdit, addFormAttr, saveType,
      duplicateType, deleteType,
      attrDialogOpen, attrForm, openAttrCreate, openAttrEdit, saveAttr, removeAttr, toggleRequired,
      TOTAL, fType, fRegion, fProject, fStatus, fQuery, regionOptions, projectOptions, filteredInstances,
      resetFilters, stats, selectedInstId, selectInstance,
      instDialogOpen, instForm, openInstanceCreate, saveInstance,
      topoMode, topoViews, topoQuery, layout, zoom, canvas, panning, startPan, onWheel, zoomBy, fitView,
      selectedNodeId, selectNodeById, onRowClick, toggleNode, expandAll, activeLinkIds, matchIds, levelKicker, nodeTotal,
      inspectorKind, selectedType, selectedInst, nodeDetail, clearSelection,
      globalQuery, runGlobalSearch
    };
  }
});

app.use(ElementPlus);
app.component('rh-icon', window.RhIcon);
app.mount('#app');
