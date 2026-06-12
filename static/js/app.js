// ── BIT Builder v2 — Vue app ─────────────────────────────────────────────────
import {
  GLOBAL_GROUPS, BOX_GROUPS, HEXBOX_GROUPS, SPACER_GROUPS, DIV_GROUPS,
  LID_GROUPS, CMP_GROUPS, LBL_FIELDS, BOX_TYPES, FBLR,
  newProject, newBox, newComponent, newLabel, uid,
} from './schema.js';
import { generateScad, validateProject } from './scadgen.js';
import { Preview3D } from './preview3d.js';

const { createApp } = Vue;
// NB: must be a regular function and use fn.apply — Vue method `this` is bound at call time
const debounce = (fn, ms) => {
  let t;
  return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
};

// ── <fld> — renders one schema field ─────────────────────────────────────────
const Fld = {
  name: 'fld',
  props: ['f', 'obj'],
  computed: {
    vis() { return this.f.vis ? this.f.vis(this.obj) : true; },
    subs() { return this.f.subs || FBLR; },
  },
  methods: {
    setNum(e) { this.obj[this.f.m] = e.target.value === '' ? null : +e.target.value; },
    setVec(i, e) { this.obj[this.f.m][i] = e.target.value === '' ? 0 : +e.target.value; },
    mode(i) { const v = this.obj[this.f.m][i]; return v === 'CENTER' || v === 'MAX' ? v : 'NUM'; },
    setMode(i, m) { this.obj[this.f.m][i] = m === 'NUM' ? 0 : m; },
    ph(i) { return this.f.t === 'num4' ? 'FBLR'[i] : 'XYZW'[i]; },
  },
  template: `
  <div class="fld" v-show="vis">
    <label class="fld-l" :title="f.tip || ''">{{ f.lbl }}<span v-if="f.tip" class="tipdot">?</span></label>
    <div class="fld-c">
      <input v-if="f.t==='num'" type="number" :step="f.int ? 1 : 'any'" :value="obj[f.m]" @input="setNum($event)" placeholder="default">
      <input v-else-if="f.t==='bool'" type="checkbox" v-model="obj[f.m]">
      <input v-else-if="f.t==='str'" type="text" v-model="obj[f.m]" placeholder="default">
      <select v-else-if="f.t==='enum'" v-model="obj[f.m]"><option v-for="o in f.opts" :key="o" :value="o">{{ o }}</option></select>
      <input v-else-if="f.t==='size'" type="text" v-model="obj[f.m]" placeholder="AUTO">
      <textarea v-else-if="f.t==='ltext'" rows="2" v-model="obj[f.m]"></textarea>
      <div v-else-if="f.t==='vec2'||f.t==='vec3'||f.t==='num4'" class="vec">
        <input v-for="(c, i) in obj[f.m]" :key="i" type="number" step="any" :placeholder="ph(i)"
               :value="obj[f.m][i]" @input="setVec(i, $event)">
      </div>
      <div v-else-if="f.t==='bool4'" class="b4">
        <label v-for="(s, i) in subs" :key="i"><input type="checkbox" v-model="obj[f.m][i]"> {{ s }}</label>
      </div>
      <div v-else-if="f.t==='posxy'" class="vec">
        <template v-for="i in [0, 1]" :key="i">
          <select :value="mode(i)" @change="setMode(i, $event.target.value)">
            <option value="CENTER">CENTER</option><option value="MAX">MAX</option><option value="NUM">mm…</option>
          </select>
          <input v-if="mode(i)==='NUM'" type="number" step="any" :value="obj[f.m][i]" @input="setVec(i, $event)">
        </template>
      </div>
    </div>
  </div>`,
};

// ── <sform> — renders schema groups with progressive disclosure ──────────────
const Sform = {
  name: 'sform',
  components: { fld: Fld },
  props: ['groups', 'obj'],
  methods: {
    gvis(g) { return g.vis ? g.vis(this.obj) : true; },
    basics(g) { return g.fields.filter(f => !f.adv); },
    advs(g) { return g.fields.filter(f => f.adv); },
  },
  template: `
  <template v-for="grp in groups" :key="grp.title">
    <section class="fsec" v-if="gvis(grp)">
      <details v-if="grp.adv"><summary class="sec-t">{{ grp.title }}</summary>
        <fld v-for="f in grp.fields" :key="f.m" :f="f" :obj="obj"/>
      </details>
      <template v-else>
        <h3 class="sec-t">{{ grp.title }}</h3>
        <fld v-for="f in basics(grp)" :key="f.m" :f="f" :obj="obj"/>
        <details v-if="advs(grp).length" class="adv"><summary>Advanced</summary>
          <fld v-for="f in advs(grp)" :key="f.m" :f="f" :obj="obj"/>
        </details>
      </template>
    </section>
  </template>`,
};

