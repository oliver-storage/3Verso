// Provador Mágico — configuração (plataforma 3Verso)
// A chave abaixo é a PUBLICÁVEL (segura no navegador). A segurança real está no RLS do banco.
export const CONFIG = {
  SISTEMA: 'Provador Mágico',
  PLATAFORMA: '3Verso',
  VERSAO: '0.1.1.1',
  DESENVOLVEDOR: 'Vettore Sistemas',
  SUPABASE_URL: 'https://tvcvanvnjbfzmsspiyxb.supabase.co',
  SUPABASE_KEY: 'sb_publishable_HAiRkJ5AuWNosaTMiOiHbg_rIrk85-u',
  EMPRESA_PADRAO: 'milla-kids', // loja aberta quando a URL não traz ?loja=
  LOGIN_SOCIAL: { google: false, facebook: false }, // ligar após criar as credenciais OAuth
  TERMO_VERSAO: '2026-11-05',
  IDADE_MIN: 3,
  IDADE_MAX: 11,
};

export function rodape(el) {
  el.textContent = `${CONFIG.SISTEMA} v${CONFIG.VERSAO}•Desenvolvido por ${CONFIG.DESENVOLVEDOR}`;
}
