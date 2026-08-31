# my콘도맵

회사 제휴 콘도/호텔 할인 리스트를 지도에서 보고, 여행 일정(Day별)을 짜는 개인용 웹앱.
정적 사이트 + 무료 API 조합으로만 구성. GitHub Pages로 배포됨.

**배포 주소**: https://siyeon-ju.github.io/mycondomap/

## 기능

- 지도에서 콘도/호텔 위치와 본인부담금 최소가 확인, 지역 필터
- 주변 식당/카페 검색
- 여행(Trip) > Day > 시간대별 일정(Stop) 관리, 같은 로그인 ID끼리 실시간 공유(Firestore)
- Day에 담긴 장소 기준 1km 이내 AI 추천(Gemini), 채택한 것만 일정에 반영
- 지도에 Day 동선(①②③ 번호 + 이동시간 표시)
- 카카오맵 앱 딥링크(K 배지)
- 공유 ID/PW 로그인 (가벼운 접근 제한용, 강한 보안 아님)

## 파일 구조

```
index.html    메인 페이지 마크업
app.js        전체 로직 (지도, 검색, 일정, AI 추천, 로그인)
style.css     스타일
deamoon.png   로그인 화면 배너 이미지

condos.json                    지오코딩 완료된 콘도/호텔 데이터 (앱이 실제로 읽는 파일)
scripts/geocode.js             지역별 원본 CSV를 카카오 API로 지오코딩 → condos.json 생성
scripts/convert_gyeongsang.js  경상 원본(다른 스키마)을 표준 CSV로 변환

vercel-proxy/api/suggest.js    AI 추천 기능용 서버리스 프록시 (Gemini API 키를 숨기는 역할)
firestore.rules, firebase.json, .firebaserc    Firestore 보안 규칙 배포 설정
```

원본 CSV/xlsx 파일들(`jeju_condo_info.csv` 등)은 `.gitignore` 처리되어 저장소에는 없음.
로컬에만 두고 `scripts/geocode.js` 돌릴 때만 사용 ([데이터 갱신](#데이터-갱신) 참고).

## 사용 중인 외부 서비스

전부 무료 티어, 카드 등록 없음.

| 서비스 | 용도 |
|---|---|
| [카카오맵 API](https://developers.kakao.com) | 지도 표시(JS SDK), 장소 검색/지오코딩(Local API) |
| GitHub Pages | 정적 사이트 호스팅, `main` 브랜치 그대로 배포 |
| [Firebase Firestore](https://console.firebase.google.com) (Spark 무료 요금제) | 일정 데이터 저장·실시간 공유. 프로젝트: `mycondomap-9d10b`. 규칙은 `firestore.rules`, `firebase deploy --only firestore:rules`로 배포 |
| [Google AI Studio](https://aistudio.google.com) (Gemini 2.5 Flash) | AI 추천 기능. 키는 `app.js`가 아니라 vercel-proxy 서버 환경변수에만 있음 |
| [Vercel](https://vercel.com) (Hobby 무료 플랜) | Gemini 키를 숨기는 프록시(`vercel-proxy/api/suggest.js`) 호스팅 |

## 혹시 돈이 나갔다면 확인할 곳

위 서비스 전부 결제수단을 등록한 적이 없어서, 한도를 넘으면 요청이 막히거나
실패할 뿐 청구가 되는 구조 자체가 아님. 그래도 의심되면 아래 순서로 확인:

1. **카카오 디벨로퍼스** → 내 애플리케이션 > 이용현황/할당량. 비즈월렛 연결 안 하면 유료 전환 자체가 안 됨.
2. **Google Cloud 결제** (console.cloud.google.com/billing) → Firebase·Gemini 키 둘 다 이 계정 산하. 결제 계정 있는지, Firebase가 Blaze(유료)로 전환됐는지(`console.firebase.google.com` > 프로젝트 설정 > 사용량 및 결제) 확인.
3. **Vercel 대시보드** → Settings > Billing, Hobby 플랜인지 확인.
4. **은행/카드사 앱**에서 최근 해외결제/구독결제 내역 확인.

## 로컬에서 실행하기

```bash
python -m http.server 8080
```

`http://localhost:8080` 접속. (카카오 JS 키 도메인 등록에 `http://localhost:8080` 포함돼 있어야 지도가 뜸)

## 데이터 갱신

콘도/호텔 목록이 추가·변경됐을 때:

1. 새 지역 CSV를 표준 스키마(`지역,콘도명,룸타입/평형,확정금액,공제방법,본인부담금`)로 준비
   (스키마가 다르면 `scripts/convert_gyeongsang.js` 참고해서 변환 스크립트 작성)
2. `scripts/geocode.js`의 `SOURCES` 배열에 파일 추가
3. 실행:
   ```bash
   KAKAO_REST_KEY=발급받은키 node scripts/geocode.js
   ```
4. `condos.json` 갱신 확인 후 git add/commit/push

## 라이선스

개인/가족 용도로만 만든 프로젝트. 재배포·상업적 이용 금지, 별도 라이선스 없음.
