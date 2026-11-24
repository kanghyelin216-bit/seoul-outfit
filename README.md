# 서울 날씨 & 옷차림 메모

서울의 현재 날씨를 보여주고, Google 로그인 후 오늘의 옷차림을 한 줄로 기록하는 웹앱입니다.

- **사용 API:** [Open-Meteo API](https://open-meteo.com/) (인증키 불필요)
- **배포 링크:** https://아이디.github.io/저장소명/ ← 본인 주소로 교체
- **기술:** HTML / CSS / JavaScript(ES Modules), Firebase Authentication, Cloud Firestore, GitHub Pages

## 실행 스크린샷

![실행 화면](docs/screenshot.png)

## 주요 기능

1. Open-Meteo로 서울의 현재 기온·체감온도·날씨·습도·바람 불러오기
2. Firebase Google 로그인 / 로그아웃
3. 오늘의 옷차림 한 줄 메모를 Firestore(`users/{uid}/memos`)에 저장, 조회, 삭제
4. 메모 저장 시 당시 날씨(기온, 체감, 상태)를 함께 기록

## 실행 방법

1. 이 저장소를 클론합니다.
2. `firebase-config.js`의 값을 본인 Firebase 웹 앱 설정으로 교체합니다.
3. 로컬 서버로 실행합니다 (ES Module이라 `file://`로는 동작하지 않습니다).
   ```bash
   python -m http.server 8000
   # http://localhost:8000 접속
   ```

## Firebase 설정 체크

- Authentication → Sign-in method → **Google** 사용 설정
- Authentication → 설정 → **승인된 도메인**에 `본인아이디.github.io` 추가
- Firestore Database 생성 후 `firestore.rules` 내용을 규칙 탭에 게시

## 배포 (GitHub Pages)

1. 저장소 Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `/ (root)` → Save
2. 1~2분 뒤 배포 링크에서 로그인·새로고침(F5) 동작 확인
