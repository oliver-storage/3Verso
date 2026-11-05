// Provador Mágico — aplicação (fluxo: loja → login → responsável → criança → avatar → loja 3D → provador → card)
import * as THREE from 'three';
import { CONFIG, rodape } from './config.js';
import * as api from './api.js';
import { carregarBase, Avatar } from './avatar.js';
import { carregarCatalogo, catalogo, Peca, NOMES_PADRAO } from './pecas.js';
import { Animador, POSES } from './anim.js';
import { Cena, TEMAS } from './cena.js';
import { gerarCard, compartilhar, baixar, FORMATOS, MODELOS } from './card.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const E = {}; // estado
const telas = ['carregando', 'entrada', 'completar', 'criancas', 'editor', 'hud', 'provador'];
function tela(id) { for (const t of telas) $('#' + t).classList.toggle('ativa', t === id); E.tela = id; enquadrar(); }
function modal(id, on = true) { $('#' + id).classList.toggle('ativa', on); }
function toast(m, ms = 3200) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms); }
function msg(form, texto, okk = false) { const p = form.querySelector('.msg') || $('#msg-entrada'); p.textContent = texto || ''; p.classList.toggle('ok', okk); }
function progresso(p, t) { $('#barra').style.width = Math.round(p * 100) + '%'; if (t) $('#msg-carregando').textContent = t; }
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

$$('.rodape').forEach(rodape);
$$('.dev').forEach(e => e.textContent = CONFIG.DESENVOLVEDOR);

// ---------- paletas ----------
const PELES = ['#f6d7c3', '#efc3a4', '#e8b796', '#d9a07a', '#c68a62', '#a8724f', '#8a5a3c', '#6b4229', '#4f2f1c'];
const OLHOS = ['#5a3a22', '#3b2416', '#7a5a2e', '#3d6e9e', '#5b8fbf', '#4f7a4a', '#7a8a5a', '#6b6b6b'];
const CABELOS = ['#111111', '#2b1a10', '#3b2414', '#6b3e1e', '#8a5a2b', '#b07a3e', '#d9a441', '#e8c77a', '#a0341f', '#c4552b', '#ff6fa5', '#7b5cff'];
const TECIDO = ['#ffffff', '#1d1d1d', '#e63946', '#ff8fb1', '#ffb3c7', '#c9a7ff', '#7b5cff', '#4b7bd6', '#7ec8e3', '#00b4d8', '#06d6a0', '#7a8b5a', '#ffd166', '#f4a261', '#7b4a26', '#f4f1ea'];
const ROSTO = [
  ['olhos_tamanho', 'Tamanho dos olhos'], ['olhos_distancia', 'Distância dos olhos'], ['sobrancelhas_altura', 'Sobrancelhas'],
  ['nariz_largura', 'Largura do nariz'], ['nariz_tamanho', 'Tamanho do nariz'], ['nariz_ponta', 'Ponta do nariz'],
  ['boca_largura', 'Largura da boca'], ['labios_volume', 'Lábios'], ['bochechas', 'Bochechas'],
  ['rosto_cheinho', 'Rosto cheinho'], ['rosto_largura', 'Largura do rosto'], ['queixo', 'Queixo'], ['orelhas_tamanho', 'Orelhas'],
];
const ICONE_SLOT = { top: '👕', bottom: '👖', full: '👗', pes: '👟', meias: '🧦', cabeca: '👒', costas: '🦸', rosto: '🕶️', cintura: '🎗️', bracos: '💪', pescoco: '🧣', cabelo_acc: '🎀' };
const NOME_SLOT = { top: 'Blusas', bottom: 'Calças/Saias', full: 'Vestidos/Trajes', pes: 'Calçados', meias: 'Meias', cabeca: 'Chapéus', costas: 'Capas', rosto: 'Rosto', cintura: 'Cintos', bracos: 'Braços', pescoco: 'Pescoço', cabelo_acc: 'Cabelo' };

// ---------- 3D ----------
const cena = new Cena($('#gl'));
let av = null, anim = null, cilios = null;
const pecas = new Map(); // id -> Peca (montada)
let cabeloPeca = null;
const teclas = new Set(), joy = { x: 0, y: 0 };

function altura() { return av ? av.alturaBruta * av.escala : 1.2; }

function enquadrar() {
  const c = cena.cam, w = innerWidth, h = innerHeight;
  if (!av) return;
  if (['editor', 'provador'].includes(E.tela) || E.cardAberto) {
    const mob = w <= 720;
    cena.quadro(av.root, altura(), mob ? { dist: 4.6, alt: .5, lado: .1, fov: 30 } : { dist: 2.5, alt: .55, lado: .18, fov: 30 });
    if (mob) c.setViewOffset(w, h, 0, h * .27, w, h); else c.setViewOffset(w, h, 200, 0, w, h);
  } else {
    c.clearViewOffset(); cena.livre();
  }
  c.updateProjectionMatrix();
}
addEventListener('resize', enquadrar);

