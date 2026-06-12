// ── BIT Builder schema ────────────────────────────────────────────────────────
// Single source of truth for every toolkit option. Both the UI forms and the
// SCAD generator are driven by these field lists — add a field here and it
// appears in the editor AND in the generated code.
//
// Field spec:
//   k      SCAD key identifier (already-quoted string keys allowed, e.g. '"wall_thickness"')
//   g      global variable name (globals only, emitted as `g = value;`)
//   m      property name on the JS model object
//   t      type: num | bool | str | enum | vec2 | vec3 | bool4 | num4 | posxy | size | ltext | list
//   d      library default → field is omitted from SCAD when value equals this (null = omit when empty)
//   init   UI initial value when it should differ from the library default
//   lbl    form label   tip: help text   adv: show under "Advanced"
//   always emit even when equal to default
//   vis    (obj) => bool, hide field in UI when false

export const SHAPES = ['SQUARE', 'FILLET', 'ROUND', 'HEX', 'HEX2', 'OCT', 'OCT2'];
export const PLACEMENTS = ['CENTER', 'FRONT', 'BACK', 'LEFT', 'RIGHT',
  'FRONT_WALL', 'BACK_WALL', 'LEFT_WALL', 'RIGHT_WALL', 'BOTTOM'];
export const CUTOUT_TYPES = ['BOTH', 'INTERIOR', 'EXTERIOR'];
export const BOX_TYPES = ['BOX', 'HEXBOX', 'DIVIDERS', 'SPACER'];
export const FBLR = ['Front', 'Back', 'Left', 'Right'];

// ── Global settings ──────────────────────────────────────────────────────────
export const GLOBAL_GROUPS = [
  { title: 'Print settings', fields: [
    { g: 'g_wall_thickness', m: 'wall_thickness', t: 'num', d: 1.5, always: true, lbl: 'Wall thickness (mm)', tip: 'Outer and inner wall thickness for all compartments.' },
    { g: 'g_tolerance', m: 'tolerance', t: 'num', d: 0.15, always: true, lbl: 'Lid tolerance (mm)', tip: 'Gap between lid and box. Increase for looser fit, decrease for tighter. Reprint only the lid to test.' },
    { g: 'g_default_font', m: 'default_font', t: 'str', d: 'Liberation Sans:style=Regular', always: true, lbl: 'Default font', tip: 'OpenSCAD font string, e.g. "Times New Roman:style=Bold".' },
  ]},
  { title: 'Output', fields: [
    { g: 'g_b_print_box', m: 'print_box', t: 'bool', d: true, always: true, lbl: 'Output compartments' },
    { g: 'g_b_print_lid', m: 'print_lid', t: 'bool', d: true, always: true, lbl: 'Output lids' },
  ]},
  { title: 'Advanced', adv: true, fields: [
    { g: 'g_detent_thickness', m: 'detent_thickness', t: 'num', d: 0.25, lbl: 'Detent thickness (mm)', tip: 'Snap-fit bump size. Bigger = tighter snap. Adjust in 0.05 steps.' },
    { g: 'g_detent_spacing', m: 'detent_spacing', t: 'num', d: 2, lbl: 'Detent length (mm)' },
    { g: 'g_tolerance_detent_pos', m: 'tolerance_detent_pos', t: 'num', d: 0.1, lbl: 'Detent position tolerance', tip: 'Moves lid detents down; larger = bigger gap between lid and box.' },
    { g: 'g_lid_thickness', m: 'lid_thickness', t: 'num', d: null, lbl: 'Lid top thickness (mm)', tip: 'Defaults to wall thickness if empty.' },
    { g: 'g_b_simple_lids', m: 'simple_lids', t: 'bool', d: false, lbl: 'Simple solid lids everywhere', tip: 'Overrides all lids to plain solid — faster to render and print.' },
    { g: 'g_b_fit_test', m: 'fit_test', t: 'bool', d: false, lbl: 'Fit-test mode', tip: 'Outputs every compartment as a thin hollow placeholder to test sizes in the game box cheaply.' },
    { g: 'g_print_mmu_layer', m: 'mmu_layer', t: 'enum', opts: ['default', 'mmu_box_layer', 'mmu_label_layer'], strv: true, d: 'default', lbl: 'Multi-material layer', tip: 'For MMU printing: export box geometry and label geometry as separate STLs.' },
  ]},
];

