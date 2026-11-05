// Provador Mágico — cenários 3D (loja e temas) e controle do jogador
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o });
const mesh = (g, m, cast = true, rec = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = rec; return x; };

export const TEMAS = {
  loja: { nome: 'Loja', cor: '#ffffff' },
  princesa: { nome: 'Festa da Princesa', cor: '#c9a7ff', icone: '👑' },
  heroi: { nome: 'Super-herói', cor: '#e63946', icone: '⚡' },
  junina: { nome: 'Festa Junina', cor: '#f4a261', icone: '🌽' },
  praia: { nome: 'Praia / Verão', cor: '#00b4d8', icone: '🏖️' },
};

// textura de canvas com texto (placas)
export function placa(texto, { cor = '#ffffff', fundo = '#e84a7f', w = 512, h = 160, fonte = 64, emoji = '' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = fundo; roundRect(x, 4, 4, w - 8, h - 8, 36); x.fill();
  x.lineWidth = 8; x.strokeStyle = 'rgba(255,255,255,.85)'; x.stroke();
  x.fillStyle = cor; x.font = `800 ${fonte}px Nunito, system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText((emoji ? emoji + ' ' : '') + texto, w / 2, h / 2 + 4, w - 40);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function roundRect(x, a, b, w, h, r) {
  x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
}
function texCanvas(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat); t.anisotropy = 8; return t;
}

export class Cena {
  constructor(canvas) {
    const r = this.r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    this.sc = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    this.sc.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
    this.sc.environmentIntensity = .55;
    this.cam = new THREE.PerspectiveCamera(42, 1, .05, 200);
    this.sol = new THREE.DirectionalLight(0xfff2e0, 2.4);
    this.sol.castShadow = true; this.sol.shadow.mapSize.set(2048, 2048);
    this.sol.shadow.bias = -.0003; this.sol.shadow.normalBias = .03;
    const s = this.sol.shadow.camera; s.left = s.bottom = -6; s.right = s.top = 6; s.far = 40;
    this.sc.add(this.sol, this.sol.target);
    this.hemi = new THREE.HemisphereLight(0xdfe9ff, 0xb59a7a, .6); this.sc.add(this.hemi);
    this.mundo = new THREE.Group(); this.sc.add(this.mundo);
    this.portais = []; this.zonas = []; this.colisores = [];
    this.anim = [];
    this.relogio = new THREE.Timer(); this.relogio.connect?.(document);
    this.alvoCam = new THREE.Vector3(); this.camOff = new THREE.Vector3(0, 1.6, 3.6);
    this.modo = 'livre';
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const c = this.r.domElement, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
  }

  limpar() {
    this.mundo.traverse(o => { o.geometry?.dispose?.(); });
    this.sc.remove(this.mundo); this.mundo = new THREE.Group(); this.sc.add(this.mundo);
    this.portais = []; this.zonas = []; this.colisores = []; this.anim = [];
    this.sc.fog = null;
  }

  ambiente(nome, marca = {}) {
    this.limpar(); this.tema = nome;
    ({ loja: () => this._loja(marca), princesa: () => this._princesa(), heroi: () => this._heroi(),
       junina: () => this._junina(), praia: () => this._praia(), estudio: () => this._estudio(marca) })[nome]();
  }

  // ---------- LOJA (hub) ----------
  _loja(marca) {
    const W = 14, D = 14, H = 4.2, g = this.mundo;
    const cP = marca.primaria || '#e84a7f', cS = marca.secundaria || '#7ec8e3', cD = marca.destaque || '#ffd166';
    this.sc.background = new THREE.Color('#f7efe9');
    this.sol.position.set(3, 9, 5); this.sol.intensity = 1.6; this.hemi.intensity = .9;
    // piso de madeira clara
    const piso = texCanvas(512, 512, (x, w, h) => {
      for (let i = 0; i < 8; i++) {
        const y = i * h / 8; x.fillStyle = `hsl(32,${38 + (i % 3) * 4}%,${78 - (i % 2) * 4}%)`; x.fillRect(0, y, w, h / 8);
        x.fillStyle = 'rgba(120,80,40,.18)'; x.fillRect(0, y, w, 2);
        const o = (i * 137) % w; x.fillRect(o, y, 2, h / 8);
        for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(120,80,40,${Math.random() * .05})`; x.fillRect(Math.random() * w, y + Math.random() * h / 8, 60 + Math.random() * 120, 1); }
      }
    }, [4, 4]);
    const chao = mesh(new THREE.PlaneGeometry(W, D), M('#fff', { map: piso, roughness: .55 }), false);
    chao.rotation.x = -Math.PI / 2; g.add(chao);
    // tapete central
    const tap = mesh(new THREE.CircleGeometry(2.2, 64), M(cS, { roughness: .95 }), false);
    tap.rotation.x = -Math.PI / 2; tap.position.y = .005; g.add(tap);
    const tap2 = mesh(new THREE.RingGeometry(1.9, 2.05, 64), M('#ffffff', { roughness: .95 }), false);
    tap2.rotation.x = -Math.PI / 2; tap2.position.y = .008; g.add(tap2);
    // paredes com faixa da marca
    const parede = texCanvas(256, 256, (x, w, h) => {
      x.fillStyle = '#fff8f3'; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(232,74,127,.06)'; for (let i = 0; i < w; i += 32) x.fillRect(i, 0, 14, h);
    }, [8, 2]);
    const mp = M('#fff', { map: parede, roughness: .9 });
    for (const [x, z, ry, len] of [[0, -D / 2, 0, W], [0, D / 2, Math.PI, W], [-W / 2, 0, Math.PI / 2, D], [W / 2, 0, -Math.PI / 2, D]]) {
      const p = mesh(new THREE.PlaneGeometry(len, H), mp, false); p.position.set(x, H / 2, z); p.rotation.y = ry; g.add(p);
      const rod = mesh(new THREE.BoxGeometry(len, .18, .04), M(cP, { roughness: .4 }), false);
      rod.position.set(x, .09, z); rod.rotation.y = ry; rod.translateZ(.02); g.add(rod);
    }
    const teto = mesh(new THREE.PlaneGeometry(W, D), M('#ffffff', { roughness: 1 }), false);
    teto.rotation.x = Math.PI / 2; teto.position.y = H; g.add(teto);
    // luminárias pendentes
    for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, 0]]) {
      const cabo = mesh(new THREE.CylinderGeometry(.008, .008, 1.1), M('#333'), false); cabo.position.set(x, H - .55, z); g.add(cabo);
      const cup = mesh(new THREE.SphereGeometry(.28, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(cD, { side: THREE.DoubleSide, roughness: .3 }), false);
      cup.rotation.x = Math.PI; cup.position.set(x, H - 1.1, z); g.add(cup);
      const l = new THREE.PointLight(0xffe2b8, 6, 7, 1.6); l.position.set(x, H - 1.25, z); g.add(l);
      const lamp = mesh(new THREE.SphereGeometry(.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff4d6' }), false);
      lamp.position.set(x, H - 1.2, z); g.add(lamp);
    }
    // logomarca/placa no fundo
    this.placaLoja = mesh(new THREE.PlaneGeometry(3.2, 1), new THREE.MeshBasicMaterial({ map: placa(marca.nome || 'Loja', { fundo: cP }), transparent: true }), false);
    this.placaLoja.position.set(0, 3.15, -D / 2 + .03); g.add(this.placaLoja);
    // araras com peças
    const pecasCores = ['#ff8fb1', '#7ec8e3', '#ffd166', '#06d6a0', '#c9a7ff', '#f4a261', '#4b7bd6', '#ef476f'];
    const arara = (x, z, ry) => {
      const a = new THREE.Group(); a.position.set(x, 0, z); a.rotation.y = ry;
      const cromo = M('#d9d9d9', { metalness: 1, roughness: .25 });
      for (const sx of [-.9, .9]) { const p = mesh(new THREE.CylinderGeometry(.025, .025, 1.5), cromo); p.position.set(sx, .75, 0); a.add(p);
        const pe = mesh(new THREE.CylinderGeometry(.18, .2, .03, 24), cromo); pe.position.set(sx, .015, 0); a.add(pe); }
      const bar = mesh(new THREE.CylinderGeometry(.02, .02, 1.85), cromo); bar.rotation.z = Math.PI / 2; bar.position.y = 1.5; a.add(bar);
      for (let i = 0; i < 7; i++) {
        const c = pecasCores[(i + Math.abs(Math.round(x * 3 + z))) % pecasCores.length];
        const roupa = new THREE.Group(); roupa.position.set(-.75 + i * .25, 1.47, 0); roupa.rotation.y = Math.PI / 2 + (Math.random() - .5) * .2;
        const cab = mesh(new THREE.TorusGeometry(.04, .006, 6, 12, Math.PI), cromo); cab.position.y = .02; roupa.add(cab);
        const shape = new THREE.Shape();
        const vest = i % 3 === 0;
        shape.moveTo(-.12, 0); shape.lineTo(-.2, -.05); shape.lineTo(-.24, -.15); shape.lineTo(-.15, -.18);
        shape.lineTo(vest ? -.22 : -.14, vest ? -.62 : -.5); shape.lineTo(vest ? .22 : .14, vest ? -.62 : -.5);
        shape.lineTo(.15, -.18); shape.lineTo(.24, -.15); shape.lineTo(.2, -.05); shape.lineTo(.12, 0);
        shape.quadraticCurveTo(0, -.06, -.12, 0);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: .04, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2 });
        const r = mesh(geo, M(c, { roughness: .85 })); r.position.set(0, -.02, -.02); roupa.add(r);
        a.add(roupa);
      }
      g.add(a); this.colisores.push({ x, z, r: 1.0 });
    };
    arara(-4.6, -1.5, Math.PI / 2); arara(-4.6, 2.2, Math.PI / 2); arara(4.6, -1.5, -Math.PI / 2); arara(4.6, 2.2, -Math.PI / 2);
    // prateleiras com caixas de sapato
    const estante = (x, z, ry) => {
      const e = new THREE.Group(); e.position.set(x, 0, z); e.rotation.y = ry;
      const mad = M('#ffffff', { roughness: .5 });
      for (let k = 0; k < 4; k++) { const s = mesh(new THREE.BoxGeometry(1.6, .04, .45), mad); s.position.y = .3 + k * .5; e.add(s);
        for (let j = 0; j < 4; j++) { const cx = mesh(new THREE.BoxGeometry(.3, .18, .3), M(pecasCores[(j + k * 2) % 8], { roughness: .6 }));
          cx.position.set(-.55 + j * .37, .41 + k * .5, 0); e.add(cx); } }
      for (const sx of [-.8, .8]) { const l = mesh(new THREE.BoxGeometry(.04, 2.1, .45), mad); l.position.set(sx, 1.05, 0); e.add(l); }
      g.add(e); this.colisores.push({ x, z, r: .9 });
    };
    estante(-5.9, -D / 2 + .3, 0); estante(5.9, -D / 2 + .3, 0); estante(0, -D / 2 + .3, 0);
    // provador (cabine com espelho)
    const prov = new THREE.Group(); prov.position.set(0, 0, D / 2 - 1.3); g.add(prov);
    const cort = M(cP, { roughness: .9, side: THREE.DoubleSide });
    const cortina = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 2.4, 40, 1, true, -Math.PI * .5, Math.PI), cort);
    const pos = cortina.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getX(i), pos.getZ(i)); const f = 1 + .04 * Math.sin(a * 22); pos.setX(i, pos.getX(i) * f); pos.setZ(i, pos.getZ(i) * f); }
    cortina.geometry.computeVertexNormals(); cortina.position.y = 1.2; cortina.castShadow = true; prov.add(cortina);
    const esp = mesh(new THREE.PlaneGeometry(.7, 1.6), new THREE.MeshPhysicalMaterial({ color: '#cfe6ff', metalness: 1, roughness: .05 }), false);
    esp.position.set(0, 1.1, .85); esp.rotation.y = Math.PI; prov.add(esp);
    const pp = mesh(new THREE.PlaneGeometry(1.6, .5), new THREE.MeshBasicMaterial({ map: placa('Provador', { fundo: cD, cor: '#3b2a1a', emoji: '✨' }), transparent: true }), false);
    pp.position.set(0, 2.75, -.95); pp.rotation.y = Math.PI; prov.add(pp);
    this.zonas.push({ id: 'provador', x: 0, z: D / 2 - 2.4, r: 1.1, rotulo: 'Entrar no provador' });
    // portais temáticos nas paredes laterais
    const portal = (tema, x, z, ry) => {
      const t = TEMAS[tema], grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
      const arco = new THREE.Shape(); arco.moveTo(-.85, 0); arco.lineTo(-.85, 2); arco.absarc(0, 2, .85, Math.PI, 0, true); arco.lineTo(.85, 0);
      const furo = new THREE.Path(); furo.moveTo(-.65, 0); furo.lineTo(-.65, 2); furo.absarc(0, 2, .65, Math.PI, 0, true); furo.lineTo(.65, 0);
      arco.holes.push(furo);
      const moldura = mesh(new THREE.ExtrudeGeometry(arco, { depth: .2, bevelEnabled: true, bevelSize: .03, bevelThickness: .03 }), M(t.cor, { roughness: .35 }));
      grp.add(moldura);
      const fs = new THREE.Shape(furo.getPoints(24));
      const brilho = new THREE.Mesh(new THREE.ShapeGeometry(fs), new THREE.ShaderMaterial({
        transparent: true, uniforms: { t: { value: 0 }, c: { value: new THREE.Color(t.cor) } },
        vertexShader: 'varying vec2 vU; void main(){ vU=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: `uniform float t; uniform vec3 c; varying vec2 vU;
          void main(){ float r=length(vU-vec2(0.,1.3)); float s=sin(r*14.-t*3.)*.5+.5; vec3 col=mix(c, vec3(1.), s*.55);
          gl_FragColor=vec4(col, .85); }` }));
      brilho.position.z = .1; grp.add(brilho);
      this.anim.push(dt => brilho.material.uniforms.t.value += dt);
      const pl = mesh(new THREE.PlaneGeometry(1.9, .55), new THREE.MeshBasicMaterial({ map: placa(t.nome, { fundo: t.cor, emoji: t.icone, fonte: 52 }), transparent: true }), false);
      pl.position.set(0, 3.15, .25); grp.add(pl);
      const fr = new THREE.Vector3(0, 0, 1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      this.zonas.push({ id: 'tema:' + tema, x: x + fr.x, z: z + fr.z, r: .95, rotulo: 'Entrar: ' + t.nome });
    };
    portal('princesa', -3.2, -D / 2 + .15, 0); portal('heroi', 3.2, -D / 2 + .15, 0);
    portal('junina', -W / 2 + .15, 5, Math.PI / 2); portal('praia', W / 2 - .15, 5, -Math.PI / 2);
    // balões decorativos
    for (let i = 0; i < 14; i++) {
      const b = mesh(new THREE.SphereGeometry(.18, 20, 14), M(pecasCores[i % 8], { roughness: .2, metalness: .05 }));
      b.scale.y = 1.2; const bx = (Math.random() - .5) * (W - 3), bz = (Math.random() - .5) * (D - 3);
      b.position.set(bx, H - .45 - Math.random() * .3, bz); g.add(b);
      const f = Math.random() * 6; this.anim.push(dt => { b.position.y += Math.sin((this.relogio.getElapsed() + f) * 1.3) * .0015; });
    }
    this.limites = { x: W / 2 - .5, z: D / 2 - .5 };
    this.spawn = new THREE.Vector3(0, 0, 1.5);
  }

  // ---------- céu gradiente ----------
  _ceu(top, bot, sol = null) {
    const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      uniforms: { a: { value: new THREE.Color(top) }, b: { value: new THREE.Color(bot) } },
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 a; uniform vec3 b; varying vec3 vP; void main(){ float h=clamp(vP.y*1.4+.15,0.,1.); gl_FragColor=vec4(mix(b,a,pow(h,.8)),1.); }' });
    const s = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), m); this.mundo.add(s);
    this.sc.background = new THREE.Color(bot);
  }

  _chao(cor, tam = 60, tex = null) {
    const c = mesh(new THREE.CircleGeometry(tam, 64), M(cor, { roughness: .95, map: tex }), false);
    c.rotation.x = -Math.PI / 2; this.mundo.add(c); return c;
  }

  // ---------- PRINCESA ----------
  _princesa() {
    const g = this.mundo; this._ceu('#9ec9ff', '#ffe3f1');
    this.sol.position.set(4, 10, 6); this.sol.intensity = 2.2; this.hemi.intensity = .7;
    this._chao('#b9e59b');
    const tapete = mesh(new THREE.PlaneGeometry(1.8, 14), M('#c8102e', { roughness: .95 }), false);
    tapete.rotation.x = -Math.PI / 2; tapete.position.set(0, .01, -4); g.add(tapete);
    const pedra = M('#f3e9ff', { roughness: .8 }), telhado = M('#b388ff', { roughness: .5 });
    const torre = (x, z, r, h) => {
      const t = mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 32), pedra); t.position.set(x, h / 2, z); g.add(t);
      const c = mesh(new THREE.ConeGeometry(r * 1.3, h * .55, 32), telhado); c.position.set(x, h + h * .27, z); g.add(c);
      const band = mesh(new THREE.PlaneGeometry(.6, .35), M('#ff6fa5', { side: THREE.DoubleSide })); band.position.set(x + .3, h + h * .55 + .3, z); g.add(band);
      for (let k = 0; k < 3; k++) { const j = mesh(new THREE.PlaneGeometry(.35, .6), M('#7d5ba6', { roughness: .3 }), false);
        const a = k * 2.1; j.position.set(x + Math.sin(a) * (r + .01), h * .65, z + Math.cos(a) * (r + .01)); j.rotation.y = a; g.add(j); }
    };
    const muro = mesh(new THREE.BoxGeometry(12, 5, 1.6), pedra); muro.position.set(0, 2.5, -12); g.add(muro);
    for (let i = -5; i <= 5; i++) { const am = mesh(new THREE.BoxGeometry(.6, .6, 1.6), pedra); am.position.set(i * 1.1, 5.3, -12); g.add(am); }
    const portao = mesh(new THREE.CircleGeometry(1.4, 32, 0, Math.PI), M('#7d4e2d'), false); portao.position.set(0, 2, -11.19); g.add(portao);
    const portao2 = mesh(new THREE.PlaneGeometry(2.8, 2), M('#7d4e2d'), false); portao2.position.set(0, 1, -11.19); g.add(portao2);
    torre(-6.5, -12, 1.4, 8); torre(6.5, -12, 1.4, 8); torre(-3, -14, 1.1, 10); torre(3, -14, 1.1, 10); torre(0, -16, 1.6, 12);
    // trono
    const trono = new THREE.Group(); trono.position.set(0, 0, -3.2); g.add(trono);
    const ouro = M('#f4c430', { metalness: 1, roughness: .25 });
    const enc = mesh(new THREE.BoxGeometry(1.2, .5, .9), M('#c8102e', { roughness: .8 })); enc.position.y = .45; trono.add(enc);
    const cos = mesh(new THREE.BoxGeometry(1.2, 1.8, .15), ouro); cos.position.set(0, 1.1, -.45); trono.add(cos);
    // árvores/flores
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 14, x = Math.cos(a) * r, z = Math.sin(a) * r + 2;
      if (z < -9) continue;
      const tr = mesh(new THREE.CylinderGeometry(.1, .14, 1.2), M('#8d6e63')); tr.position.set(x, .6, z); g.add(tr);
      const cp = mesh(new THREE.IcosahedronGeometry(.8, 1), M(['#7cc576', '#5fb35a', '#ffb7d5'][i % 3], { roughness: .9, flatShading: true }));
      cp.position.set(x, 1.6, z); g.add(cp);
    }
    for (let i = 0; i < 80; i++) { const f = mesh(new THREE.SphereGeometry(.06, 8, 6), M(['#ff6fa5', '#fff', '#ffd166', '#c9a7ff'][i % 4]), false);
      f.position.set((Math.random() - .5) * 16, .06, (Math.random() - .5) * 12 + 2); g.add(f); }
    this._brilhos('#ffffff', 120);
    this.spawn = new THREE.Vector3(0, 0, 0); this.limites = { x: 8, z: 8 };
  }

  // ---------- HERÓI ----------
  _heroi() {
    const g = this.mundo; this._ceu('#16213e', '#e9a178');
    this.sol.position.set(-6, 8, 4); this.sol.intensity = 2; this.sol.color.set('#ffd7a8'); this.hemi.intensity = .5;
    // telhado (piso)
    const t = mesh(new THREE.BoxGeometry(14, .4, 14), M('#5c677d', { roughness: .9 }), false); t.position.y = -.2; g.add(t);
    const borda = M('#3d4555');
    for (const [x, z, w, d] of [[0, -7, 14, .4], [0, 7, 14, .4], [-7, 0, .4, 14], [7, 0, .4, 14]]) {
      const b = mesh(new THREE.BoxGeometry(w, .5, d), borda); b.position.set(x, .25, z); g.add(b); }
    const caixa = mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), M('#8d99ae')); caixa.position.set(-4, .6, -4); g.add(caixa);
    const antena = mesh(new THREE.CylinderGeometry(.04, .04, 3), M('#adb5bd', { metalness: .8, roughness: .3 })); antena.position.set(4.5, 1.5, -4.5); g.add(antena);
    // holofote/símbolo no céu
    const sinal = mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshBasicMaterial({ map: placa('⚡', { fundo: 'rgba(255,240,170,.9)', cor: '#16213e', w: 256, h: 256, fonte: 200 }), transparent: true, opacity: .85 }), false);
    sinal.position.set(6, 16, -40); sinal.lookAt(0, 2, 0); g.add(sinal);
    // prédios
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2, r = 16 + Math.random() * 40, w = 2 + Math.random() * 4, h = 6 + Math.random() * 30;
      const jan = texCanvas(64, 128, (x, W, H) => { x.fillStyle = '#1b263b'; x.fillRect(0, 0, W, H);
        for (let yy = 4; yy < H; yy += 10) for (let xx = 4; xx < W; xx += 10) { x.fillStyle = Math.random() < .45 ? '#ffd166' : '#24324a'; x.fillRect(xx, yy, 6, 6); } }, [1, Math.max(1, h / 12)]);
      const b = mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ map: jan, emissiveMap: jan, emissive: '#ffffff', emissiveIntensity: .35, roughness: .8 }), false, false);
      b.position.set(Math.cos(a) * r, h / 2 - 12, Math.sin(a) * r); g.add(b);
    }
    this.sc.fog = new THREE.Fog('#e9a178', 25, 85);
    this.spawn = new THREE.Vector3(0, 0, 1); this.limites = { x: 6.3, z: 6.3 };
  }

  // ---------- JUNINA ----------
  _junina() {
    const g = this.mundo; this._ceu('#0f1b3d', '#5a3f7a');
    this.sol.position.set(2, 9, 4); this.sol.intensity = .55; this.sol.color.set('#ffd1a1'); this.hemi.intensity = .35;
    const terra = texCanvas(256, 256, (x, w, h) => { x.fillStyle = '#b7895a'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${90 + Math.random() * 60},60,30,${Math.random() * .25})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [12, 12]);
    this._chao('#ffffff', 60, terra);
    // fogueira
    const fog = new THREE.Group(); fog.position.set(0, 0, -3.5); g.add(fog);
    for (let i = 0; i < 6; i++) { const l = mesh(new THREE.CylinderGeometry(.08, .1, 1.2), M('#6d4c2f')); l.rotation.z = Math.PI / 2.6;
      l.rotation.y = i * Math.PI / 3; l.position.y = .3; fog.add(l); }
    const chama = mesh(new THREE.ConeGeometry(.45, 1.3, 16, 4, true), new THREE.MeshBasicMaterial({ color: '#ff9a3c', transparent: true, opacity: .85 }), false, false);
    chama.position.y = .9; fog.add(chama);
    const fogo = new THREE.PointLight(0xff8a3c, 30, 14, 1.4); fogo.position.y = 1.2; fog.add(fogo);
    this.anim.push(dt => { const t = this.relogio.getElapsed(); chama.scale.set(1 + Math.sin(t * 17) * .08, 1 + Math.sin(t * 11) * .12, 1);
      fogo.intensity = 26 + Math.sin(t * 23) * 6; });
    // bandeirinhas
    const cores = ['#e63946', '#f1c40f', '#2a9d8f', '#4361ee', '#ff6fa5', '#06d6a0'];
    const varal = (a, b, n) => {
      const curva = new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, .5).add(new THREE.Vector3(0, -.7, 0)), b);
      const fio = mesh(new THREE.TubeGeometry(curva, 30, .008, 4), M('#ddd'), false, false); g.add(fio);
      for (let i = 1; i < n; i++) { const p = curva.getPoint(i / n);
        const s = new THREE.Shape(); s.moveTo(-.13, 0); s.lineTo(.13, 0); s.lineTo(.13, -.32); s.lineTo(0, -.22); s.lineTo(-.13, -.32);
        const bd = mesh(new THREE.ShapeGeometry(s), M(cores[i % cores.length], { side: THREE.DoubleSide, roughness: .8 }), false, false);
        bd.position.copy(p); bd.lookAt(p.x + (b.z - a.z), p.y, p.z - (b.x - a.x)); g.add(bd);
        const f = Math.random() * 6; this.anim.push(() => { bd.rotation.x = Math.sin(this.relogio.getElapsed() * 2 + f) * .15; }); }
    };
    const postes = [[-6, -8], [6, -8], [6, 4], [-6, 4]];
    for (const [x, z] of postes) { const p = mesh(new THREE.CylinderGeometry(.08, .1, 4.2), M('#7b5a3c')); p.position.set(x, 2.1, z); g.add(p); }
    for (let i = 0; i < 4; i++) { const [x1, z1] = postes[i], [x2, z2] = postes[(i + 1) % 4];
      varal(new THREE.Vector3(x1, 4, z1), new THREE.Vector3(x2, 4, z2), 18); }
    varal(new THREE.Vector3(-6, 4, -8), new THREE.Vector3(6, 4, 4), 22); varal(new THREE.Vector3(6, 4, -8), new THREE.Vector3(-6, 4, 4), 22);
    // barracas
    const barraca = (x, z, ry, cor, txt) => {
      const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
      const balcao = mesh(new THREE.BoxGeometry(2, 1, .8), M('#c69c6d')); balcao.position.y = .5; b.add(balcao);
      const tel = mesh(new THREE.ConeGeometry(1.7, 1, 4), M(cor, { roughness: .8 })); tel.rotation.y = Math.PI / 4; tel.position.y = 2.6; b.add(tel);
      for (const sx of [-.9, .9]) { const p = mesh(new THREE.CylinderGeometry(.04, .04, 2.2), M('#7b5a3c')); p.position.set(sx, 1.1, .3); b.add(p); }
      const pl = mesh(new THREE.PlaneGeometry(1.6, .45), new THREE.MeshBasicMaterial({ map: placa(txt, { fundo: cor, fonte: 54 }), transparent: true }), false);
      pl.position.set(0, 1.9, .45); b.add(pl);
      const lz = new THREE.PointLight(0xffd59a, 4, 5); lz.position.set(0, 1.8, .8); b.add(lz);
    };
    barraca(-5, -2, Math.PI / 2, '#e63946', 'Pipoca'); barraca(5, -2, -Math.PI / 2, '#2a9d8f', 'Pescaria'); barraca(0, -9, 0, '#f1c40f', 'Quentão kids');
    // lâmpadas no varal (estrelas)
    this._brilhos('#fff1b8', 200, 40, 25);
    this.spawn = new THREE.Vector3(0, 0, 1); this.limites = { x: 6.5, z: 6.5 };
  }

  // ---------- PRAIA ----------
  _praia() {
    const g = this.mundo; this._ceu('#4cc9f0', '#fef6e4');
    this.sol.position.set(6, 12, 4); this.sol.intensity = 2.8; this.hemi.intensity = .8;
    const areia = texCanvas(256, 256, (x, w, h) => { x.fillStyle = '#f3dfb5'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) { x.fillStyle = `rgba(${170 + Math.random() * 60},${140 + Math.random() * 50},90,${Math.random() * .3})`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }, [14, 14]);
    const ch = mesh(new THREE.PlaneGeometry(80, 40), M('#fff', { map: areia, roughness: 1 }), false); ch.rotation.x = -Math.PI / 2; ch.position.z = 10; g.add(ch);
    // mar animado
    const marG = new THREE.PlaneGeometry(200, 120, 160, 80);
    const mar = new THREE.Mesh(marG, new THREE.MeshPhysicalMaterial({ color: '#1ca7c9', roughness: .08, metalness: .1, clearcoat: 1, transparent: true, opacity: .93 }));
    mar.rotation.x = -Math.PI / 2; mar.position.set(0, -.05, -50); mar.receiveShadow = true; g.add(mar);
    const p0 = Float32Array.from(marG.attributes.position.array);
    this.anim.push(() => { const t = this.relogio.getElapsed(), a = marG.attributes.position;
      for (let i = 0; i < a.count; i++) { const x = p0[i * 3], y = p0[i * 3 + 1];
        a.array[i * 3 + 2] = Math.sin(x * .3 + t * 1.2) * .08 + Math.sin(y * .5 + t * 1.6) * .1; }
      a.needsUpdate = true; marG.computeVertexNormals(); });
    const espuma = mesh(new THREE.PlaneGeometry(80, .8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .7 }), false, false);
    espuma.rotation.x = -Math.PI / 2; espuma.position.set(0, .02, -9.8); g.add(espuma);
    this.anim.push(() => { espuma.position.z = -9.8 + Math.sin(this.relogio.getElapsed() * .9) * .5; });
    // guarda-sóis
    const gs = (x, z, c1, c2) => {
      const haste = mesh(new THREE.CylinderGeometry(.03, .03, 2.4), M('#eee')); haste.position.set(x, 1.2, z); haste.rotation.z = .08; g.add(haste);
      const tex = texCanvas(256, 256, (cx, w, h) => { for (let i = 0; i < 8; i++) { cx.fillStyle = i % 2 ? c1 : c2; cx.beginPath(); cx.moveTo(w / 2, h / 2);
        cx.arc(w / 2, h / 2, w / 2, i * Math.PI / 4, (i + 1) * Math.PI / 4); cx.fill(); } });
      const topo = mesh(new THREE.ConeGeometry(1.4, .5, 32, 1, true), M('#fff', { map: tex, side: THREE.DoubleSide, roughness: .7 }));
      topo.position.set(x + .1, 2.45, z); g.add(topo);
      const toalha = mesh(new THREE.PlaneGeometry(.9, 1.8), M(c1, { roughness: 1 }), false); toalha.rotation.x = -Math.PI / 2; toalha.position.set(x + 1, .01, z + .4); g.add(toalha);
    };
    gs(-3.5, -1, '#ef476f', '#ffffff'); gs(3.8, .5, '#ffd166', '#06d6a0'); gs(-6, 3, '#118ab2', '#ffffff');
    // coqueiros
    const coqueiro = (x, z, h) => {
      const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + .6, h * .5, z), new THREE.Vector3(x + 1.1, h, z));
      const tr = mesh(new THREE.TubeGeometry(curva, 16, .16, 8), M('#a07850', { roughness: .9 })); g.add(tr);
      const topo = curva.getPoint(1);
      for (let i = 0; i < 7; i++) { const f = new THREE.Shape(); f.moveTo(0, 0); f.quadraticCurveTo(.5, .35, 1.8, 0); f.quadraticCurveTo(.5, -.1, 0, 0);
        const fo = mesh(new THREE.ShapeGeometry(f), M('#3fa34d', { side: THREE.DoubleSide, roughness: .8 })); fo.position.copy(topo);
        fo.rotation.set(-.5, i * Math.PI * 2 / 7, -.3); g.add(fo); }
    };
    coqueiro(-8, 6, 5); coqueiro(8, 7, 5.5); coqueiro(9.5, 2, 4.5);
    // castelinho de areia + baldinho
    const ca = M('#e9cf9c', { roughness: 1 });
    for (const [x, z, s] of [[2, 3, .4], [2.4, 3.2, .3], [1.7, 3.3, .28]]) { const c = mesh(new THREE.CylinderGeometry(s * .8, s, s * 1.4, 12), ca); c.position.set(x, s * .7, z); g.add(c); }
    const balde = mesh(new THREE.CylinderGeometry(.22, .17, .3, 20), M('#ef476f', { roughness: .4 })); balde.position.set(2.9, .15, 2.7); g.add(balde);
    this.spawn = new THREE.Vector3(0, 0, 2); this.limites = { x: 9, z: 8 };
  }

  // ---------- estúdio neutro (provador e cards) ----------
  _estudio(marca) {
    const g = this.mundo; this.sc.background = new THREE.Color(marca.fundo || '#f4ecff');
    this.sol.position.set(2, 6, 4); this.sol.intensity = 2.2; this.hemi.intensity = .8;
    const piso = mesh(new THREE.CircleGeometry(1.4, 64), M(marca.primaria || '#e84a7f', { roughness: .4 }), false);
    piso.rotation.x = -Math.PI / 2; piso.position.y = .002; g.add(piso);
    const fundo = mesh(new THREE.CircleGeometry(30, 64), M(marca.fundo || '#f4ecff', { roughness: 1 }), false);
    fundo.rotation.x = -Math.PI / 2; g.add(fundo);
    this.spawn = new THREE.Vector3(0, 0, 0);
  }

  _brilhos(cor, n, raio = 20, alt = 10) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - .5) * raio; p[i * 3 + 1] = 1 + Math.random() * alt; p[i * 3 + 2] = (Math.random() - .5) * raio; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: cor, size: .07, transparent: true, opacity: .9, depthWrite: false }));
    this.mundo.add(pts);
    this.anim.push(() => { pts.material.opacity = .6 + Math.sin(this.relogio.getElapsed() * 2) * .3; });
  }

  // ---------- jogador ----------
  colidir(p) {
    const L = this.limites; if (L) { p.x = Math.max(-L.x, Math.min(L.x, p.x)); p.z = Math.max(-L.z, Math.min(L.z, p.z)); }
    for (const c of this.colisores) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
      if (d < c.r) { p.x = c.x + dx / d * c.r; p.z = c.z + dz / d * c.r; } }
  }

  zonaEm(p) {
    for (const z of this.zonas) if (Math.hypot(p.x - z.x, p.z - z.z) < z.r) return z;
    return null;
  }

  seguir(obj, dt, altura) {
    if (this.modo === 'livre') {
      const alvo = obj.position.clone().add(new THREE.Vector3(0, altura * .62, 0));
      const off = this.camOff.clone().multiplyScalar(Math.max(.75, altura / 1.2)).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camYaw || 0);
      const des = alvo.clone().add(off);
      this.cam.position.lerp(des, Math.min(1, dt * 4));
      this.alvoCam.lerp(alvo, Math.min(1, dt * 6));
      this.cam.lookAt(this.alvoCam);
      this.sol.target.position.copy(obj.position);
      this.sol.position.copy(obj.position).add(new THREE.Vector3(3, 8, 5));
    }
  }

  quadro(obj, altura, { dist = 2.6, alt = .55, lado = .25, fov = 32 } = {}) {
    this.modo = 'fixo';
    this.cam.fov = fov; this.cam.updateProjectionMatrix();
    const p = obj.position;
    this.cam.position.set(p.x + altura * lado, p.y + altura * (alt + .05), p.z + altura * dist);
    this.cam.lookAt(p.x, p.y + altura * alt, p.z);
    this.sol.target.position.copy(p); this.sol.position.copy(p).add(new THREE.Vector3(2, 6, 4));
  }

  livre() { this.modo = 'livre'; this.cam.fov = 42; this.cam.updateProjectionMatrix(); }

  tick() {
    this.relogio.update(); const dt = Math.min(.05, this.relogio.getDelta());
    for (const f of this.anim) f(dt);
    return dt;
  }

  render() { this.r.render(this.sc, this.cam); }
}
