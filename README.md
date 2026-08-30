my콘도맵

회사 제휴 콘도/호텔 할인 리스트를 지도에서 보고, 여행 일정(Day별)을 짜는 개인용 웹앱.
정적 사이트 + 무료 API 조합으로만 구성. GitHub Pages로 배포됨.

배포 주소: https://siyeon-ju.github.io/mycondomap/


파일 구조

index.html            메인 페이지 마크업
app.js                전체 로직 (지도, 검색, 일정, AI 추천, 로그인)
style.css             스타일
deamoon.png           로그인 화면 배너 이미지

jeju_condo_info.csv              제주 콘도 원본 데이터
seoul_hotel_info.csv             서울 호텔 원본 데이터
gyeonggi_incheon_hotel_info.csv  경기/인천 호텔 원본 데이터 (xlsx에서 변환됨)
gyeonggi_incheon_hotel_info.xlsx 위 원본 엑셀
chungcheong_hotel_info.csv       충청 호텔 원본 데이터
jeonla_hotel_info.csv            전라 호텔 원본 데이터
Gyeongsang_Accommodations_List.csv  경상 원본 데이터 (영문 헤더, 다른 스키마)
gyeongsang_hotel_info.csv        위 파일을 표준 스키마로 변환한 결과

scripts/geocode.js             위 CSV들을 읽어 카카오 API로 지오코딩 → condos.json 생성
scripts/convert_gyeongsang.js  경상 원본(영문/다른 구조)을 표준 CSV로 변환
condos.json                    지오코딩 완료된 최종 데이터 (앱이 실제로 읽는 파일)

vercel-proxy/api/suggest.js    AI 추천 기능용 서버리스 프록시 (Gemini API 키를 숨기는 역할)


사용 중인 외부 서비스 (전부 무료 티어, 카드 등록 없음)

1. 카카오맵 API
   - 지도 표시(JS SDK), 장소 검색/지오코딩(Local API)
   - 키 발급/도메인 등록: developers.kakao.com

2. GitHub Pages
   - 정적 사이트 호스팅. main 브랜치가 그대로 배포됨.

3. Firebase (Firestore, Spark 무료 요금제)
   - 일정(Trip/Day/Stop) 데이터 저장. 로그인 ID별로 문서 분리, 같은 ID로 로그인하면 공유됨.
   - 콘솔: console.firebase.google.com (프로젝트: mycondomap-9d10b)

4. Google AI Studio (Gemini 2.5 Flash API)
   - "AI로 주변 추천받기" 기능에 사용. 무료 티어.
   - 키 자체는 app.js가 아니라 vercel-proxy 서버 쪽에만 있음(환경변수).

5. Vercel (Hobby 무료 플랜)
   - Gemini API 키를 숨기기 위한 프록시 서버 1개(vercel-proxy/api/suggest.js) 호스팅.
   - 프론트엔드가 이 프록시를 호출 → 프록시가 Gemini 호출 → 결과 반환.
   - (참고: 처음엔 Cloudflare Workers로 시도했으나, Gemini가 Cloudflare IP를 차단해서(프록시/데이터센터로 인식) Vercel로 변경함)


혹시 돈이 나갔다면 확인할 곳

원칙적으로 위 5개 서비스 전부 결제수단을 등록한 적이 없어서, 한도를 넘으면
그냥 요청이 막히거나 실패할 뿐 청구가 되는 구조 자체가 아님. 그래도 뭔가
의심되면 아래 순서로 확인:

1. 카카오 디벨로퍼스 (developers.kakao.com)
   내 애플리케이션 > 해당 앱 > 이용현황/할당량. 여기는 애초에 비즈월렛(결제수단)
   연결 안 하면 유료 전환 자체가 안 됨 — 연결한 적 없으면 걱정 안 해도 됨.

2. Google Cloud 결제 (console.cloud.google.com/billing)
   Firebase와 Gemini API 키 둘 다 이 계정 산하. "결제 계정"이 아예 없거나
   "체험판(크레딧)" 상태인지 확인. 카드 등록한 적 없으면 결제 계정 자체가 없을 것.
   Firebase 프로젝트가 Blaze(유료) 요금제로 전환됐는지도
   console.firebase.google.com > 프로젝트 설정 > 사용량 및 결제 에서 확인 가능
   (우리는 Spark 그대로 씀, Blaze로 안 감).

3. Vercel 대시보드 (vercel.com/dashboard, 프로젝트: vercel-proxy)
   Settings > Billing. Hobby 플랜인지 확인, 결제수단 등록 안 했으면 여기서도
   과금 자체가 불가능.

4. Cloudflare 대시보드 (dash.cloudflare.com)
   Workers 계정만 만들고 실제로는 안 씀(코드 배포는 했었지만 지금 프론트엔드가
   호출 안 함). 여기도 결제수단 등록 안 함.

5. 은행/카드사 앱에서 최근 해외결제/구독결제 내역 확인
   위 4곳 다 문제없으면, 진짜 의심되는 결제는 이 프로젝트랑 무관한 다른 곳일
   가능성이 높음.


로컬에서 실행하기

python -m http.server 8080
그 다음 브라우저로 http://localhost:8080 접속.
(카카오 JS 키의 도메인 등록에 http://localhost:8080 포함되어 있어야 지도가 뜸)


데이터 갱신 (콘도/호텔 목록이 추가/변경됐을 때)

1. 새 지역 CSV를 표준 스키마(지역,콘도명,룸타입/평형,확정금액,공제방법,본인부담금)로 준비
   (스키마가 다르면 scripts/convert_gyeongsang.js 참고해서 변환 스크립트 작성)
2. scripts/geocode.js의 SOURCES 배열에 파일 추가
3. KAKAO_REST_KEY=발급받은키 node scripts/geocode.js 실행 → condos.json 갱신
4. git add/commit/push
