// Provador Mágico — peças ligadas ao corpo (roupas, cabelos, acessórios)
import * as THREE from 'three';

let CAT = null, DIR = 'assets/';
const cacheBin = new Map();

export async function carregarCatalogo(dir = 'assets/') {
  DIR = dir;
  if (!CAT) CAT = await fetch(dir + 'pecas/catalogo.json').then(r => r.json());
  return CAT;
}
export const catalogo = () => CAT;

async function bin(url) {
  if (!cacheBin.has(url)) cacheBin.set(url, fetch(url).then(r => r.arrayBuffer()));
  return cacheBin.get(url);
}

const TA = { float32: Float32Array, int16: Int16Array, uint16: Uint16Array, uint8: Uint8Array, uint32: Uint32Array, int8: Int8Array };

// ---------- texturas compartilhadas ----------
let TEX = null;
function texturas() {
  if (TEX) return TEX;
  const L = new THREE.TextureLoader();
  const t = (f, srgb) => {
    const x = L.load(DIR + 'avatar/' + f);
    x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 4;
    x.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return x;
  };
  TEX = { cabelo: t('cabelo.png', true), cabeloA: t('cabelo_a.png'), ciliosA: t('cilios_a.png') };
  return TEX;
}

// ---------- materiais ----------
const PADROES = { liso: 0, listras: 1, xadrez: 2, poa: 3, estrelas: 4, floral: 5, jeans: 6, glitter: 7, coracoes: 8, emblema: 9, principe: 10, remendo: 11 };
export const NOMES_PADRAO = {
  liso: 'Liso', listras: 'Listrado', xadrez: 'Xadrez', poa: 'Poá', estrelas: 'Estrelas', floral: 'Floral',
  jeans: 'Jeans', glitter: 'Glitter', coracoes: 'Corações', emblema: 'Emblema', principe: 'Real', remendo: 'Remendos',
};

