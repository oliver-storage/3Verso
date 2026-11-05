// 3Verso — Portal de gestão. Permissões checadas no banco (RLS/RPC); aqui só a navegação.
import { CONFIG, rodape } from './config.js';

const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = v => (+v || 0).toLocaleString('pt-BR');
const dt = d => d ? new Date(d).toLocaleDateString('pt-BR') : '';
function traduzir(e) {
  const m = (e?.message || String(e)).toLowerCase();
  const t = [['invalid login credentials', 'E-mail ou senha incorretos.'], ['email not confirmed', 'Confirme seu e-mail antes de entrar.'],
    ['rate limit', 'Muitas tentativas. Aguarde alguns minutos.'], ['row-level security', 'Sem permissão para esta ação.'],
    ['sem permissão', 'Sem permissão para esta ação.'], ['duplicate key', 'Registro já existe (nome/código/endereço repetido).']];
  for (const [k, v] of t) if (m.includes(k)) return new Error(v);
  return new Error(e?.message || 'Erro inesperado.');
}
const ok = ({ data, error }) => { if (error) throw traduzir(error); return data; };
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 3200); }
const slugar = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const S = { super: false, lista: [], vista: 'projetos' };
$$('.rodape').forEach(rodape);

// ---------- login ----------
$('#f-login').onsubmit = async e => {
  e.preventDefault(); const f = e.target, m = f.querySelector('.msg'); m.textContent = '';
  try { ok(await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.senha.value })); await abrir(); }
  catch (er) { m.textContent = er.message; }
};
$('#esqueci').onclick = async () => {
  const f = $('#f-login'), m = f.querySelector('.msg'), email = f.email.value.trim();
  if (!email) { m.textContent = 'Digite seu e-mail acima.'; return; }
  try { ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); m.style.color = 'var(--ok)'; m.textContent = 'Enviamos o link para seu e-mail.'; }
  catch (er) { m.textContent = er.message; }
};
$('#m-sair').onclick = async () => { await sb.auth.signOut(); location.reload(); };
$('#m-toggle').onclick = () => { $('#menu').classList.toggle('mini'); try { localStorage.setItem('ptl_mini', $('#menu').classList.contains('mini') ? '1' : ''); } catch { } };
try { if (localStorage.getItem('ptl_mini')) $('#menu').classList.add('mini'); } catch { }

const linkAdmin = p => p.url_admin ? `${p.url_admin}${p.url_admin.includes('?') ? '&' : '?'}empresa=${encodeURIComponent(p.empresa_id)}` : null;
const linkApp = p => p.url_app ? `${p.url_app}${p.url_app.includes('?') ? '&' : '?'}loja=${encodeURIComponent(p.empresa_slug)}` : null;

async function abrir() {
  S.super = ok(await sb.rpc('eu_super_admin'));
  S.lista = ok(await sb.rpc('portal_projetos')) || [];
  const m = $('#f-login .msg');
  if (!S.super) {
    if (!S.lista.length) { m.textContent = 'Sua conta não está ligada a nenhum projeto. Peça acesso ao responsável.'; await sb.auth.signOut(); return; }
    if (S.lista.length === 1) {   // usuário de um projeto só: vai direto
      const u = linkAdmin(S.lista[0]);
      if (u) { location.replace(u); return; }
      m.textContent = 'O endereço deste projeto ainda não foi configurado. Avise o administrador.'; await sb.auth.signOut(); return;
    }
  }
  $('#login').hidden = true; $('#app').hidden = false;
  $$('.so-super').forEach(e => e.hidden = !S.super);
  const { data: { user } } = await sb.auth.getUser();
  $('#quem').textContent = `${user?.email || ''}${S.super ? ' • super admin' : ''}`;
  ir('projetos');
}

// ---------- navegação ----------
const VISTAS = { projetos, empresas, catalogo, equipe };
const TIT = { projetos: 'Projetos', empresas: 'Empresas', catalogo: 'Catálogo de projetos', equipe: 'Equipes' };
$$('.menu nav a').forEach(a => a.onclick = () => ir(a.dataset.v));
async function ir(v) {
  if (!S.super && v !== 'projetos') v = 'projetos';
  S.vista = v; $$('.menu nav a').forEach(a => a.classList.toggle('ativo', a.dataset.v === v));
  $('#titulo').textContent = TIT[v]; const V = $('#vista'); V.innerHTML = '<div class="vazio">Carregando…</div>';
  try { await VISTAS[v](V); } catch (e) { V.innerHTML = `<div class="card vazio">${esc(e.message)}</div>`; }
}

