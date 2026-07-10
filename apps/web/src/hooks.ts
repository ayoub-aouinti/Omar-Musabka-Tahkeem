import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { api } from "./lib/api";
import type {
  AccessGrant,
  AccessSessionWithJudge,
  CandidateCreate,
  CandidateDetail,
  CandidateList,
  CandidateQuestion,
  CandidateUpdate,
  CategoryGenerateResult,
  CategoryUpsert,
  CompetitionCreate,
  CompetitionDetail,
  CompetitionSummary,
  Judge,
  JudgeCreate,
  JudgeStats,
  JudgeUpdate,
  QuranScopeResult,
  ResultRow,
  ScoringConfig,
  ScoringUpdate,
  Surah,
} from "./types";

/** Central query-key factory so invalidation stays consistent. */
export const qk = {
  competitions: ["competitions"] as const,
  competition: (id: string) => ["competitions", id] as const,
  scoring: (id: string) => ["competitions", id, "scoring"] as const,
  categories: (id: string) => ["competitions", id, "categories"] as const,
  candidates: (params: Record<string, unknown>) =>
    ["candidates", params] as const,
  candidate: (id: string) => ["candidates", id] as const,
  surahs: ["quran", "surahs"] as const,
  scope: (raw: string) => ["quran", "scope", raw] as const,
  judges: (search: string) => ["judges", search] as const,
  judgeStats: (competitionId: string) => ["judges", "stats", competitionId] as const,
  judgeAccess: (competitionId: string) =>
    ["judges", "access", competitionId] as const,
  candidateQuestions: (candidateId: string) =>
    ["questions", "candidate", candidateId] as const,
  results: (competitionId: string, categoryId: string) =>
    ["results", competitionId, categoryId] as const,
};

/* -------------------------------------------------------------------------- */
/*                                Competitions                                */
/* -------------------------------------------------------------------------- */

export function useCompetitions() {
  return useQuery({
    queryKey: qk.competitions,
    queryFn: async () => {
      const res = await api.get<CompetitionSummary[]>("/competitions");
      return res.data;
    },
  });
}

export function useCompetition(id: string | undefined) {
  return useQuery({
    queryKey: qk.competition(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<CompetitionDetail>(`/competitions/${id}`);
      return res.data;
    },
  });
}

export function useCreateCompetition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CompetitionCreate) => {
      const res = await api.post<CompetitionSummary>("/competitions", payload);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.competitions });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                  Scoring                                    */
/* -------------------------------------------------------------------------- */

export function useScoring(competitionId: string | undefined) {
  return useQuery({
    queryKey: qk.scoring(competitionId ?? ""),
    enabled: Boolean(competitionId),
    queryFn: async () => {
      const res = await api.get<ScoringConfig>(
        `/competitions/${competitionId}/scoring`,
      );
      return res.data;
    },
  });
}

export function useUpdateScoring(competitionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ScoringUpdate) => {
      const res = await api.put<ScoringConfig>(
        `/competitions/${competitionId}/scoring`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.scoring(competitionId) });
      void qc.invalidateQueries({ queryKey: qk.competition(competitionId) });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                 Categories                                  */
/* -------------------------------------------------------------------------- */

export function useUpsertCategory(competitionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CategoryUpsert) => {
      const res = await api.put(
        `/competitions/${competitionId}/categories`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.competition(competitionId) });
      void qc.invalidateQueries({ queryKey: qk.categories(competitionId) });
    },
  });
}

export function useGenerateCategoryQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      categoryId,
      regenerate,
    }: {
      categoryId: string;
      regenerate: boolean;
    }) => {
      const res = await api.post<CategoryGenerateResult>(
        `/questions/category/${categoryId}/generate`,
        { regenerate },
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                 Candidates                                  */
/* -------------------------------------------------------------------------- */

export interface CandidateFilters {
  competitionId?: string;
  categoryId?: string;
  gender?: string;
  search?: string;
  take: number;
  skip: number;
}

export function useCandidates(filters: CandidateFilters, enabled = true) {
  return useQuery({
    queryKey: qk.candidates(filters as Record<string, unknown>),
    enabled,
    queryFn: async () => {
      const params: Record<string, string | number> = {
        take: filters.take,
        skip: filters.skip,
      };
      if (filters.competitionId) params.competitionId = filters.competitionId;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.gender) params.gender = filters.gender;
      if (filters.search) params.search = filters.search;
      const res = await api.get<CandidateList>("/candidates", { params });
      return res.data;
    },
  });
}

export function useCandidate(id: string | undefined) {
  return useQuery({
    queryKey: qk.candidate(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await api.get<CandidateDetail>(`/candidates/${id}`);
      return res.data;
    },
  });
}

export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CandidateCreate) => {
      const res = await api.post<CandidateDetail>("/candidates", payload);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}

