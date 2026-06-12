"""BIT Builder v2 — thin Flask backend.

The frontend generates all SCAD text; this server only:
  1. serves the static app,
  2. locates OpenSCAD,
  3. renders posted SCAD text to STL via the OpenSCAD CLI.
"""
from flask import Flask, request, jsonify, send_file
import subprocess, os, shutil, tempfile, io

app = Flask(__name__)
ROOT = os.path.dirname(os.path.abspath(__file__))
LIBRARY_DIR = os.path.join(ROOT, 'Master Files')
LIB_FILES = ['boardgame_insert_toolkit_lib.3.scad', 'bit_functions_lib.3.scad']


@app.route('/')
def index():
    # Served raw (not via Jinja) — the page is a Vue app full of {{ }} bindings.
    return send_file(os.path.join(ROOT, 'templates', 'index.html'))


@app.route('/api/check-openscad')
def check_openscad():
    path = find_openscad()
    return jsonify({'found': path is not None, 'path': path or ''})


@app.route('/api/render-stl', methods=['POST'])
def render_stl():
    payload = request.get_json(force=True)
    scad = payload.get('scad', '')
    quality = payload.get('quality', 'final')  # 'preview' renders faster at lower $fn
    if not scad.strip():
        return jsonify({'error': 'No SCAD code received.'}), 400

    openscad = find_openscad()
    if not openscad:
        return jsonify({'error': 'OpenSCAD not found. Install from openscad.org.'}), 400

    tmpdir = tempfile.mkdtemp(prefix='bitbuilder_')
    try:
        for fname in LIB_FILES:
            src = os.path.join(LIBRARY_DIR, fname)
            if os.path.exists(src):
                shutil.copy2(src, tmpdir)

        scad_path = os.path.join(tmpdir, 'insert.scad')
        stl_path = os.path.join(tmpdir, 'insert.stl')
        with open(scad_path, 'w', encoding='utf-8') as f:
            f.write(scad)

        cmd = [openscad, '-o', stl_path]
        if quality == 'preview':
            cmd += ['-D', 'fn=24']
        cmd.append(scad_path)

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600, cwd=tmpdir)
        if result.returncode != 0 or not os.path.exists(stl_path):
            err = (result.stderr or result.stdout or 'OpenSCAD failed.').strip()
            return jsonify({'error': err[-4000:]}), 500

        with open(stl_path, 'rb') as f:
            data = f.read()
        name = (payload.get('name') or 'insert').replace(' ', '_')
        return send_file(io.BytesIO(data), as_attachment=True,
                         download_name=f'{name}.stl', mimetype='application/octet-stream')
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'OpenSCAD timed out (10-minute limit).'}), 500
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def find_openscad():
    # Windows: prefer openscad.com, the console wrapper that reports progress/errors.
    candidates = [
        r'C:\Program Files\OpenSCAD\openscad.com',
        r'C:\Program Files\OpenSCAD\openscad.exe',
        r'C:\Program Files (x86)\OpenSCAD\openscad.com',
        r'C:\Program Files (x86)\OpenSCAD\openscad.exe',
        '/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD',
        '/usr/bin/openscad',
        '/usr/local/bin/openscad',
        '/snap/bin/openscad',
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    finder = 'where' if os.name == 'nt' else 'which'
    try:
        r = subprocess.run([finder, 'openscad'], capture_output=True, text=True, timeout=5)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip().split('\n')[0].strip()
    except Exception:
        pass
    return None


if __name__ == '__main__':
    app.run(debug=False, port=5000)