// ---------- projetos (cards) ----------
async function projetos(V) {
  S.lista = ok(await sb.rpc('portal_projetos')) || [];
  const tot = S.lista.reduce((a, p) => (a.cl += +p.clientes, a.po += +(p.posts_pendentes || 0), a), { cl: 0, po: 0 });
  const empresasQtd = new Set(S.lista.map(p => p.empresa_id)).size;
  V.innerHTML = `${S.super ? `<div class="kpis">
      <div class="kpi"><b>${n(empresasQtd)}</b><span>Empresas</span></div>
      <div class="kpi"><b>${n(S.lista.length)}</b><span>Projetos contratados</span></div>
      <div class="kpi"><b>${n(tot.cl)}</b><span>Cadastros (total)</span></div>
      <div class="kpi"><b>${n(tot.po)}</b><span>Posts aguardando</span></div></div>` : ''}
    <div class="linha"><input id="busca" placeholder="Buscar empresa ou projeto…"></div>
    <div class="projs" id="projs"></div>`;
  const pinta = q => {
    const l = S.lista.filter(p => !q || `${p.empresa_nome} ${p.projeto_nome}`.toLowerCase().includes(q));
    $('#projs').innerHTML = l.length ? l.map((p, i) => {
      const off = !p.empresa_ativo || !p.vinculo_ativo;
      return `<article class="proj ${off ? 'off' : ''}" data-i="${S.lista.indexOf(p)}">
        <header><div><h3>${esc(p.empresa_nome)}</h3><small>${esc(p.projeto_nome)}</small></div>
          <span class="st ${off ? 'inativo' : 'ativo'}">${off ? 'inativo' : 'ativo'}</span></header>
        <div class="nums"><div><b>${n(p.clientes)}</b><span>Cadastros</span></div><div><b>${n(p.equipe)}</b><span>Equipe</span></div>
          ${p.posts_pendentes != null ? `<div><b>${n(p.posts_pendentes)}</b><span>Posts aguardando</span></div><div><b>${n(p.cupons_abertos)}</b><span>Cupons em aberto</span></div>` : ''}</div>
        ${!p.url_admin ? `<div class="aviso">Endereço do admin não cadastrado${S.super ? ' (Catálogo)' : ''}.</div>` : ''}
        <div class="acoes"><button class="bt" data-adm ${p.url_admin ? '' : 'disabled'}>Entrar no projeto</button>
          ${p.url_app ? `<a class="bt sec" href="${esc(linkApp(p))}" target="_blank" rel="noopener">Abrir site ↗</a>` : ''}</div></article>`;
    }).join('') : '<div class="card vazio">Nenhum projeto.</div>';
    $$('[data-adm]').forEach(b => b.onclick = () => { const u = linkAdmin(S.lista[+b.closest('.proj').dataset.i]); if (u) location.href = u; });
  };
  $('#busca').oninput = e => pinta(e.target.value.trim().toLowerCase());
  pinta('');
}