function loop() {
  const dt = cena.tick();
  if (av && anim) {
    let vel = 0;
    if (E.tela === 'hud' && !E.cardAberto) {
      let mx = joy.x, mz = joy.y;
      if (teclas.has('arrowleft') || teclas.has('a')) mx -= 1;
      if (teclas.has('arrowright') || teclas.has('d')) mx += 1;
      if (teclas.has('arrowup') || teclas.has('w')) mz -= 1;
      if (teclas.has('arrowdown') || teclas.has('s')) mz += 1;
      const m = Math.hypot(mx, mz);
      if (m > .08) {
        const k = Math.min(1, m); mx /= m; mz /= m;
        const sp = 1.7 * Math.max(.8, altura() / 1.2) * k;
        av.root.position.x += mx * sp * dt; av.root.position.z += mz * sp * dt;
        cena.colidir(av.root.position);
        const alvo = Math.atan2(mx, mz);
        let d = alvo - av.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        av.root.rotation.y += d * Math.min(1, dt * 10);
        vel = k;
      }
      cena.seguir(av.root, dt, altura());
      verZona();
    } else if (E.girar) av.root.rotation.y += dt * 1.2;
    anim.update(dt, vel);
  }
  cena.render();
  requestAnimationFrame(loop);
}

function verZona() {
  const z = cena.zonaEm(av.root.position), b = $('#acao-zona');
  if (z?.id !== E.zona?.id) { E.zona = z; b.hidden = !z; if (z) b.textContent = z.rotulo; }
}

// ---------- controles ----------
addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea')) return;
  const k = e.key.toLowerCase(); teclas.add(k);
  if ((k === 'enter' || k === 'e') && E.zona && E.tela === 'hud') acaoZona();
});
addEventListener('keyup', e => teclas.delete(e.key.toLowerCase()));
addEventListener('blur', () => teclas.clear());
{
  const j = $('#joy'), bola = j.querySelector('i'); let id = null;
  const mover = e => { const r = j.getBoundingClientRect(), R = r.width / 2;
    let x = e.clientX - r.left - R, y = e.clientY - r.top - R; const m = Math.hypot(x, y); if (m > R) { x *= R / m; y *= R / m; }
    joy.x = x / R; joy.y = y / R; bola.style.transform = `translate(${x}px,${y}px)`; };
  j.addEventListener('pointerdown', e => { id = e.pointerId; j.setPointerCapture(id); mover(e); });
  j.addEventListener('pointermove', e => { if (e.pointerId === id) mover(e); });
  const fim = () => { id = null; joy.x = joy.y = 0; bola.style.transform = ''; };
  j.addEventListener('pointerup', fim); j.addEventListener('pointercancel', fim);
}
// girar o avatar arrastando no editor/provador
{
  let ini = null;
  $('#gl').addEventListener('pointerdown', e => { if (['editor', 'provador'].includes(E.tela)) ini = { x: e.clientX, r: av?.root.rotation.y }; });
  addEventListener('pointermove', e => { if (ini && av) av.root.rotation.y = ini.r + (e.clientX - ini.x) * .01; });
  addEventListener('pointerup', () => ini = null);
}

// ---------- loja / marca ----------
async function iniciar() {
  const slug = new URLSearchParams(location.search).get('loja') || CONFIG.EMPRESA_PADRAO;
  try { E.loja = await api.configLoja(slug); }
  catch (e) { progresso(0, e.message); return; }
  aplicarMarca(E.loja);
  progresso(.08, 'Carregando o avatar…');
  const [base] = await Promise.all([carregarBase('assets/avatar/base'), carregarCatalogo('assets/')]);
  E.base = base;
  progresso(.6, 'Montando a loja…');
  cena.ambiente('loja', { ...E.loja.cores, nome: E.loja.nome });
  requestAnimationFrame(loop);
  progresso(1, 'Pronto!');
  api.sb.auth.onAuthStateChange((ev, s) => {
    if (ev === 'PASSWORD_RECOVERY') novaSenha();
    if (ev === 'SIGNED_IN' && E.tela === 'entrada') posLogin();
  });
  (await api.sessao()) ? posLogin() : tela('entrada');
}