// ── Labels (used by boxes, lids and components) ──────────────────────────────
export const LBL_FIELDS = [
  { k: 'LBL_TEXT', m: 'text', t: 'ltext', d: '', lbl: 'Text', tip: 'Per-compartment grids: one line per row, cells separated by | (e.g. "A|B↵C|D").', vis: o => o.mode !== 'image' },
  { k: 'LBL_IMAGE', m: 'image', t: 'str', d: '', lbl: 'SVG path', tip: 'Absolute path to an .svg file on this PC.', vis: o => o.mode === 'image' },
  { k: 'LBL_PLACEMENT', m: 'placement', t: 'enum', opts: PLACEMENTS, d: 'CENTER', lbl: 'Placement', tip: 'FRONT/BACK/etc = cell edges. *_WALL = on the compartment wall itself. BOTTOM = floor.' },
  { k: 'LBL_SIZE', m: 'size', t: 'size', d: 'AUTO', lbl: 'Size', tip: 'AUTO scales to fit, or a number (mm).' },
  { k: 'LBL_FONT', m: 'font', t: 'str', d: '', lbl: 'Font', tip: 'Leave empty for the global default font.' },
  { k: 'LBL_DEPTH', m: 'depth', t: 'num', d: 0.2, lbl: 'Depth (mm)', tip: 'Engraving depth.' },
  { k: 'ROTATION', m: 'rotation', t: 'num', d: 0, lbl: 'Rotation (°)' },
  { k: 'POSITION_XY', m: 'offset', t: 'vec2', d: [0, 0], lbl: 'Offset X/Y (mm)', adv: true },
  { k: 'LBL_SPACING', m: 'spacing', t: 'num', d: 1, lbl: 'Letter spacing', adv: true },
  { k: 'LBL_AUTO_SCALE_FACTOR', m: 'scale_factor', t: 'num', d: 1.2, lbl: 'Auto-scale factor', tip: 'Lower = bigger auto-sized text.', adv: true },
];

// ── Lid ───────────────────────────────────────────────────────────────────────
export const LID_GROUPS = [
  { title: 'Style', fields: [
    { k: 'LID_INSET_B', m: 'inset', t: 'bool', d: false, init: true, lbl: 'Inset lid', tip: 'Sits inside the compartment rim (required for stacking). Unchecked = cap lid that wraps over the compartment.' },
    { k: 'LID_SOLID_B', m: 'solid', t: 'bool', d: false, lbl: 'Solid lid', tip: 'Plain solid top instead of a patterned grid.' },
    { k: 'LID_HEIGHT', m: 'height', t: 'num', d: null, lbl: 'Lid wall height (mm)', tip: 'How far the lid overlaps the compartment. Default: 2 inset / 4 cap.' },
    { k: 'LID_FIT_UNDER_B', m: 'fit_under', t: 'bool', d: true, lbl: 'Lid stores under compartment', tip: 'Cuts the compartment base so the lid can be stowed underneath during play.' },
  ]},
  { title: 'Pattern', vis: o => !o.solid, fields: [
    { k: 'LID_PATTERN_RADIUS', m: 'pattern_radius', t: 'num', d: 4, init: 8, lbl: 'Cell radius (mm)' },
    { k: 'LID_PATTERN_N1', m: 'pattern_n1', t: 'num', d: 6, lbl: 'Outer polygon sides', adv: true, tip: '6 = hexagons. 3–8 supported; mix N1/N2 for fancy patterns.' },
    { k: 'LID_PATTERN_N2', m: 'pattern_n2', t: 'num', d: 6, lbl: 'Inner polygon sides', adv: true },
    { k: 'LID_PATTERN_ANGLE', m: 'pattern_angle', t: 'num', d: 30, lbl: 'Pattern angle (°)', adv: true },
    { k: 'LID_PATTERN_ROW_OFFSET', m: 'pattern_row_offset', t: 'num', d: 50, lbl: 'Row offset (%)', adv: true },
    { k: 'LID_PATTERN_COL_OFFSET', m: 'pattern_col_offset', t: 'num', d: 100, lbl: 'Column offset (%)', adv: true },
    { k: 'LID_PATTERN_THICKNESS', m: 'pattern_thickness', t: 'num', d: 0.5, lbl: 'Pattern line thickness (mm)', adv: true },
  ]},
  { title: 'Fit & grip', fields: [
    { k: 'LID_CUTOUT_SIDES_4B', m: 'cutout_sides', t: 'bool4', d: [false, false, false, false], lbl: 'Finger cutouts', tip: 'Notches in the lid wall to grip and lift the lid.' },
    { k: 'LID_TABS_4B', m: 'tabs', t: 'bool4', d: [true, true, true, true], lbl: 'Snap tabs', adv: true, tip: 'Which sides get snap-fit tabs (inset lids).' },
  ]},
  { title: 'Label styling', adv: true, fields: [
    { k: 'LID_LABELS_INVERT_B', m: 'label_invert', t: 'bool', d: false, lbl: 'Invert label', tip: 'Raised text on a recessed background instead of engraved.' },
    { k: 'LID_SOLID_LABELS_DEPTH', m: 'label_depth', t: 'num', d: null, lbl: 'Label depth on solid lid (mm)' },
    { k: 'LID_LABELS_BG_THICKNESS', m: 'label_bg', t: 'num', d: 2, lbl: 'Label background thickness (mm)' },
    { k: 'LID_LABELS_BORDER_THICKNESS', m: 'label_border', t: 'num', d: 0.3, lbl: 'Label border thickness (mm)' },
    { k: 'LID_STRIPE_WIDTH', m: 'stripe_width', t: 'num', d: 0.5, lbl: 'Label stripe width (mm)' },
    { k: 'LID_STRIPE_SPACE', m: 'stripe_space', t: 'num', d: 1, lbl: 'Label stripe spacing (mm)' },
  ]},
];