// ---------- empresas (super) ----------
async function empresas(V) {
  const [es, ps] = await Promise.all([sb.from('empresas').select('id, nome, slug, ativo, criado_em, empresa_projetos(projeto_id, ativo)').order('nome').then(ok),
    sb.from('projetos').select('id, codigo, nome, ativo').order('nome').then(ok)]);
  V.innerHTML = `<div class="card"><h3>Nova empresa</h3>
    <form id="f-emp" class="linha"><label>Nome<input name="nome" required maxlength="80"></label>
      <label>Endereço (slug)<input name="slug" required pattern="[a-z0-9\\-]{2,40}" placeholder="ex.: loja-da-ana"></label>
      <label>Projeto<select name="projeto">${ps.filter(p => p.ativo).map(p => `<option value="${esc(p.codigo)}">${esc(p.nome)}</option>`).join('')}</select></label>
      <label>E-mail do dono (já cadastrado)<input name="email" type="email"></label><button class="bt">Criar</button></form>
    <small class="aviso">O dono precisa ter criado a conta antes. Pode deixar em branco e adicionar depois em Equipes.</small></div>
    <div class="card tab-wrap"><table><tr><th>Empresa</th><th>Endereço</th><th>Projetos (clique para ligar/desligar)</th><th>Desde</th><th>Status</th><th></th></tr>
    ${es.map(e => `<tr data-id="${e.id}"><td><b>${esc(e.nome)}</b></td><td>${esc(e.slug)}</td>
      <td><div class="chips">${ps.map(p => { const v = e.empresa_projetos.find(x => x.projeto_id === p.id);
        return `<button class="chip ${v?.ativo ? 'on' : ''}" data-p="${p.id}" data-on="${v?.ativo ? 1 : 0}">${v?.ativo ? '✓' : '+'} ${esc(p.nome)}</button>`; }).join('')}</div></td>
      <td>${dt(e.criado_em)}</td><td><span class="st ${e.ativo ? 'ativo' : 'inativo'}">${e.ativo ? 'ativa' : 'inativa'}</span></td>
      <td><button class="bt p sec" data-t="${e.ativo ? 0 : 1}">${e.ativo ? 'Desativar' : 'Ativar'}</button></td></tr>`).join('') || '<tr><td colspan="6" class="vazio">Nenhuma empresa.</td></tr>'}</table></div>`;
  const f = $('#f-emp');
  f.nome.oninput = () => { f.slug.value = slugar(f.nome.value); };
  f.onsubmit = async e => {
    e.preventDefault();
    try { ok(await sb.rpc('criar_empresa', { p_nome: f.nome.value, p_slug: f.slug.value, p_email_dono: f.email.value.trim() || null, p_projeto: f.projeto.value })); toast('Empresa criada!'); ir('empresas'); }
    catch (er) { toast(er.message); }
  };
  $$('[data-p]').forEach(b => b.onclick = async () => {
    const liga = b.dataset.on !== '1';
    if (!liga && !confirmar(b, 'Desligar este projeto da empresa?')) return;
    try { ok(await sb.rpc('vincular_projeto', { p_empresa: b.closest('tr').dataset.id, p_projeto: b.dataset.p, p_ativo: liga })); toast(liga ? 'Projeto ligado.' : 'Projeto desligado.'); ir('empresas'); }
    catch (er) { toast(er.message); }
  });
  $$('[data-t]').forEach(b => b.onclick = async () => {
    const ativa = b.dataset.t === '1';
    if (!ativa && !confirmar(b, 'Desativar a empresa? A equipe perde o acesso.')) return;
    try { ok(await sb.rpc('ativar_empresa', { p_empresa: b.closest('tr').dataset.id, p_ativo: ativa })); ir('empresas'); } catch (er) { toast(er.message); }
  });
}
// confirmação sem diálogo do navegador: 1º clique arma, 2º confirma
function confirmar(b, msg) {
  if (b.dataset.arm) return true;
  b.dataset.arm = 1; toast(msg + ' Clique de novo para confirmar.'); setTimeout(() => delete b.dataset.arm, 4000); return false;
}

// ---------- catálogo de projetos (super) ----------
async function catalogo(V) {
  const ps = ok(await sb.from('projetos').select('id, codigo, nome, url_app, url_admin, ativo, criado_em').order('nome'));
  V.innerHTML = `<div class="card"><h3 id="cat-tit">Novo projeto</h3>
    <form id="f-prj" class="linha"><input type="hidden" name="id">
      <label>Nome<input name="nome" required maxlength="60"></label>
      <label>Código<input name="codigo" required pattern="[a-z0-9_]{2,40}" placeholder="ex.: provador_magico"></label>
      <label>Endereço do site<input name="url_app" placeholder="/pasta/ ou https://..."></label>
      <label>Endereço do admin<input name="url_admin" placeholder="/pasta/admin.html ou https://..."></label>
      <label class="chk"><input type="checkbox" name="ativo" checked> Ativo</label>
      <button class="bt">Salvar</button><button type="button" class="bt sec" id="cat-novo" hidden>Cancelar</button></form>
    <small class="aviso">O código não muda depois de criado (os dados de cada projeto são ligados a ele).</small></div>
    <div class="card tab-wrap"><table><tr><th>Projeto</th><th>Código</th><th>Site</th><th>Admin</th><th>Status</th><th></th></tr>
    ${ps.map(p => `<tr data-id="${p.id}"><td><b>${esc(p.nome)}</b></td><td>${esc(p.codigo)}</td>
      <td>${p.url_app ? esc(p.url_app) : '<span class="aviso">não cadastrado</span>'}</td><td>${p.url_admin ? esc(p.url_admin) : '<span class="aviso">não cadastrado</span>'}</td>
      <td><span class="st ${p.ativo ? 'ativo' : 'inativo'}">${p.ativo ? 'ativo' : 'inativo'}</span></td>
      <td><button class="bt p sec" data-e>Editar</button></td></tr>`).join('')}</table></div>`;
  const f = $('#f-prj');
  f.nome.oninput = () => { if (!f.id.value) f.codigo.value = slugar(f.nome.value).replace(/-/g, '_'); };
  $$('[data-e]').forEach(b => b.onclick = () => {
    const p = ps.find(x => x.id === b.closest('tr').dataset.id);
    f.id.value = p.id; f.nome.value = p.nome; f.codigo.value = p.codigo; f.codigo.readOnly = true;
    f.url_app.value = p.url_app || ''; f.url_admin.value = p.url_admin || ''; f.ativo.checked = p.ativo;
    $('#cat-tit').textContent = 'Editar projeto'; $('#cat-novo').hidden = false; f.nome.focus();
  });
  $('#cat-novo').onclick = () => ir('catalogo');
  f.onsubmit = async e => {
    e.preventDefault();
    try { ok(await sb.rpc('salvar_projeto', { p_id: f.id.value || null, p_codigo: f.codigo.value, p_nome: f.nome.value,
        p_url_app: f.url_app.value.trim() || null, p_url_admin: f.url_admin.value.trim() || null, p_ativo: f.ativo.checked })); toast('Projeto salvo!'); ir('catalogo'); }
    catch (er) { toast(er.message); }
  };
}