// ── <label-list> — label editor for boxes, lids and components ───────────────
const LabelList = {
  name: 'label-list',
  components: { sform: Sform },
  props: ['owner', 'hint'],
  data: () => ({ lblGroups: [{ title: '', fields: LBL_FIELDS }] }),
  methods: { add() { this.owner.labels.push(newLabel()); } },
  template: `
  <section class="fsec">
    <h3 class="sec-t">Labels</h3>
    <p v-if="hint" class="hint">{{ hint }}</p>
    <div v-for="(lbl, i) in owner.labels" :key="i" class="lblcard">
      <div class="lblhead">
        <span>Label {{ i + 1 }}</span>
        <span class="seg">
          <button :class="{ on: lbl.mode !== 'image' }" @click="lbl.mode = 'text'">Text</button>
          <button :class="{ on: lbl.mode === 'image' }" @click="lbl.mode = 'image'">SVG</button>
        </span>
        <button class="x" @click="owner.labels.splice(i, 1)">✕</button>
      </div>
      <sform :groups="lblGroups" :obj="lbl"/>
    </div>
    <button class="addbtn" @click="add">+ Add label</button>
  </section>`,
};

// ── Main app ──────────────────────────────────────────────────────────────────
createApp({
  components: { sform: Sform, fld: Fld, 'label-list': LabelList },
  data() {
    return {
      project: newProject(),
      sel: { boxId: null, cmpId: null, pane: 'box' },
      expanded: {},
      showScad: false,
      rendering: false, exporting: false,
      openscad: null, openscadPath: '',
      scadError: null, toast: null, _toastT: null,
      exactMode: false,
      BOX_TYPES,
      groups: {
        global: GLOBAL_GROUPS, BOX: BOX_GROUPS, HEXBOX: HEXBOX_GROUPS,
        SPACER: SPACER_GROUPS, DIVIDERS: DIV_GROUPS, lid: LID_GROUPS, cmp: CMP_GROUPS,
      },
    };
  },
  computed: {
    selBox() { return this.project.boxes.find(b => b.id === this.sel.boxId) || null; },
    selCmp() { return this.selBox?.components.find(c => c.id === this.sel.cmpId) || null; },
    scad() { return generateScad(this.project); },
    warnings() { return validateProject(this.project); },
    boxNames() { return this.project.boxes.map(b => b.name); },
  },
  watch: {
    project: {
      deep: true,
      handler() { this.persist(); this.refreshPreview(); },
    },
    sel: { deep: true, handler() { this.refreshPreview(); } },
  },
  methods: {
    // ── selection ────────────────────────────────────────────────────────────
    selSettings() { this.sel = { boxId: null, cmpId: null, pane: 'settings' }; },
    selBoxPane(id) { this.sel = { boxId: id, cmpId: null, pane: 'box' }; this.expanded[id] = true; },
    selLid(id) { this.sel = { boxId: id, cmpId: null, pane: 'lid' }; },
    selCmpPane(bid, cid) { this.sel = { boxId: bid, cmpId: cid, pane: 'cmp' }; },

    // ── structure ops ────────────────────────────────────────────────────────
    addBox() {
      const b = newBox(this.project.boxes.length + 1);
      this.project.boxes.push(b);
      this.selBoxPane(b.id);
    },
    dupBox(box) {
      const c = JSON.parse(JSON.stringify(box));
      c.id = uid(); c.name += ' copy';
      c.components.forEach(x => { x.id = uid(); });
      this.project.boxes.push(c);
      this.selBoxPane(c.id);
    },
    rmBox(id) {
      if (!confirm('Delete this compartment and its sections?')) return;
      this.project.boxes = this.project.boxes.filter(b => b.id !== id);
      if (this.sel.boxId === id) this.selSettings();
    },
    addCmp(box) {
      const c = newComponent(box.components.length + 1);
      box.components.push(c);
      this.selCmpPane(box.id, c.id);
    },
    rmCmp(box, id) {
      box.components = box.components.filter(c => c.id !== id);
      if (this.sel.cmpId === id) this.selBoxPane(box.id);
    },
    hasLid(box) { return box.type === 'BOX' || box.type === 'HEXBOX'; },
    hasCmps(box) { return box.type === 'BOX' || box.type === 'HEXBOX'; },

    // ── preview ──────────────────────────────────────────────────────────────
    refreshPreview: debounce(function () {
      this.exactMode = false;
      this.preview?.update(this.project, this.sel);
    }, 200),
    refit() { this.preview?.update(this.project, { ...this.sel, refit: true }); },
    async renderExact() {
      this.rendering = true; this.scadError = null;
      try {
        const r = await fetch('/api/render-stl', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scad: this.scad, quality: 'preview', name: this.project.name }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Render failed');
        this.preview.loadStl(await r.arrayBuffer());
        this.exactMode = true;
        this.notify('Exact render loaded', 'ok');
      } catch (e) { this.scadError = e.message; this.notify('Render failed — see error panel', 'err'); }
      this.rendering = false;
    },

    // ── files ────────────────────────────────────────────────────────────────
    fileName(ext) { return (this.project.name || 'insert').replace(/[\\/\s]+/g, '_') + ext; },
    downloadBlob(blob, name) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name; a.click();
      URL.revokeObjectURL(a.href);
    },
    downloadScad() {
      this.downloadBlob(new Blob([this.scad], { type: 'text/plain' }), this.fileName('.scad'));
      this.notify('SCAD downloaded — open it in OpenSCAD next to the two library files', 'ok');
    },
    copyScad() { navigator.clipboard.writeText(this.scad).then(() => this.notify('Copied', 'ok')); },
    async exportStl() {
      this.exporting = true; this.scadError = null;
      this.notify('Rendering final STL — large inserts can take a few minutes…', 'info');
      try {
        const r = await fetch('/api/render-stl', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scad: this.scad, quality: 'final', name: this.project.name }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Render failed');
        this.downloadBlob(await r.blob(), this.fileName('.stl'));
        this.notify('STL exported!', 'ok');
      } catch (e) { this.scadError = e.message; this.notify('Export failed — see error panel', 'err'); }
      this.exporting = false;
    },
    saveProject() {
      this.downloadBlob(new Blob([JSON.stringify(this.project, null, 2)], { type: 'application/json' }),
        this.fileName('.json'));
    },
    loadProject() { this.$refs.file.click(); },
    onFile(e) {
      const f = e.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = ev => {
        try {
          const p = JSON.parse(ev.target.result);
          if (!p.boxes || p.version !== 2) throw 0;
          this.project = p;
          this.selSettings();
          this.notify('Project loaded', 'ok');
        } catch { this.notify('Not a valid BIT Builder v2 project file', 'err'); }
      };
      rd.readAsText(f);
      e.target.value = '';
    },
    resetProject() {
      if (!confirm('Start a new project? Unsaved changes are kept in this browser until you reset.')) return;
      this.project = newProject();
      this.selBoxPane(this.project.boxes[0].id);
    },

    // ── misc ─────────────────────────────────────────────────────────────────
    persist: debounce(function () {
      try { localStorage.setItem('bitbuilder2', JSON.stringify(this.project)); } catch {}
    }, 400),
    notify(msg, type = 'info') {
      clearTimeout(this._toastT);
      this.toast = { msg, type };
      this._toastT = setTimeout(() => { this.toast = null; }, 3500);
    },
    async checkOpenscad() {
      try {
        const d = await (await fetch('/api/check-openscad')).json();
        this.openscad = d.found; this.openscadPath = d.path;
      } catch { this.openscad = false; }
    },
  },
  mounted() {
    try {
      const saved = localStorage.getItem('bitbuilder2');
      if (saved) { const p = JSON.parse(saved); if (p.version === 2) this.project = p; }
    } catch {}
    this.sel.boxId = this.project.boxes[0]?.id || null;
    this.sel.pane = this.sel.boxId ? 'box' : 'settings';
    if (this.sel.boxId) this.expanded[this.sel.boxId] = true;
    this.checkOpenscad();
    this.preview = new Preview3D(this.$refs.canvas);
    this.preview.update(this.project, this.sel);
  },
}).mount('#app');
