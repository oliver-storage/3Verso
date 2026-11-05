// Provador Mágico — motor do avatar (corpo CC0 MakeHuman, rig e morphs)
import * as THREE from 'three';

const ALTURA_REAL = { 3: .95, 4: 1.02, 5: 1.09, 6: 1.15, 7: 1.21, 8: 1.27, 9: 1.32, 10: 1.38, 11: 1.43 };
export function alturaPorIdade(a) {
  a = Math.min(11, Math.max(3, a));
  const i = Math.floor(a), f = a - i;
  return i >= 11 ? ALTURA_REAL[11] : ALTURA_REAL[i] * (1 - f) + ALTURA_REAL[i + 1] * f;
}

let BASE = null;
let ASSET_DIR = 'assets/avatar/';
export async function carregarBase(url = 'assets/avatar/base') {
  if (BASE) return BASE;
  ASSET_DIR = url.replace(/[^/]+$/, '');
  const [meta, bin] = await Promise.all([
    fetch(url + '.json').then(r => r.json()),
    fetch(url + '.bin').then(r => r.arrayBuffer()),
  ]);
  const T = { float32: Float32Array, int16: Int16Array, uint16: Uint16Array, uint8: Uint8Array };
  const seg = {};
  for (const [k, s] of Object.entries(meta.seg)) seg[k] = new T[s.t](bin, s.o, s.n);
  BASE = { meta, seg };
  return BASE;
}

export const PADRAO = {
  idade: 7, menino: 0, etnia: [1 / 3, 1 / 3, 1 / 3], peso: 0, altura: 0,
  face: {}, expr: {},
  pele: '#e8b796', olhos: '#5a3a22', cabeloCor: '#3b2414', sobrancelhaCor: null,
  sardas: 0, blush: .35,
};

const ETN = ['african', 'asian', 'caucasian'];

export class Avatar {
  constructor(base, params = {}) {
    this.base = base;
    const { meta, seg } = base;
    this.nv = meta.nv;
    this.params = structuredClone({ ...PADRAO, ...params });
    this.pos = new Float32Array(this.nv * 3);
    this.root = new THREE.Group();
    this.root.name = 'avatar';
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    this._buildSkeleton();
    this._buildMeshes();
    this.anexos = []; // roupas/cabelo/acessórios ligados ao corpo
    this.bake();
  }

  // ---------- morphs ----------
  _applyDense(name, inf, p = this.pos) {
    if (!inf) return;
    const m = this.base.meta.morphs[name], d = this.base.seg['dm_' + name], k = m.sc * inf;
    for (let i = 0; i < p.length; i++) p[i] += d[i] * k;
  }

  // forma de referência (7 anos, neutra) — coordenadas estáveis para estampas
  formaMedia() {
    if (!this._mid) {
      this._mid = Float32Array.from(this.base.seg.pos);
      this._applyDense('idade', .5, this._mid); this._applyDense('genero', .5, this._mid);
      this._applyDense('idade_genero', .25, this._mid);
    }
    return this._mid;
  }
  _applySparse(key, sc, inf) {
    if (!inf) return;
    const I = this.base.seg[key + '_i'], d = this.base.seg[key + '_d'], k = sc * inf, p = this.pos;
    for (let j = 0; j < I.length; j++) {
      const v = I[j] * 3, q = j * 3;
      p[v] += d[q] * k; p[v + 1] += d[q + 1] * k; p[v + 2] += d[q + 2] * k;
    }
  }

  bake() {
    const P = this.params, M = this.base.meta.morphs;
    this.pos.set(this.base.seg.pos);
    const s = (Math.min(11, Math.max(3, P.idade)) - 3) / 8, t = P.menino;
    this._applyDense('idade', s);
    this._applyDense('genero', t);
    this._applyDense('idade_genero', s * t);
    if (P.peso > 0) this._applyDense('peso_mais', P.peso); else this._applyDense('peso_menos', -P.peso);
    if (P.altura > 0) this._applyDense('altura_mais', P.altura); else this._applyDense('altura_menos', -P.altura);
    ETN.forEach((r, i) => this._applyDense('etnia_' + r, (P.etnia[i] ?? 1 / 3) - 1 / 3));
    for (const [k, v] of Object.entries(P.face || {})) {
      const m = M[k]; if (!m || !v) continue;
      v > 0 ? this._applySparse('fp_' + k, m.sp, v) : this._applySparse('fn_' + k, m.sn, -v);
    }
    for (const [k, v] of Object.entries(P.expr || {})) {
      const m = M[k]; if (m && v) this._applySparse('ex_' + k, m.sc, v);
    }
    this._updateSkeletonRest();
    this._updateGeometry();
    for (const a of this.anexos) a.atualizar(this);
    this._ajustarEscala();
    this._updateMaterials();
  }

