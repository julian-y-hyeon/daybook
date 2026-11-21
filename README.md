# daybook

레이너 볼프하임 롤플레이의 캘린더와 통화·문자 화면을 보는 개인 페이지. GitHub Pages에 올리고, 로그인한 관리자 한 명만 데이터를 볼 수 있다. 이 저장소에는 화면 코드만 두고 데이터는 두지 않는다. 문자·통화와 장기기억 계획은 wolfheim의 `studio/daybook/`에서 읽는다.

- `index.html`: 로그인
- `calendar.html`: 볼프하임 캘린더
- `phone.html`: 통화 · 문자(#messages, #calls, #rec-N)
- `css/`: 페이지별 스타일
- `js/config.js`: Supabase 주소와 anon 키
- `js/common.js`: 로그인 확인, 저장·불러오기, 위쪽 메뉴
- `js/calendar.js`, `js/phone.js`: 각 화면
- `supabase/schema.sql`: `docs` 테이블과 RLS(관리자 UID만). 캘린더만 여기 저장한다
- `supabase/functions/repo-read/`: 비공개 저장소 wolfheim에서 최근기억·고정기억 네 파일과 `studio/daybook/`의 `calendar.md`·`phone.json`을 읽어 주는 Edge Function
