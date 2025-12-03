import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getServiceDetail } from "../../utils/guidanceSearch";
import {
  CASES_UPDATED_EVENT,
  getCaseByServiceId,
  type CaseTrackerStatus,
  upsertCase,
  upsertCivilCase,
} from "../../utils/caseTracker";
import styles from "./DocumentChecklistPage.module.css";
import {
  loadNaverMap,
  type NaverInfoWindowInstance,
  type NaverLatLng,
  type NaverMarkerInstance,
} from "../../utils/naver";
import { getJson } from "../../utils/api";
import type {
  CivilPetition,
  CivilPetitionStep,
  CivilPetitionStepRecord,
} from "../../types/civilPetition";
import type {
  DocumentRequirement,
  ServiceGuidanceDetail,
} from "../../types/guidance";
import { getSequenceRows, type SequenceRow } from "../../data/serviceSequences";
import { useAuth } from "../../context/useAuth";
// 🚀 ================= [여기에 삽입] ================= 🚀
//

// 👈 [추가] OfficeCategory 정의 (OfficeInfo가 사용)
type OfficeCategory = "all" | "welfare" | "civil" | "employment";

// 👈 [추가] 관공서 정보 타입 (NearbyOfficesPage.tsx에서 복사)
type OfficeInfo = {
  id: string;
  name: string;
  category?: OfficeCategory | null;
  regionCode?: string | null;
  address: string;
  phone?: string;
  openingHours?: string;
  notes?: string;
  latitude: number;
  longitude: number;
};
type OfficeWithDistance = OfficeInfo & { distanceKm: number };

type LatLngInstance = NaverLatLng & {
  lat: () => number;
  lng: () => number;
};