  _ajustarEscala() {
    // altura real da faixa etária + pé no chão
    const p = this.pos, src = this.base.seg.corpo_src;
    let ymin = 1e9, ymax = -1e9;
    for (let i = 0; i < src.length; i++) { const y = p[src[i] * 3 + 1]; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
    this.alturaBruta = ymax - ymin;
    // sola de calçado abaixo do pé
    for (const a of this.anexos) if (a.info?.slot === 'pes') for (const m of a.malhas) {
      const P = m.geometry.attributes.position.array;
      for (let i = 1; i < P.length; i += 3) if (P[i] < ymin) ymin = P[i];
    }
    const alvo = alturaPorIdade(this.params.idade) * (1 + (this.params.altura || 0) * .06);
    const k = alvo / this.alturaBruta;
    this.inner.scale.setScalar(k);
    this.inner.position.y = -ymin * k;
    this.escala = k;
  }

  // ---------- esqueleto ----------
  _buildSkeleton() {
    const { bones } = this.base.meta;
    this.bones = bones.map(b => { const o = new THREE.Bone(); o.name = b.n; return o; });
    bones.forEach((b, i) => { if (b.p >= 0) this.bones[b.p].add(this.bones[i]); });
    this.boneByName = Object.fromEntries(this.bones.map(b => [b.name, b]));
    this.skeleton = new THREE.Skeleton(this.bones);
    this.restHead = bones.map(() => new THREE.Vector3());
    this.restTail = bones.map(() => new THREE.Vector3());
  }

  _centroid(list, out) {
    const p = this.pos; out.set(0, 0, 0);
    for (const v of list) out.x += p[v * 3], out.y += p[v * 3 + 1], out.z += p[v * 3 + 2];
    return out.multiplyScalar(1 / list.length);
  }

  _updateSkeletonRest() {
    const { bones } = this.base.meta;
    // guarda pose atual
    const pose = this.bones.map(b => b.quaternion.clone());
    bones.forEach((b, i) => { this._centroid(b.h, this.restHead[i]); this._centroid(b.t, this.restTail[i]); });
    bones.forEach((b, i) => {
      const o = this.bones[i];
      o.quaternion.identity(); o.scale.set(1, 1, 1);
      if (b.p >= 0) o.position.subVectors(this.restHead[i], this.restHead[b.p]);
      else o.position.copy(this.restHead[i]);
    });
    // inversas no espaço do mesh: calcula com a raiz solta (sem escala/posição do inner)
    const pai = this.bones[0].parent;
    if (pai) pai.remove(this.bones[0]);
    this.bones[0].updateMatrixWorld(true);
    this.skeleton.boneInverses = this.bones.map(b => new THREE.Matrix4().copy(b.matrixWorld).invert());
    if (pai) pai.add(this.bones[0]);
    this.bones.forEach((b, i) => b.quaternion.copy(pose[i]));
    this.inner.updateMatrixWorld(true);
  }

  // ---------- malhas ----------
  _skinAttrs(src) {
    const si = this.base.seg.skin_i, sw = this.base.seg.skin_w, n = src.length;
    const I = new Uint16Array(n * 4), Wt = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) {
      I[i * 4 + j] = si[src[i] * 4 + j]; Wt[i * 4 + j] = sw[src[i] * 4 + j] / 255;
    }
    return [new THREE.Uint16BufferAttribute(I, 4), new THREE.Float32BufferAttribute(Wt, 4)];
  }

  _mkSkinned(name, src, uv, idx, mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(src.length * 3), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(src.length * 3), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const [si, sw] = this._skinAttrs(src);
    g.setAttribute('skinIndex', si); g.setAttribute('skinWeight', sw);
    g.setIndex(new THREE.Uint16BufferAttribute(idx, 1));
    const m = new THREE.SkinnedMesh(g, mat);
    m.name = name; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    m.bind(this.skeleton, new THREE.Matrix4());
    m.userData.src = src;
    return m;
  }