// ---------- equipes de qualquer empresa (super) ----------
async function equipe(V) {
  const es = ok(await sb.from('empresas').select('id, nome').order('nome'));
  if (!es.length) { V.innerHTML = '<div class="card vazio">Cadastre uma empresa primeiro.</div>'; return; }
  let sel = null; try { sel = sessionStorage.getItem('ptl_eq'); } catch { }
  if (!es.some(e => e.id === sel)) sel = es[0].id;
  V.innerHTML = `<div class="card"><div class="linha"><label>Empresa<select id="eq-emp">${es.map(e => `<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select></label></div>
    <form id="f-mb" class="linha"><label>E-mail (já cadastrado)<input name="email" type="email" required></label>
      <label>Papel<select name="papel"><option value="dono">Dono</option><option value="admin">Admin</option><option value="atendente" selected>Atendente</option></select></label>
      <button class="bt">Adicionar</button></form>
    <small class="aviso">A pessoa precisa criar a conta antes. Dono e admin gerenciam a loja; atendente aprova posts e cupons.</small></div>
    <div class="card tab-wrap" id="eq-tab"></div>`;
  const s = $('#eq-emp'); s.value = sel;
  const carrega = async () => {
    try { sessionStorage.setItem('ptl_eq', s.value); } catch { }
    const eq = ok(await sb.rpc('listar_equipe', { p_empresa: s.value })) || [];
    $('#eq-tab').innerHTML = `<table><tr><th>E-mail</th><th>Papel</th><th>Desde</th><th>Status</th><th></th></tr>
      ${eq.map(m => `<tr data-u="${m.user_id}"><td>${esc(m.email)}</td><td>${esc(m.papel)}</td><td>${dt(m.criado_em)}</td>
        <td><span class="st ${m.ativo ? 'ativo' : 'inativo'}">${m.ativo ? 'ativo' : 'inativo'}</span></td>
        <td><button class="bt p sec" data-a="${m.ativo ? 0 : 1}">${m.ativo ? 'Desativar' : 'Ativar'}</button> <button class="bt p er" data-r>Remover</button></td></tr>`).join('')
        || '<tr><td colspan="5" class="vazio">Ninguém na equipe ainda.</td></tr>'}</table>`;
    $$('[data-a]').forEach(b => b.onclick = async () => {
      try { ok(await sb.from('membros').update({ ativo: b.dataset.a === '1' }).eq('empresa_id', s.value).eq('user_id', b.closest('tr').dataset.u)); carrega(); } catch (er) { toast(er.message); }
    });
    $$('[data-r]').forEach(b => b.onclick = async () => {
      if (!confirmar(b, 'Remover da equipe?')) return;
      try { ok(await sb.from('membros').delete().eq('empresa_id', s.value).eq('user_id', b.closest('tr').dataset.u)); carrega(); } catch (er) { toast(er.message); }
    });
  };
  s.onchange = carrega;
  $('#f-mb').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    try { ok(await sb.rpc('adicionar_membro', { p_empresa: s.value, p_email: f.email.value.trim(), p_papel: f.papel.value })); toast('Adicionado!'); f.reset(); carrega(); }
    catch (er) { toast(er.message); }
  };
  await carrega();
}

sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') trocarSenha(); });
async function trocarSenha() {
  $('#login').hidden = false; $('#app').hidden = true;
  const f = $('#f-login'); f.innerHTML = `<h1>3Verso</h1><p>Nova senha</p><input name="senha" type="password" required minlength="10" autocomplete="new-password" placeholder="Nova senha">
    <button class="bt">Salvar</button><p class="msg"></p>`;
  f.onsubmit = async e => { e.preventDefault(); try { ok(await sb.auth.updateUser({ password: f.senha.value })); location.replace(location.pathname); } catch (er) { f.querySelector('.msg').textContent = er.message; } };
}

(async () => { if ((await sb.auth.getSession()).data.session && !location.hash.includes('type=recovery')) abrir().catch(e => toast(e.message)); })();