export function useUpdateCandidate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CandidateUpdate) => {
      const res = await api.patch<CandidateDetail>(`/candidates/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["candidates"] });
      void qc.invalidateQueries({ queryKey: qk.candidate(id) });
    },
  });
}

export function useDeleteCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/candidates/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}

export function useGenerateCandidateQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      candidateId,
      regenerate,
    }: {
      candidateId: string;
      regenerate: boolean;
    }) => {
      const res = await api.post<CandidateQuestion[]>(
        `/questions/candidate/${candidateId}/generate`,
        { regenerate },
      );
      return res.data;
    },
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: qk.candidate(variables.candidateId),
      });
      void qc.invalidateQueries({
        queryKey: qk.candidateQuestions(variables.candidateId),
      });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                   Quran                                     */
/* -------------------------------------------------------------------------- */

export function useSurahs() {
  return useQuery({
    queryKey: qk.surahs,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await api.get<Surah[]>("/quran/surahs");
      return res.data;
    },
  });
}

/** Live scope resolution — pass an already-debounced raw string. */
export function useScopePreview(
  raw: string,
  options?: Partial<UseQueryOptions<QuranScopeResult>>,
) {
  return useQuery({
    queryKey: qk.scope(raw),
    enabled: raw.trim().length > 0,
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await api.get<QuranScopeResult>("/quran/scope", {
        params: { raw },
      });
      return res.data;
    },
    ...options,
  });
}

/* -------------------------------------------------------------------------- */
/*                                   Judges                                    */
/* -------------------------------------------------------------------------- */

export function useJudges(search: string) {
  return useQuery({
    queryKey: qk.judges(search),
    queryFn: async () => {
      const res = await api.get<Judge[]>("/judges", {
        params: search ? { search } : undefined,
      });
      return res.data;
    },
  });
}

export function useJudgeStats(competitionId: string | undefined) {
  return useQuery({
    queryKey: qk.judgeStats(competitionId ?? ""),
    enabled: Boolean(competitionId),
    queryFn: async () => {
      const res = await api.get<JudgeStats>("/judges/stats", {
        params: { competitionId },
      });
      return res.data;
    },
  });
}

export function useJudgeAccess(competitionId: string | undefined) {
  return useQuery({
    queryKey: qk.judgeAccess(competitionId ?? ""),
    enabled: Boolean(competitionId),
    queryFn: async () => {
      const res = await api.get<AccessSessionWithJudge[]>("/judges/access", {
        params: { competitionId },
      });
      return res.data;
    },
  });
}

export function useCreateJudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: JudgeCreate) => {
      const res = await api.post<Judge>("/judges", payload);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["judges"] });
    },
  });
}

export function useUpdateJudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: JudgeUpdate }) => {
      const res = await api.patch<Judge>(`/judges/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["judges"] });
    },
  });
}

export function useDeleteJudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/judges/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["judges"] });
    },
  });
}

export function useGrantAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      judgeId,
      competitionId,
      hours,
    }: {
      judgeId: string;
      competitionId: string;
      hours: number;
    }) => {
      const res = await api.post<AccessGrant>(`/judges/${judgeId}/access`, {
        competitionId,
        hours,
      });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["judges"] });
    },
  });
}

export function useRevokeAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accessId: string) => {
      await api.delete(`/judges/access/${accessId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["judges"] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                  Results                                    */
/* -------------------------------------------------------------------------- */

export function useResults(
  competitionId: string | undefined,
  categoryId: string,
) {
  return useQuery({
    queryKey: qk.results(competitionId ?? "", categoryId),
    enabled: Boolean(competitionId),
    queryFn: async () => {
      const params: Record<string, string> = { competitionId: competitionId! };
      if (categoryId) params.categoryId = categoryId;
      const res = await api.get<ResultRow[]>("/judging/results", { params });
      return res.data;
    },
  });
}