  _buildMeshes() {
    const s = this.base.seg;
    const mats = this.mats = criarMateriais();
    this.inner.add(this.bones[0]);
    this.corpo = this._mkSkinned('corpo', s.corpo_src, s.corpo_uv, s.corpo_idx, mats.pele);
    this.dentes = this._mkSkinned('dentes', s.dentes_src, s.dentes_uv, s.dentes_idx, mats.dentes);
    this.lingua = this._mkSkinned('lingua', s.lingua_src, s.lingua_uv, s.lingua_idx, mats.lingua);
    this.dentes.castShadow = this.lingua.castShadow = false;
    // olhos: pesos de pele interpolados das referências mhclo
    const refs = s.olho_refs, wts = s.olho_wts, ne = this.base.meta.olho.n, esrc = s.olho_src;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(esrc.length * 3), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(esrc.length * 3), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(s.olho_uv, 2));
    g.setIndex(new THREE.Uint16BufferAttribute(s.olho_idx, 1));
    const eyeL = this.base.meta.bones.findIndex(b => b.n === 'eye.L'), eyeR = eyeL + 1;
    const I = new Uint16Array(esrc.length * 4), W = new Float32Array(esrc.length * 4);
    for (let i = 0; i < esrc.length; i++) {
      const v = esrc[i], r0 = refs[v * 3];
      const x = s.pos[r0 * 3];
      I[i * 4] = x > 0 ? eyeL : eyeR; W[i * 4] = 1;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(I, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(W, 4));
    this.olhos = new THREE.SkinnedMesh(g, mats.olhos);
    this.olhos.name = 'olhos'; this.olhos.frustumCulled = false;
    this.olhos.bind(this.skeleton, new THREE.Matrix4());
    // córnea: mesma geometria, outro índice, transparente e brilhante
    const gc = g.clone(); gc.setIndex(new THREE.Uint16BufferAttribute(s.cornea_idx, 1));
    for (const k of ['position', 'normal']) gc.setAttribute(k, g.attributes[k]);
    this.cornea = new THREE.SkinnedMesh(gc, mats.cornea);
    this.cornea.name = 'cornea'; this.cornea.frustumCulled = false; this.cornea.renderOrder = 2;
    this.cornea.bind(this.skeleton, new THREE.Matrix4());
    for (const m of [this.corpo, this.dentes, this.lingua, this.olhos, this.cornea]) this.inner.add(m);
  }

  _fillFromSrc(mesh) {
    const src = mesh.userData.src, P = mesh.geometry.attributes.position.array, p = this.pos;
    for (let i = 0; i < src.length; i++) {
      const v = src[i] * 3; P[i * 3] = p[v]; P[i * 3 + 1] = p[v + 1]; P[i * 3 + 2] = p[v + 2];
    }
    mesh.geometry.attributes.position.needsUpdate = true;
  }

  _normaisSuaves(mesh) {
    // normais por vértice de origem (sem costura nos cortes de UV)
    const src = mesh.userData.src, idx = mesh.geometry.index.array, p = this.pos;
    const acc = this._nacc || (this._nacc = new Float32Array(this.nv * 3));
    acc.fill(0);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let f = 0; f < idx.length; f += 3) {
      const i0 = src[idx[f]] * 3, i1 = src[idx[f + 1]] * 3, i2 = src[idx[f + 2]] * 3;
      a.set(p[i0], p[i0 + 1], p[i0 + 2]); b.set(p[i1], p[i1 + 1], p[i1 + 2]); c.set(p[i2], p[i2 + 1], p[i2 + 2]);
      n.subVectors(c, b).cross(a.sub(b));
      for (const i of [i0, i1, i2]) { acc[i] += n.x; acc[i + 1] += n.y; acc[i + 2] += n.z; }
    }
    const N = mesh.geometry.attributes.normal.array;
    for (let i = 0; i < src.length; i++) {
      const v = src[i] * 3; n.set(acc[v], acc[v + 1], acc[v + 2]).normalize();
      N[i * 3] = n.x; N[i * 3 + 1] = n.y; N[i * 3 + 2] = n.z;
    }
    mesh.geometry.attributes.normal.needsUpdate = true;
  }

  _updateGeometry() {
    for (const m of [this.corpo, this.dentes, this.lingua]) {
      this._fillFromSrc(m); this._normaisSuaves(m); m.geometry.computeBoundingSphere();
    }
    // olhos via mhclo
    const s = this.base.seg, refs = s.olho_refs, wts = s.olho_wts, offs = s.olho_offs, p = this.pos;
    const sc = this.base.meta.olho.scales, k = {};
    for (const [ax, [a, b, r]] of Object.entries(sc)) {
      const j = { x: 0, y: 1, z: 2 }[ax]; k[ax] = Math.abs(p[a * 3 + j] - p[b * 3 + j]) / r;
    }
    const E = new Float32Array(this.base.meta.olho.n * 3);
    for (let i = 0; i < this.base.meta.olho.n; i++) {
      for (let j = 0; j < 3; j++) {
        let v = 0;
        for (let q = 0; q < 3; q++) v += wts[i * 3 + q] * p[refs[i * 3 + q] * 3 + j];
        E[i * 3 + j] = v + offs[i * 3 + j] * k['xyz'[j]];
      }
    }
    const esrc = s.olho_src, P = this.olhos.geometry.attributes.position.array;
    for (let i = 0; i < esrc.length; i++) for (let j = 0; j < 3; j++) P[i * 3 + j] = E[esrc[i] * 3 + j];
    this.olhos.geometry.attributes.position.needsUpdate = true;
    this.olhos.geometry.computeVertexNormals();
  }

  _updateMaterials() {
    const P = this.params, u = this.mats.peleU;
    u.uTom.value.set(P.pele);
    u.uSobr.value.set(P.sobrancelhaCor || P.cabeloCor);
    u.uSardas.value = P.sardas; u.uBlush.value = P.blush;
    this.mats.olhosU.uIris.value.set(P.olhos);
  }

  set(params) { Object.assign(this.params, params); this.bake(); }

  anexar(obj) { this.anexos.push(obj); obj.montar(this); obj.atualizar(this); this._ajustarEscala(); }
  remover(obj) { this.anexos = this.anexos.filter(a => a !== obj); obj.desmontar?.(this); this._ajustarEscala(); }

  // direção de repouso do osso (cabeça -> cauda)
  restDir(n) {
    const i = this.bones.indexOf(this.boneByName[n]);
    return new THREE.Vector3().subVectors(this.restTail[i], this.restHead[i]).normalize();
  }

  // pose: { boneName: [eixoX,eixoY,eixoZ, ângulo] ou Quaternion }
  bone(n) { return this.boneByName[n]; }
}

