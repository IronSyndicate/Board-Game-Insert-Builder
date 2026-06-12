// ── three.js preview: instant approximate meshes + exact STL mode ────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { STLLoader } from 'three/addons/STLLoader.js';
import { componentOffset } from './scadgen.js';

const PALETTE = [0x5a8adf, 0x4caf50, 0xe05555, 0xaf5ad2, 0xd2af32, 0x32c8c8];
const GAP = 8;

export class Preview3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14141f);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(120, -160, 140);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x606070, 1.3));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(80, -120, 200);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0xaab4ff, 0.45);
    fill.position.set(-100, 80, 60);
    this.scene.add(fill);

    const grid = new THREE.GridHelper(600, 60, 0x2a2a3e, 0x20202e);
    grid.rotation.x = Math.PI / 2;
    this.scene.add(grid);

    this.approxRoot = new THREE.Group();
    this.exactRoot = new THREE.Group();
    this.scene.add(this.approxRoot, this.exactRoot);
    this.exact = false;
    this._fitted = false;

    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
    const tick = () => { requestAnimationFrame(tick); this.controls.update(); this.renderer.render(this.scene, this.camera); };
    tick();
  }

  resize() {
    const w = this.canvas.parentElement.clientWidth, h = this.canvas.parentElement.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ── Approximate parametric view ─────────────────────────────────────────────
  update(project, sel = {}) {
    this.exact = false;
    this.exactRoot.visible = false;
    this.approxRoot.visible = true;
    disposeChildren(this.approxRoot);

    const wallG = num(project.settings?.wall_thickness, 1.5);
    let cursorX = 0;
    for (const box of project.boxes || []) {
      if (box.enabled === false) continue;
      const g = new THREE.Group();
      g.position.x = cursorX;
      const selBox = box.id === sel.boxId;
      const wall = num(box.wall_override) || wallG;
      let width = 100;
      if (box.type === 'BOX' || box.type === 'SPACER') {
        width = num(box.size[0], 100);
        this.buildBox(g, box, wall, selBox, sel.cmpId, box.type === 'SPACER');
      } else if (box.type === 'HEXBOX') {
        width = this.buildHexbox(g, box, wall, selBox);
      } else if (box.type === 'DIVIDERS') {
        width = this.buildDividers(g, box, selBox);
      }
      this.approxRoot.add(g);
      cursorX += width + GAP;
    }
    if (!this._fitted || sel.refit) { this.fitView(); this._fitted = true; }
  }

  // The library carves compartments OUT of a solid block — render exactly that:
  // a solid body whose top band has the compartment footprints punched through,
  // with a colored sheet at each cavity floor.
  buildBox(g, box, wall, selBox, selCmpId, spacerOnly) {
    const [bx, by, bz] = box.size.map(v => num(v, 10));
    const bodyMat = mat(selBox ? 0x50506e : 0x3e3e56, 1);
    outline(g, bx, by, bz, selBox ? 0xd4a017 : 0x55556e);

    if (spacerOnly) { // a spacer really is just a hollow wall frame
      const ring = rectPts(bx, by, bx / 2, by / 2);
      const hole = rectPts(bx - 2 * wall, by - 2 * wall, bx / 2, by / 2);
      g.add(extrudeMesh(ring, [hole], bz, 0, bodyMat));
      return;
    }

    // collect every compartment cell: footprint polygon + carve depth
    const cells = [];
    (box.components || []).forEach((cmp, ci) => {
      if (cmp.enabled === false) return;
      const off = componentOffset(box, cmp, wall);
      const [nx, ny] = cmp.num.map(v => Math.max(1, Math.round(num(v, 1))));
      const [cx, cy, cz] = cmp.size.map(v => num(v, 10));
      const [px, py] = cmp.padding.map(v => num(v, 0));
      const mf = num(cmp.margin[0], 0), ml = num(cmp.margin[2], 0);
      const depth = Math.min(Math.max(cz, 0.1), bz - wall);
      const rot = (num(cmp.rotation, 0) * Math.PI) / 180;
      const ctr = [wall + off.x + off.fw / 2, wall + off.y + off.fh / 2];
      const base = footprintPts(cmp.shape);
      for (let xi = 0; xi < nx; xi++) for (let yi = 0; yi < ny; yi++) {
        const cc = [wall + off.x + ml + xi * (cx + px) + cx / 2,
                    wall + off.y + mf + yi * (cy + py) + cy / 2];
        const pts = base.map(([u, v]) => rot2([cc[0] + u * cx, cc[1] + v * cy], ctr, rot));
        cells.push({ pts, depth, color: PALETTE[ci % PALETTE.length], sel: cmp.id === selCmpId });
      }
    });

    const maxD = cells.length ? Math.max(...cells.map(c => c.depth)) : 0;
    const base = bz - maxD;
    // solid lower slab (nothing is carved below the deepest compartment)
    if (base > 0.01) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(bx, by, base), bodyMat);
      slab.position.set(bx / 2, by / 2, base / 2);
      g.add(slab);
    }
    // upper band with the compartment footprints punched through it
    if (maxD > 0 || !cells.length) {
      g.add(extrudeMesh(rectPts(bx, by, bx / 2, by / 2), cells.map(c => c.pts),
        cells.length ? maxD : bz, base, bodyMat));
    }
    // cavity floors (one colored sheet per cell, top face at its real depth)
    for (const c of cells) {
      const floorZ = bz - c.depth;
      g.add(extrudeMesh(inset(c.pts, 0.985), [], 0.5, floorZ - 0.2,
        floorMat(c.color, c.sel)));
      // colored rim marks which component the opening belongs to
      g.add(loop(c.pts, bz + 0.05, c.sel ? 0xffffff : c.color));
    }

    // lid: flat panel laid out behind the body, as in the real output
    const lid = box.lid || {};
    if (!box.no_lid && lid.enabled !== false) {
      const offY = by + GAP;
      const lidM = mat(selBox ? 0x5a5a7e : 0x46465e, 1);
      let holes = [];
      if (!lid.solid) {
        const r = Math.max(num(lid.pattern_radius, 8), 1.5);
        const m = 2 * wall + r * 0.6;
        holes = hexHoles(m, offY + m, bx - m, offY + by - m, r,
          Math.max(num(lid.pattern_thickness, 0.5), 0.3));
      }
      g.add(extrudeMesh(rectPts(bx, by, bx / 2, offY + by / 2), holes, wall, 0, lidM));
      // rim wall (printed pointing up): inset lids sit a wall in from the edge
      const ins = lid.inset !== false ? wall : 0.01;
      const lh = Math.max(num(lid.height, lid.inset !== false ? 2 : 4), 0.5);
      g.add(extrudeMesh(
        rectPts(bx - 2 * ins, by - 2 * ins, bx / 2, offY + by / 2),
        [rectPts(bx - 2 * ins - wall, by - 2 * ins - wall, bx / 2, offY + by / 2)],
        lh, wall, lidM));
      outline(g, bx, by, wall + lh, selBox ? 0xd4a017 : 0x55556e, offY);
    }
  }

  buildHexbox(g, box, wall, selBox) {
    const d = num(box.hex_size[0], 100), h = num(box.hex_size[1], 20);
    const innerR = d / 2;
    const outerR = (innerR * Math.sin(Math.PI / 3) + wall) / Math.sin(Math.PI / 3);
    const bodyMat = mat(selBox ? 0x50506e : 0x3e3e56, 1);
    const ctr = [outerR, outerR];
    const hexPts = r => footprintPts('HEX').map(([u, v]) => [ctr[0] + u * 2 * r, ctr[1] + v * 2 * r]);
    const cmp = (box.components || []).find(c => c.enabled !== false);
    const depth = Math.min(cmp ? num(cmp.size[2], h - wall) : h - wall, h - wall);
    // solid base + walls-with-hex-cavity band, carved from the top
    const base = h - depth;
    g.add(extrudeMesh(hexPts(outerR), [], base, 0, bodyMat));
    g.add(extrudeMesh(hexPts(outerR), [hexPts(innerR)], depth, base, bodyMat));
    g.add(extrudeMesh(inset(hexPts(innerR), 0.985), [], 0.5, base - 0.2,
      floorMat(PALETTE[0], false)));

    // lid panel behind the body
    const lid = box.lid || {};
    if (lid.enabled !== false) {
      const offY = outerR * 2 + GAP;
      const lidM = mat(selBox ? 0x5a5a7e : 0x46465e, 1);
      const lidCtr = [outerR, offY + outerR];
      const at = (pts, c) => pts.map(([u, v]) => [u - ctr[0] + c[0], v - ctr[1] + c[1]]);
      let holes = [];
      if (!lid.solid) {
        const r = Math.max(num(lid.pattern_radius, 8), 1.5);
        const keep = (x, y) => Math.hypot(x - lidCtr[0], y - lidCtr[1]) <
          innerR * Math.sin(Math.PI / 3) - r;
        holes = hexHoles(lidCtr[0] - outerR, lidCtr[1] - outerR,
          lidCtr[0] + outerR, lidCtr[1] + outerR, r,
          Math.max(num(lid.pattern_thickness, 0.5), 0.3), keep);
      }
      g.add(extrudeMesh(at(hexPts(outerR), lidCtr), holes, wall, 0, lidM));
      const lh = Math.max(num(lid.height, 2), 0.5);
      g.add(extrudeMesh(at(hexPts(innerR), lidCtr),
        [at(inset(hexPts(innerR), 0.92), lidCtr)], lh, wall, lidM));
    }
    return outerR * 2;
  }

  buildDividers(g, box, selBox) {
    const [fw, fh] = box.frame_size.map(v => num(v, 80));
    const t = Math.max(num(box.thickness, 0.5), 0.6);
    const [tw, th] = box.tab_size.map(v => num(v, 14));
    const tabs = box.tab_texts || [];
    const cyc = Math.max(1, num(box.tab_cycle, 3));
    const m = mat(selBox ? 0x6a6a92 : 0x4a4a62, 0.95);
    tabs.forEach((_, i) => {
      const y = i * (fh + th + 4);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, t), m);
      plate.position.set(fw / 2, y + fh / 2, t / 2);
      const ti = i % cyc;
      const tx = cyc > 1 ? (fw - tw) / (cyc - 1) * ti : 0;
      const tab = new THREE.Mesh(new THREE.BoxGeometry(tw, th, t), m);
      tab.position.set(tx + tw / 2, y + fh + th / 2, t / 2);
      g.add(plate, tab);
    });
    return fw;
  }

  // ── Exact STL mode ──────────────────────────────────────────────────────────
  loadStl(buffer) {
    disposeChildren(this.exactRoot);
    const geo = new STLLoader().parse(buffer);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xb8b8c8, roughness: 0.55, metalness: 0.05,
    }));
    this.exactRoot.add(mesh);
    this.exactRoot.visible = true;
    this.approxRoot.visible = false;
    this.exact = true;
    this.fitView();
  }

  fitView() {
    const root = this.exact ? this.exactRoot : this.approxRoot;
    const bb = new THREE.Box3().setFromObject(root);
    if (bb.isEmpty()) return;
    const c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    const dist = Math.max(s.x, s.y, s.z, 40) * 1.6;
    this.camera.position.set(c.x + dist * 0.7, c.y - dist * 0.8, c.z + dist * 0.7);
    this.controls.target.copy(c);
  }
}