function aplicarMarca(l) {
  const c = l.cores || {}, r = document.documentElement.style;
  if (c.primaria) r.setProperty('--p', c.primaria);
  if (c.secundaria) r.setProperty('--s', c.secundaria);
  if (c.destaque) r.setProperty('--d', c.destaque);
  document.querySelector('meta[name=theme-color]').content = c.primaria || '#e84a7f';
  document.title = `${CONFIG.SISTEMA} • ${l.nome}`;
  $$('.nome-loja').forEach(e => e.textContent = l.nome);
  $('#nome-carregando').textContent = l.nome;
  $$('.logo-img, #logo-carregando').forEach(i => { if (l.logo) i.src = l.logo; else i.removeAttribute('src'); });
  $$('.ig-loja').forEach(e => e.textContent = l.instagram ? (l.instagram.startsWith('@') ? l.instagram : '@' + l.instagram) : 'a loja');
}

// ---------- entrada ----------
$$('.abas button').forEach(b => b.onclick = () => {
  $$('.abas button').forEach(x => x.classList.toggle('ativa', x === b));
  $('#f-entrar').hidden = b.dataset.aba !== 'entrar'; $('#f-criar').hidden = b.dataset.aba !== 'criar'; msg($('#f-entrar'), '');
});
$$('.btn-social').forEach(b => {
  const on = CONFIG.LOGIN_SOCIAL[b.dataset.prov];
  if (!on) { b.disabled = true; b.title = 'Em breve'; b.append(' (em breve)'); }
  b.onclick = async () => { try { await api.entrarSocial(b.dataset.prov); } catch (e) { msg($('#f-entrar'), e.message); } };
});
$('#f-entrar').onsubmit = async e => {
  e.preventDefault(); const f = e.target, b = f.querySelector('button'); b.disabled = true; msg(f, '');
  try { await api.entrar(f.email.value.trim(), f.senha.value); await posLogin(); }
  catch (er) { msg(f, er.message); } finally { b.disabled = false; }
};
$('#f-criar').onsubmit = async e => {
  e.preventDefault(); const f = e.target, b = f.querySelector('button'); b.disabled = true; msg(f, '');
  try {
    const r = await api.cadastrar(f.email.value.trim(), f.senha.value, f.nome.value.trim());
    if (r.session) await posLogin();
    else msg(f, '📩 Enviamos um link para o seu e-mail. Confirme e depois entre.', true);
  } catch (er) { msg(f, er.message); } finally { b.disabled = false; }
};
$('#esqueci').onclick = async e => {
  e.preventDefault(); const f = $('#f-entrar'), em = f.email.value.trim();
  if (!em) return msg(f, 'Digite seu e-mail acima e clique de novo.');
  try { await api.recuperarSenha(em); msg(f, '📩 Enviamos o link para trocar a senha.', true); } catch (er) { msg(f, er.message); }
};
async function novaSenha() {
  const s = prompt('Digite a nova senha (10+ caracteres, com maiúscula, minúscula, número e símbolo):');
  if (!s) return;
  const { error } = await api.sb.auth.updateUser({ password: s });
  toast(error ? api.traduzir(error).message : 'Senha alterada!');
}
$$('.ver-termos').forEach(a => a.onclick = e => { e.preventDefault(); modal('termos'); });
$('#tm-fechar').onclick = () => modal('termos', false);

async function posLogin() {
  try {
    E.cli = await api.meuCliente(E.loja.empresa_id);
    if (!E.cli) {
      const s = await api.sessao(), f = $('#f-completar');
      f.nome.value = s?.user?.user_metadata?.nome || s?.user?.user_metadata?.full_name || '';
      return tela('completar');
    }
    await listarCriancas();
  } catch (e) { toast(e.message); tela('entrada'); }
}

$('#f-completar').onsubmit = async e => {
  e.preventDefault(); const f = e.target, b = f.querySelector('button'); b.disabled = true; msg(f, '');
  const w = f.whatsapp.value.replace(/\D/g, '');
  const whats = w.length >= 12 ? '+' + w : '+55' + w;
  if (w.length < 10 || w.length > 13) { msg(f, 'WhatsApp inválido. Use DDD + número.'); b.disabled = false; return; }
  try { E.cli = await api.criarCliente(E.loja.empresa_id, { nome: f.nome.value.trim(), whatsapp: whats, marketing: f.marketing.checked }); await listarCriancas(); }
  catch (er) { msg(f, er.message); } finally { b.disabled = false; }
};

