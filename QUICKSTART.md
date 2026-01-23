# 빠른 시작 가이드

## 1. 백엔드 실행

터미널 1에서:

```bash
cd /Users/daniel/lotto-project/backend
yarn start:dev
```

서버가 시작되면 다음과 같이 표시됩니다:
```
Backend server running on http://localhost:3001
```

## 2. 프론트엔드 실행

터미널 2에서:

```bash
cd /Users/daniel/lotto-project/frontend
yarn dev
```

서버가 시작되면:
```
▲ Next.js 16.1.4
- Local:        http://localhost:3000
```

## 3. 브라우저에서 접속

http://localhost:3000 으로 접속하세요.

## 주요 기능 테스트

### 대시보드 (/)
- 최근 당첨번호 10개 표시
- 번호별 출현 통계

### 번호 생성 (/generate)
1. 생성 옵션 설정
2. "번호 조합 생성" 버튼 클릭
3. 생성된 조합 확인

### 통계 분석 (/statistics)
1. 분석 범위 설정 (시작/종료 회차)
2. 범위별 번호 출현 빈도 확인

### 조합 검증 (/validate)
1. 6개 번호 선택
2. 검증 범위 설정
3. "검증 시작" 버튼 클릭
4. 과거 당첨번호와의 일치도 확인

## API 테스트

백엔드 API를 직접 테스트하려면:

```bash
# 헬스 체크
curl http://localhost:3001/api/lotto/health

# 전체 당첨번호 조회
curl http://localhost:3001/api/lotto/draws

# 최근 5회차 조회
curl http://localhost:3001/api/lotto/draws/recent/5

# 통계 조회
curl http://localhost:3001/api/lotto/statistics
```

## 트러블슈팅

### 포트가 이미 사용 중인 경우

백엔드 (3001):
```bash
lsof -ti:3001 | xargs kill -9
```

프론트엔드 (3000):
```bash
lsof -ti:3000 | xargs kill -9
```

### 의존성 문제

```bash
# 백엔드
cd backend
rm -rf node_modules yarn.lock
yarn install

# 프론트엔드
cd frontend
rm -rf node_modules yarn.lock .next
yarn install
```