function num(v, d = 0) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; }
const matCache = new Map();
function mat(color, opacity) {
  const key = color + '/' + opacity;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({
    color, transparent: opacity < 1, opacity,
  }));
  return matCache.get(key);
}
// cavity floors glow slightly so compartments stay readable down in the shadows
function floorMat(color, sel) {
  const key = 'floor/' + color + '/' + sel;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({
    color, emissive: new THREE.Color(color).multiplyScalar(sel ? 0.55 : 0.35),
  }));
  return matCache.get(key);
}
// 2D footprint of a compartment shape on the unit square, centred at origin
function footprintPts(shape) {
  const poly = (n, off) => Array.from({ length: n }, (_, i) => {
    const a = off + (i * 2 * Math.PI) / n;
    return [Math.cos(a) / 2, Math.sin(a) / 2];
  });
  switch (shape) {
    case 'ROUND': return poly(32, 0);
    case 'HEX': return poly(6, 0);
    case 'HEX2': return poly(6, Math.PI / 6);
    case 'OCT': return poly(8, Math.PI / 8);
    case 'OCT2': return poly(8, 0);
    default: return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  }
}
const rectPts = (w, h, cx, cy) =>
  [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([u, v]) => [cx + u * w, cy + v * h]);
const rot2 = ([x, y], [cx, cy], a) => {
  if (!a) return [x, y];
  const dx = x - cx, dy = y - cy, c = Math.cos(a), s = Math.sin(a);
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
};
const inset = (pts, f) => {
  const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length;
  const cy = pts.reduce((t, p) => t + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
};
// solid extrusion of an outline (with optional punched holes) from z0 upward
function extrudeMesh(outerPts, holes, depth, z0, material) {
  const shape = new THREE.Shape(outerPts.map(p => new THREE.Vector2(p[0], p[1])));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  const m = new THREE.Mesh(geo, material);
  m.position.z = z0;
  return m;
}
function loop(pts, z, color) {
  const geo = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0], p[1], z)));
  return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color }));
}
function outline(g, x, y, z, color, yOff = 0) {
  const e = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(x, y, z)),
    new THREE.LineBasicMaterial({ color }));
  e.position.set(x / 2, yOff + y / 2, z / 2);
  g.add(e);
}
// hexagon-grid hole footprints for patterned lids, clipped to a bounding region
function hexHoles(x0, y0, x1, y1, R, t, inside = null) {
  const hr = Math.max(R - t, R * 0.5), dx = R * 1.732, dy = R * 1.5;
  const out = [];
  let row = 0;
  for (let y = y0; y <= y1; y += dy, row++) {
    for (let x = x0 + (row % 2) * dx / 2; x <= x1; x += dx) {
      if (inside && !inside(x, y)) continue;
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        pts.push([x + hr * Math.cos(a), y + hr * Math.sin(a)]);
      }
      out.push(pts);
    }
  }
  return out;
}
function disposeChildren(root) {
  for (const c of [...root.children]) {
    c.traverse(o => o.geometry?.dispose());
    root.remove(c);
  }
}
