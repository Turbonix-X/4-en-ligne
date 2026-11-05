// ===== Le plateau en 3D (Three.js r128), avec les mêmes méthodes que Board2D =====
// Glisser fait tourner la caméra, un simple clic ou tap joue.
// Le décor : façade en fibre avec anneaux incrustés, cadre doré riveté, peigne d'entrée, socle gravé,
// tapis de feutrine, réserves de pions, lumières et poussières qui flottent.

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
    this.particles = [];
    this.cursor = null;
    this.hint = null;
    this.targets = null;
    this.doomed = null;
    this.locked = true;
    this.win = null;
    this.yaw = -0.34;
    this.pitch = 0.13;
    this.dist = 14;
    this.distGoal = 14;
    this.lookY = 0;
    this.distMul = 1;
    this.yawOff = 0;
    this.focus = null;
    this.focusK = 0;
    this.wobble = 0;
    this.materials = new Map();
    this.sparkMats = new Map();
    this.boardKey = "";
    this.pileKey = "";
    this.introDone = false;
    this.turnColor = new THREE.Color(0x9b6dff);
    this.turnGoal = new THREE.Color(0x9b6dff);

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
    this.piles = new THREE.Group();
    this.scene.add(this.piles);

    this.buildTextures();
    this.buildLights();
    this.buildEnv();
    this.buildShared();
    this.buildAmbience();
    this.buildFog();

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
          this.pitch = Math.max(-0.2, Math.min(0.85, this.down.pitch + dy * 0.005));
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

  // --- Textures dessinées à la main --------------------------------------------------

  texture(width, draw, height = width) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    draw(c.getContext("2d"), width, height);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }

  buildTextures() {
    // Un halo doux, pour toutes les lueurs
    this.glowTex = this.texture(128, (g, s) => {
      const c = s / 2;
      const grad = g.createRadialGradient(c, c, 0, c, c, c);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.25, "rgba(255,255,255,.5)");
      grad.addColorStop(0.6, "rgba(255,255,255,.12)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    });
    // L'étincelle à 4 branches du logo
    this.starTex = this.texture(128, (g, s) => {
      const c = s / 2;
      const grad = g.createRadialGradient(c, c, 0, c, c, c * 0.5);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
      g.fillStyle = "#fff";
      g.beginPath();
      g.moveTo(c, 0);
      g.quadraticCurveTo(c, c, s, c);
      g.quadraticCurveTo(c, c, c, s);
      g.quadraticCurveTo(c, c, 0, c);
      g.quadraticCurveTo(c, c, c, 0);
      g.fill();
    });
    this.xTex = this.texture(128, (g, s) => {
      g.lineCap = "round";
      g.lineWidth = s * 0.17;
      g.strokeStyle = "#ffffff";
      g.beginPath();
      g.moveTo(s * 0.27, s * 0.27); g.lineTo(s * 0.73, s * 0.73);
      g.moveTo(s * 0.73, s * 0.27); g.lineTo(s * 0.27, s * 0.73);
      g.stroke();
    });
    // La fibre tressée de la façade (relief et légères variations de couleur)
    const weave = (g, s, a, b) => {
      const n = 8, u = s / n;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const over = (x + y) % 2 === 0;
          const grad = over ? g.createLinearGradient(x * u, 0, (x + 1) * u, 0) : g.createLinearGradient(0, y * u, 0, (y + 1) * u);
          grad.addColorStop(0, a);
          grad.addColorStop(0.5, b);
          grad.addColorStop(1, a);
          g.fillStyle = grad;
          g.fillRect(x * u, y * u, u, u);
        }
      }
    };
    this.weaveBump = this.texture(128, (g, s) => weave(g, s, "#303030", "#e0e0e0"));
    this.weaveBump.encoding = THREE.LinearEncoding;
    this.weaveMap = this.texture(128, (g, s) => weave(g, s, "#dcd8e6", "#ffffff"));
    for (const t of [this.weaveBump, this.weaveMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1.5, 1.5);
      t.anisotropy = 8;
    }
    // Le faisceau qui descend dans le couloir visé (fort en haut, nul en bas)
    this.beamTex = this.texture(16, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(255,255,255,.75)");
      grad.addColorStop(1, "rgba(255,255,255,.04)");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    }, 128);
    // La tranche crantée des pions : des stries seulement sur le bord
    this.knurl = null; // Créée avec la forme du pion
    this.feltTex = this.texture(1024, (g, s) => {
      const c = s / 2;
      const base = g.createRadialGradient(c, c, 0, c, c, c);
      base.addColorStop(0, "#3a2670");
      base.addColorStop(0.55, "#241744");
      base.addColorStop(0.86, "#150e2b");
      base.addColorStop(1, "rgba(13,9,28,0)");
      g.fillStyle = base;
      g.fillRect(0, 0, s, s);
      // Le grain de la feutrine
      for (let k = 0; k < 16000; k++) {
        const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * c * 0.92;
        g.fillStyle = k % 2 ? "rgba(255,255,255,.028)" : "rgba(0,0,0,.09)";
        g.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.6, 1.6);
      }
      // Le X en filigrane
      g.save();
      g.translate(c, c);
      g.globalAlpha = 0.14;
      g.fillStyle = "#ffd60a";
      const u = s * 0.11;
      g.beginPath();
      g.moveTo(-u, -u); g.lineTo(-u * 0.55, -u); g.lineTo(u, u); g.lineTo(u * 0.55, u); g.closePath();
      g.moveTo(u, -u); g.lineTo(u * 0.55, -u); g.lineTo(-u, u); g.lineTo(-u * 0.55, u); g.closePath();
      g.fill();
      g.restore();
    });
    // La plaque gravée du socle
    this.plaqueTex = this.texture(512, (g, w, h) => {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#2a2533");
      bg.addColorStop(1, "#111017");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#ffd60a";
      g.lineWidth = 5;
      g.strokeRect(5, 5, w - 10, h - 10);
      const gold = g.createLinearGradient(0, 22, 0, h - 22);
      gold.addColorStop(0, "#fff6a8");
      gold.addColorStop(0.5, "#ffd60a");
      gold.addColorStop(1, "#d99a00");
      g.fillStyle = gold;
      const m = h / 2, z = 30, x0 = 62;
      g.beginPath();
      g.moveTo(x0 - z, m - z); g.lineTo(x0 - z * 0.45, m - z); g.lineTo(x0 + z, m + z); g.lineTo(x0 + z * 0.45, m + z); g.closePath();
      g.moveTo(x0 + z, m - z); g.lineTo(x0 + z * 0.45, m - z); g.lineTo(x0 - z, m + z); g.lineTo(x0 - z * 0.45, m + z); g.closePath();
      g.fill();
      g.font = "900 56px Outfit, Segoe UI, sans-serif";
      g.textBaseline = "middle";
      g.fillText("TURBONIX", 112, m + 3);
    }, 96);
  }

  // --- Lumières ------------------------------------------------------------------------

  buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xd9ccff, 0x1a1030, 0.14));
    const key = new THREE.DirectionalLight(0xfff4dd, 0.72);
    key.position.set(-6, 13, 14);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005;
    key.shadow.radius = 6;
    s.add(key);
    this.key = key;
    const fill = new THREE.DirectionalLight(0x9b6dff, 0.14);
    fill.position.set(10, 2, 9);
    s.add(fill);
    const yellow = new THREE.PointLight(0xffd60a, 0.45, 40);
    yellow.position.set(-10, 7, -6);
    s.add(yellow);
    const mauve = new THREE.PointLight(0x9b6dff, 0.55, 40);
    mauve.position.set(10, 5, -6);
    s.add(mauve);
    // Une lumière de la couleur du joueur dont c'est le tour
    this.turnLight = new THREE.PointLight(0xffffff, 0.16, 26);
    this.turnLight.position.set(0, 2, 7);
    s.add(this.turnLight);
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
    add(0x55525e, 0, 9, 3, 14, 7);
    add(0x6b5f3c, -9, 2, 5, 6, 10);
    add(0x3a2866, 9, 0, 3, 6, 12);
    add(0x4a3c08, 0, -8, 5, 12, 4);
    add(0xffffff, 3, 3, 10, 2.4, 2.4);
    add(0xffffff, -4, 5, 8, 1.2, 3);
    add(0xfff2c0, 6, -2, 8, 0.8, 4);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pm.fromScene(env, 0.03).texture;
    pm.dispose();
    this.scene.environment = this.envMap;
  }

  buildShared() {
    // Le pion : rebord surélevé, face creusée, sillon central. Comme un vrai jeton.
    const R = 0.435, T = 0.15, C = 0.108;
    const upper = [
      [R, 0.0], [R, 0.075], [R - 0.012, 0.118], [R - 0.038, 0.142], [R - 0.07, T], [R - 0.1, 0.143],
      [R - 0.122, 0.122], [R - 0.14, C], [0.21, C], [0.197, C - 0.012], [0.172, C - 0.012], [0.16, C], [0, C],
    ];
    const lower = upper.slice(1).reverse().map(([r, y]) => [r, -y]);
    const pts = lower.concat(upper).map(([r, y]) => new THREE.Vector2(r, y));
    this.tokenGeo = new THREE.LatheGeometry(pts, 56);
    this.tokenGeo.rotateX(Math.PI / 2);

    // Les crans de la tranche : seule la bande du bord porte les stries
    const n = pts.length - 1;
    const first = pts.findIndex((p) => p.x >= R - 0.0001) / n;
    let lastIdx = 0;
    pts.forEach((p, i) => { if (p.x >= R - 0.0001) lastIdx = i; });
    const lastV = lastIdx / n;
    this.knurl = this.texture(1024, (g, w, h) => {
      g.fillStyle = "#808080";
      g.fillRect(0, 0, w, h);
      const top = (1 - lastV) * h, bottom = (1 - first) * h;
      for (let k = 0; k < 90; k++) {
        const x = (k / 90) * w;
        g.fillStyle = "#ffffff";
        g.fillRect(x, top, (w / 90) * 0.45, bottom - top);
        g.fillStyle = "#000000";
        g.fillRect(x + (w / 90) * 0.5, top, (w / 90) * 0.45, bottom - top);
      }
    }, 128);
    this.knurl.encoding = THREE.LinearEncoding;

    this.pipGeo = new THREE.PlaneGeometry(0.46, 0.46);
    this.debrisGeo = new THREE.BoxGeometry(0.1, 0.1, 0.05);

    const beamMat = new THREE.MeshBasicMaterial({ map: this.beamTex, color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.laneMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), beamMat);
    this.laneMesh.visible = false;
    this.laneMesh.renderOrder = 6;
    this.rig.add(this.laneMesh);
    this.hintMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
    this.hintMesh.visible = false;
    this.hintMesh.renderOrder = 6;
    this.rig.add(this.hintMesh);
    this.aim = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true }));
    this.aim.visible = false;
    this.aim.renderOrder = 7;
    this.rig.add(this.aim);
    this.ghost = new THREE.Mesh(this.tokenGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, roughness: 0.25 }));
    this.ghost.visible = false;
    this.ghost.renderOrder = 7;
    this.rig.add(this.ghost);
  }

  // La lueur derrière le plateau et les poussières
  buildAmbience() {
    this.backGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0x9b6dff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.backGlow.position.set(0, 0, -3);
    this.scene.add(this.backGlow);

    const N = 140;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const yellow = new THREE.Color(0xffe45c), mauve = new THREE.Color(0xc9b0ff);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 26;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 2] = (Math.random() - 0.65) * 16;
      const c = i % 3 ? mauve : yellow;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ map: this.glowTex, size: 0.2, transparent: true, opacity: 0.7, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.scene.add(this.dust);
  }

  buildFog() {
    this.fog = new FogField(document.createElement("canvas"));
    this.fogTex = new THREE.CanvasTexture(this.fog.canvas);
    this.fogTex.encoding = THREE.sRGBEncoding;
    this.fogMeshes = [];
    // Un nuage devant, un derrière, et un voile plus léger en avant pour donner du volume
    [[0.3, 1, 1], [-0.3, 1, 1], [0.62, 0.4, 1.03]].forEach(([z, opacity, scale]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.fogTex, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
      m.position.z = z;
      m.renderOrder = 4;
      m.userData.scale = scale;
      this.fogGroup.add(m);
      this.fogMeshes.push(m);
    });
    this.fogGroup.visible = false;
    this.lastFog = 0;
  }

  toWorld(x, y) {
    const { w, h } = this.state;
    return [x - (w - 1) / 2, (h - 1) / 2 - y];
  }

  // --- Le plateau et son décor (refaits seulement si la taille change) -----------------------

  buildBoard() {
    const { w, h, o } = this.state;
    const key = `${w}x${h}x${o.gravity}x${o.rotate ? 1 : 0}`;
    if (key === this.boardKey) return;
    this.boardKey = key;
    const dispose = (group) => {
      while (group.children.length) {
        const c = group.children.pop();
        c.traverse((n) => {
          if (n.geometry) n.geometry.dispose();
          if (n.isSprite && n.material.map) n.material.map.dispose();
        });
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

    // La façade percée, en fibre tressée
    const shape = rounded(new THREE.Shape(), W, H, 0.34);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [px, py] = this.toWorld(x, y);
        const hole = new THREE.Path();
        hole.absarc(px, py, 0.445, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
    }
    const plateGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.38, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 20 });
    plateGeo.translate(0, 0, -0.19);
    const plate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({
      color: 0x3a1f9c, map: this.weaveMap, bumpMap: this.weaveBump, bumpScale: 0.003,
      roughness: 0.4, metalness: 0.25, envMapIntensity: 0.8,
    }));
    plate.castShadow = true;
    plate.receiveShadow = true;
    this.boardGroup.add(plate);

    // Un anneau métallique incrusté autour de chaque trou, sur les deux faces
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xa98cf0, metalness: 0.95, roughness: 0.24, envMapIntensity: 1.3 });
    const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(0.452, 0.024, 10, 40), ringMat, w * h * 2);
    const m4 = new THREE.Matrix4();
    let idx = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [px, py] = this.toWorld(x, y);
        for (const z of [0.208, -0.208]) {
          m4.makeTranslation(px, py, z);
          rings.setMatrixAt(idx++, m4);
        }
      }
    }
    this.boardGroup.add(rings);

    // Le cadre doré
    const frameShape = rounded(new THREE.Shape(), W + 0.16, H + 0.16, 0.44);
    frameShape.holes.push(rounded(new THREE.Path(), W - 0.02, H - 0.02, 0.32));
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.54, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 4, curveSegments: 14 });
    frameGeo.translate(0, 0, -0.27);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffb700, roughness: 0.26, metalness: 0.92, emissive: 0x1c1000, envMapIntensity: 1.5 });
    const frame = new THREE.Mesh(frameGeo, goldMat);
    frame.castShadow = true;
    this.boardGroup.add(frame);

    // Un filet mauve lumineux sur le cadre
    const lineShape = rounded(new THREE.Shape(), W + 0.075, H + 0.075, 0.38);
    lineShape.holes.push(rounded(new THREE.Path(), W + 0.04, H + 0.04, 0.36));
    const line = new THREE.Mesh(new THREE.ShapeGeometry(lineShape, 12), new THREE.MeshBasicMaterial({ color: 0xc4a8ff }));
    line.position.z = 0.315;
    this.boardGroup.add(line);
    this.frameLine = line;

    // Les rivets sur le pourtour
    const spots = [];
    const stepX = (2 * W) / Math.max(2, Math.round(W)), stepY = (2 * H) / Math.max(2, Math.round(H));
    for (let x = -W + 0.1; x <= W - 0.1 + 0.01; x += (2 * W - 0.2) / Math.max(2, Math.round(stepX * w / 2))) {
      spots.push([x, H + 0.08], [x, -H - 0.08]);
    }
    for (let y = -H + 0.1 + stepY / 2; y < H - 0.1; y += stepY) {
      spots.push([W + 0.08, y], [-W - 0.08, y]);
    }
    const rivets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.038, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff2b0, metalness: 1, roughness: 0.2, envMapIntensity: 1.8 }), spots.length);
    spots.forEach(([x, y], i) => {
      m4.makeTranslation(x, y, 0.312);
      rivets.setMatrixAt(i, m4);
    });
    this.boardGroup.add(rivets);

    this.addComb(goldMat);
    this.addKeys();
    this.buildStand(W, H);
    this.fit();
  }

  // Le peigne d'entrée : des ailettes entre les couloirs, du côté où les pions arrivent
  addComb(goldMat) {
    const { w, h, o } = this.state;
    const g = o.gravity;
    if (g === "none") return;
    const vertical = C4.isVertical(g);
    const n = vertical ? w : h;
    const sign = g === "up" || g === "left" ? -1 : 1;
    const dark = new THREE.MeshStandardMaterial({ color: 0x3d2299, roughness: 0.35, metalness: 0.5 });
    const fin = new THREE.BoxGeometry(0.05, 0.62, 0.42);
    const tip = new THREE.SphereGeometry(0.05, 12, 8);
    const start = (vertical ? h : w) / 2 + 0.34 + 0.16;
    for (let l = 0; l <= n; l++) {
      const along = l - n / 2;
      const f = new THREE.Mesh(fin, dark);
      const t = new THREE.Mesh(tip, goldMat);
      const out = start + 0.3;
      if (vertical) {
        f.position.set(along, sign * out, 0);
        t.position.set(along, sign * (out + 0.32), 0);
      } else {
        f.rotation.z = Math.PI / 2;
        // Gauche : les pions arrivent par la droite. Droite : par la gauche.
        const side = g === "left" ? 1 : -1;
        f.position.set(side * out, along, 0);
        t.position.set(side * (out + 0.32), along, 0);
      }
      f.castShadow = true;
      this.boardGroup.add(f, t);
    }
  }

  addKeys() {
    // Les numéros des touches ne servent à rien sur un écran tactile, comme en 2D
    if (matchMedia("(hover: none)").matches) return;
    const { w, h, o } = this.state;
    const g = o.gravity;
    const vertical = C4.isVertical(g);
    const n = Math.min(10, vertical ? w : h);
    for (let l = 0; l < n; l++) {
      const label = l === 9 ? "0" : String(l + 1);
      const tex = this.texture(64, (ctx, s) => {
        ctx.beginPath();
        ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(13,12,18,.82)";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,214,10,.8)";
        ctx.stroke();
        ctx.fillStyle = "#ffe45c";
        ctx.font = `800 ${s * 0.46}px Outfit, Segoe UI, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, s / 2, s / 2 + 2);
      });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.scale.set(0.46, 0.46, 1);
      if (vertical) {
        const [px] = this.toWorld(l, 0);
        sp.position.set(px, g === "up" ? -h / 2 - 1.62 : h / 2 + (g === "none" ? 0.86 : 1.62), 0.1);
      } else {
        const [, py] = this.toWorld(0, l);
        sp.position.set(g === "left" ? w / 2 + 1.62 : -w / 2 - 1.62, py, 0.1);
      }
      this.boardGroup.add(sp);
    }
  }

  // Le socle, les montants et le tapis : ils ne tournent pas avec la grille
  buildStand(W, H) {
    const { w, h, o } = this.state;
    const diag = Math.hypot(w, h) / 2 + 0.6;
    // En mode rotation, il faut assez de place sous la grille pour qu'elle tourne sans toucher le tapis
    const entryBelow = o.gravity === "up" ? 1.05 : 0;
    const floorY = o.rotate ? -(diag + 0.4) : -(h / 2 + 1.15 + entryBelow);
    this.floorY = floorY;
    const size = Math.max(w, h);

    const R = size * 1.05 + 4;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 72), new THREE.MeshStandardMaterial({ map: this.feltTex, color: 0x8a8a8a, transparent: true, roughness: 0.96, metalness: 0, envMapIntensity: 0.12 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = floorY;
    floor.receiveShadow = true;
    this.decor.add(floor);

    const ring = (radius, color, thick) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(radius, thick, 8, 128), new THREE.MeshBasicMaterial({ color }));
      m.rotation.x = Math.PI / 2;
      m.position.y = floorY + 0.03;
      this.decor.add(m);
      return m;
    };
    this.ringA = ring(R * 0.74, 0xffd60a, 0.045);
    this.ringB = ring(R * 0.66, 0x9b6dff, 0.03);
    // Des plots lumineux tout autour de l'anneau
    const studN = 28;
    const studs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }), studN);
    const m4 = new THREE.Matrix4();
    for (let k = 0; k < studN; k++) {
      const a = (k / studN) * Math.PI * 2;
      m4.makeTranslation(Math.cos(a) * R * 0.7, floorY + 0.05, Math.sin(a) * R * 0.7);
      studs.setMatrixAt(k, m4);
    }
    this.decor.add(studs);

    // Le socle à gradins
    const baseW = Math.max(3.4, Math.min(w, size) * 0.72);
    const dark = new THREE.MeshStandardMaterial({ color: 0x241545, roughness: 0.4, metalness: 0.6, envMapIntensity: 1 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc81f, roughness: 0.25, metalness: 0.95, envMapIntensity: 1.5 });
    const slab = (bw, bh, bd, y, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      m.position.y = y;
      m.castShadow = true;
      m.receiveShadow = true;
      this.decor.add(m);
      return m;
    };
    slab(baseW + 0.5, 0.16, 2.1, floorY + 0.08, dark);
    slab(baseW + 0.56, 0.035, 2.16, floorY + 0.175, gold);
    slab(baseW, 0.34, 1.7, floorY + 0.36, dark);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28), new THREE.MeshStandardMaterial({ map: this.plaqueTex, roughness: 0.35, metalness: 0.4 }));
    plaque.position.set(0, floorY + 0.36, 0.856);
    this.decor.add(plaque);

    // Les montants
    const metal = new THREE.MeshStandardMaterial({ color: 0xcdb6ff, metalness: 0.95, roughness: 0.25, envMapIntensity: 1.4 });
    const standTop = floorY + 0.53;
    if (o.rotate) {
      // Un axe derrière le centre de la grille, autour duquel elle tourne
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, -standTop, 24), metal);
      post.position.set(0, standTop / 2, -0.62);
      post.castShadow = true;
      this.decor.add(post);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 40), gold);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(0, 0, -0.5);
      this.decor.add(hub);
    } else {
      const bottom = -(H + 0.16);
      const len = Math.max(0.1, bottom - standTop);
      [-1, 1].forEach((side) => {
        const x = side * Math.min(baseW / 2 - 0.5, W * 0.5);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, len + 0.1, 20), metal);
        leg.position.set(x, standTop + len / 2, 0);
        leg.castShadow = true;
        this.decor.add(leg);
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), gold);
        collar.position.set(x, standTop + 0.03, 0);
        this.decor.add(collar);
      });
    }

    // La lumière et l'ombre s'adaptent à la taille de la grille
    const span = size + 5;
    const cam = this.key.shadow.camera;
    cam.left = -span; cam.right = span; cam.top = span; cam.bottom = -span;
    cam.far = 70;
    cam.updateProjectionMatrix();
    this.backGlow.scale.set(size * 2.6 + 6, size * 2.4 + 6, 1);
    this.pileKey = "";
  }

  // Les réserves de pions posées sur le tapis
  updatePiles() {
    const s = this.state;
    const { w, h, o } = s;
    const cells = w * h;
    const left = s.count.map((n) => {
      const total = o.limit ? o.limit : Math.floor(cells / o.players);
      return Math.max(0, Math.min(9, total - n));
    });
    const key = left.join() + this.view.colors.join() + this.view.skins.join() + this.boardKey;
    if (key === this.pileKey) return;
    this.pileKey = key;
    while (this.piles.children.length) this.piles.remove(this.piles.children[0]);
    // Sur les côtés de la grille, pour ne jamais cacher une case
    const side = w / 2 + 1.05;
    const spots = [[-side, 0.7], [side, 0.7], [-side - 0.05, 2], [side + 0.05, 2]];
    left.forEach((n, p) => {
      const mat = this.material(this.view.colors[p] || "#ffd60a", this.view.skins[p] || "classic");
      const [x, z] = spots[p];
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(this.tokenGeo, mat);
        m.rotation.x = Math.PI / 2;
        const jitter = (k * 37 + p * 13) % 7;
        m.position.set(x + (jitter - 3) * 0.009, this.floorY + 0.17 + k * 0.295, z + ((jitter * 3) % 7 - 3) * 0.009);
        m.castShadow = true;
        this.piles.add(m);
      }
    });
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
    const entryTop = g === "down" ? 2 : g === "none" ? 1.1 : 0.6;
    const top = (o.rotate ? Math.max(h / 2, Math.hypot(w, h) / 2 - 0.5) : h / 2) + entryTop;
    // On garde de la place en bas pour le socle et les réserves de pions, plus près de la caméra
    const bottom = (this.floorY != null ? -this.floorY : h / 2 + 1) + 1.15;
    this.lookY = (top - bottom) / 2;
    const halfH = (top + bottom) / 2;
    const entrySide = g === "left" || g === "right" ? 2 : 0;
    const halfW = w / 2 + 1.45 + entrySide;
    this.distGoal = Math.max(halfH / tan, halfW / (tan * aspect)) * 1.07 + 0.5;
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
    if (x < -3 || y < -3 || x > w + 2 || y > h + 2) return null;
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
      if (duration <= 0 || Fx.reduced()) { fn(1, 1); resolve(); return; }
      this.tweens.push({ t0: performance.now(), duration, fn, ease, resolve });
    });
  }

  tick(now) {
    const dtMs = Math.min(100, now - this.last);
    const dt = dtMs / 1000;
    this.last = now;
    const time = now / 1000;
    this.tweens = this.tweens.filter((tw) => {
      const k = Math.min(1, (now - tw.t0) / tw.duration);
      tw.fn(tw.ease(k), k);
      if (k >= 1) { tw.resolve(); return false; }
      return true;
    });

    // Éclats et étincelles
    this.particles = this.particles.filter((p) => {
      p.life -= dt / p.total;
      if (p.life <= 0) { this.rig.remove(p.obj); return false; }
      p.vy -= p.gravity * dt;
      p.obj.position.x += p.vx * dt;
      p.obj.position.y += p.vy * dt;
      p.obj.position.z += p.vz * dt;
      if (p.spin) { p.obj.rotation.x += p.spin * dt; p.obj.rotation.y += p.spin * 0.7 * dt; }
      const k = p.base * Math.min(1, p.life * 2);
      p.obj.scale.set(k, k, k);
      return true;
    });

    const reduced = Fx.reduced();
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
    this.tokens.forEach((t) => {
      const g = t.group;
      if (t.spark) {
        const k = reduced ? 0.7 : Math.max(0, Math.sin(time * 1.9 + t.id * 2.3));
        t.spark.material.opacity = k * k;
        t.spark.material.rotation = time * 0.9 + t.id;
        const scale = 0.25 + k * 0.45;
        t.spark.scale.set(scale, scale, 1);
      }
      if (t.halo) {
        t.halo.material.opacity = 0.2 + 0.14 * Math.sin(time * 2.4 + t.id);
      }
      const marked = this.doomed === t.id;
      const target = this.targets && this.targets.includes(t.id);
      if (t.winT != null) {
        g.scale.setScalar(1.08 + 0.07 * Math.sin(time * 5 - t.winT));
        if (t.winHalo) t.winHalo.material.opacity = 0.55 + 0.3 * Math.sin(time * 5 - t.winT);
      } else if (marked) {
        g.scale.setScalar(0.9 + 0.1 * pulse);
      } else if (target) {
        g.scale.setScalar(1 + 0.08 * pulse);
      } else if (t.scaleLocked !== true) {
        g.scale.setScalar(1);
      }
    });
    this.materials.forEach((m, key) => {
      if (key.startsWith("shine")) m.emissiveIntensity = 0.1 + 0.08 * Math.sin(time * 2.4);
    });
    if (this.winMesh) this.winMesh.material.opacity = 0.75 + 0.25 * Math.sin(time * 5);
    if (this.winGlow) this.winGlow.material.opacity = 0.35 + 0.2 * Math.sin(time * 5);
    if (this.aim.visible) this.aim.rotation.z = time;
    if (this.hintMesh.visible) this.hintMesh.material.opacity = 0.22 + 0.16 * pulse;

    // Le pion qui attend : il flotte et se balance
    if (this.ghost.visible && !reduced) {
      this.ghost.position.y = this.ghostY + (this.ghostFloat ? Math.sin(time * 3.4) * 0.05 : 0);
      this.ghost.rotation.y = Math.sin(time * 2) * 0.28;
    }

    // Les lumières suivent le joueur dont c'est le tour
    this.turnColor.lerp(this.turnGoal, 0.06);
    this.turnLight.color.copy(this.turnColor);
    this.backGlow.material.color.copy(this.turnColor);
    this.backGlow.material.opacity = 0.26 + 0.07 * Math.sin(time * 1.2);
    if (this.ringA) {
      this.ringB.material.color.setHSL(0.72, 0.9, 0.62 + 0.1 * pulse);
    }
    if (this.frameLine) this.frameLine.material.color.copy(this.turnColor).lerp(new THREE.Color(0xffffff), 0.3);
    if (!reduced) {
      const pos = this.dust.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * (0.1 + (i % 5) * 0.035);
        if (y > 9) y = -9;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      this.dust.rotation.y = Math.sin(time * 0.05) * 0.2;
    }

    // Le choc d'un pion fait vibrer tout le plateau
    this.wobble *= Math.pow(0.0015, dt);
    this.rig.rotation.x = this.wobble * Math.sin(time * 34);

    // Le brouillard
    if (this.fog.active && now - this.lastFog > 33) {
      this.lastFog = now;
      this.fog.draw(now);
      this.fogTex.needsUpdate = true;
      if (!this.fog.active) this.fogGroup.visible = false;
    }

    // Caméra : un léger balancement, et elle s'approche de la ligne gagnante
    this.focusK += ((this.focus ? 1 : 0) - this.focusK) * Math.min(1, dt * 2.2);
    const dGoal = this.distGoal * this.distMul * (1 - this.focusK * 0.14);
    this.dist += (dGoal - this.dist) * Math.min(1, dt * 6);
    const sway = reduced || this.down ? 0 : Math.sin(time * 0.35) * 0.02;
    const yaw = this.yaw + sway + this.yawOff;
    const lookX = this.focus ? this.focus[0] * this.focusK * 0.6 : 0;
    const lookY = this.lookY + (this.focus ? (this.focus[1] - this.lookY) * this.focusK * 0.6 : 0);
    this.camera.position.set(
      lookX + Math.sin(yaw) * Math.cos(this.pitch) * this.dist,
      lookY + Math.sin(this.pitch) * this.dist,
      Math.cos(yaw) * Math.cos(this.pitch) * this.dist,
    );
    this.camera.lookAt(lookX, lookY, 0);
    if (document.hidden) return;
    this.renderer.render(this.scene, this.camera);
  }

  // Une arrivée en douceur la première fois qu'on ouvre la 3D
  intro() {
    if (this.introDone || Fx.reduced()) return;
    this.introDone = true;
    this.yawOff = -0.75;
    this.distMul = 1.5;
    this.tween(1500, (k) => {
      this.yawOff = -0.75 * (1 - k);
      this.distMul = 1 + 0.5 * (1 - k);
    }, (k) => 1 - Math.pow(1 - k, 3));
    // Cette animation doit survivre aux mises à jour de la grille
    if (this.tweens.length) this.tweens[this.tweens.length - 1].keep = true;
  }

  // --- Pions ------------------------------------------------------------------------

  material(color, skin) {
    const key = `${skin}|${color}`;
    let m = this.materials.get(key);
    if (m) return m;
    const base = new THREE.Color(color);
    const common = { bumpMap: this.knurl, bumpScale: 0.012 };
    switch (skin) {
      case "gold":
        m = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 1, roughness: 0.16, emissive: 0x4a2c00, emissiveIntensity: 0.5, envMapIntensity: 2, ...common });
        break;
      case "shine":
        m = new THREE.MeshStandardMaterial({ color: base, metalness: 0.3, roughness: 0.08, emissive: base, emissiveIntensity: 0.1, envMapIntensity: 0.9, ...common });
        break;
      default:
        m = new THREE.MeshStandardMaterial({ color: base, metalness: 0.06, roughness: 0.27, envMapIntensity: 0.7, ...common });
    }
    this.materials.set(key, m);
    return m;
  }

  makeToken(id, owner, x, y) {
    const color = this.view.colors[owner] || "#ffd60a";
    const skin = this.view.skins[owner] || "classic";
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.tokenGeo, this.material(color, skin));
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    if (skin === "x" || skin === "gold") {
      const tint = skin === "gold" ? new THREE.Color(0x9c6400) : new THREE.Color(Fx.ink(color));
      const mat = new THREE.MeshBasicMaterial({ map: this.xTex, transparent: true, color: tint, depthWrite: false, side: THREE.DoubleSide });
      for (const z of [0.112, -0.112]) {
        const p = new THREE.Mesh(this.pipGeo, mat);
        p.position.z = z;
        if (skin === "gold") p.scale.setScalar(0.62);
        g.add(p);
      }
    }
    const t = { id, owner, x, y, group: g };
    if (skin === "shine" || skin === "gold") {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.starTex, color: skin === "gold" ? 0xfff2b0 : 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      sp.position.set(0.18, 0.18, 0.26);
      g.add(sp);
      t.spark = sp;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: skin === "gold" ? 0xffc83d : new THREE.Color(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.25 }));
      halo.scale.set(1.5, 1.5, 1);
      halo.position.z = 0.22;
      g.add(halo);
      t.halo = halo;
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
    this.tweens.filter((t) => !t.keep).forEach((t) => t.resolve());
    this.tweens = this.tweens.filter((t) => t.keep);
    this.state = C4.clone(state);
    if (view) this.view = view;
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
    this.updatePiles();
    const who = state.over ? state.winner : state.turn;
    const hex = who >= 0 ? this.view.colors[who] : "#9b6dff";
    this.turnGoal.set(hex || "#9b6dff");
    if (!this.win) this.removeWinMesh();
    this.fit();
    if (!this.introDone) {
      this.dist = this.distGoal * 1.5;
      this.intro();
    }
  }

  drawFog() {
    const s = this.state;
    if (!s.o.fog) {
      this.fog.stop();
      this.fogGroup.visible = false;
      return;
    }
    const before = this.fog.canvas.width;
    this.fog.setup(s.w, s.h, 48);
    if (this.fog.canvas.width !== before) this.fogTex.dispose();
    this.fogMeshes.forEach((m) => {
      const k = m.userData.scale;
      m.scale.set((s.w + 1) * k, (s.h + 1) * k, 1);
    });
    const viewer = this.view.viewer;
    const instant = viewer !== this.fog.viewer;
    this.fog.viewer = viewer;
    this.fog.setMask(this.mask(), instant);
    this.fogGroup.visible = true;
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
    const tone = this.view.skins[cur.owner] === "gold" ? "#ffc83d" : color;
    if (cur.kind === "lane") {
      const g = o.gravity;
      const vertical = C4.isVertical(g);
      this.ghost.material.color.set(tone);
      this.ghost.visible = true;
      this.ghostFloat = true;
      this.laneMesh.material.color.set(tone);
      if (vertical) {
        const [px] = this.toWorld(cur.lane, 0);
        this.ghostY = g === "up" ? -h / 2 - 0.92 : h / 2 + 0.92;
        this.ghost.position.set(px, this.ghostY, 0);
        this.laneMesh.scale.set(1, h, 1);
        this.laneMesh.rotation.z = g === "up" ? Math.PI : 0;
        this.laneMesh.position.set(px, 0, 0.26);
      } else {
        const [, py] = this.toWorld(0, cur.lane);
        this.ghostY = py;
        this.ghost.position.set(g === "left" ? w / 2 + 0.92 : -w / 2 - 0.92, py, 0);
        this.laneMesh.scale.set(1, w, 1);
        this.laneMesh.rotation.z = g === "left" ? -Math.PI / 2 : Math.PI / 2;
        this.laneMesh.position.set(0, py, 0.26);
      }
      this.laneMesh.visible = true;
    } else if (cur.kind === "cell") {
      const [px, py] = this.toWorld(cur.x, cur.y);
      this.aim.position.set(px, py, 0.34);
      this.aim.material.color.set(cur.bomb ? 0xff4d6d : 0xffd60a);
      this.aim.visible = true;
      if (!cur.bomb) {
        this.ghost.material.color.set(tone);
        this.ghostY = py;
        this.ghostFloat = false;
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
      this.hintMesh.position.set(px, py, 0.27);
    } else if (C4.isVertical(o.gravity)) {
      const [px] = this.toWorld(hint.lane, 0);
      this.hintMesh.scale.set(1, h, 1);
      this.hintMesh.position.set(px, 0, 0.27);
    } else {
      const [, py] = this.toWorld(0, hint.lane);
      this.hintMesh.scale.set(w, 1, 1);
      this.hintMesh.position.set(0, py, 0.27);
    }
    this.hintMesh.visible = true;
  }

  // --- Effets -----------------------------------------------------------------------

  sparkMaterial(hex) {
    let m = this.sparkMats.get(hex);
    if (!m) {
      m = new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(hex), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      this.sparkMats.set(hex, m);
    }
    return m;
  }

  // Des étincelles qui jaillissent d'un point
  sparks(px, py, hex, count, power = 2.4) {
    if (Fx.reduced()) return;
    const mat = this.sparkMaterial(hex);
    for (let k = 0; k < count; k++) {
      const sp = new THREE.Sprite(mat);
      sp.position.set(px, py, 0.3);
      this.rig.add(sp);
      const a = Math.random() * Math.PI * 2;
      const v = power * (0.4 + Math.random() * 0.8);
      const base = 0.1 + Math.random() * 0.16;
      sp.scale.setScalar(base);
      this.particles.push({ obj: sp, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 0.7, vz: Math.random() * v * 0.8, gravity: 6, life: 1, total: 0.4 + Math.random() * 0.45, base });
    }
  }

  // Des éclats de pion qui volent et retombent
  debris(px, py, hex, count, power = 4) {
    if (Fx.reduced()) return;
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.35, metalness: 0.2 });
    for (let k = 0; k < count; k++) {
      const m = new THREE.Mesh(this.debrisGeo, mat);
      m.position.set(px, py, 0.2);
      this.rig.add(m);
      const a = Math.random() * Math.PI * 2;
      const v = power * (0.35 + Math.random() * 0.8);
      const base = 0.6 + Math.random() * 0.9;
      this.particles.push({ obj: m, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 1.4, vz: 1 + Math.random() * power * 0.7, gravity: 11, life: 1, total: 0.7 + Math.random() * 0.5, base, spin: 8 + Math.random() * 12 });
    }
  }

  // L'onde lumineuse qui part d'un pion qui vient de se poser
  shockRing(px, py, hex) {
    if (Fx.reduced()) return;
    const m = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.47, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(px, py, 0.27);
    m.renderOrder = 6;
    this.rig.add(m);
    const job = this.tween(430, (k) => {
      m.scale.setScalar(1 + k * 1.1);
      m.material.opacity = 1 - k;
    });
    this.tweens[this.tweens.length - 1] && (this.tweens[this.tweens.length - 1].keep = true);
    job.then(() => { this.rig.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }

  // Le choc de l'atterrissage
  impact(t, strength = 1) {
    const [px, py] = this.toWorld(t.x, t.y);
    const skin = this.view.skins[t.owner];
    const hex = skin === "gold" ? "#ffc83d" : this.view.colors[t.owner] || "#ffd60a";
    this.shockRing(px, py, hex);
    this.sparks(px, py, hex, 7, 1.8 * strength);
    this.wobble = Math.min(0.024, this.wobble + 0.009 * strength);
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
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const my = this.gen;
    setTimeout(() => {
      if (my !== this.gen || !this.alive) return;
      if (withSound) {
        if (typeof Sound !== "undefined") Sound.clack(0.6);
        if (typeof Haptics !== "undefined") Haptics.buzz(15);
      }
      if (this.tokens.get(t.id) === t) this.impact(t, Math.min(1.3, 0.5 + dist / 6));
    }, duration * 0.62);
    // Le pion roule sur lui-même en tombant
    const spin = (Math.PI * 2) * Math.max(1, Math.round(dist / 2.5)) * (t.id % 2 ? 1 : -1);
    return this.tween(duration, (_, k) => {
      const b = this.bounce(k);
      t.group.position.x = from[0] + (to[0] - from[0]) * b;
      t.group.position.y = from[1] + (to[1] - from[1]) * b;
      t.group.rotation.z = spin * (1 - Math.min(1, k / 0.62));
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
          const [px, py] = this.toWorld(t.x, t.y);
          this.sparks(px, py, this.view.colors[t.owner] || "#ffffff", 10, 1.6);
          await this.tween(440 / speed, (k) => {
            t.group.scale.setScalar(k < 0.3 ? 1 + k : 1.3 * (1 - (k - 0.3) / 0.7));
            t.group.rotation.y = k * 7;
            t.group.position.z = k * 1.1;
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
            const [px, py] = this.toWorld(t.x, t.y);
            return this.tween(320 / speed, (k) => {
              t.group.scale.set(1 + k * 0.55, 1 - k * 0.92, 1 + k * 0.2);
            }).then(() => {
              this.debris(px, py, this.view.colors[t.owner] || "#ffffff", 14, 3.2);
              this.sparks(px, py, "#ffffff", 8, 2.4);
              this.tokenGroup.remove(t.group);
              this.tokens.delete(i.id);
            });
          }));
          this.shake(0.12, 280 / speed);
          this.wobble = 0.03;
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
      await this.tween(340 / speed, (k) => {
        g.position.z = 3.5 * (1 - k) * (1 - k);
        g.rotation.y = (1 - k) * 4;
      });
      g.rotation.y = 0;
      t.scaleLocked = false;
      this.impact(t, 1);
      return;
    }
    const from = to.slice();
    switch (o.gravity) {
      case "up": from[1] = -h / 2 - 0.92; break;
      case "left": from[0] = w / 2 + 0.92; break;
      case "right": from[0] = -w / 2 - 0.92; break;
      default: from[1] = h / 2 + 0.92;
    }
    g.position.set(from[0], from[1], 0);
    await this.fall(t, from, to, this.fallTime(Math.hypot(from[0] - to[0], from[1] - to[1]), speed));
    g.rotation.z = 0;
  }

  shake(power, duration) {
    this.tween(duration, (_, k) => {
      const f = (1 - k) * power;
      this.rig.position.set(Math.sin(k * 60) * f, Math.cos(k * 47) * f * 0.6, 0);
    }).then(() => this.rig.position.set(0, 0, 0));
  }

  async animBomb(ev, speed) {
    const [px, py] = this.toWorld(ev.x, ev.y);
    // Une vraie bombe : corps noir, bouchon doré, mèche qui crépite
    const bomb = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 20), new THREE.MeshStandardMaterial({ color: 0x15131c, roughness: 0.28, metalness: 0.65, envMapIntensity: 1.4 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0xffc81f, metalness: 0.95, roughness: 0.25 }));
    cap.position.y = 0.36;
    const spark = new THREE.Sprite(this.sparkMaterial("#ffb030"));
    spark.scale.setScalar(0.45);
    spark.position.y = 0.52;
    const light = new THREE.PointLight(0xff6020, 1.8, 5);
    light.position.y = 0.5;
    bomb.add(body, cap, spark, light);
    this.rig.add(bomb);
    if (typeof Sound !== "undefined") Sound.whoosh(0.45 / speed);
    await this.tween(480 / speed, (k) => {
      const f = (1 - k) * (1 - k);
      bomb.position.set(px, py + f * 2.4, 0.5 + f * 9);
      bomb.rotation.x = k * 6;
      bomb.rotation.z = k * 2;
      spark.scale.setScalar(0.35 + Math.random() * 0.25);
    });
    this.rig.remove(bomb);
    body.geometry.dispose();
    cap.geometry.dispose();
    if (typeof Sound !== "undefined") Sound.boom();
    if (typeof Haptics !== "undefined") Haptics.buzz([60, 30, 120]);
    const at = this.project(ev.x, ev.y);
    const blast = document.createElement("span");
    blast.className = "blast";
    blast.style.left = at[0] + "px";
    blast.style.top = at[1] + "px";
    blast.style.setProperty("--s", "190px");
    this.host.appendChild(blast);
    blast.addEventListener("animationend", () => blast.remove());
    const hex = this.view.colors[ev.owner] || "#ffffff";
    this.debris(px, py, hex, 26, 6.5);
    this.sparks(px, py, "#ffb030", 30, 5);
    this.sparks(px, py, "#ffffff", 12, 3.4);
    this.flash.position.set(px, py, 2);
    this.tween(640 / speed, (k) => { this.flash.intensity = 8 * (1 - k); });
    this.shake(0.36, 580);
    this.wobble = 0.05;
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
    await this.tween(860 / speed, (_, k) => { this.rig.rotation.z = (-Math.PI / 2) * ease(k); });
    this.wobble = 0.03;
    // Nouvelle disposition : la grille est maintenant couchée dans l'autre sens
    const view = C4.clone(this.state);
    view.w = ev.w; view.h = ev.h;
    this.state = view;
    this.rig.rotation.z = 0;
    this.buildBoard();
    if (this.state.o.fog && this.fog.reveal) {
      const before = this.fog.canvas.width;
      this.fog.rotate();
      this.fog.setup(ev.w, ev.h, 48);
      if (this.fog.canvas.width !== before) this.fogTex.dispose();
      this.fogMeshes.forEach((m) => {
        const k = m.userData.scale;
        m.scale.set((ev.w + 1) * k, (ev.h + 1) * k, 1);
      });
    }
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
    if (this.winGlow) {
      this.rig.remove(this.winGlow);
      this.winGlow = null;
    }
    this.focus = null;
    this.tokens.forEach((t) => {
      t.winT = null;
      if (t.winHalo) { t.group.remove(t.winHalo); t.winHalo = null; }
    });
  }

  showWin(line, bad) {
    this.win = line ? { line, bad } : null;
    this.removeWinMesh();
    if (!line) return;
    const s = this.state;
    const at = (c) => this.toWorld(c % s.w, (c / s.w) | 0);
    const a = at(line[0]), b = at(line[line.length - 1]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const hex = bad ? "#ff4d6d" : "#ffd60a";
    const geo = new THREE.CylinderGeometry(0.075, 0.075, 1, 12);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true }));
    mesh.position.set(a[0], a[1], 0.42);
    mesh.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2;
    mesh.scale.y = 0.001;
    mesh.renderOrder = 8;
    this.rig.add(mesh);
    this.winMesh = mesh;
    const job = (k) => { mesh.scale.y = Math.max(0.001, len * k); };
    this.tween(560, job, (k) => 1 - Math.pow(1 - k, 3));

    // Une grande lueur le long de la ligne
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(hex), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4 }));
    glow.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0.5);
    glow.scale.set(len + 3, len + 3, 1);
    this.rig.add(glow);
    this.winGlow = glow;

    // La caméra s'approche
    this.focus = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

    // Les pions gagnants sautent vers l'avant et font un tour, l'un après l'autre
    line.forEach((c, i) => {
      const t = this.tokens.get(s.id[c]);
      if (!t) return;
      t.winT = i * 0.8;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color(hex), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
      halo.scale.set(1.9, 1.9, 1);
      halo.position.z = 0.2;
      t.group.add(halo);
      t.winHalo = halo;
      const g = t.group;
      const delay = i * 110;
      setTimeout(() => {
        if (this.tokens.get(t.id) !== t || !this.alive) return;
        const [px, py] = this.toWorld(t.x, t.y);
        this.sparks(px, py, hex, 12, 3);
        this.tween(720, (k, raw) => {
          g.rotation.y = k * Math.PI * 2;
          g.position.z = 0.32 * Math.sin(Math.min(1, raw * 1.6) * Math.PI * 0.5);
        }, (k) => 1 - Math.pow(1 - k, 3));
      }, delay);
    });
  }

  clearWin() { this.win = null; this.removeWinMesh(); }
}
