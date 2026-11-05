// Provador Mágico — Admin da loja (3Verso). Permissões checadas no banco (RLS/RPC).
import { CONFIG, rodape } from './config.js';
import { sb, traduzir, idade } from './api.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dt = d => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR') : '';
const ok = ({ data, error }) => { if (error) throw traduzir(error); return data; };
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 3200); }
const S = { empresa: null, empresas: [], super: false, vista: 'painel' };
$$('.rodape').forEach(rodape);

// ---------- login ----------
$('#f-login').onsubmit = async e => {
  e.preventDefault(); const f = e.target, m = f.querySelector('.msg'); m.textContent = '';
  try { ok(await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.senha.value })); await abrir(); }
  catch (er) { m.textContent = er.message; }
};
$('#m-sair').onclick = async () => { await sb.auth.signOut(); location.reload(); };
$('#m-toggle').onclick = () => { $('#menu').classList.toggle('mini'); try { localStorage.setItem('adm_mini', $('#menu').classList.contains('mini') ? '1' : ''); } catch { } };
try { if (localStorage.getItem('adm_mini')) $('#menu').classList.add('mini'); } catch { }

async function abrir() {
  S.super = ok(await sb.rpc('eu_super_admin'));
  S.empresas = ok(await sb.rpc('minhas_empresas')) || [];
  if (!S.empresas.length && !S.super) {
    $('#f-login .msg').textContent = 'Sua conta ainda não está ligada a nenhuma loja. Peça ao responsável para te adicionar.';
    await sb.auth.signOut(); return;
  }
  $('#login').hidden = true; $('#app').hidden = false;
  $$('.so-super').forEach(e => e.hidden = !S.super);
  const sel = $('#sel-empresa'); sel.innerHTML = '';
  for (const e of S.empresas) sel.add(new Option(e.nome, e.id));
  sel.onchange = () => trocarEmpresa(sel.value);
  let ult = null; try { ult = localStorage.getItem('adm_emp'); } catch { }
  const pedida = new URLSearchParams(location.search).get('empresa'); // vindo do portal 3Verso
  if (pedida) history.replaceState(null, '', location.pathname);
  const ini = S.empresas.find(e => e.id === pedida) || S.empresas.find(e => e.id === ult) || S.empresas[0];
  if (ini) { sel.value = ini.id; await trocarEmpresa(ini.id); } else ir('empresas');
}
async function trocarEmpresa(id) {
  S.empresa = S.empresas.find(e => e.id === id);
  try { localStorage.setItem('adm_emp', id); } catch { }
  $('#ver-loja').href = `index.html?loja=${encodeURIComponent(S.empresa.slug)}`;
  ir(S.vista); contarPendentes();
}
async function contarPendentes() {
  const { count } = await sb.from('pm_posts').select('id', { count: 'exact', head: true }).eq('empresa_id', S.empresa.id).eq('status', 'pendente');
  const b = $('#badge-posts'); b.hidden = !count; b.textContent = count;
}

// ---------- navegação ----------
const VISTAS = { painel, posts, cupons, leads, marca, equipe, empresas };
const TIT = { painel: 'Painel', posts: 'Posts para aprovar', cupons: 'Cupons', leads: 'Cadastros (leads)', marca: 'Marca e contatos', equipe: 'Equipe', empresas: 'Empresas da plataforma' };
$$('.menu nav a').forEach(a => a.onclick = () => ir(a.dataset.v));
async function ir(v) {
  S.vista = v; $$('.menu nav a').forEach(a => a.classList.toggle('ativo', a.dataset.v === v));
  $('#titulo').textContent = TIT[v]; const V = $('#vista'); V.innerHTML = '<div class="vazio">Carregando…</div>';
  try { await VISTAS[v](V); } catch (e) { V.innerHTML = `<div class="card vazio">${esc(e.message)}</div>`; }
}
const eid = () => S.empresa?.id;

