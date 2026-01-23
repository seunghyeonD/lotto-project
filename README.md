# 로또 번호 생성 시스템

과거 데이터 분석을 통한 지능형 로또 번호 생성 및 분석 시스템

## 주요 기능

### 1. 번호 생성
- 기획안 규칙에 따른 지능형 번호 조합 생성
- 범위별 분포 제약 조건 (단/십/이/삼/사 번대)
- 과거 당첨번호와의 중복 필터링
- 5개, 4개 일치 조합 분석

### 2. 통계 분석
- 회차별 번호 출현 빈도 분석
- 범위별 통계
- 최근 출현 패턴 분석

### 3. 조합 검증
- 선택한 번호의 과거 당첨번호 매칭 분석
- 일치도 통계
- 상세 결과 표시

## 기술 스택

### Frontend
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4

### Backend
- NestJS 11
- TypeScript 5
- RESTful API

## 시작하기

### 1. 의존성 설치

```bash
# 프론트엔드 설치
cd frontend
yarn install

# 백엔드 설치
cd backend
yarn install
```

### 2. 개발 서버 실행

터미널을 2개 열어서 각각 실행:

```bash
# 터미널 1: 백엔드 실행
cd backend
yarn start:dev

# 터미널 2: 프론트엔드 실행
cd frontend
yarn dev
```

### 3. 접속

- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:3001

## API 엔드포인트

### 당첨번호 관리
- `GET /api/lotto/draws` - 전체 당첨번호 조회
- `GET /api/lotto/draws/:round` - 특정 회차 조회
- `GET /api/lotto/draws/recent/:count` - 최근 N회차 조회
- `POST /api/lotto/draws` - 당첨번호 추가

### 통계
- `GET /api/lotto/statistics` - 번호 통계 조회

### 조합 생성
- `POST /api/lotto/combinations/generate` - 번호 조합 생성
- `POST /api/lotto/combinations/validate` - 조합 검증
- `POST /api/lotto/combinations/analyze` - 조합 분석

## 프로젝트 구조

```
lotto-project/
├── frontend/           # Next.js 프론트엔드
│   ├── app/           # 페이지
│   ├── components/    # 재사용 컴포넌트
│   ├── lib/          # API 클라이언트
│   └── types/        # TypeScript 타입
│
├── backend/           # NestJS 백엔드
│   ├── src/
│   │   ├── controllers/  # API 컨트롤러
│   │   ├── services/     # 비즈니스 로직
│   │   ├── types/        # TypeScript 타입
│   │   ├── utils/        # 유틸리티 함수
│   │   └── data/         # 샘플 데이터
│   └── ...
└── README.md
```

## 주요 알고리즘

### 번호 조합 생성 규칙

1. **범위별 분포**: 각 범위(단/십/이/삼/사)에서 0~2개씩 선택
2. **11-19번 행 제약**: 0~4개까지만 허용
3. **최근 번호 제외**: 최근 2주 내 출현 번호 제외
4. **과거 매칭 필터**: 과거 당첨번호와 3개 이상 일치하는 조합 제외
5. **중복 조합 제거**: 같은 N개 숫자 조합은 1개만 유지

## 라이선스

MIT
