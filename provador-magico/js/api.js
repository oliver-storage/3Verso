// Provador Mágico — acesso ao Supabase (Auth + tabelas protegidas por RLS)
import { CONFIG } from './config.js';

export const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const ok = ({ data, error }) => { if (error) throw traduzir(error); return data; };

export function traduzir(e) {
  const m = (e?.message || String(e)).toLowerCase();
  const t = [
    ['invalid login credentials', 'E-mail ou senha incorretos.'],
    ['email not confirmed', 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
    ['user already registered', 'Este e-mail já tem cadastro. Use "Entrar".'],
    ['password should be', 'Senha fraca: use 10+ caracteres com maiúscula, minúscula, número e símbolo.'],
    ['weak password', 'Senha fraca: use 10+ caracteres com maiúscula, minúscula, número e símbolo.'],
    ['pwned', 'Essa senha já vazou na internet. Escolha outra.'],
    ['rate limit', 'Muitas tentativas. Aguarde alguns minutos.'],
    ['row-level security', 'Sem permissão para esta ação.'],
    ['sem permissão', 'Sem permissão para esta ação.'],
    ['duplicate key', 'Registro já existe.'],
  ];
  for (const [k, v] of t) if (m.includes(k)) return new Error(v);
  return new Error(e?.message || 'Erro inesperado.');
}

// ---------- loja ----------
export async function configLoja(slug) {
  const d = ok(await sb.rpc('pm_config_publica', { p_slug: slug }));
  if (!d) throw new Error('Loja não encontrada ou inativa.');
  return d;
}

// ---------- auth ----------
export const sessao = async () => (await sb.auth.getSession()).data.session;
export const sair = () => sb.auth.signOut();

export async function cadastrar(email, senha, nome) {
  return ok(await sb.auth.signUp({
    email, password: senha,
    options: { data: { nome }, emailRedirectTo: location.origin + location.pathname + location.search },
  }));
}
export async function entrar(email, senha) {
  return ok(await sb.auth.signInWithPassword({ email, password: senha }));
}
export async function entrarSocial(provider) {
  return ok(await sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.href } }));
}
export async function recuperarSenha(email) {
  return ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + location.search }));
}

// ---------- cliente (responsável) ----------
export async function meuCliente(empresaId) {
  const s = await sessao(); if (!s) return null;
  return ok(await sb.from('clientes').select('*').eq('empresa_id', empresaId).eq('user_id', s.user.id).maybeSingle());
}
export async function criarCliente(empresaId, { nome, whatsapp, marketing }) {
  const s = await sessao();
  return ok(await sb.from('clientes').insert({
    empresa_id: empresaId, user_id: s.user.id, nome, whatsapp, email: s.user.email,
    provedor: s.user.app_metadata?.provider || 'email',
    aceite_lgpd_em: new Date().toISOString(), aceite_versao: CONFIG.TERMO_VERSAO, aceite_marketing: !!marketing,
  }).select().single());
}

// ---------- crianças / avatar ----------
export async function criancas(clienteId) {
  return ok(await sb.from('criancas').select('*, pm_avatares(params)').eq('cliente_id', clienteId).order('criado_em'));
}
export async function criarCrianca(cli, { nome, data_nascimento, genero }) {
  return ok(await sb.from('criancas').insert({ empresa_id: cli.empresa_id, cliente_id: cli.id, nome, data_nascimento, genero }).select().single());
}
export async function salvarAvatar(crianca, params) {
  // update só da coluna params (o banco não deixa trocar criança/empresa); se ainda não existe, insere
  const r = ok(await sb.from('pm_avatares').update({ params }).eq('crianca_id', crianca.id).select('crianca_id'));
  if (r?.length) return r;
  return ok(await sb.from('pm_avatares').insert({ crianca_id: crianca.id, empresa_id: crianca.empresa_id, params }));
}
export async function salvarLook(crianca, tema, pecas) {
  return ok(await sb.from('pm_looks').insert({ empresa_id: crianca.empresa_id, crianca_id: crianca.id, tema, pecas }).select().single());
}

// ---------- posts / cupons ----------
export async function regrasAtivas(empresaId) {
  return ok(await sb.from('pm_cupom_regras').select('*').eq('empresa_id', empresaId).eq('ativo', true));
}
export async function enviarPost(cli, { link, arquivo, lookId, regraId }) {
  let print_path = null;
  if (arquivo) {
    const ext = (arquivo.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    print_path = `${cli.empresa_id}/${cli.id}/${Date.now()}.${ext}`;
    ok(await sb.storage.from('pm-posts').upload(print_path, arquivo, { contentType: arquivo.type }));
  }
  return ok(await sb.from('pm_posts').insert({
    empresa_id: cli.empresa_id, cliente_id: cli.id, link: link || null, print_path, look_id: lookId || null, regra_id: regraId || null,
  }).select().single());
}
export async function meusPosts(cli) {
  return ok(await sb.from('pm_posts').select('*').eq('cliente_id', cli.id).order('criado_em', { ascending: false }));
}
export async function meusCupons(cli) {
  return ok(await sb.from('pm_cupons').select('*, pm_cupom_regras(nome,tipo,valor)').eq('cliente_id', cli.id).order('criado_em', { ascending: false }));
}

export function idade(dataNasc, ref = new Date()) {
  const d = new Date(dataNasc + 'T12:00:00');
  let a = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) a--;
  return a;
}
