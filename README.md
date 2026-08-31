# 유앤아이트립

관심 콘도/호텔 리스트를 지도에서 보고, 여행 일정(Day별)을 짜는 개인용 웹앱.
정적 사이트 + 무료 API 조합으로만 구성. GitHub Pages로 배포됨.

## 기능

- 지도에서 콘도/호텔 위치와 최소 부담금 확인, 지역 필터
- 주변 식당/카페 검색
- 여행(Trip) > Day > 시간대별 일정(Stop) 관리, 로그인 계정끼리 실시간 공유
- Day에 담긴 장소 기준 주변 AI 추천, 채택한 것만 일정에 반영
- 지도에 Day 동선(번호 + 이동시간) 표시
- 카카오맵 앱 딥링크
- 로그인 게이트 (가벼운 접근 제한용)

## 기술 스택

- 카카오맵 JS SDK / Local API — 지도, 검색, 지오코딩
- Firebase Firestore — 일정 데이터 저장·실시간 동기화
- Gemini API (서버리스 프록시 경유) — AI 추천
- GitHub Pages — 정적 호스팅
- Vercel — API 프록시 호스팅

## 구조

```
index.html
app.js
style.css

scripts/
  geocode.js
  convert_gyeongsang.js

vercel-proxy/
  api/suggest.js

firestore.rules
firebase.json
```

## 로컬에서 실행하기

```bash
python -m http.server 8080
```

`http://localhost:8080` 접속.

## 라이선스

개인/가족 용도로만 만든 프로젝트. 재배포·상업적 이용 금지, 별도 라이선스 없음.