// ---------- crianças ----------
async function listarCriancas() {
  E.criancas = await api.criancas(E.cli.id);
  const L = $('#lista-criancas'); L.innerHTML = '';
  for (const c of E.criancas) {
    const i = api.idade(c.data_nascimento), b = document.createElement('div');
    b.className = 'crianca'; b.tabIndex = 0;
    b.innerHTML = `<button class="del" title="Excluir">✕</button><span class="emo">${c.genero === 'menina' ? '👧' : '👦'}</span><b>${esc(c.nome)}</b><span>${i} ${i === 1 ? 'ano' : 'anos'}</span>`;
    b.onclick = ev => { if (ev.target.closest('.del')) return; escolherCrianca(c); };
    b.querySelector('.del').onclick = async () => {
      if (!confirm(`Excluir ${c.nome} e todos os looks dela(e)?`)) return;
      const { error } = await api.sb.from('criancas').delete().eq('id', c.id);
      if (error) toast(api.traduzir(error).message); else listarCriancas();
    };
    L.append(b);
  }
  $('#nova-crianca').open = !E.criancas.length;
  tela('criancas');
}
$('#f-crianca').onsubmit = async e => {
  e.preventDefault(); const f = e.target, b = f.querySelector('button'); b.disabled = true; msg(f, '');
  const i = api.idade(f.nasc.value);
  if (isNaN(i) || i < 0 || i > 17) { msg(f, 'Data de nascimento inválida.'); b.disabled = false; return; }
  try {
    const c = await api.criarCrianca(E.cli, { nome: f.nome.value.trim(), data_nascimento: f.nasc.value, genero: f.genero.value });
    f.reset(); if (i < CONFIG.IDADE_MIN || i > CONFIG.IDADE_MAX) toast(`A loja tem peças de ${CONFIG.IDADE_MIN} a ${CONFIG.IDADE_MAX} anos; o avatar usa a idade mais próxima.`);
    await listarCriancas(); escolherCrianca({ ...c, pm_avatares: null });
  } catch (er) { msg(f, er.message); } finally { b.disabled = false; }
};
$('#sair1').onclick = sair;
async function sair() { await api.sair(); location.reload(); }

async function escolherCrianca(c) {
  tela('carregando'); progresso(.2, `Preparando ${c.nome}…`);
  E.crianca = c; E.idade = api.idade(c.data_nascimento);
  const salvo = (Array.isArray(c.pm_avatares) ? c.pm_avatares[0] : c.pm_avatares)?.params;
  const menina = c.genero === 'menina';
  E.params = Object.assign({
    pele: '#e8b796', olhos: '#5a3a22', cabeloCor: '#3b2414', cabelo: menina ? 'longo' : 'curto',
    peso: 0, altura: 0, sardas: 0, blush: menina ? .4 : .25, face: {}, expr: {},
  }, salvo || {});
  E.look = salvo?.look || {}; E.cores = salvo?.cores || {};
  const ida = Math.min(CONFIG.IDADE_MAX, Math.max(CONFIG.IDADE_MIN, E.idade));
  if (av) { cena.sc.remove(av.root); for (const p of pecas.values()) av.remover(p); pecas.clear(); }
  av = new Avatar(E.base, { ...E.params, idade: ida, menino: menina ? 0 : 1 });
  cena.sc.add(av.root);
  anim = new Animador(av);
  progresso(.5, 'Penteando o cabelo…');
  const cat = catalogo();
  cilios = await Peca.carregar({ id: 'cilios', ...cat.cilios }); av.anexar(cilios);
  await trocarCabelo(E.params.cabelo);
  progresso(.8, 'Vestindo…');
  if (!Object.keys(E.look).length) E.look = menina ? { full: 'vestido', pes: 'sapatilha' } : { top: 'camiseta', bottom: 'bermuda', pes: 'tenis' };
  for (const id of Object.values(E.look)) await vestir(id, true);
  progresso(1);
  if (salvo) irLoja(); else abrirEditor();
}

async function trocarCabelo(id) {
  if (cabeloPeca) { av.remover(cabeloPeca); cabeloPeca = null; }
  const info = catalogo().cabelos.find(c => c.id === id); if (!info) return;
  E.params.cabelo = id;
  const p = await Peca.carregar(info, 'cabelos');
  if (E.params.cabelo !== id) return; // trocou no meio do download
  av.anexar(p); p.aplicarCores({ cabelo: E.params.cabeloCor }); cabeloPeca = p;
}