// ---------- painel ----------
async function painel(V) {
  const cnt = async (t, f = q => q) => (await f(sb.from(t).select('id', { count: 'exact', head: true }).eq('empresa_id', eid()))).count || 0;
  const [cli, cri, pend, emit, usad] = await Promise.all([cnt('clientes'), cnt('criancas'), cnt('pm_posts', q => q.eq('status', 'pendente')),
    cnt('pm_cupons'), cnt('pm_cupons', q => q.eq('status', 'usado'))]);
  const crs = ok(await sb.from('criancas').select('nome, data_nascimento, genero, clientes(nome, whatsapp)').eq('empresa_id', eid()));
  const mes = new Date().getMonth();
  const aniv = crs.filter(c => new Date(c.data_nascimento + 'T12:00:00').getMonth() === mes)
    .sort((a, b) => a.data_nascimento.slice(5).localeCompare(b.data_nascimento.slice(5)));
  V.innerHTML = `<div class="kpis">
    <div class="kpi"><b>${cli}</b><span>Responsáveis cadastrados</span></div>
    <div class="kpi"><b>${cri}</b><span>Crianças</span></div>
    <div class="kpi"><b>${pend}</b><span>Posts aguardando</span></div>
    <div class="kpi"><b>${emit}</b><span>Cupons emitidos</span></div>
    <div class="kpi"><b>${usad}</b><span>Cupons usados</span></div></div>
    <div class="card"><h3>🎂 Aniversariantes do mês</h3>${aniv.length ? `<div class="tab-wrap"><table><tr><th>Criança</th><th>Dia</th><th>Faz</th><th>Responsável</th><th></th></tr>
    ${aniv.map(c => `<tr><td>${esc(c.nome)}</td><td>${dt(c.data_nascimento).slice(0, 5)}</td><td>${idade(c.data_nascimento) + (new Date().getDate() <= +c.data_nascimento.slice(8) ? 1 : 0)} anos</td>
      <td>${esc(c.clientes?.nome)}</td><td>${c.clientes?.whatsapp ? `<a class="bt p sec" target="_blank" rel="noopener" href="https://wa.me/${c.clientes.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! A ${S.empresa.nome} deseja feliz aniversário para ${c.nome}! 🎉`)}">WhatsApp</a>` : ''}</td></tr>`).join('')}</table></div>`
      : '<div class="vazio">Nenhum aniversariante este mês.</div>'}</div>`;
}