const GLSL_PADROES = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float ruido(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float sdEstrela(vec2 p, float r){ const vec2 k1=vec2(0.809016994,-0.587785252); const vec2 k2=vec2(-k1.x,k1.y);
  p.x=abs(p.x); p-=2.0*max(dot(k1,p),0.0)*k1; p-=2.0*max(dot(k2,p),0.0)*k2; p.x=abs(p.x); p.y-=r;
  vec2 ba=.42*vec2(-k1.y,k1.x)-vec2(0,1); float h=clamp(dot(p,ba)/dot(ba,ba),0.0,r);
  return length(p-ba*h)*sign(p.y*ba.x-p.x*ba.y); }
float sdCoracao(vec2 p){ p.x=abs(p.x); p.y+=.5;
  if(p.y+p.x>1.0) return sqrt(dot(p-vec2(.25,.75),p-vec2(.25,.75)))-sqrt(2.0)/4.0;
  return sqrt(min(dot(p-vec2(0,1),p-vec2(0,1)), dot(p-.5*max(p.x+p.y,0.0),p-.5*max(p.x+p.y,0.0))))*sign(p.x-p.y); }
vec3 padrao2D(int tipo, vec2 q, vec3 c1, vec3 c2, vec3 c3, float aa){
  if(tipo==2){ // xadrez
    float a = smoothstep(.5-aa,.5+aa, abs(fract(q.x)*2.-1.));
    float b = smoothstep(.5-aa,.5+aa, abs(fract(q.y)*2.-1.));
    vec3 c = mix(c1, c2, .5*(a+b));
    float fino = step(.92, abs(fract(q.x*2.+.25)*2.-1.)) + step(.92, abs(fract(q.y*2.+.25)*2.-1.));
    return mix(c, c3, clamp(fino,0.,1.)*.6);
  }
  if(tipo==3){ vec2 g=fract(q+vec2(step(1.,mod(floor(q.y),2.))*.5,0.))-.5; return mix(c1,c2,smoothstep(.24+aa,.24-aa,length(g))); }
  if(tipo==4){ vec2 c=floor(q); vec2 g=fract(q)-.5; float r=.18+.1*h21(c); return mix(c1,c2,smoothstep(aa,-aa,sdEstrela(g,r))); }
  if(tipo==5){ vec2 c=floor(q*1.0); vec2 g=fract(q)-.5; g+= (vec2(h21(c),h21(c+3.))-.5)*.3;
    float a=atan(g.y,g.x), r=length(g); float pet=.16+.09*cos(a*5.);
    vec3 cor = mix(c1, mix(c2,c3,step(.5,h21(c+7.))), smoothstep(pet+aa,pet-aa,r));
    return mix(cor, vec3(1.,.85,.3), smoothstep(.06+aa,.06-aa,r)); }
  if(tipo==8){ vec2 g=fract(q)-.5; return mix(c1,c2,smoothstep(aa,-aa,sdCoracao(g*3.2))); }
  return c1;
}
vec3 tecidoCor(int tipo, vec3 p, vec3 n, vec3 c1, vec3 c2, vec3 c3, float esc, vec3 emb, vec2 uvv){
  float f = 28.0*esc;
  vec3 an = pow(abs(n), vec3(4.)); an/= (an.x+an.y+an.z);
  if(tipo==0) return c1;
  if(tipo==1){ float s = smoothstep(.45,.55, abs(fract(p.y*f*.9)*2.-1.)); return mix(c1,c2,s); }
  if(tipo==6 || tipo==11){ // jeans
    float tw = fract((p.x*an.z+p.z*an.x+p.y*1.)*420.*esc + p.y*420.*esc);
    float nz = ruido(p.xy*160.)*.12 + ruido(vec2(p.y*900., p.x*40.+p.z*40.))*.08;
    vec3 c = c1*(.9+nz+.08*step(.5,tw));
    if(tipo==11){
      vec2 q = p.xy; vec2 kn = vec2(abs(q.x)-.06, q.y-.27);
      float rem = step(abs(kn.x),.035)*step(abs(kn.y),.035);
      float rem2 = step(abs(abs(q.x)-.05),.03)*step(abs(q.y-.12),.025);
      float borda = (step(.029,abs(kn.x))+step(.029,abs(kn.y)))*rem;
      c = mix(c, mix(c2,c3,step(0.,q.x)), max(rem,rem2));
      c = mix(c, vec3(.95), borda*step(.5,fract((kn.x+kn.y)*120.)));
    }
    return c;
  }
  if(tipo==7){ float g = h21(floor(p.xy*700.)+floor(p.z*700.)); vec3 c=mix(c1, c1*1.15, ruido(p.xy*30.));
    return c + c2*step(.965,g)*1.2; }
  if(tipo==9){ // emblema no peito
    vec3 c = c1;
    vec2 d = p.xy - emb.xy;
    if(n.z>.3){ float r=length(d*vec2(1.,1.1)); c = mix(c, c2, smoothstep(.05,.047,r));
      c = mix(c, c3, smoothstep(.003,-.003, sdEstrela(d*vec2(1.,1.1), .028))); }
    float lat = smoothstep(.006,.003, abs(abs(p.x)-.0) - .0); // costura
    return c;
  }
  if(tipo==10){ // príncipe: faixa diagonal + botões dourados
    vec3 c = c1;
    float faixa = abs((p.y - emb.y) + p.x*.9);
    if(n.z>.2) c = mix(c, c2, smoothstep(.024,.021,faixa)*step(-.03, p.y-emb.y+.1));
    float bot = length(vec2(p.x, fract(p.y*28.)/28.-.018));
    if(n.z>.5 && abs(p.x)<.02 && p.y>emb.y-.14 && p.y<emb.y+.06) c = mix(c, c2, smoothstep(.007,.005,bot));
    return c;
  }
  // padrões 2D em projeção triplanar
  float aa = .06;
  vec3 a = padrao2D(tipo, p.zy*f*.5, c1,c2,c3,aa);
  vec3 b = padrao2D(tipo, p.xz*f*.5, c1,c2,c3,aa);
  vec3 cc = padrao2D(tipo, p.xy*f*.5, c1,c2,c3,aa);
  return a*an.x + b*an.y + cc*an.z;
}`;

function matTecido(m, emb) {
  const u = {
    c1: { value: new THREE.Color(m.cores[0]) }, c2: { value: new THREE.Color(m.cores[1] || '#fff') },
    c3: { value: new THREE.Color(m.cores[2] || m.cores[1] || '#fff') },
    tipo: { value: PADROES[m.padrao] ?? 0 }, esc: { value: m.escala || 1 }, emb: { value: new THREE.Vector3(...emb) },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    roughness: .82 - (m.brilho || 0) * .5, sheen: .6, sheenRoughness: .8, sheenColor: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide, clearcoat: (m.brilho || 0) * .3,
  });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute vec3 pat; varying vec3 vPat; varying vec3 vPN;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\n vPat = pat; vPN = normal;');
    sh.fragmentShader = `uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform int tipo; uniform float esc; uniform vec3 emb;
      varying vec3 vPat; varying vec3 vPN;\n` + GLSL_PADROES + "\n" + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 tc = tecidoCor(tipo, vPat, normalize(vPN), c1, c2, c3, esc, emb, vec2(0.));
      float trama = .94 + .06*ruido(vPat.xy*2600.) ;
      diffuseColor.rgb = tc * trama * (gl_FrontFacing ? 1.0 : .55);`);
  };
  mat.customProgramCacheKey = () => 'tecido3';
  mat.userData.u = u;
  return mat;
}