// 브라우저 위치와 관공서 사이의 실제 거리를 계산해 마커 색을 결정한다.
const haversineDistanceKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistance = (distanceKm: number) => {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m`;
  return `${distanceKm.toFixed(1)}km`;
};

type LoanStep = {
  order: number;
  title: string;
  description: string;
};

const FIRST_HOME_LOAN_STEPS: LoanStep[] = [
  {
    order: 1,
    title: "주택도시기금 회원가입",
    description:
      "기금e든든(주택기금) 홈페이지에 접속해 회원가입과 본인 인증을 완료합니다.",
  },
  {
    order: 2,
    title: "예비 자격심사 및 대출 신청",
    description:
      "자격심사 페이지에서 세대·소득 정보를 입력해 예비 자격을 확인한 뒤 “가능” 결과가 나오면 온라인으로 대출 신청서를 제출합니다.",
  },
  {
    order: 3,
    title: "취급은행 상담",
    description:
      "신청서를 접수한 은행에서 전화 상담을 진행하며 신청 내용과 필요 서류, 약정 절차를 안내받습니다.",
  },
  {
    order: 4,
    title: "주택 매매계약서 작성",
    description:
      "매매하려는 주택의 계약서를 작성합니다. 공인중개사가 준비해 주는 확약서, 중개대상물 확인서 등 부속 서류를 함께 챙깁니다.",
  },
  {
    order: 5,
    title: "제출 서류 준비(행정복지센터)",
    description:
      "주민등록등본, 무주택 확인서 등 행정복지센터에서 발급받아야 하는 서류를 방문 발급 또는 정부24로 준비합니다.",
  },
  {
    order: 6,
    title: "소득증빙 발급",
    description:
      "회사에서 급여명세서 또는 소득금액증명서를 발급받아 은행 제출용으로 준비합니다.",
  },
  {
    order: 7,
    title: "은행 방문 및 서류 제출",
    description:
      "취급은행을 방문해 모든 원본 서류를 제출하고 담보·보증 절차를 마무리합니다. 심사 중 추가 서류 요청 여부를 확인합니다.",
  },
  {
    order: 8,
    title: "대출 실행 확인",
    description:
      "최종 승인 후 1~2시간 내 지정 계좌로 대출금 입금 여부를 확인하고 잔금 일정을 맞춥니다.",
  },
];

const normalizeStepRecord = (
  step: CivilPetitionStep
): CivilPetitionStepRecord => {
  if (typeof step === "string") {
    return { content: step };
  }
  return step ?? { content: "" };
};

type RequiredLinkEntry = {
  label: string;
  url: string;
  context?: string;
};

const collectRequiredLinks = (
  sequence: SequenceRow[],
  documents: DocumentRequirement[]
): RequiredLinkEntry[] => {
  const linkMap = new Map<string, RequiredLinkEntry>();

  sequence.forEach((row) => {
    const entries =
      row.links && row.links.length > 0
        ? row.links
        : row.linkUrl
        ? [{ label: "바로가기", url: row.linkUrl }]
        : [];
    entries.forEach((entry) => {
      const key = `${entry.url}`;
      if (!linkMap.has(key)) {
        linkMap.set(key, {
          label: entry.label ?? "바로가기",
          url: entry.url,
          context: row.title ?? row.type,
        });
      }
    });
  });

  documents.forEach((doc) => {
    if (!doc.downloadUrl) return;
    const key = `${doc.downloadUrl}`;
    if (linkMap.has(key)) return;
    linkMap.set(key, {
      label: doc.downloadLabel ?? doc.issuingAuthority ?? "발급 사이트",
      url: doc.downloadUrl,
      context: doc.name,
    });
  });

  return Array.from(linkMap.values());
};

const getModeLabel = (
  mode?: CivilPetitionStepRecord["mode"] | null,
  fallback?: string
) => {
  if (!mode) return fallback ?? "진행";
  const normalized = mode.toString().toUpperCase();
  if (normalized === "ONLINE") return "온라인 신청";
  if (normalized === "OFFLINE") return "방문 신청";
  if (normalized === "HYBRID") return "온라인/방문";
  return fallback ?? mode.toString();
};

const createRowsFromSteps = (
  steps: CivilPetition["onlineSteps"],
  fallbackType: string,
  offset: number
): SequenceRow[] => {
  return steps.map((step, index) => {
    const normalized = normalizeStepRecord(step);
    const fallbackOrder = offset + index + 1;
    return {
      id: normalized.id ? String(normalized.id) : `${fallbackType}-${index}`,
      order: normalized.order ?? fallbackOrder,
      type: getModeLabel(normalized.mode, fallbackType),
      content: normalized.content,
      linkUrl: normalized.linkUrl ?? undefined,
    };
  });
};

const buildSequenceFromPetition = (petition: CivilPetition): SequenceRow[] => {
  const onlineRows = createRowsFromSteps(
    petition.onlineSteps ?? [],
    "온라인 신청",
    0
  );
  const lastOnlineOrder = onlineRows.reduce(
    (max, row) => Math.max(max, row.order ?? 0),
    0
  );
  const offlineRows = createRowsFromSteps(
    petition.offlineSteps ?? [],
    "방문 신청",
    lastOnlineOrder
  );
  const combined = [...onlineRows, ...offlineRows];
  return combined.map((row, index) => ({
    ...row,
    order: row.order ?? index + 1,
  }));
};

const mergeSequenceWithPetitionLinks = (
  rows: SequenceRow[],
  petition: CivilPetition
): SequenceRow[] => {
  const linkMap = new Map<number, string>();
  const allSteps = [
    ...(petition.onlineSteps ?? []),
    ...(petition.offlineSteps ?? []),
  ];
  allSteps.forEach((step, index) => {
    const normalized = normalizeStepRecord(step);
    if (!normalized.linkUrl) return;
    const orderKey = (normalized.order ?? index + 1) || index + 1;
    if (!linkMap.has(orderKey)) {
      linkMap.set(orderKey, normalized.linkUrl);
    }
  });
  return rows.map((row, index) => {
    const normalizedOrder = row.order ?? index + 1;
    return {
      ...row,
      order: normalizedOrder,
      linkUrl: row.linkUrl ?? linkMap.get(normalizedOrder),
    };
  });
};

const resolveSequenceRows = (petition: CivilPetition): SequenceRow[] => {
  const predefined = getSequenceRows(petition.infoId);
  if (predefined.length > 0) {
    return mergeSequenceWithPetitionLinks(predefined, petition);
  }
  return buildSequenceFromPetition(petition);
};

type NearbyFilter = {
  categories?: OfficeCategory[];
  keywordIncludes?: string[];
};

const SERVICE_MAP_FILTERS: Record<string, NearbyFilter> = {
  "first-home-loan": {
    categories: ["civil", "welfare"],
    keywordIncludes: ["은행", "금융", "행정복지", "주택도시기금"],
  },
  CP_001: {
    categories: ["civil", "welfare"],
    keywordIncludes: [
      "은행",
      "금융",
      "행정복지",
      "주택도시기금",
      "동구청",
      "북구청",
      "서구청",
      "남구청",
      "광산구청",
      "구청",
    ],
  },
};

const DEFAULT_NEARBY_FILTER: NearbyFilter = {
  categories: ["civil", "welfare", "employment"],
  keywordIncludes: ["행정복지", "구청"],
};

// 🚀 ================= [여기까지 삽입] ================= 🚀

const DocumentChecklistPage = () => {
  const { serviceId } = useParams();
  const id = serviceId!;
  const detail = useMemo<ServiceGuidanceDetail | null>(
    () => getServiceDetail(id) ?? null,
    [id]
  );
  const location = useLocation();
  const initialState =
    (location.state as { petition?: CivilPetition } | null) ?? null;
  const [civilPetition, setCivilPetition] = useState<CivilPetition | null>(
    () => {
      if (initialState?.petition && initialState.petition.infoId === id) {
        return initialState.petition;
      }
      return null;
    }
  );
  const [isLoadingPetition, setIsLoadingPetition] = useState(false);
  const [petitionError, setPetitionError] = useState<string | null>(null);

  useEffect(() => {
    if (detail || civilPetition || isLoadingPetition) return;
    let isMounted = true;
    setIsLoadingPetition(true);
    getJson<CivilPetition>(`/api/civil-petitions/${id}`)
      .then((data) => {
        if (!isMounted) return;
        setCivilPetition(data);
        setPetitionError(null);
      })
      .catch((error) => {
        console.error("민원 세부 정보를 불러오지 못했습니다.", error);
        if (!isMounted) return;
        setPetitionError(
          "민원 세부 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
        );
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingPetition(false);
      });

    return () => {
      isMounted = false;
    };
  }, [detail, civilPetition, id, isLoadingPetition]);

  if (detail) {
    return <StaticChecklistView detail={detail} serviceId={id} />;
  }

  if (isLoadingPetition) {
    return (
      <div className={styles.page}>
        <p>민원 세부 정보를 불러오는 중입니다…</p>
      </div>
    );
  }

  if (petitionError) {
    return (
      <div className={styles.page}>
        <p>{petitionError}</p>
      </div>
    );
  }

  if (civilPetition) {
    return <CivilChecklistView petition={civilPetition} />;
  }

  return (
    <div className={styles.page}>
      <p>표시할 민원 정보를 찾을 수 없습니다.</p>
    </div>
  );
};

type StaticChecklistProps = {
  detail: ServiceGuidanceDetail;
  serviceId: string;
};

const StaticChecklistView = ({ detail, serviceId }: StaticChecklistProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const docs = detail.documentChecklistDetails;
  const staticSequence = useMemo(() => getSequenceRows(serviceId), [serviceId]);
  const mapContainerId = `service-map-${serviceId}`;
  const [caseStatus, setCaseStatus] = useState<CaseTrackerStatus>(() => {
    const entry = getCaseByServiceId(serviceId);
    return entry?.status ?? "idle";
  });
  const requiredLinks = useMemo(
    () => collectRequiredLinks(staticSequence, docs),
    [staticSequence, docs]
  );

  // ✅ 페이지 진입 시 상단으로 이동
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncCaseStatus = () => {
      const entry = getCaseByServiceId(serviceId);
      setCaseStatus(entry?.status ?? "idle");
    };

    syncCaseStatus();
    window.addEventListener(
      CASES_UPDATED_EVENT,
      syncCaseStatus as EventListener
    );

    return () => {
      window.removeEventListener(
        CASES_UPDATED_EVENT,
        syncCaseStatus as EventListener
      );
    };
  }, [serviceId]);

  const docFormats: Record<string, string> = {
    download: "온라인 다운로드",
    "in-person": "방문 발급",
    copy: "사본 제출",
  };

  const statusLabelMap: Record<CaseTrackerStatus, string> = {
    idle: "미진행",
    "in-progress": "진행 중",
    completed: "완료",
  };
  const statusLabel = statusLabelMap[caseStatus] ?? "미진행";

  const handleStartCase = async () => {
    if (!user?.memberId) {
      navigate("/login");
      return;
    }

    try {
      await upsertCase(detail, user.memberId);
      setCaseStatus("in-progress");
      navigate("/my-complaints");
    } catch (error) {
      console.error("나의 민원을 저장하지 못했습니다.", error);
      alert("나의 민원을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.lead}>필수 서류 체크리스트</p>
          <h1>{detail.title}</h1>
          <p className={styles.summary}>{detail.summary}</p>
        </div>
        <div className={styles.docStats}>
          총 <strong>{docs.length}</strong>건
        </div>
      </header>

      {serviceId === "first-home-loan" && (
        <section className={styles.section}>
          <h2>진행 단계 요약</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">순서</th>
                <th scope="col">단계</th>
                <th scope="col">설명</th>
              </tr>
            </thead>
            <tbody>
              {FIRST_HOME_LOAN_STEPS.map((step) => (
                <tr key={step.order}>
                  <td>{step.order}</td>
                  <td>{step.title}</td>
                  <td>{step.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 표 기반 체크리스트 */}
      <section className={styles.section}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">서류명</th>
              <th scope="col">발급기관</th>
              <th scope="col">발급 방법</th>
              <th scope="col">준비 메모</th>
              <th scope="col">첨부</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td className={styles.nameCell}>
                  <span>{doc.name}</span>
                  {doc.validityPeriod && (
                    <span className={styles.docHint}>
                      유효기간 {doc.validityPeriod}
                    </span>
                  )}
                </td>
                <td className={styles.metaCell}>
                  <p className={styles.docIssuer}>{doc.issuingAuthority}</p>
                  {doc.fee && (
                    <span className={styles.docHint}>수수료 {doc.fee}</span>
                  )}
                </td>
                <td>
                  <div className={styles.formatChips}>
                    {doc.availableFormats.map((format) => (
                      <span key={format} className={styles.formatChip}>
                        {docFormats[format] ?? format}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{doc.preparationNotes ?? "-"}</td>
                <td className={styles.docLinkHint}>
                  {doc.downloadLabel ?? "서류 안내 버튼에서 확인"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <div className={styles.actionCard}>
          <div>
            <h2>신청 진행 상태</h2>
            <p className={styles.actionDescription}>
              진행하기를 누르면 나의 민원으로 이동하여 체크리스트를 활용하실 수
              있습니다.{" "}
            </p>
            <span className={styles.statusBadge}>현재 상태: {statusLabel}</span>
          </div>
          {/* 진행하기 버튼: 체크리스트 뷰에서도 언제든 노출합니다. */}
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleStartCase}
          >
            진행하기
          </button>
        </div>
        <RequiredLinksPanel links={requiredLinks} />
      </section>

      <NearbyOfficesMap
        mapContainerId={mapContainerId}
        filters={SERVICE_MAP_FILTERS[detail.id] ?? DEFAULT_NEARBY_FILTER}
      />
    </div>
  );
};

type CivilChecklistViewProps = {
  petition: CivilPetition;
};

const CivilChecklistView = ({ petition }: CivilChecklistViewProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mapContainerId = `civil-map-${petition.infoId}`;
  const [caseStatus, setCaseStatus] = useState<CaseTrackerStatus>(() => {
    const entry = getCaseByServiceId(petition.infoId);
    return entry?.status ?? "idle";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncCaseStatus = () => {
      const entry = getCaseByServiceId(petition.infoId);
      setCaseStatus(entry?.status ?? "idle");
    };

    syncCaseStatus();
    window.addEventListener(
      CASES_UPDATED_EVENT,
      syncCaseStatus as EventListener
    );

    return () => {
      window.removeEventListener(
        CASES_UPDATED_EVENT,
        syncCaseStatus as EventListener
      );
    };
  }, [petition.infoId]);
  const sequence = useMemo<SequenceRow[]>(
    () => resolveSequenceRows(petition),
    [petition]
  );
  const requiredLinks = useMemo(
    () => collectRequiredLinks(sequence, []),
    [sequence]
  );

  const handleStartCase = async () => {
    if (!user?.memberId) {
      navigate("/login");
      return;
    }

    try {
      await upsertCivilCase(petition, user.memberId);
      setCaseStatus("in-progress");
      navigate("/my-complaints");
    } catch (error) {
      console.error("나의 민원 저장 실패", error);
      alert("나의 민원 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const statusLabelMap: Record<CaseTrackerStatus, string> = {
    idle: "미진행",
    "in-progress": "진행 중",
    completed: "완료",
  };
  const statusLabel = statusLabelMap[caseStatus] ?? "미진행";

  const getSequenceTypeClass = (type: string) => {
    switch (type) {
      case "사전 준비":
      case "신청 준비":
        return styles.sequenceTypePrep;
      case "온라인 신청":
        return styles.sequenceTypeOnline;
      case "심사 진행":
      case "조사 및 심사":
        return styles.sequenceTypeReview;
      case "은행 방문":
      case "방문 신청":
      case "신청 및 접수":
        return styles.sequenceTypeOffline;
      case "대출 실행":
      case "선정 및 지급":
        return styles.sequenceTypeExecute;
      case "사후 관리":
        return styles.sequenceTypeFollow;
      default:
        return "";
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.lead}>필수 안내 절차</p>
          <h1>{petition.cpName}</h1>
          <p className={styles.summary}>{petition.simple}</p>
        </div>
      </header>

      <section className={styles.section}>
        <h2>처리 순서</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">진행</th>
              <th scope="col">안내</th>
            </tr>
          </thead>
          <tbody>
            {sequence.length === 0 && (
              <tr>
                <td colSpan={2}>표시할 단계가 없습니다.</td>
              </tr>
            )}
            {sequence.map((row) => {
              const typeBadgeClass = getSequenceTypeClass(row.type);
              const typeClassNames = [styles.sequenceType, typeBadgeClass]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={row.id} className={styles.sequenceRow}>
                  <td className={styles.sequenceTypeCell}>
                    <span className={styles.sequenceStepBadge}>
                      {row.order}
                    </span>
                    <div className={styles.sequenceTypeWrapper}>
                      <span className={typeClassNames}>{row.type}</span>
                      <span className={styles.sequenceStepLabel}>
                        STEP {row.order}
                      </span>
                    </div>
                  </td>
                  <td className={styles.sequenceContentCell}>
                    {row.title && (
                      <p className={styles.sequenceContentTitle}>{row.title}</p>
                    )}
                    <p className={styles.sequenceGuide}>{row.content}</p>
                    {row.checklist && row.checklist.length > 0 && (
                      <ul className={styles.sequenceList}>
                        {row.checklist.map((item, index) => (
                          <li key={`${row.id}-list-${index}`}>{item}</li>
                        ))}
                      </ul>
                    )}
                    {row.note && (
                      <p className={styles.sequenceFootnote}>{row.note}</p>
                    )}
                    {(() => {
                      const linkTargets =
                        row.links && row.links.length > 0
                          ? row.links
                          : row.linkUrl
                          ? [{ label: "안내 바로가기", url: row.linkUrl }]
                          : [];
                      if (linkTargets.length === 0) return null;
                      return (
                        <div className={styles.sequenceLinkGroup}>
                          {linkTargets.map((target) => (
                            <a
                              key={`${row.id}-${target.url}`}
                              href={target.url}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.sequenceLinkButton}
                            >
                              {target.label}
                            </a>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <div className={styles.actionCard}>
          <div>
            <h2>나의 민원에서 진행 이어가기</h2>
            <p className={styles.actionDescription}>
              준비가 끝났다면 나의 민원 페이지에서 진행 상황을 정리해 보세요.
            </p>
            <span className={styles.statusBadge}>현재 상태: {statusLabel}</span>
          </div>
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleStartCase}
          >
            나의 민원으로 이동
          </button>
        </div>
        <RequiredLinksPanel links={requiredLinks} />
      </section>

      <NearbyOfficesMap
        mapContainerId={mapContainerId}
        showHeading={false}
        filters={SERVICE_MAP_FILTERS[petition.infoId] ?? DEFAULT_NEARBY_FILTER}
      />
    </div>
  );
};

const RequiredLinksPanel = ({ links }: { links: RequiredLinkEntry[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (links.length === 0) {
    return (
      <div className={styles.linkPanel}>
        <p className={styles.linkPanelEmpty}>
          외부 사이트 안내가 필요한 단계가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.linkPanel}>
      <button
        type="button"
        className={styles.linkPanelToggle}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        서류 안내 바로가기
        <span className={styles.linkPanelHint}>
          {isOpen ? "닫기" : `${links.length}곳`}
        </span>
      </button>
      {isOpen && (
        <ul className={styles.linkPanelList}>
          {links.map((entry) => (
            <li key={entry.url} className={styles.linkPanelItem}>
              <div>
                <p className={styles.linkPanelContext}>{entry.context}</p>
                <a href={entry.url} target="_blank" rel="noreferrer">
                  {entry.label}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

type NearbyOfficesMapProps = {
  mapContainerId: string;
  showHeading?: boolean;
  filters?: NearbyFilter;
};

function NearbyOfficesMap({
  mapContainerId,
  showHeading = true,
  filters,
}: NearbyOfficesMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const infoWindowRef = useRef<NaverInfoWindowInstance | null>(null);
  const [officeList, setOfficeList] = useState<OfficeWithDistance[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let markers: NaverMarkerInstance[] = [];
    let canceled = false;
    setGeoError(null);
    setIsRequestingLocation(true);

    loadNaverMap()
      .then(() => {
        if (canceled) return;
        const container = containerRef.current;
        if (!container || !window.naver) return;

        const naver = window.naver.maps;
        infoWindowRef.current =
          infoWindowRef.current ??
          new naver.InfoWindow({
            borderWidth: 0,
            backgroundColor: "transparent",
          });

        const buildInfoWindowContent = (
          office: OfficeWithDistance,
          order: number
        ) => {
          const phoneLine = office.phone ? `<p>전화: ${office.phone}</p>` : "";
          const openingLine = office.openingHours
            ? `<p>운영: ${office.openingHours}</p>`
            : "";
          const notesLine = office.notes ? `<p>${office.notes}</p>` : "";
          return `
            <div class="nearby-info-window">
              <strong>${office.name}</strong>
              <p>${office.address}</p>
              <p>순서: STEP ${order}</p>
              <p>거리: ${formatDistance(office.distanceKm)}</p>
              ${phoneLine}
              ${openingLine}
              ${notesLine}
            </div>
          `.trim();
        };

        const initializeMap = (
          centerLatLng: LatLngInstance,
          nearbyOffices: OfficeWithDistance[]
        ) => {
          const initializedMap = new naver.Map(container, {
            center: centerLatLng,
            zoom: 14,
          });

          new naver.Marker({
            map: initializedMap,
            position: centerLatLng,
            title: "현재 위치",
            icon: {
              content: `<div style="width:20px;height:20px;background-color:#007aff;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.5);"></div>`,
              anchor: new naver.Point(10, 10),
            },
          });

          const openInfoWindow = (
            office: OfficeWithDistance,
            marker: NaverMarkerInstance,
            order: number
          ) => {
            if (!infoWindowRef.current) return;
            infoWindowRef.current.setContent(
              buildInfoWindowContent(office, order)
            );
            infoWindowRef.current.open(initializedMap, marker);
          };
          const closeInfoWindow = () => infoWindowRef.current?.close();

          nearbyOffices.forEach((office, index) => {
            const order = index + 1;
            const pos = new naver.LatLng(office.latitude, office.longitude);
            const marker = new naver.Marker({
              map: initializedMap,
              position: pos,
              title: office.name,
              icon: {
                content: `
                  <div style="
                    width:34px;
                    height:34px;
                    border-radius:50%;
                    border:2px solid #fff;
                    background:#1d4ed8;
                    color:#fff;
                    font-weight:700;
                    font-size:0.9rem;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    box-shadow:0 6px 16px rgba(15,23,42,0.35);
                  ">
                    ${order}
                  </div>
                `,
                anchor: new naver.Point(10, 10),
              },
            });
            markers.push(marker);

            naver.Event.addListener(marker, "mouseover", () =>
              openInfoWindow(office, marker, order)
            );
            naver.Event.addListener(marker, "mouseout", closeInfoWindow);
            naver.Event.addListener(marker, "click", () =>
              openInfoWindow(office, marker, order)
            );
          });
        };

        const fetchNearbyData = (userLocation: LatLngInstance) => {
          const lat = userLocation.lat();
          const lng = userLocation.lng();
          const radius = 5;

          getJson<OfficeInfo[]>(
            `/offices/nearby?lat=${lat}&lng=${lng}&radiusKm=${radius}`
          )
            .then((data) => {
              const withDistance = data
                .map<OfficeWithDistance>((office) => ({
                  ...office,
                  distanceKm: haversineDistanceKm(
                    lat,
                    lng,
                    office.latitude,
                    office.longitude
                  ),
                }))
                .sort((a, b) => a.distanceKm - b.distanceKm);
              const withinRadius = withDistance.filter(
                (office) => office.distanceKm <= radius
              );
              const filtered = applyNearbyFilters(withinRadius, filters);
              const finalList = (
                filtered.length > 0 ? filtered : withinRadius
              ).slice(0, 5);
              setOfficeList(finalList);
              initializeMap(userLocation, finalList);
            })
            .catch((err) => {
              console.error("가까운 관공서 로드 실패:", err);
              setOfficeList([]);
              initializeMap(userLocation, []);
            });
        };

        const handleGeoSuccess = (pos: GeolocationPosition) => {
          setIsRequestingLocation(false);
          const userLoc = new naver.LatLng(
            pos.coords.latitude,
            pos.coords.longitude
          ) as LatLngInstance;
          fetchNearbyData(userLoc);
        };

        const handleGeoError = (err: GeolocationPositionError) => {
          console.warn("위치정보 접근 거부:", err);
          setIsRequestingLocation(false);
          setGeoError(
            "현재 위치 정보를 가져오지 못했습니다. 브라우저 권한을 허용하거나 HTTPS(https://localhost)로 접속해 주세요."
          );
          const defaultLoc = new naver.LatLng(
            35.1595454,
            126.8526012
          ) as LatLngInstance;
          setOfficeList([]);
          initializeMap(defaultLoc, []);
        };

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            handleGeoSuccess,
            handleGeoError,
            {
              enableHighAccuracy: true,
              timeout: 8000,
              maximumAge: 0,
            }
          );
        } else {
          setIsRequestingLocation(false);
          setGeoError("이 브라우저에서는 위치 정보를 사용할 수 없습니다.");
          const defaultLoc = new naver.LatLng(
            35.1595454,
            126.8526012
          ) as LatLngInstance;
          setOfficeList([]);
          initializeMap(defaultLoc, []);
        }
      })
      .catch((error) => console.error("네이버 지도 로드 실패", error));

    return () => {
      canceled = true;
      markers.forEach((marker) => marker.setMap(null));
      markers = [];
      infoWindowRef.current?.close();
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [filters, mapContainerId, refreshCounter]);

  return (
    <section className={styles.section}>
      {showHeading && (
        <div className={styles.sectionHeading}>
          <h2>상담 및 방문 안내</h2>
        </div>
      )}
      <div className={styles.supportGrid}>
        <div className={styles.mapRow}>
          <div className={styles.mapPanel}>
            <h3>가까운 관공서</h3>
            <div className={styles.mapActions}>
              {geoError && <p className={styles.mapError}>{geoError}</p>}
              <button
                type="button"
                className={styles.mapRefreshButton}
                onClick={() => setRefreshCounter((count) => count + 1)}
                disabled={isRequestingLocation}
              >
                {isRequestingLocation ? "위치 확인 중…" : "위치 다시 찾기"}
              </button>
            </div>
            <div
              id={mapContainerId}
              ref={containerRef}
              className={styles.mapFrame}
              aria-label="관공서 위치 지도 영역"
            />
          </div>
          <div className={styles.nearbyListPanel}>
            <h3>STEP 순서 목록</h3>
            {officeList.length === 0 ? (
              <p className={styles.mapHelper}>
                표시할 지점을 불러올 수 없습니다.
              </p>
            ) : (
              <ol className={styles.nearbyList}>
                {officeList.map((office, index) => (
                  <li
                    key={`${office.id}-${index}`}
                    className={styles.nearbyListItem}
                  >
                    <span className={styles.nearbyListStep}>{index + 1}</span>
                    <div className={styles.nearbyListBody}>
                      <p className={styles.nearbyListName}>{office.name}</p>
                      <p className={styles.nearbyListMeta}>{office.address}</p>
                      <p className={styles.nearbyListMeta}>
                        거리 {formatDistance(office.distanceKm)}
                      </p>
                      {office.phone && (
                        <p className={styles.nearbyListMeta}>
                          전화 {office.phone}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const applyNearbyFilters = (
  offices: OfficeWithDistance[],
  filters?: NearbyFilter
) => {
  if (!filters) return offices;
  let filtered = offices;
  if (filters.categories?.length) {
    filtered = filtered.filter((office) => {
      if (!office.category) return true;
      return filters.categories!.includes(office.category);
    });
  }
  if (filters.keywordIncludes?.length) {
    filtered = filtered.filter((office) => {
      const target = `${office.name ?? ""} ${office.address ?? ""}`;
      return filters.keywordIncludes!.some((keyword) =>
        target.includes(keyword)
      );
    });
  }
  return filtered;
};

export default DocumentChecklistPage;
