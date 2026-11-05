// Provador Mágico — gerador de cards para Instagram/WhatsApp
import { CONFIG } from './config.js';

export const FORMATOS = {
  feed: { nome: 'Feed (4:5)', w: 1080, h: 1350 },
  story: { nome: 'Story (9:16)', w: 1080, h: 1920 },
  quadrado: { nome: 'Quadrado (1:1)', w: 1080, h: 1080 },
};

export const MODELOS = {
  look: { nome: 'Look do Dia', titulo: n => `O look de ${n}`, sub: t => t },
  desafio: { nome: 'Desafio da Semana', titulo: () => 'Desafio aceito!', sub: t => `Tema: ${t}` },
  aniversario: { nome: 'Aniversário', titulo: n => `Parabéns, ${n}!`, sub: () => 'Meu look de aniversário' },
  cresci: { nome: 'Eu Cresci!', titulo: n => `${n} cresceu!`, sub: (t, i) => `Agora com ${i} anos` },
  conquista: { nome: 'Conquista', titulo: n => `${n} arrasou!`, sub: t => `Look completo: ${t}` },
};

const cacheImg = new Map();
function img(url) {
  if (!url) return Promise.resolve(null);
  if (!cacheImg.has(url)) cacheImg.set(url, new Promise(res => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = url;
  }));
  return cacheImg.get(url);
}

function rr(x, a, b, w, h, r) {
  x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
}

/** foto: canvas/imagem do avatar renderizado (proporção do formato)
 *  d: { loja, crianca, idade, tema, modelo, formato, link } */
export async function gerarCard(foto, d) {
  const F = FORMATOS[d.formato] || FORMATOS.feed, M = MODELOS[d.modelo] || MODELOS.look;
  const c = document.createElement('canvas'); c.width = F.w; c.height = F.h;
  const x = c.getContext('2d');
  const cores = d.loja.cores || {}, P = cores.primaria || '#e84a7f', S = cores.secundaria || '#7ec8e3', D = cores.destaque || '#ffd166';
  // fundo
  const gr = x.createLinearGradient(0, 0, F.w, F.h); gr.addColorStop(0, P); gr.addColorStop(1, S);
  x.fillStyle = gr; x.fillRect(0, 0, F.w, F.h);
  // confetes
  const rnd = mulberry(d.crianca.length * 97 + F.h);
  for (let i = 0; i < 70; i++) {
    x.fillStyle = [D, '#ffffff', P, S][i % 4]; x.globalAlpha = .35 + rnd() * .4;
    const cx = rnd() * F.w, cy = rnd() * F.h, s = 6 + rnd() * 14;
    x.save(); x.translate(cx, cy); x.rotate(rnd() * 6); x.fillRect(-s / 2, -s / 4, s, s / 2); x.restore();
  }
  x.globalAlpha = 1;
  // moldura da foto
  const m = 56, topo = 190, base = d.formato === 'story' ? 520 : 330;
  const fw = F.w - m * 2, fh = F.h - topo - base;
  x.save(); x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 40; x.shadowOffsetY = 14;
  x.fillStyle = '#ffffff'; rr(x, m - 14, topo - 14, fw + 28, fh + 28, 46); x.fill(); x.restore();
  x.save(); rr(x, m, topo, fw, fh, 36); x.clip();
  if (foto) {
    const k = Math.max(fw / foto.width, fh / foto.height), w = foto.width * k, h = foto.height * k;
    x.drawImage(foto, m + (fw - w) / 2, topo + (fh - h) / 2, w, h);
  }
  x.restore();
  // logo + nome da loja no topo
  const logo = await img(d.loja.logo);
  x.textBaseline = 'middle';
  if (logo) {
    const lh = 120, lw = Math.min(380, logo.width * lh / logo.height);
    x.fillStyle = 'rgba(255,255,255,.95)'; rr(x, F.w / 2 - lw / 2 - 26, 36, lw + 52, lh + 20, 40); x.fill();
    x.drawImage(logo, F.w / 2 - lw / 2, 46, lw, lh);
  } else {
    x.fillStyle = '#ffffff'; x.font = '900 78px Nunito, system-ui, sans-serif'; x.textAlign = 'center';
    x.fillText(d.loja.nome, F.w / 2, 100, F.w - 120);
  }
  // selo do modelo
  x.save(); x.translate(F.w - m - 20, topo + 40); x.rotate(.12);
  x.fillStyle = D; rr(x, -230, -38, 260, 76, 38); x.fill();
  x.fillStyle = '#3b2a1a'; x.font = '900 34px Nunito, system-ui, sans-serif'; x.textAlign = 'center';
  x.fillText(M.nome.toUpperCase(), -100, 2, 240); x.restore();
  // textos de baixo
  const y0 = topo + fh + 40;
  x.textAlign = 'center'; x.fillStyle = '#ffffff';
  x.font = '900 76px Nunito, system-ui, sans-serif';
  x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 12;
  x.fillText(M.titulo(d.crianca), F.w / 2, y0 + 50, F.w - 100);
  x.font = '700 44px Nunito, system-ui, sans-serif';
  x.fillText(M.sub(d.tema, d.idade), F.w / 2, y0 + 120, F.w - 100);
  x.shadowBlur = 0;
  // chamada para marcar a loja
  const ig = d.loja.instagram ? (d.loja.instagram.startsWith('@') ? d.loja.instagram : '@' + d.loja.instagram) : '';
  const hashtag = '#' + (d.loja.nome || 'loja').replace(/[^\p{L}\p{N}]/gu, '') + 'Kids3D';
  const linhaY = y0 + (d.formato === 'story' ? 230 : 195);
  x.fillStyle = 'rgba(255,255,255,.95)'; rr(x, m, linhaY - 44, F.w - m * 2 - (d.link ? 200 : 0), 88, 44); x.fill();
  x.fillStyle = P; x.font = '800 38px Nunito, system-ui, sans-serif'; x.textAlign = 'left';
  x.fillText(ig ? `Marque ${ig}  ${hashtag}` : hashtag, m + 34, linhaY + 2, F.w - m * 2 - 260);
  // QR para o site
  if (d.link && window.qrcode) {
    const q = window.qrcode(0, 'M'); q.addData(d.link); q.make();
    const n = q.getModuleCount(), tam = 170, cs = tam / n, qx = F.w - m - tam, qy = linhaY - tam / 2 - 6;
    x.fillStyle = '#ffffff'; rr(x, qx - 12, qy - 12, tam + 24, tam + 24, 20); x.fill();
    x.fillStyle = '#1b1b1b';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(qx + k * cs, qy + r * cs, cs + .5, cs + .5);
  }
  // assinatura
  x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '600 26px Nunito, system-ui, sans-serif';
  x.fillText(`Feito no ${CONFIG.SISTEMA} • ${CONFIG.PLATAFORMA}`, F.w / 2, F.h - 40);
  return c;
}

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export async function compartilhar(canvas, nome, texto) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], nome + '.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: texto }); return 'compartilhado'; } catch { return 'cancelado'; }
  }
  baixar(canvas, nome); return 'baixado';
}

export function baixar(canvas, nome) {
  const a = document.createElement('a'); a.download = nome + '.png'; a.href = canvas.toDataURL('image/png'); a.click();
}