// ---------- posts ----------
async function posts(V) {
  const ps = ok(await sb.from('pm_posts').select('*, clientes(nome, whatsapp), pm_cupom_regras(nome)').eq('empresa_id', eid()).order('status').order('criado_em', { ascending: false }).limit(200));
  if (!ps.length) { V.innerHTML = '<div class="card vazio">Nenhum post enviado ainda.</div>'; return; }
  const urls = {};
  await Promise.all(ps.filter(p => p.print_path).map(async p => {
    const { data } = await sb.storage.from('pm-posts').createSignedUrl(p.print_path, 600); urls[p.id] = data?.signedUrl;
  }));
  V.innerHTML = `<div class="card tab-wrap"><table><tr><th>Data</th><th>Cliente</th><th>Prova</th><th>Regra</th><th>Status</th><th></th></tr>
    ${ps.map(p => `<tr data-id="${p.id}"><td>${dt(p.criado_em)}</td><td>${esc(p.clientes?.nome)}</td>
      <td>${p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">Ver post ↗</a>` : ''}${urls[p.id] ? `<a href="${urls[p.id]}" target="_blank" rel="noopener"><img class="prev-print" src="${urls[p.id]}" alt="print"></a>` : ''}</td>
      <td>${esc(p.pm_cupom_regras?.nome || 'Padrão de post')}</td><td><span class="st ${p.status}">${p.status}</span>${p.motivo ? `<br><small>${esc(p.motivo)}</small>` : ''}</td>
      <td>${p.status === 'pendente' ? '<button class="bt p ok" data-a="1">Aprovar</button> <button class="bt p er" data-a="0">Recusar</button>' : ''}</td></tr>`).join('')}</table></div>`;
  V.querySelectorAll('button[data-a]').forEach(b => b.onclick = async () => {
    const id = b.closest('tr').dataset.id, ap = b.dataset.a === '1';
    const motivo = ap ? null : prompt('Motivo da recusa (aparece para o cliente):', 'A loja não foi marcada no post.');
    if (!ap && motivo === null) return;
    b.disabled = true;
    try {
      const cp = ok(await sb.rpc('pm_avaliar_post', { p_post: id, p_aprovar: ap, p_motivo: motivo }));
      toast(ap ? (cp?.codigo ? `Aprovado! Cupom ${cp.codigo} emitido.` : 'Aprovado (sem regra de cupom ativa ou limite atingido).') : 'Recusado.');
      contarPendentes(); ir('posts');
    } catch (e) { toast(e.message); b.disabled = false; }
  });
}

// ---------- cupons ----------
const GAT = { post: 'Postou e marcou', indicacao: 'Indicação', aniversario: 'Aniversário', pontos: 'Pontos no game', desafio: 'Desafio', cadastro: 'Cadastro' };
const TIPO = { percentual: '% de desconto', valor: 'R$ de desconto', brinde: 'Brinde', frete: 'Frete grátis' };
const valorTxt = r => r.tipo === 'percentual' ? `${String(r.valor).replace('.', ',')}%` : r.tipo === 'valor' ? brl(r.valor) : TIPO[r.tipo];
async function cupons(V) {
  const [rs, cs] = await Promise.all([
    sb.from('pm_cupom_regras').select('*').eq('empresa_id', eid()).order('criado_em').then(ok),
    sb.from('pm_cupons').select('*, clientes(nome, whatsapp), pm_cupom_regras(nome, tipo, valor)').eq('empresa_id', eid()).order('criado_em', { ascending: false }).limit(300).then(ok),
  ]);
  V.innerHTML = `<div class="card"><h3>Regras de cupom</h3>
    <form id="f-regra" class="linha">
      <label>Nome<input name="nome" required placeholder="Ex.: Postou e marcou a loja"></label>
      <label>Gatilho<select name="gatilho">${Object.entries(GAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label>Tipo<select name="tipo">${Object.entries(TIPO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label>Valor<input name="valor" type="number" min="0" step="0.01" value="10"></label>
      <label>Validade (dias)<input name="validade_dias" type="number" min="1" max="365" value="30"></label>
      <label>Limite por cliente<input name="limite_por_cliente" type="number" min="1" value="1"></label>
      <button class="bt">+ Criar regra</button></form>
    <div class="tab-wrap"><table><tr><th>Nome</th><th>Gatilho</th><th>Benefício</th><th>Validade</th><th>Limite</th><th>Status</th><th></th></tr>
    ${rs.map(r => `<tr data-id="${r.id}"><td>${esc(r.nome)}</td><td>${GAT[r.gatilho]}</td><td>${valorTxt(r)}</td><td>${r.validade_dias} dias</td><td>${r.limite_por_cliente}</td>
      <td><span class="st ${r.ativo ? 'ativo' : 'inativo'}">${r.ativo ? 'ativa' : 'inativa'}</span></td>
      <td><button class="bt p sec" data-t>${r.ativo ? 'Desativar' : 'Ativar'}</button> <button class="bt p er" data-x>Excluir</button></td></tr>`).join('') || '<tr><td colspan="7" class="vazio">Nenhuma regra. Crie a primeira acima.</td></tr>'}
    </table></div></div>
    <div class="card"><h3>Cupons emitidos</h3><div class="tab-wrap"><table><tr><th>Código</th><th>Cliente</th><th>Benefício</th><th>Validade</th><th>Status</th><th></th></tr>
    ${cs.map(c => `<tr data-id="${c.id}"><td><b>${esc(c.codigo)}</b></td><td>${esc(c.clientes?.nome)}</td><td>${c.pm_cupom_regras ? valorTxt(c.pm_cupom_regras) : ''}</td><td>${dt(c.validade)}</td>
      <td><span class="st ${c.status}">${c.status}</span></td>
      <td>${c.clientes?.whatsapp && c.status === 'gerado' ? '<button class="bt p ok" data-w>Enviar no WhatsApp</button>' : ''} ${c.status !== 'usado' ? '<button class="bt p sec" data-u>Marcar usado</button>' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="vazio">Nenhum cupom emitido.</td></tr>'}
    </table></div></div>`;
  $('#f-regra').onsubmit = async e => {
    e.preventDefault(); const f = e.target, d = Object.fromEntries(new FormData(f));
    try { ok(await sb.from('pm_cupom_regras').insert({ ...d, valor: +d.valor, validade_dias: +d.validade_dias, limite_por_cliente: +d.limite_por_cliente, empresa_id: eid() })); toast('Regra criada.'); ir('cupons'); }
    catch (er) { toast(er.message); }
  };
  V.querySelectorAll('[data-t]').forEach(b => b.onclick = async () => {
    const id = b.closest('tr').dataset.id, r = rs.find(x => x.id === id);
    try { ok(await sb.from('pm_cupom_regras').update({ ativo: !r.ativo }).eq('id', id)); ir('cupons'); } catch (e) { toast(e.message); }
  });
  V.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
    if (!confirm('Excluir a regra? Cupons já emitidos continuam válidos.')) return;
    try { ok(await sb.from('pm_cupom_regras').delete().eq('id', b.closest('tr').dataset.id)); ir('cupons'); } catch (e) { toast(e.message); }
  });
  V.querySelectorAll('[data-w]').forEach(b => b.onclick = async () => {
    const c = cs.find(x => x.id === b.closest('tr').dataset.id);
    const t = `Olá, ${c.clientes.nome}! 🎉 Seu post foi aprovado pela ${S.empresa.nome}. Seu cupom: *${c.codigo}* (${c.pm_cupom_regras ? valorTxt(c.pm_cupom_regras) : ''}), válido até ${dt(c.validade)}.`;
    open(`https://wa.me/${c.clientes.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(t)}`, '_blank', 'noopener');
    try { ok(await sb.from('pm_cupons').update({ status: 'enviado' }).eq('id', c.id)); ir('cupons'); } catch (e) { toast(e.message); }
  });
  V.querySelectorAll('[data-u]').forEach(b => b.onclick = async () => {
    try { ok(await sb.from('pm_cupons').update({ status: 'usado', usado_em: new Date().toISOString() }).eq('id', b.closest('tr').dataset.id)); ir('cupons'); } catch (e) { toast(e.message); }
  });
}

