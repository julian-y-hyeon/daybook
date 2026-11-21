// 비공개 저장소 julian-y-hyeon/wolfheim main에서 정해 둔 파일만 읽어 돌려준다. 저장소를 고치지 않는다.
// 비밀값(Edge Functions → Secrets): GH_TOKEN(Contents 읽기 전용 fine-grained 토큰), OWNER_UID(관리자 UID)
// SUPABASE_URL, SUPABASE_ANON_KEY는 Supabase가 넣어 준다.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const OWNER = 'julian-y-hyeon';
const REPO = 'wolfheim';
const REF = 'main';
const ALLOW = new Set([
  'story/memory/레이너_최근기억.md',
  'story-modern/memory/레이너_최근기억.md',
  'story/memory/레이너_고정기억.md',
  'story-modern/memory/레이너_고정기억.md',
]);
const ORIGINS = ['https://julian-y-hyeon.github.io'];

function cors(req: Request) {
  const o = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST만 받아요' }, 405);

  // 로그인한 관리자인지 확인
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json(req, { error: '로그인이 필요해요' }, 401);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: u, error: ue } = await sb.auth.getUser(token);
  if (ue || !u?.user) return json(req, { error: '로그인이 만료됐어요. 다시 로그인해 주세요' }, 401);
  if (u.user.id !== Deno.env.get('OWNER_UID')) return json(req, { error: '권한이 없어요' }, 403);

  let paths: unknown;
  try { paths = (await req.json()).paths; } catch { return json(req, { error: '요청 형식이 맞지 않아요' }, 400); }
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > ALLOW.size) return json(req, { error: 'paths가 필요해요' }, 400);

  const gh = Deno.env.get('GH_TOKEN');
  if (!gh) return json(req, { error: 'GH_TOKEN 비밀값이 없어요' }, 500);

  const files: Record<string, string> = {};
  const errors: Record<string, string> = {};
  await Promise.all(paths.map(async (p) => {
    if (typeof p !== 'string' || !ALLOW.has(p)) { errors[String(p)] = '읽을 수 없는 경로예요'; return; }
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${p.split('/').map(encodeURIComponent).join('/')}?ref=${REF}`;
    try {
      const r = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${gh}`,
          'Accept': 'application/vnd.github.raw+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'daybook-repo-read',
        },
      });
      if (r.ok) files[p] = await r.text();
      else errors[p] = r.status === 401 || r.status === 403 ? 'GitHub 토큰이 거절됐어요(만료·권한 확인)' : r.status === 404 ? '파일을 찾지 못했어요' : `GitHub 응답 ${r.status}`;
    } catch (e) {
      errors[p] = 'GitHub에 닿지 못했어요: ' + (e instanceof Error ? e.message : String(e));
    }
  }));
  return json(req, { files, errors });
});