// ---------- editor ----------
const ABAS = {
  'Pele': () => cores(PELES, 'pele'),
  'Cabelo': () => {
    const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;gap:12px';
    const op = document.createElement('div'); op.className = 'opcoes';
    const lista = [...catalogo().cabelos].sort((a, b) => (b.genero === (E.crianca.genero === 'menina' ? 'f' : 'm')) - (a.genero === (E.crianca.genero === 'menina' ? 'f' : 'm')));
    for (const c of lista) {
      const b = document.createElement('button'); b.textContent = c.nome; b.classList.toggle('ativa', c.id === E.params.cabelo);
      b.onclick = async () => { op.querySelectorAll('button').forEach(x => x.classList.toggle('ativa', x === b)); await trocarCabelo(c.id); };
      op.append(b);
    }
    d.append(op, cores(CABELOS, 'cabeloCor', v => cabeloPeca?.aplicarCores({ cabelo: v })));
    return d;
  },
  'Olhos': () => cores(OLHOS, 'olhos'),
  'Rosto': () => {
    const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;gap:12px';
    for (const [k, n] of ROSTO) d.append(slider(n, E.params.face[k] || 0, -1, 1, v => { E.params.face[k] = v; refazer(); }));
    return d;
  },
  'Corpo': () => {
    const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;gap:12px';
    d.append(slider('Corpo (magrinho ↔ fofinho)', E.params.peso, -1, 1, v => { E.params.peso = v; refazer(); }));
    d.append(slider('Altura para a idade', E.params.altura, -1, 1, v => { E.params.altura = v; refazer(); }));
    return d;
  },
  'Detalhes': () => {
    const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;gap:12px';
    d.append(slider('Sardinhas', E.params.sardas, 0, 1, v => { E.params.sardas = v; refazer(); }));
    d.append(slider('Bochechas rosadas', E.params.blush, 0, 1, v => { E.params.blush = v; refazer(); }));
    d.append(slider('Sorriso', E.params.expr.sorriso || 0, 0, 1, v => { E.params.expr.sorriso = v; refazer(); }));
    return d;
  },
};
let refazerH = 0;
function refazer() { cancelAnimationFrame(refazerH); refazerH = requestAnimationFrame(() => av.set({ ...E.params, idade: av.params.idade, menino: av.params.menino })); }
function cores(lista, chave, extra) {
  const d = document.createElement('div'); d.className = 'cores';
  const marcar = v => d.querySelectorAll('button').forEach(b => b.classList.toggle('ativa', b.dataset.c === v));
  const set = v => { E.params[chave] = v; marcar(v); extra ? extra(v) : refazer(); };
  for (const c of lista) { const b = document.createElement('button'); b.dataset.c = c; b.style.background = c; b.onclick = () => set(c); b.title = c; d.append(b); }
  const i = document.createElement('input'); i.type = 'color'; i.value = E.params[chave]; i.oninput = () => set(i.value); i.title = 'Outra cor'; d.append(i);
  marcar(E.params[chave]); return d;
}
function slider(nome, v, min, max, cb) {
  const l = document.createElement('label'); l.className = 'slider';
  l.innerHTML = `<span>${nome}</span><output></output><input type="range" min="${min}" max="${max}" step="0.05" value="${v}">`;
  const i = l.querySelector('input'), o = l.querySelector('output');
  const show = () => o.textContent = Math.round(i.value * 100);
  i.oninput = () => { show(); cb(+i.value); }; show(); return l;
}
function abrirEditor() {
  cena.ambiente('estudio', { ...E.loja.cores, fundo: '#f6efff' });
  av.root.position.set(0, 0, 0); av.root.rotation.y = 0;
  anim.pose = null;
  $('#ed-idade').textContent = `${E.crianca.nome} • ${E.idade} anos`;
  const nav = $('#abas-ed'); nav.innerHTML = '';
  for (const n of Object.keys(ABAS)) {
    const b = document.createElement('button'); b.textContent = n;
    b.onclick = () => { nav.querySelectorAll('button').forEach(x => x.classList.toggle('ativa', x === b)); $('#ed-conteudo').replaceChildren(ABAS[n]()); };
    nav.append(b);
  }
  nav.firstChild.click();
  tela('editor');
}
$('#ed-girar').onclick = () => { E.girar = !E.girar; };
$('#ed-salvar').onclick = async () => {
  const b = $('#ed-salvar'); b.disabled = true;
  try { await salvar(); irLoja(); } catch (e) { toast(e.message); } finally { b.disabled = false; E.girar = false; }
};
async function salvar() { await api.salvarAvatar(E.crianca, { ...E.params, look: E.look, cores: E.cores }); }

// ---------- loja e temas ----------
function irLoja() { entrarTema('loja'); }
function entrarTema(t) {
  E.tema = t;
  cena.ambiente(t, { ...E.loja.cores, nome: E.loja.nome });
  av.root.position.copy(cena.spawn); av.root.rotation.y = Math.PI;
  cena.camYaw = 0; cena.cam.position.set(cena.spawn.x, 1.8, cena.spawn.z + 4);
  $('#h-local').textContent = (TEMAS[t].icone || '🏬') + ' ' + (t === 'loja' ? E.loja.nome : TEMAS[t].nome);
  $('#h-voltar').hidden = t === 'loja';
  $('#dica').textContent = t === 'loja' ? 'Ande pela loja e entre nos portais dos temas ou no provador!' : 'Abra o provador e monte o look do tema!';
  E.zona = null; $('#acao-zona').hidden = true;
  tela('hud');
}
function acaoZona() {
  const z = E.zona; if (!z) return;
  if (z.id === 'provador') abrirProvador();
  else if (z.id.startsWith('tema:')) entrarTema(z.id.slice(5));
}
$('#acao-zona').onclick = acaoZona;
$('#h-voltar').onclick = irLoja;
$('#h-provador').onclick = () => abrirProvador();
$('#h-menu').onclick = () => $('#menu').hidden = !$('#menu').hidden;
$('#menu').onclick = async e => {
  const m = e.target.dataset.m; $('#menu').hidden = true;
  if (m === 'avatar') abrirEditor();
  if (m === 'criancas') { await salvar().catch(() => {}); listarCriancas(); }
  if (m === 'acenar' || m === 'dancar') anim.tocar(m);
  if (m === 'sair') sair();
};