// ---------- leads ----------
async function leads(V) {
  const cl = ok(await sb.from('clientes').select('*, criancas(nome, data_nascimento, genero)').eq('empresa_id', eid()).order('criado_em', { ascending: false }));
  const linhas = cl.flatMap(c => (c.criancas.length ? c.criancas : [null]).map(k => ({ c, k })));
  V.innerHTML = `<div class="card"><div class="linha"><input id="busca" placeholder="Buscar por nome, e-mail ou WhatsApp"><button class="bt" id="csv">⬇️ Exportar CSV</button></div>
    <div class="tab-wrap"><table id="tb"><tr><th>Cadastro</th><th>Responsável</th><th>WhatsApp</th><th>E-mail</th><th>Aceita marketing</th><th>Criança</th><th>Idade</th><th>Nascimento</th></tr>
    ${linhas.map(({ c, k }) => `<tr><td>${dt(c.criado_em)}</td><td>${esc(c.nome)}</td><td>${esc(c.whatsapp)}</td><td>${esc(c.email)}</td><td>${c.aceite_marketing ? 'Sim' : 'Não'}</td>
      <td>${k ? (k.genero === 'menina' ? '👧 ' : '👦 ') + esc(k.nome) : '—'}</td><td>${k ? idade(k.data_nascimento) : ''}</td><td>${k ? dt(k.data_nascimento) : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="vazio">Nenhum cadastro ainda.</td></tr>'}
    </table></div><small>${cl.length} responsáveis • ${cl.reduce((s, c) => s + c.criancas.length, 0)} crianças</small></div>`;
  $('#busca').oninput = e => { const q = e.target.value.toLowerCase(); $$('#tb tr').forEach((tr, i) => { if (i) tr.hidden = !tr.textContent.toLowerCase().includes(q); }); };
  $('#csv').onclick = () => {
    const cab = ['Cadastro', 'Responsável', 'WhatsApp', 'E-mail', 'Aceita marketing', 'Criança', 'Gênero', 'Idade', 'Nascimento'];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = linhas.map(({ c, k }) => [dt(c.criado_em), c.nome, c.whatsapp, c.email, c.aceite_marketing ? 'Sim' : 'Não', k?.nome, k?.genero, k ? idade(k.data_nascimento) : '', k ? dt(k.data_nascimento) : '']);
    const csv = '﻿' + [cab, ...rows].map(r => r.map(q).join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `cadastros-${S.empresa.slug}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };
}