function matCabelo(m) {
  const T = texturas();
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(m.cores[0]), roughness: .48, metalness: 0,
    sheen: .6, sheenRoughness: .4, sheenColor: new THREE.Color(m.cores[0]).lerp(new THREE.Color('#ffffff'), .18),
    side: THREE.DoubleSide, anisotropy: .6, anisotropyRotation: Math.PI / 2,
  });
  if (!m.touca && !m.opaco) {
    mat.map = T.cabelo; mat.alphaMap = T.cabeloA; mat.alphaTest = .42; mat.alphaToCoverage = true;
  } else {
    mat.map = T.cabelo;
  }
  mat.userData.cabelo = true;
  return mat;
}

function criarMaterial(m, emb) {
  switch (m.tipo) {
    case 'tecido': return matTecido(m, emb);
    case 'cabelo': return matCabelo(m);
    case 'cilios': {
      const T = texturas();
      return new THREE.MeshStandardMaterial({ color: m.cores[0], roughness: .8, alphaMap: T.ciliosA, alphaTest: .35, alphaToCoverage: true, side: THREE.DoubleSide });
    }
    case 'metal': return new THREE.MeshPhysicalMaterial({ color: m.cores[0], metalness: 1, roughness: .22, clearcoat: .6, side: THREE.DoubleSide });
    case 'plastico': return new THREE.MeshPhysicalMaterial({ color: m.cores[0], roughness: .3, clearcoat: .6, side: THREE.DoubleSide });
    case 'lente': return new THREE.MeshPhysicalMaterial({ color: m.cores[0], roughness: .05, clearcoat: 1, transparent: true, opacity: .82, side: THREE.DoubleSide });
    case 'borracha': return new THREE.MeshStandardMaterial({ color: m.cores[0], roughness: .75, side: THREE.DoubleSide });
    case 'palha': {
      const u = { c1: { value: new THREE.Color(m.cores[0]) }, c2: { value: new THREE.Color(m.cores[1]) } };
      const mat = new THREE.MeshStandardMaterial({ roughness: .9, side: THREE.DoubleSide });
      mat.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, u);
        sh.fragmentShader = 'uniform vec3 c1; uniform vec3 c2;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          vec2 q = vUv*vec2(140., 40.);
          float t = step(.5, fract((floor(q.x)+floor(q.y))*.5));
          float fio = abs(fract(t>.5 ? q.x : q.y)*2.-1.);
          diffuseColor.rgb = mix(c2, c1, .55+.45*fio) * (gl_FrontFacing ? 1. : .7);`);
      };
      mat.defines = { USE_UV: '' };
      mat.customProgramCacheKey = () => 'palha1';
      mat.userData.u = u;
      return mat;
    }
    default: return new THREE.MeshStandardMaterial({ color: m.cores?.[0] || '#ccc', side: THREE.DoubleSide });
  }
}

// ---------- peça ----------
export class Peca {
  /** info: entrada do catálogo (item, cabelo ou cílios); pasta: 'pecas'|'cabelos' */
  static async carregar(info, pasta = 'pecas') {
    const buf = await bin(`${DIR}${pasta}/${info.id}.bin`);
    return new Peca(info, buf);
  }

  constructor(info, buf) {
    this.info = info; this.id = info.id;
    this.seg = {};
    for (const [k, s] of Object.entries(info.seg)) this.seg[k] = new TA[s.t](buf, s.o, s.n);
    this.malhas = [];
    this.cores = null;
  }

  montar(av) {
    const emb = CAT.emblema || [0, .62, .1];
    for (const pm of this.info.partes) {
      const s = k => this.seg[pm.p + '_' + k];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(pm.n * 3), 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pm.n * 3), 3));
      g.setAttribute('pat', new THREE.Float32BufferAttribute(new Float32Array(pm.n * 3), 3));
      if (pm.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(s('uv'), 2));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(s('si')), 4));
      const sw = s('sw'), W = new Float32Array(sw.length);
      for (let i = 0; i < sw.length; i++) W[i] = sw[i] / 255;
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(W, 4));
      g.setIndex(new THREE.BufferAttribute(s('idx'), 1));
      const mat = criarMaterial(pm.mat, emb);
      const m = new THREE.SkinnedMesh(g, mat);
      m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
      m.bind(av.skeleton, new THREE.Matrix4());
      m.userData.pm = pm;
      if (pm.mat.tipo === 'cabelo') m.renderOrder = 1;
      if (pm.mat.tipo === 'cilios') m.castShadow = false;
      av.inner.add(m);
      this.malhas.push(m);
    }
    this._preencherPat(av);
    if (this.cores) this.aplicarCores(this.cores);
  }

  desmontar(av) {
    for (const m of this.malhas) { av.inner.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.malhas = [];
  }

  _calc(av, pm, src, out) {
    const s = k => this.seg[pm.p + '_' + k];
    const refs = s('refs'), wts = s('wts'), offs = s('offs');
    const sc = CAT.scales[pm.sc], k = [0, 0, 0];
    ['x', 'y', 'z'].forEach((ax, j) => {
      const [a, b, r] = sc[ax]; k[j] = Math.abs(src[a * 3 + j] - src[b * 3 + j]) / r * pm.osc;
    });
    for (let i = 0; i < pm.n; i++) {
      const r0 = refs[i * 3] * 3, r1 = refs[i * 3 + 1] * 3, r2 = refs[i * 3 + 2] * 3;
      const w0 = wts[i * 3] / 255, w1 = wts[i * 3 + 1] / 255, w2 = wts[i * 3 + 2] / 255;
      for (let j = 0; j < 3; j++)
        out[i * 3 + j] = w0 * src[r0 + j] + w1 * src[r1 + j] + w2 * src[r2 + j] + offs[i * 3 + j] * k[j];
    }
  }

  _preencherPat(av) {
    const mid = av.formaMedia();
    for (const m of this.malhas) {
      this._calc(av, m.userData.pm, mid, m.geometry.attributes.pat.array);
      m.geometry.attributes.pat.needsUpdate = true;
    }
  }

  atualizar(av) {
    for (const m of this.malhas) {
      const pm = m.userData.pm;
      this._calc(av, pm, av.pos, m.geometry.attributes.position.array);
      m.geometry.attributes.position.needsUpdate = true;
      m.geometry.computeVertexNormals();
      m.geometry.computeBoundingSphere();
    }
  }

  // cores: [c1,c2,c3] e padrão — aplica em todas as partes de tecido / cor única nas demais
  aplicarCores(c) {
    this.cores = c;
    for (const m of this.malhas) {
      const u = m.material.userData.u;
      if (m.userData.pm.mat.tipo === 'tecido' && u) {
        if (c.c1) u.c1.value.set(c.c1);
        if (c.c2) u.c2.value.set(c.c2);
        if (c.c3) u.c3.value.set(c.c3);
        if (c.padrao != null && PADROES[c.padrao] != null) u.tipo.value = PADROES[c.padrao];
      } else if (m.material.userData.cabelo && c.cabelo) {
        m.material.color.set(c.cabelo);
        m.material.sheenColor.set(c.cabelo).lerp(new THREE.Color('#fff'), .18);
      } else if (['metal', 'plastico', 'borracha'].includes(m.userData.pm.mat.tipo) && c.c1) {
        m.material.color.set(c.c1);
      }
    }
  }
}
