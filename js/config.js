// 3Verso — Portal de gestão de projetos
// Chave PUBLICÁVEL (segura no navegador). A segurança real está no RLS/RPC do banco.
export const CONFIG = {
  SISTEMA: '3Verso',
  VERSAO: '0.2.0.0',
  DESENVOLVEDOR: 'Vettore Sistemas',
  SUPABASE_URL: 'https://tvcvanvnjbfzmsspiyxb.supabase.co',
  SUPABASE_KEY: 'sb_publishable_HAiRkJ5AuWNosaTMiOiHbg_rIrk85-u',
};

export function rodape(el) {
  el.textContent = `${CONFIG.SISTEMA} v${CONFIG.VERSAO}•Desenvolvido por ${CONFIG.DESENVOLVEDOR}`;
}