// ---------- marca ----------
const TEMAS = { princesa: 'Festa da Princesa', heroi: 'Super-herói', junina: 'Festa Junina', praia: 'Praia / Verão' };
async function marca(V) {
  const ep = ok(await sb.from('empresa_projetos').select('projeto_id, config, projetos!inner(codigo)').eq('empresa_id', eid()).eq('projetos.codigo', 'provador_magico').single());
  const c = ep.config || {}, co = c.cores || {}, temas = c.temas || Object.keys(TEMAS);
  V.innerHTML = `<form class="card" id="f-marca"><h3>Logomarca</h3>
    <div class="linha"><div>${c.logo ? `<img class="logo-prev" src="${esc(c.logo)}" alt="logo">` : '<span class="vazio">Sem logo</span>'}</div>
      <label>Enviar logo (PNG, JPG, WEBP ou SVG, até 2 MB)<input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label></div>
    <h3>Cores</h3><div class="linha">
      <label>Principal<input type="color" name="primaria" value="${co.primaria || '#e84a7f'}"></label>
      <label>Secundária<input type="color" name="secundaria" value="${co.secundaria || '#7ec8e3'}"></label>
      <label>Destaque<input type="color" name="destaque" value="${co.destaque || '#ffd166'}"></label></div>
    <h3>Contatos</h3><div class="linha">
      <label>Instagram<input name="instagram" placeholder="@sualoja" value="${esc(c.instagram || '')}"></label>
      <label>WhatsApp da loja (com DDD)<input name="whatsapp" placeholder="85 99999-9999" value="${esc(c.whatsapp || '')}"></label></div>
    <label>Mensagem inicial do WhatsApp<textarea name="mensagem_whatsapp" rows="2">${esc(c.mensagem_whatsapp || '')}</textarea></label>
    <h3>Temas ativos</h3><div class="linha">${Object.entries(TEMAS).map(([k, n]) => `<label class="chk"><input type="checkbox" name="tema" value="${k}" ${temas.includes(k) ? 'checked' : ''}>${n}</label>`).join('')}</div>
    <div><button class="bt">Salvar</button></div></form>`;
  $('#f-marca').onsubmit = async e => {
    e.preventDefault(); const f = e.target, b = f.querySelector('.bt'); b.disabled = true;
    try {
      let logo = c.logo || null; const arq = f.logo.files[0];
      if (arq) {
        if (arq.size > 2 * 1024 * 1024) throw new Error('A logo deve ter até 2 MB.');
        const ext = arq.name.split('.').pop().toLowerCase().replace(/[^a-z]/g, '');
        const path = `${eid()}/logo-${Date.now()}.${ext}`;
        ok(await sb.storage.from('logos').upload(path, arq, { contentType: arq.type, upsert: false }));
        logo = sb.storage.from('logos').getPublicUrl(path).data.publicUrl;
      }
      const w = f.whatsapp.value.replace(/\D/g, '');
      const cfg = { ...c, logo, cores: { primaria: f.primaria.value, secundaria: f.secundaria.value, destaque: f.destaque.value },
        instagram: f.instagram.value.trim() || null, whatsapp: w ? (w.length >= 12 ? '+' + w : '+55' + w) : null,
        mensagem_whatsapp: f.mensagem_whatsapp.value.trim(), temas: $$('[name=tema]:checked').map(i => i.value) };
      ok(await sb.from('empresa_projetos').update({ config: cfg }).eq('empresa_id', eid()).eq('projeto_id', ep.projeto_id));
      toast('Marca salva!'); ir('marca');
    } catch (er) { toast(er.message); b.disabled = false; }
  };
}