// ── Component (a grid of compartments inside a box) ──────────────────────────
export const CMP_GROUPS = [
  { title: 'Grid & size', fields: [
    { k: 'CMP_NUM_COMPARTMENTS_XY', m: 'num', t: 'vec2', d: [1, 1], always: true, int: true, lbl: 'Cells X / Y' },
    { k: 'CMP_COMPARTMENT_SIZE_XYZ', m: 'size', t: 'vec3', d: [10, 10, 10], always: true, lbl: 'Cell size X/Y/Z (mm)', tip: 'Interior size of EACH cell. Z is depth; cells are carved from the top of the compartment.' },
    { k: 'CMP_PADDING_XY', m: 'padding', t: 'vec2', d: [1, 1], lbl: 'Padding X / Y (mm)', tip: 'Wall thickness between cells.' },
  ]},
  { title: 'Shape', fields: [
    { k: 'CMP_SHAPE', m: 'shape', t: 'enum', opts: SHAPES, d: 'SQUARE', lbl: 'Shape' },
    { k: 'CMP_FILLET_RADIUS', m: 'fillet_radius', t: 'num', d: null, lbl: 'Fillet radius (mm)', vis: o => o.shape === 'FILLET' },
    { k: 'CMP_SHAPE_ROTATED_B', m: 'rotated', t: 'bool', d: false, lbl: 'Rotate shape 90°', vis: o => o.shape !== 'SQUARE' },
    { k: 'CMP_SHAPE_VERTICAL_B', m: 'vertical', t: 'bool', d: false, lbl: 'Vertical (stack of pieces)', tip: 'Shape extends side-to-side instead of top-down — e.g. a slot for a stack of round tokens.', vis: o => o.shape !== 'SQUARE' },
    { k: 'CMP_PEDESTAL_BASE_B', m: 'pedestal', t: 'bool', d: false, lbl: 'Pedestal base', tip: 'Raises pieces on a pedestal so they are easy to grab.' },
  ]},
  { title: 'Position', fields: [
    { k: 'POSITION_XY', m: 'position', t: 'posxy', d: ['CENTER', 'CENTER'], lbl: 'Position X / Y', tip: 'CENTER, MAX, or mm from the compartment interior origin (front-left).' },
    { k: 'ROTATION', m: 'rotation', t: 'num', d: 0, lbl: 'Rotation (°)', adv: true },
    { k: 'CMP_MARGIN_FBLR', m: 'margin', t: 'num4', d: [0, 0, 0, 0], lbl: 'Margin F/B/L/R (mm)', adv: true, tip: 'Extra space between this section and its surroundings, per side.' },
  ]},
  { title: 'Finger cutouts', fields: [
    { k: 'CMP_CUTOUT_SIDES_4B', m: 'cutout_sides', t: 'bool4', d: [false, false, false, false], lbl: 'Side cutouts', tip: 'Scoops in cell walls for fingers — essential for card stacks.' },
    { k: 'CMP_CUTOUT_CORNERS_4B', m: 'cutout_corners', t: 'bool4', subs: ['Front-L', 'Back-R', 'Back-L', 'Front-R'], d: [false, false, false, false], lbl: 'Corner cutouts', adv: true },
    { k: 'CMP_CUTOUT_TYPE', m: 'cutout_type', t: 'enum', opts: CUTOUT_TYPES, d: 'BOTH', lbl: 'Cutout reach', adv: true, tip: 'INTERIOR: only inner walls. EXTERIOR: only the outer compartment wall. BOTH: all the way through.' },
    { k: 'CMP_CUTOUT_HEIGHT_PCT', m: 'cutout_height_pct', t: 'num', d: 100, lbl: 'Cutout height (%)', adv: true },
    { k: 'CMP_CUTOUT_DEPTH_PCT', m: 'cutout_depth_pct', t: 'num', d: 25, lbl: 'Cutout depth (%)', adv: true },
    { k: 'CMP_CUTOUT_WIDTH_PCT', m: 'cutout_width_pct', t: 'num', d: 50, lbl: 'Cutout width (%)', adv: true },
    { k: 'CMP_CUTOUT_BOTTOM_B', m: 'cutout_bottom', t: 'bool', d: false, lbl: 'Bottom hole', tip: 'Opening in the floor to push pieces out from below.' },
    { k: 'CMP_CUTOUT_BOTTOM_PCT', m: 'cutout_bottom_pct', t: 'num', d: 80, lbl: 'Bottom hole size (%)', adv: true, vis: o => o.cutout_bottom },
  ]},
  { title: 'Exotic', adv: true, fields: [
    { k: 'CMP_SHEAR', m: 'shear', t: 'vec2', d: [0, 0], lbl: 'Shear X / Y (°)', tip: 'Slants compartment walls — e.g. angled card wells for easy browsing.' },
    { k: 'CMP_PADDING_HEIGHT_ADJUST_XY', m: 'padding_height_adjust', t: 'vec2', d: [0, 0], lbl: 'Divider height adjust X / Y (mm)', tip: 'Lowers (negative) or raises internal divider walls relative to cell depth.' },
  ]},
];