// ---------- provador ----------
let filtroSlot = 'todos';
function itensDoTema() {
  const cat = catalogo().itens, g = E.crianca.genero === 'menina' ? 'f' : 'm';
  const temas = E.loja.temas || Object.keys(TEMAS);
  return cat.filter(i => (E.tema === 'loja' ? (i.tema === 'loja' || temas.includes(i.tema)) : (i.tema === E.tema || i.tema === 'loja')))
    .sort((a, b) => (b.tema === E.tema) - (a.tema === E.tema) || (b.genero === g) - (a.genero === g));
}
function abrirProvador() {
  $('#pv-tema').textContent = E.tema === 'loja' ? '' : '• ' + TEMAS[E.tema].nome;
  const itens = itensDoTema(), slots = ['todos', ...new Set(itens.map(i => i.slot))];
  const S = $('#pv-slots'); S.innerHTML = '';
  for (const s of slots) {
    const b = document.createElement('button'); b.textContent = s === 'todos' ? 'Todos' : (ICONE_SLOT[s] + ' ' + NOME_SLOT[s]);
    b.classList.toggle('ativa', s === filtroSlot);
    b.onclick = () => { filtroSlot = s; S.querySelectorAll('button').forEach(x => x.classList.toggle('ativa', x === b)); listarPecas(); };
    S.append(b);
  }
  listarPecas(); tela('provador');
  av.root.rotation.y = 0;
}
function listarPecas() {
  const G = $('#pv-pecas'); G.innerHTML = '';
  for (const it of itensDoTema().filter(i => filtroSlot === 'todos' || i.slot === filtroSlot)) {
    const b = document.createElement('button'); b.className = 'peca'; b.classList.toggle('ativa', E.look[it.slot] === it.id);
    const cor = E.cores[it.id]?.c1 || it.partes[0]?.mat?.cores?.[0] || '#eee';
    b.innerHTML = `<div class="ico" style="background:${esc(cor)}22">${ICONE_SLOT[it.slot] || '✨'}</div><b>${esc(it.nome)}</b><span>${brl(it.preco)}</span>`;
    b.onclick = async () => { await alternar(it); listarPecas(); mostrarCores(it); };
    G.append(b);
  }
}
async function alternar(it) {
  if (E.look[it.slot] === it.id) { despir(it.slot); return; }
  await vestir(it.id);
}
function despir(slot) {
  const id = E.look[slot]; if (!id) return;
  const p = pecas.get(id); if (p) { av.remover(p); pecas.delete(id); }
  delete E.look[slot];
}
async function vestir(id, inicial = false) {
  const it = catalogo().itens.find(i => i.id === id); if (!it) return;
  if (it.slot === 'full') { despir('top'); despir('bottom'); }
  if (it.slot === 'top' || it.slot === 'bottom') despir('full');
  despir(it.slot);
  E.look[it.slot] = id;
  const p = await Peca.carregar(it);
  if (E.look[it.slot] !== id) return;
  av.anexar(p); pecas.set(id, p);
  if (E.cores[id]) p.aplicarCores(E.cores[id]);
}
function mostrarCores(it) {
  const C = $('#pv-cores'), p = pecas.get(it.id);
  const tecido = it.partes.some(x => x.mat.tipo === 'tecido');
  if (!p || !tecido) { C.hidden = true; return; }
  C.hidden = false; C.innerHTML = `<b>Personalizar: ${esc(it.nome)}</b>`;
  const atual = E.cores[it.id] || { c1: it.partes[0].mat.cores[0], c2: it.partes[0].mat.cores[1], padrao: it.partes[0].mat.padrao };
  const linha = (rot, ch) => {
    const d = document.createElement('div'); d.className = 'cores'; d.style.gap = '6px';
    const t = document.createElement('span'); t.textContent = rot; t.style.cssText = 'font-weight:700;font-size:13px;width:100%';
    d.append(t);
    for (const c of TECIDO) { const b = document.createElement('button'); b.style.cssText = `background:${c};width:30px;height:30px`; b.classList.toggle('ativa', atual[ch] === c);
      b.onclick = () => { atual[ch] = c; E.cores[it.id] = { ...atual }; p.aplicarCores(atual); d.querySelectorAll('button').forEach(x => x.classList.toggle('ativa', x === b)); }; d.append(b); }
    return d;
  };
  const sel = document.createElement('select');
  for (const [k, n] of Object.entries(NOMES_PADRAO)) sel.add(new Option('Estampa: ' + n, k, false, k === atual.padrao));
  sel.onchange = () => { atual.padrao = sel.value; E.cores[it.id] = { ...atual }; p.aplicarCores(atual); };
  C.append(linha('Cor principal', 'c1'), linha('Cor da estampa', 'c2'), sel);
}
$('#pv-fechar').onclick = async () => { $('#pv-cores').hidden = true; tela('hud'); salvar().catch(() => {}); };
$('#pv-whats').onclick = () => {
  const num = String(E.loja.whatsapp || '').replace(/\D/g, '');
  if (!num) return toast('A loja ainda não cadastrou o WhatsApp.');
  const it = Object.values(E.look).map(id => catalogo().itens.find(i => i.id === id)).filter(Boolean);
  const tam = tamanhoSugerido(E.idade);
  const linhas = it.map(i => `• ${i.nome} (${brl(i.preco)})`).join('\n');
  const total = it.reduce((s, i) => s + i.preco, 0);
  const t = `${E.loja.mensagem_whatsapp || 'Olá! Quero essas peças:'}\n\n${linhas}\n\nTotal: ${brl(total)}\nCriança: ${E.crianca.nome}, ${E.idade} anos (tamanho sugerido ${tam})`;
  open(`https://wa.me/${num}?text=${encodeURIComponent(t)}`, '_blank', 'noopener');
};
function tamanhoSugerido(i) { const t = Math.max(2, Math.min(16, Math.ceil((i + 1) / 2) * 2)); return String(t); }

