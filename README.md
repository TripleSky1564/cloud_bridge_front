<p align="center">
  <img src="https://github.com/user-attachments/assets/4a6a621f-8a20-4ed1-af88-a0a51ca221aa" width="900">
</p>

# 🌤️ Cloud__Bridge – RAG 기반 통합 민원 AI 지원 서비스  
**민원 검색 · 체크리스트 · 위치 정보 · AI 챗봇 상담을 통합 제공하는 All-in-One 플랫폼**

<img src="https://img.shields.io/badge/NaverCloudPlatform-VPC-green" />
<img src="https://img.shields.io/badge/FastAPI-Chatbot-blue" />
<img src="https://img.shields.io/badge/SpringBoot-WAS-yellow" />
<img src="https://img.shields.io/badge/OpenSearch-RAG-orange" />
<img src="https://img.shields.io/badge/Redis-Cache-red" />

---

## 📌 프로젝트 개요
CloudBridge는 복잡한 민원 정보를 누구나 빠르게 이해하고 처리할 수 있도록  
**AI 챗봇 + 민원 검색 + 체크리스트 + 관공서 위치 안내 기능**을 통합 제공하는 서비스입니다.

특히 RAG(Retrieval-Augmented Generation)를 사용하여  
정부 문서를 기반으로 **정확하고 신뢰할 수 있는 민원 답변**을 제공합니다.

---

## 🚀 핵심 기능

### 1) 🤖 AI 민원 챗봇 (FastAPI)
- 질문 의도 분석 (민원 여부 자동 판단)
- RAG 기반 정확한 답변 제공
- 실시간 Streaming 응답
- 개인정보 마스킹(주민번호, 전화번호)
- Redis 기반 세션 관리(TTL 2시간, 최대 10개 메시지 유지)

### 2) 📝 민원 정보 검색 (Spring Boot)
- OpenSearch 벡터검색 + Full-text 검색
- 나의 민원 → 체크리스트 자동 제공
- 실시간 온라인 페이지 링크 제공

### 3) 📍 관공서 위치 조회
- GeoLocation 기반 행정기관 위치 확인
- 네이버 지도 API 연동
- 사용자의 현재 위치 기반 행정기관 위치 확인

### 4) 🔐 로그인 & 인증
- 휴대폰 본인인증 기반 로그인

---

## 🏛 전체 시스템 아키텍처 (Naver Cloud Platform)

> ![Image](https://github.com/user-attachments/assets/b0ae11e9-e234-4c72-afdc-06eb6d6ae58d)


### 설계 원칙
- Public Subnet: 프론트, 웹서버, 챗봇 서버
- Private Subnet: DB, 캐시, 검색 엔진
- 내부 통신은 HTTP (폐쇄망 + 성능 최적화)
- SSL 인증서는 ALB에서 종료(Termination)
- 모든 서버는 Docker + Auto Restart

---

## 🧠 RAG 파이프라인 구조

> ![Image](https://github.com/user-attachments/assets/ac1e76b4-16f4-4bc5-b085-3916eb0393fd)

## 🔐 보안 및 개인정보 처리

### ✔ 개인정보 자동 마스킹
- 주민등록번호 → ******-*******
- 전화번호 → 010-****-****
- LLM에 민감정보가 절대로 전달되지 않도록 설계

### ✔ Redis의 역할
- 세션 캐시 (TTL = 2시간)
- 과거 메시지 10개까지만 유지
- 대화 내용은 **DB에 영구 저장하지 않음**

---

## 🗄 문서 인덱싱 파이프라인(Embedding)

문서 수집 → 전처리(불필요 텍스트 제거) → 문단 분리 → Embedding API 호출 → OpenSearch 저장(원문 + 벡터) → RAG 품질을 유지하기 위해 자동화 스크립트 제공.

---

## 🧩 기술 스택

![Image](https://github.com/user-attachments/assets/22add252-5261-4cb8-8078-87cf2e940722)

### Backend
- Spring Boot (민원 API)
- FastAPI (AI 챗봇 API)
- LangChain, OpenAI GPT-4o-mini
- OpenSearch (Vector Search)
- Redis (Session Cache)
- MySQL

### Frontend
- React + TypeScript
- Axios
- Nginx Reverse Proxy

### Infra (Naver Cloud Platform)
- VPC, Subnet, ACG, ALB, NAT Gateway
- Object Storage, Server(Ubuntu)
- Docker, Docker Compose

---

## 📁 프로젝트 구조

![Image](https://github.com/user-attachments/assets/8d429243-218d-4534-936f-20a884c36e01)

---

## 🧪 주요 트러블슈팅 정리

### 1) Mixed Content (HTTPS/HTTP 충돌)
- 원인: 클라이언트는 HTTPS인데 FastAPI가 HTTP였음
- 해결: ALB에서 HTTPS Termination, 내부는 HTTP 유지

### 2) Reverse Proxy 충돌
- `/api/**` 전부 Spring으로 들어가는 문제
- 해결: 챗봇 경로(`/api/chatbot/`) 별도 라우팅

### 3) Redis 메모리 증가 이슈
- 해결: TTL 설정 + 메시지 개수 제한

### 4) OpenSearch 필드명 오류
- 해결: vector_field, text_field 일치하도록 수정

---

👥 팀 / 기여자

PM / Infra: 양용석

AI Chatbot(FastAPI): 양용석

Backend(WAS): 이동민

Frontend: 오정관

data collection : 배종민

deliverable: 김윤수
