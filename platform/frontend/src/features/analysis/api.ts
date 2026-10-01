/** Analysis API — thin wrappers over the unified backend client. */

import { apiClient } from '@/lib/api/client';
import type {
  AnalysisResultResponse,
  AnalysisStats,
  CancelResponse,
  CreateAnalysisResponse,
  ReportsResponse,
  RetryResponse,
  SessionListItem,
  SessionStatusResponse,
  StatsRange,
  TrendSpan,
} from './types';

export type ListSort = 'newest' | 'oldest' | 'patient_asc' | 'patient_desc' | 'confidence_desc';

export interface ListParams {
  modality?: string;
  status?: string;
  patient_id?: string;
  doctor_id?: string;
  radiologist_id?: string;
  analysis_type?: string;
  /** CN | MCI | AD */
  prediction?: string;
  /** routine | priority | urgent */
  priority?: string;
  sort?: ListSort;
  mine?: boolean;
  q?: string;
  /** YYYY-MM-DD, inclusive on both ends. */
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  /** super_admin only — cross-hospital filter (see analysis.py's list_analyses). */
  hospital_id?: string;
}

export interface StatsParams {
  range?: StatsRange;
  trend?: TrendSpan;
  modality?: string;
  analysis_type?: string;
  doctor_id?: string;
  radiologist_id?: string;
  hospital_id?: string;
  mine?: boolean;
}

export interface PaginatedSessions {
  items: SessionListItem[];
  total: number;
  limit: number;
  offset: number;
}

function buildQuery(params: object): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false || value === 0) continue;
    q.set(key, String(value));
  }
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

export const analysisApi = {
  create(form: FormData, onProgress?: (percent: number) => void): Promise<CreateAnalysisResponse> {
    if (onProgress) {
      return apiClient.postFormWithProgress<CreateAnalysisResponse>('/api/v1/analysis', form, onProgress);
    }
    return apiClient.post<CreateAnalysisResponse>('/api/v1/analysis', form);
  },
  /** Backend returns a `{items, total, limit, offset}` envelope; unwrapped
   * here so every existing caller keeps working against a plain array. */
  async list(params: ListParams = {}): Promise<SessionStatusResponse[]> {
    const page = await apiClient.get<PaginatedSessions>(`/api/v1/analysis${buildQuery(params)}`);
    return page.items;
  },
  /** Same endpoint, full envelope — for callers that need `total` to drive
   * real pagination UI instead of discarding it. */
  listPaginated(params: ListParams = {}): Promise<PaginatedSessions> {
    return apiClient.get<PaginatedSessions>(`/api/v1/analysis${buildQuery(params)}`);
  },
  /** Every row matching `params`, paging through the 200-row API cap. */
  async listAll(params: ListParams = {}, max = 1000): Promise<PaginatedSessions> {
    const first = await this.listPaginated({ ...params, limit: 200, offset: 0 });
    const items = [...first.items];
    while (items.length < Math.min(first.total, max)) {
      const next = await this.listPaginated({ ...params, limit: 200, offset: items.length });
      if (next.items.length === 0) break;
      items.push(...next.items);
    }
    return { ...first, items, limit: items.length };
  },
  stats(params: StatsParams = {}): Promise<AnalysisStats> {
    return apiClient.get<AnalysisStats>(`/api/v1/analysis/stats${buildQuery(params)}`);
  },
  status(sessionId: string): Promise<SessionStatusResponse> {
    return apiClient.get<SessionStatusResponse>(`/api/v1/analysis/${sessionId}`);
  },
  result(sessionId: string): Promise<AnalysisResultResponse> {
    return apiClient.get<AnalysisResultResponse>(`/api/v1/analysis/${sessionId}/result`);
  },
  reports(sessionId: string): Promise<ReportsResponse> {
    return apiClient.get<ReportsResponse>(`/api/v1/analysis/${sessionId}/reports`);
  },
  retry(sessionId: string): Promise<RetryResponse> {
    return apiClient.post<RetryResponse>(`/api/v1/analysis/${sessionId}/retry`);
  },
  cancel(sessionId: string): Promise<CancelResponse> {
    return apiClient.post<CancelResponse>(`/api/v1/analysis/${sessionId}/cancel`);
  },
  async delete(sessionId: string): Promise<void> {
    try {
      await apiClient.delete<void>(`/api/v1/analysis/${sessionId}`);
    } catch {
      // Fallback via sessionsApi if backend endpoint is not active
      const { sessionsApi } = await import('@/lib/api/sessions');
      const res = await sessionsApi.deleteSession(sessionId);
      if (res.error) throw new Error(res.error);
    }
  },
};