// ---------- equipe ----------
const PAPEL = { dono: 'Dono', admin: 'Administrador', atendente: 'Atendente' };
async function equipe(V) {
  const eq = ok(await sb.rpc('listar_equipe', { p_empresa: eid() })) || [];
  V.innerHTML = `<div class="card"><h3>Adicionar pessoa</h3><p style="margin:0;color:var(--tx2)">A pessoa precisa criar a conta antes (na tela da loja, em "Criar conta"). Depois, informe o e-mail aqui.</p>
    <form id="f-membro" class="linha"><label>E-mail<input name="email" type="email" required></label>
      <label>Papel<select name="papel">${Object.entries(PAPEL).filter(([k]) => S.super || k !== 'dono').map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <button class="bt">Adicionar</button></form></div>
    <div class="card tab-wrap"><table><tr><th>E-mail</th><th>Papel</th><th>Status</th><th>Desde</th><th></th></tr>
    ${eq.map(m => `<tr data-u="${m.user_id}"><td>${esc(m.email)}</td><td>${PAPEL[m.papel]}</td><td><span class="st ${m.ativo ? 'ativo' : 'inativo'}">${m.ativo ? 'ativo' : 'inativo'}</span></td><td>${dt(m.criado_em)}</td>
      <td>${m.papel !== 'dono' || S.super ? `<button class="bt p sec" data-t>${m.ativo ? 'Desativar' : 'Ativar'}</button> <button class="bt p er" data-x>Remover</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="vazio">Ninguém na equipe.</td></tr>'}
    </table></div>`;
  $('#f-membro').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    try { ok(await sb.rpc('adicionar_membro', { p_empresa: eid(), p_email: f.email.value.trim(), p_papel: f.papel.value })); toast('Adicionado!'); ir('equipe'); }
    catch (er) { toast(er.message); }
  };
  V.querySelectorAll('[data-t]').forEach(b => b.onclick = async () => {
    const u = b.closest('tr').dataset.u, m = eq.find(x => x.user_id === u);
    try { ok(await sb.from('membros').update({ ativo: !m.ativo }).eq('empresa_id', eid()).eq('user_id', u)); ir('equipe'); } catch (er) { toast(er.message); }
  });
  V.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
    if (!confirm('Remover essa pessoa da equipe?')) return;
    try { ok(await sb.from('membros').delete().eq('empresa_id', eid()).eq('user_id', b.closest('tr').dataset.u)); ir('equipe'); } catch (er) { toast(er.message); }
  });
}

// ---------- empresas (super admin) ----------
async function empresas(V) {
  if (!S.super) { V.innerHTML = '<div class="card vazio">Somente o administrador da plataforma.</div>'; return; }
  const es = ok(await sb.from('empresas').select('*, empresa_projetos(ativo, projetos(nome))').order('nome'));
  V.innerHTML = `<div class="card"><h3>Nova empresa</h3>
    <form id="f-emp" class="linha"><label>Nome<input name="nome" required></label>
      <label>Endereço (slug)<input name="slug" required pattern="[a-z0-9\\-]{2,40}" placeholder="ex.: loja-da-ana"></label>
      <label>E-mail do dono (já cadastrado)<input name="email" type="email"></label><button class="bt">Criar</button></form></div>
    <div class="card tab-wrap"><table><tr><th>Empresa</th><th>Endereço</th><th>Projetos</th><th>Status</th><th>Link</th><th></th></tr>
    ${es.map(e => `<tr data-id="${e.id}"><td>${esc(e.nome)}</td><td>${esc(e.slug)}</td><td>${e.empresa_projetos.map(p => esc(p.projetos?.nome)).join(', ')}</td>
      <td><span class="st ${e.ativo ? 'ativo' : 'inativo'}">${e.ativo ? 'ativa' : 'inativa'}</span></td>
      <td><a href="index.html?loja=${encodeURIComponent(e.slug)}" target="_blank" rel="noopener">abrir ↗</a></td>
      <td><button class="bt p sec" data-t>${e.ativo ? 'Desativar' : 'Ativar'}</button></td></tr>`).join('')}</table></div>`;
  $('#f-emp [name=nome]').oninput = e => { $('#f-emp [name=slug]').value = e.target.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); };
  $('#f-emp').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    try { ok(await sb.rpc('criar_empresa', { p_nome: f.nome.value, p_slug: f.slug.value, p_email_dono: f.email.value || null })); toast('Empresa criada!');
      S.empresas = ok(await sb.rpc('minhas_empresas')); const sel = $('#sel-empresa'); sel.innerHTML = ''; for (const x of S.empresas) sel.add(new Option(x.nome, x.id)); if (S.empresa) sel.value = S.empresa.id; ir('empresas'); }
    catch (er) { toast(er.message); }
  };
  V.querySelectorAll('[data-t]').forEach(b => b.onclick = async () => {
    const id = b.closest('tr').dataset.id, x = es.find(e => e.id === id);
    try { ok(await sb.from('empresas').update({ ativo: !x.ativo }).eq('id', id)); ir('empresas'); } catch (er) { toast(er.message); }
  });
}

(async () => { if ((await sb.auth.getSession()).data.session) abrir().catch(e => toast(e.message)); })();
