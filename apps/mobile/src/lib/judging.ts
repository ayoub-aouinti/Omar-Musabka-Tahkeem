import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import type {
  CandidateListItem,
  OpenSessionResponse,
  SubmitBody,
  SubmitResponse,
} from "../types";

export const candidatesKey = (competitionId: string | undefined) =>
  ["candidates", competitionId ?? "bound"] as const;

export const sessionKey = (candidateId: string) =>
  ["session", candidateId] as const;

/**
 * The judge's assigned candidates. A QR token is already bound to a competition,
 * so `competitionId` is only sent when the judge logged in with a password.
 */
export function useCandidates(): UseQueryResult<CandidateListItem[]> {
  const { user } = useAuth();
  const boundCompetition = user?.competitionId;
  return useQuery({
    queryKey: candidatesKey(boundCompetition),
    enabled: Boolean(user?.judgeId),
    queryFn: async () => {
      const params = boundCompetition
        ? undefined
        : { competitionId: user?.competitionId };
      const { data } = await api.get<CandidateListItem[]>(
        "/judging/my-candidates",
        { params },
      );
      return data;
    },
  });
}

export function useOpenSession(
  candidateId: string,
): UseQueryResult<OpenSessionResponse> {
  return useQuery({
    queryKey: sessionKey(candidateId),
    enabled: Boolean(candidateId),
    staleTime: 0,
    queryFn: async () => {
      const { data } = await api.post<OpenSessionResponse>(
        `/judging/sessions/${candidateId}/open`,
      );
      return data;
    },
  });
}

export function useSubmitSession(candidateId: string) {
  const qc = useQueryClient();
  return useMutation<SubmitResponse, unknown, SubmitBody>({
    mutationFn: async (body) => {
      const { data } = await api.post<SubmitResponse>(
        "/judging/submit",
        body,
      );
      return data;
    },
    onSuccess: () => {
      // Both the session and the candidate list carry the new status/score.
      void qc.invalidateQueries({ queryKey: sessionKey(candidateId) });
      void qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}

/** The competition the judge's card is bound to — for a name, not an id. */
export function useCompetition(competitionId: string | undefined) {
  return useQuery({
    queryKey: ["competition", competitionId],
    enabled: Boolean(competitionId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await api.get<{ id: string; name: string }>(
        `/competitions/${competitionId}`,
      );
      return data;
    },
  });
}