// ── Box-type specific fields ──────────────────────────────────────────────────
export const BOX_GROUPS = [
  { title: 'Dimensions', fields: [
    { k: 'BOX_SIZE_XYZ', m: 'size', t: 'vec3', d: [100, 100, 30], always: true, lbl: 'Exterior size X/Y/Z (mm)', tip: 'With an inset lid the printed height is Z + 2×wall.' },
  ]},
  { title: 'Options', fields: [
    { k: 'BOX_STACKABLE_B', m: 'stackable', t: 'bool', d: false, lbl: 'Stackable', tip: 'Base is shaped to lock onto the lid of the compartment below. Forces an inset lid.' },
    { k: 'BOX_NO_LID_B', m: 'no_lid', t: 'bool', d: false, lbl: 'No lid' },
    { k: '"wall_thickness"', m: 'wall_override', t: 'num', d: null, lbl: 'Wall thickness override (mm)', adv: true, tip: 'Overrides the global wall thickness for this compartment only.' },
  ]},
];

export const HEXBOX_GROUPS = [
  { title: 'Dimensions', fields: [
    { k: 'HEXBOX_SIZE_DZ', m: 'hex_size', t: 'vec2', d: [100, 20], always: true, lbl: 'Interior diameter / height (mm)', tip: 'Diameter = corner-to-corner across the tile that must fit inside. Height is exterior.' },
  ]},
  { title: 'Options', fields: [
    { k: 'BOX_STACKABLE_B', m: 'stackable', t: 'bool', d: false, lbl: 'Stackable' },
  ]},
];

export const SPACER_GROUPS = [
  { title: 'Dimensions', fields: [
    { k: 'BOX_SIZE_XYZ', m: 'size', t: 'vec3', d: [100, 100, 30], always: true, lbl: 'Exterior size X/Y/Z (mm)', tip: 'A spacer is just a hollow wall frame — useful to fill leftover gaps in the game box.' },
  ]},
];

