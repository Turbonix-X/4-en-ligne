// ===== Le plateau en 3D (Three.js r128), avec les mêmes méthodes que Board2D =====
// Glisser fait tourner la caméra, un simple clic ou tap joue.

class Board3D {
  static available() {
    if (typeof THREE === "undefined") return false;
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) { return false; }
  }

  constructor(host, cb) {
    this.host = host;
    this.cb = cb;
    this.gen = 0;
    this.state = null;
    this.view = { viewer: null, colors: [], skins: [] };
    this.tokens = new Map();
    this.tweens = [];
    this.cursor = null;
    this.hint = null;
    this.targets = null;
    this.doomed = null;
    this.locked = true;
    this.win = null;
    this.yaw = -0.3;
    this.pitch = 0.1;
    this.dist = 14;
    this.distGoal = 14;
    this.materials = new Map();
    this.boardKey = "";

    host.innerHTML = "";
    this.wrap = document.createElement("div");
    this.wrap.className = "b3d";
    host.appendChild(this.wrap);

    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.LinearToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.wrap.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    this.rig = new THREE.Group();
    this.scene.add(this.rig);
    this.tokenGroup = new THREE.Group();
    this.rig.add(this.tokenGroup);
    this.boardGroup = new THREE.Group();
    this.rig.add(this.boardGroup);
    this.fogGroup = new THREE.Group();
    this.rig.add(this.fogGroup);
    this.decor = new THREE.Group();
    this.scene.add(this.decor);

    this.buildLights();
    this.buildEnv();
    this.buildShared();

    this.onDown = (e) => {
      this.down = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch, moved: false, id: e.pointerId };
      try { r.domElement.setPointerCapture(e.pointerId); } catch (err) { /* pointeur déjà relâché */ }
    };
    this.onMove = (e) => {
      if (this.down) {
        const dx = e.clientX - this.down.x, dy = e.clientY - this.down.y;
        if (Math.hypot(dx, dy) > 7) this.down.moved = true;
        if (this.down.moved) {
          this.yaw = Math.max(-1.05, Math.min(1.05, this.down.yaw - dx * 0.006));
          this.pitch = Math.max(-0.5, Math.min(0.85, this.down.pitch + dy * 0.005));
          return;
        }
      }
      if (e.pointerType === "touch") return;
      const p = this.cellAt(e);
      if (this.cb.onHover) this.cb.onHover(p ? p[0] : null, p ? p[1] : null);
    };
    this.onUp = (e) => {
      const d = this.down;
      this.down = null;
      if (!d || d.moved) return;
      const p = this.cellAt(e);
      if (p && this.cb.onPick) this.cb.onPick(p[0], p[1]);
    };
    this.onLeave = () => { if (!this.down && this.cb.onHover) this.cb.onHover(null, null); };
    const el = r.domElement;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", () => { this.down = null; });
    el.addEventListener("pointerleave", this.onLeave);

    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(host);

    this.alive = true;
    this.last = performance.now();
    const loop = (t) => {
      if (!this.alive) return;
      this.tick(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    // Onglet caché : requestAnimationFrame s'arrête, mais les animations doivent finir quand même
    this.backup = setInterval(() => {
      if (performance.now() - this.last > 400) this.tick(performance.now());
    }, 200);
  }

  destroy() {
    this.alive = false;
    this.gen++;
    clearInterval(this.backup);
    this.ro.disconnect();
    this.tweens.forEach((t) => t.resolve());
    this.tweens = [];
    this.renderer.dispose();
    try { this.renderer.forceContextLoss(); } catch (e) { /* déjà perdu */ }
    this.host.innerHTML = "";
  }

  // --- Décor ----------------------------------------------------------------------

  buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xd9ccff, 0x1a1030, 0.35));
    const key = new THREE.DirectionalLight(0xfff4dd, 0.95);
    key.position.set(-6, 12, 14);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.camera.left = -11; key.shadow.camera.right = 11;
    key.shadow.camera.top = 11; key.shadow.camera.bottom = -11;
    key.shadow.bias = -0.0006;
    key.shadow.radius = 5;
    s.add(key);
    this.key = key;
    const mauve = new THREE.PointLight(0x9b6dff, 0.9, 40);
    mauve.position.set(9, -3, 8);
    s.add(mauve);
    const yellow = new THREE.PointLight(0xffd60a, 0.7, 40);
    yellow.position.set(-9, 6, -6);
    s.add(yellow);
    this.flash = new THREE.PointLight(0xffa030, 0, 18);
    this.flash.position.set(0, 0, 2);
    s.add(this.flash);
  }

  // Une petite pièce colorée qui se reflète dans les pions brillants et en or
  buildEnv() {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x05030a);
    const add = (color, x, y, z, sx, sy) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    // Des surfaces sombres et quelques petites zones vives : ça fait de beaux reflets sans tout délaver
    add(0x55525e, 0, 9, 3, 14, 7);
    add(0x6b5f3c, -9, 2, 5, 6, 10);
    add(0x3a2866, 9, 0, 3, 6, 12);
    add(0x4a3c08, 0, -8, 5, 12, 4);
    add(0xffffff, 3, 3, 10, 2.4, 2.4);
    add(0xffffff, -4, 5, 8, 1.2, 3);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pm.fromScene(env, 0.05).texture;
    pm.dispose();
    this.scene.environment = this.envMap;
  }

  texture(size, draw) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d"), size);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  buildShared() {
    // Le pion : un disque arrondi, tourné pour se présenter face à la caméra
    const pts = [];
    const R = 0.43, T = 0.14, B = 0.05;
    pts.push(new THREE.Vector2(0, -T));
    pts.push(new THREE.Vector2(R - B, -T));
    for (let k = 0; k <= 6; k++) {
      const a = -Math.PI / 2 + (k / 6) * Math.PI;
      pts.push(new THREE.Vector2(R - B + Math.cos(a) * B, Math.sin(a) * (T)));
    }
    pts.push(new THREE.Vector2(R - B, T));
    pts.push(new THREE.Vector2(0, T));
    this.tokenGeo = new THREE.LatheGeometry(pts, 40);
    this.tokenGeo.rotateX(Math.PI / 2);
    this.ringGeo = new THREE.TorusGeometry(0.29, 0.016, 8, 40);

    this.xTex = this.texture(128, (g, s) => {
      g.clearRect(0, 0, s, s);
      g.lineCap = "round";
      g.lineWidth = s * 0.17;
      g.strokeStyle = "#ffffff";
      g.beginPath();
      g.moveTo(s * 0.27, s * 0.27); g.lineTo(s * 0.73, s * 0.73);
      g.moveTo(s * 0.73, s * 0.27); g.lineTo(s * 0.27, s * 0.73);
      g.stroke();
    });
    this.starTex = this.texture(128, (g, s) => {
      const c = s / 2;
      const grad = g.createRadialGradient(c, c, 0, c, c, c);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.2, "rgba(255,255,255,.55)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      g.fillStyle = "#fff";
      g.beginPath();
      for (const [a, b] of [[0, 1], [Math.PI / 2, 1]]) {
        g.ellipse(c, c, s * 0.5 * b, s * 0.022, a, 0, Math.PI * 2);
      }
      g.fill();
    });
    this.fogTex = this.texture(128, (g, s) => {
      const c = s / 2;
      for (let k = 0; k < 26; k++) {
        const a = Math.random() * 6.28, d = Math.random() * s * 0.25;
        const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d, r = s * (0.16 + Math.random() * 0.2);
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, "rgba(120,105,170,.55)");
        grad.addColorStop(1, "rgba(60,45,100,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, s, s);
      }
    });

    this.laneMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
    this.laneMesh.visible = false;
    this.rig.add(this.laneMesh);
    this.hintMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    this.hintMesh.visible = false;
    this.rig.add(this.hintMesh);
    this.aim = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd60a }));
    this.aim.visible = false;
    this.rig.add(this.aim);
    this.ghost = new THREE.Mesh(this.tokenGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.3 }));
    this.ghost.visible = false;
    this.rig.add(this.ghost);
  }

  toWorld(x, y) {
    const { w, h } = this.state;
    return [x - (w - 1) / 2, (h - 1) / 2 - y];
  }

  // Plateau percé, cadre doré, pieds et tapis : refaits seulement si la taille change
  buildBoard() {
    const { w, h, o } = this.state;
    const key = `${w}x${h}x${o.gravity}`;
    if (key === this.boardKey) return;
    this.boardKey = key;
    const dispose = (group) => {
      while (group.children.length) {
        const c = group.children.pop();
        c.traverse((n) => { if (n.geometry) n.geometry.dispose(); });
      }
    };
    dispose(this.boardGroup);
    dispose(this.decor);

    const pad = 0.34;
    const W = w / 2 + pad, H = h / 2 + pad;
    const rounded = (shape, a, b, r) => {
      shape.moveTo(-a + r, -b);
      shape.lineTo(a - r, -b);
      shape.quadraticCurveTo(a, -b, a, -b + r);
      shape.lineTo(a, b - r);
      shape.quadraticCurveTo(a, b, a - r, b);
      shape.lineTo(-a + r, b);
      shape.quadraticCurveTo(-a, b, -a, b - r);
      shape.lineTo(-a, -b + r);
      shape.quadraticCurveTo(-a, -b, -a + r, -b);
      return shape;
    };
    const shape = rounded(new THREE.Shape(), W, H, 0.34);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [px, py] = this.toWorld(x, y);
        const hole = new THREE.Path();
        hole.absarc(px, py, 0.445, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
    }
    const plateGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.38, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 16 });
    plateGeo.translate(0, 0, -0.19);
    const plate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ color: 0x3d2299, roughness: 0.34, metalness: 0.2, envMapIntensity: 0.7 }));
    plate.castShadow = true;
    plate.receiveShadow = true;
    this.boardGroup.add(plate);

    // Le cadre jaune
    const frameShape = rounded(new THREE.Shape(), W + 0.14, H + 0.14, 0.42);
    frameShape.holes.push(rounded(new THREE.Path(), W - 0.02, H - 0.02, 0.32));
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.5, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3, curveSegments: 12 });
    frameGeo.translate(0, 0, -0.25);
    const frame = new THREE.Mesh(frameGeo, new THREE.MeshStandardMaterial({ color: 0xffd60a, roughness: 0.28, metalness: 0.75, emissive: 0x332200, envMapIntensity: 1.2 }));
    frame.castShadow = true;
    this.boardGroup.add(frame);

    // Les numéros des couloirs
    this.addKeys();

    // Le tapis, qui ne tourne pas avec la grille
    const floorY = -Math.max(w, h) / 2 - 1;
    const R = Math.max(w, h) * 0.95;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshStandardMaterial({ color: 0x1b1330, roughness: 0.95, metalness: 0, envMapIntensity: 0.15 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorY;
    floor.receiveShadow = true;
    this.decor.add(floor);
    const ring = (radius, color) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.05, 8, 96), new THREE.MeshBasicMaterial({ color }));
      m.rotation.x = Math.PI / 2;
      m.position.y = floorY + 0.03;
      this.decor.add(m);
      return m;
    };
    this.ringA = ring(R * 0.98, 0xffd60a);
    this.ringB = ring(R * 0.84, 0x9b6dff);
    this.floorY = floorY;
    // Le socle qui relie le plateau au tapis
    const base = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, h) * 0.5, 0.26, 1.5), new THREE.MeshStandardMaterial({ color: 0x2d1b57, roughness: 0.4, metalness: 0.5 }));
    base.position.y = floorY + 0.13;
    base.castShadow = true;
    this.decor.add(base);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, Math.max(0.1, -floorY - Math.min(H, Math.max(w, h) / 2)), 0.3), base.material);
    post.position.y = floorY + (-floorY - Math.min(H, Math.max(w, h) / 2)) / 2 + 0.05;
    this.decor.add(post);
    this.fit();
  }

  addKeys() {
    const { w, h, o } = this.state;
    const g = o.gravity;
    const vertical = C4.isVertical(g);
    const n = Math.min(10, vertical ? w : h);
    for (let l = 0; l < n; l++) {
      const label = l === 9 ? "0" : String(l + 1);
      const tex = this.texture(64, (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        ctx.fillStyle = "rgba(255,255,255,.72)";
        ctx.font = `800 ${s * 0.56}px Outfit, Segoe UI, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, s / 2, s / 2 + 2);
      });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.scale.set(0.62, 0.62, 1);
      if (vertical) {
        const [px] = this.toWorld(l, 0);
        sp.position.set(px, g === "up" ? -h / 2 - 0.82 : h / 2 + (g === "none" ? 0.74 : 1.62), 0);
      } else {
        const [, py] = this.toWorld(0, l);
        sp.position.set(g === "left" ? w / 2 + 1.62 : -w / 2 - 1.62, py, 0);
      }
      this.boardGroup.add(sp);
    }
  }

  // --- Caméra ----------------------------------------------------------------------

  fit() {
    if (!this.state) return;
    const { w, h, o } = this.state;
    const W = this.host.clientWidth, H = this.host.clientHeight;
    if (!W || !H) return;
    const aspect = W / H;
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    const g = o.gravity;
    const halfH = h / 2 + 0.7 + (g === "down" || g === "up" || g === "none" ? 1.05 : 0);
    const halfW = w / 2 + 0.7 + (g === "left" || g === "right" ? 1.05 : 0);
    this.distGoal = Math.max(halfH / tan, halfW / (tan * aspect)) * 1.12 + 0.6;
  }

  layout() {
    const W = this.host.clientWidth, H = this.host.clientHeight;
    if (!W || !H) return;
    this.renderer.setSize(W, H);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.fit();
    this.dist = this.distGoal;
  }

  cellAt(e) {
    if (!this.state) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: nx, y: ny }, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const { w, h } = this.state;
    const x = Math.round(hit.x + (w - 1) / 2);
    const y = Math.round((h - 1) / 2 - hit.y);
    if (x < -2 || y < -2 || x > w + 1 || y > h + 1) return null;
    return [Math.max(0, Math.min(w - 1, x)), Math.max(0, Math.min(h - 1, y))];
  }

  project(x, y) {
    const [px, py] = this.toWorld(x, y);
    const v = new THREE.Vector3(px, py, 0.2).project(this.camera);
    return [(v.x + 1) * 0.5 * this.host.clientWidth, (1 - v.y) * 0.5 * this.host.clientHeight];
  }

  // --- La boucle d'animation --------------------------------------------------------

  tween(duration, fn, ease = (t) => t) {
    return new Promise((resolve) => {
      if (duration <= 0 || Fx.reduced()) { fn(1); resolve(); return; }
      this.tweens.push({ t0: performance.now(), duration, fn, ease, resolve });
    });
  }

  tick(now) {
    this.last = now;
    const time = now / 1000;
    this.tweens = this.tweens.filter((tw) => {
      const k = Math.min(1, (now - tw.t0) / tw.duration);
      tw.fn(tw.ease(k), k);
      if (k >= 1) { tw.resolve(); return false; }
      return true;
    });

    const reduced = Fx.reduced();
    // Effets permanents : brillance, or, pion qui va partir, cible, ligne gagnante
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
    this.tokens.forEach((t) => {
      const g = t.group;
      if (t.spark) {
        const k = reduced ? 0.7 : Math.max(0, Math.sin(time * 1.9 + t.id * 2.3));
        t.spark.material.opacity = k * k;
        t.spark.material.rotation = time * 0.9 + t.id;
        const scale = 0.5 + k * 0.5;
        t.spark.scale.set(scale, scale, 1);
      }
      const marked = this.doomed === t.id;
      const target = this.targets && this.targets.includes(t.id);
      if (t.winT != null) {
        const w = 1.06 + 0.07 * Math.sin(time * 5 - t.winT);
        g.scale.setScalar(w);
      } else if (marked) {
        g.scale.setScalar(0.9 + 0.1 * pulse);
      } else if (target) {
        g.scale.setScalar(1 + 0.08 * pulse);
      } else if (t.scaleLocked !== true) {
        g.scale.setScalar(1);
      }
    });
    this.materials.forEach((m, key) => {
      if (key.startsWith("shine")) m.emissiveIntensity = 0.2 + 0.14 * Math.sin(time * 2.4);
    });
    if (this.winMesh) this.winMesh.material.opacity = 0.75 + 0.25 * Math.sin(time * 5);
    if (this.aim.visible) this.aim.rotation.z = time;
    if (this.hintMesh.visible) this.hintMesh.material.opacity = 0.22 + 0.16 * pulse;
    if (this.ringA) { this.ringA.rotation.z = time * 0.1; this.ringB.material.color.setHSL(0.72, 0.9, 0.62 + 0.1 * pulse); }
    this.fogGroup.children.forEach((f, i) => { f.rotation.z = time * 0.1 * (i % 2 ? 1 : -1) + i; });

    // Caméra
    this.dist += (this.distGoal - this.dist) * 0.1;
    const sway = reduced || this.down ? 0 : Math.sin(time * 0.35) * 0.018;
    const yaw = this.yaw + sway;
    const cx = Math.sin(yaw) * Math.cos(this.pitch) * this.dist;
    const cz = Math.cos(yaw) * Math.cos(this.pitch) * this.dist;
    const cy = Math.sin(this.pitch) * this.dist;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(0, 0, 0);
    if (document.hidden) return;
    this.renderer.render(this.scene, this.camera);
  }

  // --- Pions ------------------------------------------------------------------------

  material(color, skin) {
    const key = `${skin}|${color}`;
    let m = this.materials.get(key);
    if (m) return m;
    const base = new THREE.Color(color);
    switch (skin) {
      case "gold":
        m = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 1, roughness: 0.2, emissive: 0x4a2c00, emissiveIntensity: 0.5, envMapIntensity: 1.8 });
        break;
      case "shine":
        m = new THREE.MeshStandardMaterial({ color: base, metalness: 0.3, roughness: 0.1, emissive: base, emissiveIntensity: 0.2, envMapIntensity: 1 });
        break;
      default:
        m = new THREE.MeshStandardMaterial({ color: base, metalness: 0.05, roughness: 0.3, envMapIntensity: 0.6 });
    }
    this.materials.set(skin === "shine" ? "shine:" + key : key, m);
    this.materials.set(key, m);
    return m;
  }

  makeToken(id, owner, x, y) {
    const color = this.view.colors[owner] || "#ffd60a";
    const skin = this.view.skins[owner] || "classic";
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.tokenGeo, this.material(color, skin));
    body.castShadow = true;
    g.add(body);
    const dark = new THREE.Color(skin === "gold" ? "#a86f00" : Fx.shade(color, -0.3));
    const ringMat = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.5, metalness: skin === "gold" ? 1 : 0.1 });
    for (const z of [0.142, -0.142]) {
      const r = new THREE.Mesh(this.ringGeo, ringMat);
      r.position.z = z;
      g.add(r);
    }
    if (skin === "x") {
      const mat = new THREE.MeshBasicMaterial({ map: this.xTex, transparent: true, color: new THREE.Color(Fx.ink(color)), depthWrite: false, side: THREE.DoubleSide });
      for (const z of [0.146, -0.146]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), mat);
        p.position.z = z;
        g.add(p);
      }
    }
    const t = { id, owner, x, y, group: g };
    if (skin === "shine" || skin === "gold") {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.starTex, color: skin === "gold" ? 0xfff2b0 : 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      sp.position.set(0.17, 0.17, 0.22);
      g.add(sp);
      t.spark = sp;
    }
    const [px, py] = this.toWorld(x, y);
    g.position.set(px, py, 0);
    this.tokenGroup.add(g);
    this.tokens.set(id, t);
    return t;
  }

  mask() {
    const s = this.state;
    if (!s.o.fog || this.view.viewer == null || s.over) return null;
    return C4.visibleMask(s, this.view.viewer);
  }

  sync(state, view) {
    this.gen++;
    this.tweens.forEach((t) => t.resolve());
    this.tweens = [];
    this.state = C4.clone(state);
    if (view) {
      this.view = view;
    }
    this.rig.rotation.z = 0;
    this.rig.position.set(0, 0, 0);
    this.flash.intensity = 0;
    this.buildBoard();
    while (this.tokenGroup.children.length) this.tokenGroup.remove(this.tokenGroup.children[0]);
    this.tokens.clear();
    const mask = this.mask();
    const { w, h } = this.state;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = x + y * w;
        if (state.own[c] < 0 || (mask && !mask[c])) continue;
        this.makeToken(state.id[c], state.own[c], x, y);
      }
    }
    this.drawFog();
    this.drawCursor();
    this.drawHint();
    if (!this.win) this.removeWinMesh();
    this.fit();
  }

  drawFog() {
    while (this.fogGroup.children.length) this.fogGroup.remove(this.fogGroup.children[0]);
    const mask = this.mask();
    if (!mask) return;
    const { w, h } = this.state;
    const mat = new THREE.MeshBasicMaterial({ map: this.fogTex, color: 0xb9a9e8, transparent: true, opacity: 0.98, depthWrite: false, side: THREE.DoubleSide });
    const disc = new THREE.MeshBasicMaterial({ color: 0x1c1436, side: THREE.DoubleSide });
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask[x + y * w]) continue;
        const [px, py] = this.toWorld(x, y);
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), disc);
        d.position.set(px, py, 0);
        this.fogGroup.add(d);
        for (const z of [0.24, -0.24]) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), mat);
          p.position.set(px, py, z);
          this.fogGroup.add(p);
        }
      }
    }
  }

  setDoomed(id) { this.doomed = id; }
  setTargets(ids) { this.targets = ids; }
  setLocked(v) { this.locked = v; this.drawCursor(); }
  setCursor(c) { this.cursor = c; this.drawCursor(); }

  drawCursor() {
    const cur = this.locked ? null : this.cursor;
    this.ghost.visible = false;
    this.laneMesh.visible = false;
    this.aim.visible = false;
    if (!cur || !this.state) return;
    const { w, h, o } = this.state;
    const color = this.view.colors[cur.owner] || "#ffd60a";
    if (cur.kind === "lane") {
      const g = o.gravity;
      const vertical = C4.isVertical(g);
      this.ghost.material.color.set(this.view.skins[cur.owner] === "gold" ? "#ffc83d" : color);
      this.ghost.visible = true;
      if (vertical) {
        const [px] = this.toWorld(cur.lane, 0);
        this.ghost.position.set(px, g === "up" ? -h / 2 - 0.82 + 0.0 : h / 2 + 0.92, 0);
        this.laneMesh.scale.set(1, h, 1);
        this.laneMesh.position.set(px, 0, 0.24);
      } else {
        const [, py] = this.toWorld(0, cur.lane);
        this.ghost.position.set(g === "left" ? w / 2 + 0.92 : -w / 2 - 0.92, py, 0);
        this.laneMesh.scale.set(w, 1, 1);
        this.laneMesh.position.set(0, py, 0.24);
      }
      this.laneMesh.visible = true;
    } else if (cur.kind === "cell") {
      const [px, py] = this.toWorld(cur.x, cur.y);
      this.aim.position.set(px, py, 0.26);
      this.aim.material.color.set(cur.bomb ? 0xff4d6d : 0xffd60a);
      this.aim.visible = true;
      if (!cur.bomb) {
        this.ghost.material.color.set(this.view.skins[cur.owner] === "gold" ? "#ffc83d" : color);
        this.ghost.position.set(px, py, 0);
        this.ghost.visible = true;
      }
    }
  }

  setHint(h) { this.hint = h; this.drawHint(); }

  drawHint() {
    const hint = this.hint;
    this.hintMesh.visible = false;
    if (!hint || !this.state) return;
    const { w, h, o } = this.state;
    if (hint.cell) {
      const [px, py] = this.toWorld(hint.cell[0], hint.cell[1]);
      this.hintMesh.scale.set(1, 1, 1);
      this.hintMesh.position.set(px, py, 0.25);
    } else if (C4.isVertical(o.gravity)) {
      const [px] = this.toWorld(hint.lane, 0);
      this.hintMesh.scale.set(1, h, 1);
      this.hintMesh.position.set(px, 0, 0.25);
    } else {
      const [, py] = this.toWorld(0, hint.lane);
      this.hintMesh.scale.set(w, 1, 1);
      this.hintMesh.position.set(0, py, 0.25);
    }
    this.hintMesh.visible = true;
  }

  // --- Animations -------------------------------------------------------------------

  // Courbe de chute avec deux rebonds : 0 = départ, 1 = arrivée
  bounce(k) {
    if (k < 0.62) { const t = k / 0.62; return t * t; }
    if (k < 0.88) { const t = (k - 0.62) / 0.26; return 1 - 0.13 * 4 * t * (1 - t); }
    const t = (k - 0.88) / 0.12;
    return 1 - 0.035 * 4 * t * (1 - t);
  }

  fall(t, from, to, duration, withSound = true) {
    if (withSound) {
      setTimeout(() => {
        if (typeof Sound !== "undefined") Sound.clack(0.6);
        if (typeof Haptics !== "undefined") Haptics.buzz(15);
      }, duration * 0.62);
    }
    return this.tween(duration, (_, k) => {
      const b = this.bounce(k);
      t.group.position.x = from[0] + (to[0] - from[0]) * b;
      t.group.position.y = from[1] + (to[1] - from[1]) * b;
    });
  }

  fallTime(cells, speed) { return (280 + 170 * Math.sqrt(Math.max(1, cells))) / speed; }

  async play(events, state, speed = 1) {
    const my = ++this.gen;
    if (!speed) { this.sync(state); return; }
    const previous = this.state;
    const fogViewer = previous.o.fog && !state.over ? this.view.viewer : null;
    const finalMask = fogViewer != null ? C4.visibleMask(state, fogViewer) : null;

    for (const ev of events) {
      if (my !== this.gen) return;
      switch (ev.t) {
        case "place": {
          if (fogViewer != null && ev.owner !== fogViewer && !(finalMask && finalMask[ev.x + ev.y * previous.w])) break;
          await this.animPlace(ev, speed);
          break;
        }
        case "fall": {
          const items = ev.items.filter((i) => this.tokens.has(i.id));
          if (!items.length) break;
          const longest = Math.max(...items.map((i) => Math.hypot(i.x - i.x0, i.y - i.y0)));
          const time = this.fallTime(longest, speed);
          const jobs = items.map((i) => {
            const t = this.tokens.get(i.id);
            const from = t.group.position.toArray();
            t.x = i.x; t.y = i.y;
            return this.fall(t, from, this.toWorld(i.x, i.y), time, false);
          });
          setTimeout(() => { if (typeof Sound !== "undefined") Sound.clack(0.6); }, time * 0.62);
          await Promise.all(jobs);
          break;
        }
        case "remove": {
          const t = this.tokens.get(ev.id);
          if (!t) break;
          if (typeof Sound !== "undefined") Sound.erase();
          t.scaleLocked = true;
          await this.tween(420 / speed, (k) => {
            t.group.scale.setScalar(k < 0.3 ? 1 + k : 1.3 * (1 - (k - 0.3) / 0.7));
            t.group.rotation.y = k * 7;
            t.group.position.z = k * 0.9;
          });
          this.tokenGroup.remove(t.group);
          this.tokens.delete(ev.id);
          break;
        }
        case "crush": {
          if (typeof Sound !== "undefined") Sound.thud();
          await Promise.all(ev.items.map((i) => {
            const t = this.tokens.get(i.id);
            if (!t) return null;
            t.scaleLocked = true;
            const at = this.project(t.x, t.y);
            Fx.burst(this.host, 12, false, at, [this.view.colors[t.owner], "#ffffff"]);
            return this.tween(340 / speed, (k) => {
              t.group.scale.set(1 + k * 0.5, 1 - k, 1);
            }).then(() => {
              this.tokenGroup.remove(t.group);
              this.tokens.delete(i.id);
            });
          }));
          this.shake(0.1, 260 / speed);
          break;
        }
        case "bomb": {
          await this.animBomb(ev, speed);
          break;
        }
        case "rotate": {
          await this.animRotate(ev, speed);
          break;
        }
        case "out":
        case "surrender":
          if (typeof Sound !== "undefined") Sound.lose();
          break;
      }
    }
    if (my !== this.gen) return;
    this.sync(state);
  }

  async animPlace(ev, speed) {
    const { w, h, o } = this.state;
    const t = this.makeToken(ev.id, ev.owner, ev.x, ev.y);
    const to = this.toWorld(ev.x, ev.y);
    const g = t.group;
    if (o.gravity === "none") {
      if (typeof Sound !== "undefined") Sound.clack(0.6);
      t.scaleLocked = true;
      await this.tween(320 / speed, (k) => {
        g.position.z = 3.5 * (1 - k) * (1 - k);
        g.rotation.y = (1 - k) * 4;
      });
      g.rotation.y = 0;
      t.scaleLocked = false;
      return;
    }
    const from = to.slice();
    switch (o.gravity) {
      case "up": from[1] = -h / 2 - 0.82; break;
      case "left": from[0] = w / 2 + 0.92; break;
      case "right": from[0] = -w / 2 - 0.92; break;
      default: from[1] = h / 2 + 0.92;
    }
    g.position.set(from[0], from[1], 0);
    await this.fall(t, from, to, this.fallTime(Math.hypot(from[0] - to[0], from[1] - to[1]), speed));
  }

  shake(power, duration) {
    this.tween(duration, (_, k) => {
      const f = (1 - k) * power;
      this.rig.position.set(Math.sin(k * 60) * f, Math.cos(k * 47) * f * 0.6, 0);
    }).then(() => this.rig.position.set(0, 0, 0));
  }

  async animBomb(ev, speed) {
    const [px, py] = this.toWorld(ev.x, ev.y);
    const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshStandardMaterial({ color: 0x15131c, roughness: 0.35, metalness: 0.5 }));
    const fuse = new THREE.PointLight(0xff6020, 1.6, 4);
    bomb.add(fuse);
    this.rig.add(bomb);
    if (typeof Sound !== "undefined") Sound.whoosh(0.45 / speed);
    await this.tween(460 / speed, (k) => {
      bomb.position.set(px, py + (1 - k) * (1 - k) * 2, 0.5 + (1 - k) * (1 - k) * 8);
      bomb.rotation.x = k * 7;
    });
    this.rig.remove(bomb);
    bomb.geometry.dispose();
    if (typeof Sound !== "undefined") Sound.boom();
    if (typeof Haptics !== "undefined") Haptics.buzz([60, 30, 120]);
    const at = this.project(ev.x, ev.y);
    Fx.burst(this.host, 46, false, at, ["#ffd60a", "#ff8a00", "#ff4d6d", "#ffffff", this.view.colors[ev.owner] || "#fff"]);
    const blast = document.createElement("span");
    blast.className = "blast";
    blast.style.left = at[0] + "px";
    blast.style.top = at[1] + "px";
    blast.style.setProperty("--s", "170px");
    this.host.appendChild(blast);
    blast.addEventListener("animationend", () => blast.remove());
    this.flash.position.set(px, py, 2);
    this.tween(620 / speed, (k) => { this.flash.intensity = 7 * (1 - k); });
    this.shake(0.34, 560);
    const t = this.tokens.get(ev.id);
    if (t) { this.tokenGroup.remove(t.group); this.tokens.delete(ev.id); }
    await Fx.wait(220 / speed);
  }

  async animRotate(ev, speed) {
    if (typeof Sound !== "undefined") Sound.rumble(0.8 / speed);
    this.setCursor(null);
    this.boardGroup.children.filter((c) => c.isSprite).forEach((c) => { c.visible = false; });
    const ease = (k) => {
      if (k < 0.16) return -0.09 * Math.sin((k / 0.16) * Math.PI * 0.5);
      const t = (k - 0.16) / 0.84;
      const s = 1 - Math.pow(1 - t, 3);
      return -0.09 + 1.09 * s + 0.05 * Math.sin(t * Math.PI);
    };
    await this.tween(820 / speed, (_, k) => { this.rig.rotation.z = (-Math.PI / 2) * ease(k); });
    // Nouvelle disposition, la grille est maintenant couchée dans l'autre sens
    const view = C4.clone(this.state);
    view.w = ev.w; view.h = ev.h;
    this.state = view;
    this.rig.rotation.z = 0;
    this.buildBoard();
    this.tokens.forEach((t) => {
      const nx = ev.h0 - 1 - t.y, ny = t.x;
      t.x = nx; t.y = ny;
      const [px, py] = this.toWorld(nx, ny);
      t.group.position.set(px, py, 0);
    });
    this.fit();
  }

  // --- Ligne gagnante ---------------------------------------------------------------

  removeWinMesh() {
    if (this.winMesh) {
      this.rig.remove(this.winMesh);
      this.winMesh.geometry.dispose();
      this.winMesh = null;
    }
    this.tokens.forEach((t) => { t.winT = null; });
  }

  showWin(line, bad) {
    this.win = line ? { line, bad } : null;
    this.removeWinMesh();
    if (!line) return;
    const s = this.state;
    const at = (c) => this.toWorld(c % s.w, (c / s.w) | 0);
    const a = at(line[0]), b = at(line[line.length - 1]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const geo = new THREE.CylinderGeometry(0.075, 0.075, 1, 12);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: bad ? 0xff4d6d : 0xffd60a, transparent: true }));
    mesh.position.set(a[0], a[1], 0.24);
    mesh.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2;
    mesh.scale.y = 0.001;
    this.rig.add(mesh);
    this.winMesh = mesh;
    this.tween(520, (k) => { mesh.scale.y = Math.max(0.001, len * k); }, (k) => 1 - Math.pow(1 - k, 3));
    line.forEach((c, i) => {
      const t = this.tokens.get(s.id[c]);
      if (t) t.winT = i * 0.8;
    });
  }

  clearWin() { this.win = null; this.removeWinMesh(); }
}