// ---------- materiais ----------
let MASK_TEX = null, IRIS_TEX = null;
export function criarMateriais() {
  const loader = new THREE.TextureLoader();
  if (!MASK_TEX) {
    MASK_TEX = loader.load(ASSET_DIR + 'pele_mascara.png');
    MASK_TEX.colorSpace = THREE.NoColorSpace; MASK_TEX.anisotropy = 4;
    IRIS_TEX = loader.load(ASSET_DIR + 'olho.png');
    IRIS_TEX.colorSpace = THREE.SRGBColorSpace;
  }
  const peleU = {
    uTom: { value: new THREE.Color('#e8b796') }, uSobr: { value: new THREE.Color('#3b2414') },
    uSardas: { value: 0 }, uBlush: { value: .35 }, uMask: { value: MASK_TEX },
  };
  const pele = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: .62, sheen: .35, sheenRoughness: .6, sheenColor: new THREE.Color('#ffb59a'),
    clearcoat: .04, clearcoatRoughness: .7,
  });
  pele.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, peleU);
    sh.fragmentShader = `uniform vec3 uTom; uniform vec3 uSobr; uniform float uSardas; uniform float uBlush; uniform sampler2D uMask;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec4 mk = texture2D(uMask, vUv);
      vec3 tom = uTom;
      float pores = h21(floor(vUv*900.0))*.04 - .02;
      vec3 sk = tom * (1.0 + pores);
      vec3 lip = tom*vec3(1.0,.66,.66);
      sk = mix(sk, lip, mk.g);
      sk = mix(sk, sk*vec3(1.0,.78,.76), mk.b * uBlush);
      float fr = step(.83, h21(floor(vUv*1400.0))) * mk.a * uSardas;
      sk = mix(sk, tom*vec3(.72,.55,.42), fr*.7);
      sk = mix(sk, uSobr, mk.r * .92);
      diffuseColor.rgb = sk;`);
  };
  pele.customProgramCacheKey = () => 'pele1';
  pele.defines = { USE_UV: '' };

  const olhosU = { uIris: { value: new THREE.Color('#5a3a22') }, uTex: { value: IRIS_TEX } };
  const olhos = new THREE.MeshPhysicalMaterial({ roughness: .15, clearcoat: 1, clearcoatRoughness: .02 });
  olhos.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, olhosU);
    sh.fragmentShader = 'uniform vec3 uIris; uniform sampler2D uTex;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec4 t = texture2D(uTex, vUv);
      // canal A = máscara da íris; cor da íris tingida mantendo detalhe
      float lum = dot(t.rgb, vec3(.3,.59,.11));
      vec3 iris = uIris * (lum*2.2);
      diffuseColor.rgb = mix(t.rgb, iris, clamp((t.a-.5)*2.,0.,1.));`);
  };
  olhos.customProgramCacheKey = () => 'olhos1';
  olhos.defines = { USE_UV: '' };

  const cornea = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0, transmission: 0, transparent: true, opacity: .12,
    clearcoat: 1, clearcoatRoughness: 0, depthWrite: false,
  });
  const dentes = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: .35 });
  const lingua = new THREE.MeshStandardMaterial({ color: 0xc8606a, roughness: .5 });
  return { pele, peleU, olhos, olhosU, cornea, dentes, lingua };
}