export const DIV_GROUPS = [
  { title: 'Frame', fields: [
    { k: 'DIV_FRAME_SIZE_XY', m: 'frame_size', t: 'vec2', d: [80, 80], always: true, lbl: 'Frame width / height (mm)', tip: 'Size of the card-shaped body, excluding the tab.' },
    { k: 'DIV_THICKNESS', m: 'thickness', t: 'num', d: 0.5, lbl: 'Thickness (mm)' },
    { k: 'DIV_FRAME_NUM_COLUMNS', m: 'num_columns', t: 'num', d: -1, int: true, lbl: 'Window columns', tip: '-1 = solid divider. 0+ = number of column struts in the cut-out window (saves filament).' },
    { k: 'DIV_FRAME_TOP', m: 'frame_top', t: 'num', d: 10, lbl: 'Top rail (mm)', adv: true },
    { k: 'DIV_FRAME_BOTTOM', m: 'frame_bottom', t: 'num', d: 10, lbl: 'Bottom rail (mm)', adv: true },
    { k: 'DIV_FRAME_COLUMN', m: 'frame_column', t: 'num', d: 7, lbl: 'Column width (mm)', adv: true },
    { k: 'DIV_FRAME_RADIUS', m: 'frame_radius', t: 'num', d: 15, lbl: 'Window corner radius (mm)', adv: true },
  ]},
  { title: 'Tabs', fields: [
    { k: 'DIV_TAB_SIZE_XY', m: 'tab_size', t: 'vec2', d: [32, 14], lbl: 'Tab width / height (mm)' },
    { k: 'DIV_TAB_CYCLE', m: 'tab_cycle', t: 'num', d: 3, int: true, lbl: 'Tab positions per row', tip: 'Tabs step across this many positions, then wrap (3 = left, centre, right).' },
    { k: 'DIV_TAB_CYCLE_START', m: 'tab_cycle_start', t: 'num', d: 1, int: true, lbl: 'First tab position', adv: true },
    { k: 'DIV_TAB_RADIUS', m: 'tab_radius', t: 'num', d: 4, lbl: 'Tab corner radius (mm)', adv: true },
  ]},
  { title: 'Tab text', fields: [
    { k: 'DIV_TAB_TEXT_SIZE', m: 'tab_text_size', t: 'num', d: 7, lbl: 'Text size' },
    { k: 'DIV_TAB_TEXT_FONT', m: 'tab_text_font', t: 'str', d: '', lbl: 'Font', tip: 'Empty = toolkit default (Stencil Std:style=Bold).' },
    { k: 'DIV_TAB_TEXT_SPACING', m: 'tab_text_spacing', t: 'num', d: 1.1, lbl: 'Letter spacing', adv: true },
    { k: 'DIV_TAB_TEXT_CHAR_THRESHOLD', m: 'tab_text_chars', t: 'num', d: 4, int: true, lbl: 'Shrink-to-fit above N chars', adv: true },
  ]},
];

// ── Helpers ───────────────────────────────────────────────────────────────────
export const flat = groups => groups.flatMap(g => g.fields);

function initValue(f) {
  const v = f.init !== undefined ? f.init : f.d;
  return Array.isArray(v) ? [...v] : v;
}
export const objFromGroups = groups => {
  const o = {};
  for (const f of flat(groups)) o[f.m] = initValue(f);
  return o;
};

let _uid = 1;
export const uid = () => 'id' + (_uid++) + '_' + Date.now().toString(36);

export function newLabel() {
  const o = objFromGroups([{ fields: LBL_FIELDS }]);
  o.mode = 'text';
  return o;
}
export function newLid() {
  const o = objFromGroups(LID_GROUPS);
  o.enabled = true;
  o.labels = [];
  return o;
}
export function newComponent(n = 1) {
  const o = objFromGroups(CMP_GROUPS);
  o.id = uid();
  o.name = 'Section ' + n;
  o.enabled = true;
  o.labels = [];
  o.num = [2, 2];
  o.size = [30, 30, 25];
  return o;
}
export function newBox(n = 1) {
  return {
    id: uid(), name: 'Compartment ' + n, type: 'BOX', enabled: true,
    ...objFromGroups(BOX_GROUPS),
    ...objFromGroups(HEXBOX_GROUPS),
    ...objFromGroups(DIV_GROUPS),
    tab_texts: ['Tab 1', 'Tab 2', 'Tab 3'],
    labels: [],
    lid: newLid(),
    components: [newComponent(1)],
  };
}
export function newProject() {
  const settings = objFromGroups(GLOBAL_GROUPS);
  settings.isolated_box = '';
  return { name: 'My Game Insert', version: 2, settings, boxes: [newBox(1)] };
}
