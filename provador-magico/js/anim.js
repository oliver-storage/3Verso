// Provador Mágico — animação procedural do avatar (parado, andar, acenar, dançar, poses de card)
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);
const qa = (eixo, ang) => new THREE.Quaternion().setFromAxisAngle(eixo, ang);

export class Animador {
  constructor(av) {
    this.av = av;
    this.t = 0; this.vel = 0; this.fase = 0;
    this.acao = null; this.tAcao = 0;
    this.pose = null; // pose fixa para cards
    this.calibrar();
  }

  // rotações que levam os braços do A-pose para "ao lado do corpo"
  calibrar() {
    const av = this.av; this.base = {};
    for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1;
      const d = av.restDir(`upperarm01.${s}`);
      this.base[`upperarm01.${s}`] = Q().setFromUnitVectors(d, V(sg * .16, -1, .04).normalize());
      this.base[`lowerarm01.${s}`] = qa(X, -.18);
      this.base[`wrist.${s}`] = qa(Z, sg * .1);
      for (let f = 2; f <= 5; f++) for (let j = 1; j <= 3; j++) this.base[`finger${f}-${j}.${s}`] = qa(Z, sg * (.16 + j * .08));
      this.base[`finger1-2.${s}`] = qa(Y, sg * .2);
    }
  }

  tocar(acao) { this.acao = acao; this.tAcao = 0; }

  update(dt, vel = 0) {
    const av = this.av;
    this.t += dt; this.vel += (vel - this.vel) * Math.min(1, dt * 8);
    const v = this.vel;
    this.fase += dt * (2 + v * 5.5);
    const r = {};
    const set = (n, q) => { r[n] = r[n] ? q.clone().multiply(r[n]) : q.clone(); };
    for (const [n, q] of Object.entries(this.base)) set(n, q);

    // respiração / balanço parado
    const resp = Math.sin(this.t * 1.6);
    set('spine02', qa(X, resp * .012));
    set('neck01', qa(Y, Math.sin(this.t * .37) * .06 * (1 - Math.min(1, v * 2))));
    set('head', qa(X, Math.sin(this.t * .5) * .03));

    // andar
    if (v > .01) {
      const a = Math.min(1, v * 1.4), s = Math.sin(this.fase), c = Math.cos(this.fase);
      for (const [lado, sg] of [['L', 1], ['R', -1]]) {
        const ph = sg * s;
        set(`upperleg01.${lado}`, qa(X, -ph * .55 * a));
        set(`lowerleg01.${lado}`, qa(X, Math.max(0, -sg * c) * .9 * a));
        set(`foot.${lado}`, qa(X, ph * .2 * a));
        set(`upperarm01.${lado}`, qa(X, ph * .5 * a));
        set(`lowerarm01.${lado}`, qa(X, -.25 * a));
      }
      set('spine04', qa(Y, s * .08 * a));
      set('spine01', qa(Y, -s * .1 * a));
      set('spine03', qa(X, .05 * a));
      av.inner.position.y = (av._yBase ?? av.inner.position.y);
    }

    // ações
    if (this.acao) {
      this.tAcao += dt;
      const t = this.tAcao;
      const fim = { acenar: 2.4, dancar: 4, pular: .9, girar: 1.6, comemorar: 2 }[this.acao] || 2;
      const env = Math.min(1, t * 4, (fim - t) * 4);
      if (this.acao === 'acenar') {
        set('upperarm01.R', Q().slerp(Q().setFromUnitVectors(V(-.16, -1, .04).normalize(), V(-.55, .8, .2).normalize()), env));
        set('lowerarm01.R', qa(Z, -Math.sin(t * 9) * .45 * env).multiply(qa(Y, .3 * env)));
      } else if (this.acao === 'dancar') {
        const b = Math.sin(t * 7);
        set('spine04', qa(Z, b * .12 * env)); set('spine02', qa(Z, -b * .08 * env));
        for (const [lado, sg] of [['L', 1], ['R', -1]]) {
          set(`upperarm01.${lado}`, Q().slerp(qa(Z, sg * (1.2 + .3 * Math.sin(t * 7 + sg)) ), env));
          set(`lowerarm01.${lado}`, qa(X, -.8 * env));
          set(`upperleg01.${lado}`, qa(X, Math.max(0, sg * b) * -.4 * env));
          set(`lowerleg01.${lado}`, qa(X, Math.max(0, sg * b) * .7 * env));
        }
      } else if (this.acao === 'comemorar') {
        for (const [lado, sg] of [['L', 1], ['R', -1]])
          set(`upperarm01.${lado}`, Q().slerp(Q().setFromUnitVectors(V(sg * .16, -1, .04).normalize(), V(sg * .45, .9, .1).normalize()), env));
      } else if (this.acao === 'girar') {
        av.root.rotation.y += dt * Math.PI * 2 / fim * 1.0;
      }
      if (t > fim) this.acao = null;
    }

    if (this.pose) for (const [n, q] of Object.entries(this.pose)) set(n, q);
    for (const b of av.bones) b.quaternion.copy(r[b.name] || Q());
  }
}

// poses prontas para os cards
export const POSES = {
  natural: {},
  maos_cintura: (() => {
    const p = {};
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      p[`upperarm01.${s}`] = qa(Z, sg * .55).multiply(qa(X, .25));
      p[`lowerarm01.${s}`] = qa(Y, -sg * 1.7).multiply(qa(X, -.4));
    }
    return p;
  })(),
  heroi: (() => {
    const p = {};
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      p[`upperarm01.${s}`] = qa(Z, sg * .5);
      p[`lowerarm01.${s}`] = qa(Y, -sg * 1.6);
      p[`upperleg01.${s}`] = qa(Z, sg * .12);
    }
    p['spine01'] = qa(X, -.08);
    return p;
  })(),
  tchau: { 'upperarm01.R': qa(Z, -2.3), 'lowerarm01.R': qa(Z, -.4) },
  vitoria: { 'upperarm01.R': qa(Z, -2.5), 'upperarm01.L': qa(Z, 2.5) },
  princesa: (() => {
    const p = {};
    for (const [s, sg] of [['L', 1], ['R', -1]]) { p[`upperarm01.${s}`] = qa(Z, sg * .35).multiply(qa(X, -.15)); p[`lowerarm01.${s}`] = qa(Y, -sg * .5); }
    p['upperleg01.R'] = qa(X, .12); p['lowerleg01.R'] = qa(X, .3); p['head'] = qa(Z, .1);
    return p;
  })(),
};