// ---------- card ----------
for (const [k, v] of Object.entries(MODELOS)) $('#cd-modelo').add(new Option(v.nome, k));
for (const [k, v] of Object.entries(FORMATOS)) $('#cd-formato').add(new Option(v.nome, k));
for (const [k, n] of [['natural', 'Natural'], ['maos_cintura', 'Mãos na cintura'], ['heroi', 'Pose de herói'], ['princesa', 'Princesa'], ['vitoria', 'Vitória'], ['tchau', 'Tchauzinho']]) $('#cd-pose').add(new Option(n, k));
$('#pv-card').onclick = abrirCard;
async function abrirCard() {
  E.cardAberto = true;
  const nasc = new Date(E.crianca.data_nascimento + 'T12:00:00'), hoje = new Date();
  $('#cd-modelo').value = nasc.getMonth() === hoje.getMonth() ? 'aniversario' : (E.tema === 'loja' ? 'look' : 'desafio');
  $('#cd-pose').value = E.tema === 'heroi' ? 'heroi' : E.tema === 'princesa' ? 'princesa' : 'maos_cintura';
  modal('card'); await desenharCard(); regras();
  E.look_id = null;
}
['#cd-modelo', '#cd-formato', '#cd-pose'].forEach(s => $(s).onchange = desenharCard);
async function desenharCard() {
  const F = FORMATOS[$('#cd-formato').value];
  const fw = F.w - 112, fh = F.h - 190 - ($('#cd-formato').value === 'story' ? 520 : 330);
  // foto do avatar: render dedicado
  anim.pose = POSES[$('#cd-pose').value]; const exprAnt = av.params.expr;
  av.set({ expr: { ...exprAnt, sorriso: Math.max(.6, exprAnt.sorriso || 0) } });
  const rotAnt = av.root.rotation.y; av.root.rotation.y = .25;
  anim.update(.016, 0);
  const r = cena.r, cam = cena.cam, tam = new THREE.Vector2(); r.getSize(tam); const pr = r.getPixelRatio();
  const W = 900, H = Math.round(W * fh / fw);
  r.setPixelRatio(1); r.setSize(W, H, false);
  cam.clearViewOffset(); cam.aspect = W / H;
  const h = altura(), p = av.root.position;
  const dist = Math.max(h * 1.15, h * .9 / (2 * Math.tan(THREE.MathUtils.degToRad(15)))) * (W / H < .8 ? 1.12 : .95);
  cam.fov = 30; cam.position.set(p.x + h * .35, p.y + h * .58, p.z + dist); cam.lookAt(p.x, p.y + h * .5, p.z);
  cam.updateProjectionMatrix(); r.render(cena.sc, cam);
  const foto = document.createElement('canvas'); foto.width = W; foto.height = H; foto.getContext('2d').drawImage(r.domElement, 0, 0);
  r.setPixelRatio(pr); r.setSize(tam.x, tam.y, false); cena.resize();
  av.root.rotation.y = rotAnt; av.set({ expr: exprAnt });
  const link = location.origin + location.pathname + '?loja=' + encodeURIComponent(E.loja.slug);
  E.cardCanvas = await gerarCard(foto, {
    loja: E.loja, crianca: E.crianca.nome, idade: E.idade, tema: E.tema === 'loja' ? E.loja.nome : TEMAS[E.tema].nome,
    modelo: $('#cd-modelo').value, formato: $('#cd-formato').value, link,
  });
  $('#cd-img').src = E.cardCanvas.toDataURL('image/png');
  enquadrar();
}
async function regras() {
  const R = $('#cd-regras'); R.innerHTML = '';
  try {
    const rs = await api.regrasAtivas(E.loja.empresa_id);
    const posts = rs.filter(r => r.gatilho === 'post');
    if (!posts.length) R.innerHTML = '<div class="regra">A loja ainda não ativou cupons para posts.</div>';
    for (const r of posts) {
      const v = r.tipo === 'percentual' ? `${String(r.valor).replace('.', ',')}% OFF` : r.tipo === 'valor' ? `${brl(+r.valor)} OFF` : r.tipo === 'frete' ? 'Frete grátis' : 'Brinde';
      R.insertAdjacentHTML('beforeend', `<div class="regra">🎟️ ${esc(r.nome)} — ${v}</div>`);
    }
    E.regraPost = posts[0]?.id || null;
  } catch (e) { R.textContent = e.message; }
}
async function salvarLookAtual() {
  if (E.look_id) return E.look_id;
  const l = await api.salvarLook(E.crianca, E.tema, Object.values(E.look).map(id => ({ id, cores: E.cores[id] || null })));
  return (E.look_id = l.id);
}
$('#cd-fechar').onclick = () => { modal('card', false); E.cardAberto = false; anim.pose = null; enquadrar(); };
$('#cd-baixar').onclick = async () => { baixar(E.cardCanvas, nomeArq()); salvarLookAtual().catch(() => {}); };
$('#cd-compartilhar').onclick = async () => {
  const ig = E.loja.instagram ? (E.loja.instagram.startsWith('@') ? E.loja.instagram : '@' + E.loja.instagram) : '';
  const r = await compartilhar(E.cardCanvas, nomeArq(), `Olha o look que montei! ${ig}`.trim());
  if (r === 'baixado') toast('Card baixado! Poste no Instagram marcando a loja.');
  salvarLookAtual().catch(() => {});
};
const nomeArq = () => `card-${E.crianca.nome}-${E.tema}`.normalize('NFD').replace(/[^\w-]/g, '').toLowerCase();
$('#f-post').onsubmit = async e => {
  e.preventDefault(); const f = e.target, b = f.querySelector('button'); msg(f, '');
  const link = f.link.value.trim(), arq = f.print.files[0];
  if (!link && !arq) return msg(f, 'Cole o link do post ou envie um print.');
  if (link && !/^https:\/\/(www\.)?instagram\.com\//i.test(link)) return msg(f, 'O link precisa ser de um post do Instagram.');
  if (arq && arq.size > 5 * 1024 * 1024) return msg(f, 'O print deve ter até 5 MB.');
  b.disabled = true;
  try {
    const lookId = await salvarLookAtual();
    await api.enviarPost(E.cli, { link, arquivo: arq, lookId, regraId: E.regraPost });
    f.reset(); msg(f, '✅ Enviado! Assim que a loja aprovar, seu cupom aparece em "Cupons".', true);
  } catch (er) { msg(f, er.message); } finally { b.disabled = false; }
};

// ---------- cupons ----------
$('#h-cupons').onclick = async () => {
  modal('cupons');
  $('#cp-indicacao').textContent = E.cli.codigo_indicacao || '-';
  try {
    const [cs, ps] = await Promise.all([api.meusCupons(E.cli), api.meusPosts(E.cli)]);
    $('#cp-lista').innerHTML = cs.length ? cs.map(c => `<div class="cupom"><div><b>${esc(c.codigo)}</b><br><span>${esc(c.pm_cupom_regras?.nome || 'Cupom')} • válido até ${new Date(c.validade + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div><span class="st ${c.status === 'usado' ? 'recusado' : 'aprovado'}">${esc(c.status)}</span></div>`).join('')
      : '<p class="sub">Você ainda não tem cupons. Gere um card, poste e envie para validação!</p>';
    $('#cp-posts').innerHTML = ps.length ? ps.map(p => `<div class="post-item"><span>${new Date(p.criado_em).toLocaleDateString('pt-BR')} • ${p.link ? 'link' : 'print'}</span><span class="st ${p.status}">${p.status}</span></div>`).join('')
      : '<p class="sub">Nenhum post enviado.</p>';
  } catch (e) { toast(e.message); }
};
$('#cp-fechar').onclick = () => modal('cupons', false);

iniciar().catch(e => { console.error(e); progresso(0, 'Erro: ' + e.message); });
