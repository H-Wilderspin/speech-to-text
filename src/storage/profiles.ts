export const CONSENT_VERSION = 'local-voiceprint-v1';

export type SpeakerProfile = {
  schemaVersion: 1;
  id: string;
  displayName: string;
  createdAt: string;
  consentVersion: typeof CONSENT_VERSION;
  consentedAt: string;
  modelVersion: string;
  sampleDurationMs: number;
  embedding: number[];
};

export type ProfileSummary = Omit<SpeakerProfile, 'embedding'>;
export interface ProfileStore {
  list(): Promise<ProfileSummary[]>;
  /** Caller must erase the returned temporary embedding after use. */
  read(id: string, signal: AbortSignal): Promise<SpeakerProfile | undefined>;
  save(profile: SpeakerProfile, signal: AbortSignal): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  close(): void;
}

export function normalizeEmbedding(values: ArrayLike<number>): number[] {
  const vector = Array.from(values);
  if (vector.length < 1 || vector.length > 4096 || !vector.every(Number.isFinite)) {
    throw new Error('The voice model returned an invalid voiceprint.');
  }
  const norm = Math.hypot(...vector);
  if (!Number.isFinite(norm) || norm < 1e-12) throw new Error('The voiceprint was empty. Try recording again.');
  return vector.map((value) => value / norm);
}

/** Reconstruct only allowed fields; raw audio and arbitrary extras cannot be saved. */
export function validateProfile(value: SpeakerProfile): SpeakerProfile {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1 || typeof value.id !== 'string' || !value.id || value.id.length > 100
    || typeof value.displayName !== 'string' || !value.displayName.trim() || value.displayName.trim().length > 60
    || value.consentVersion !== CONSENT_VERSION || typeof value.consentedAt !== 'string' || !Number.isFinite(Date.parse(value.consentedAt))
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.modelVersion !== 'string'
    || !value.modelVersion || value.modelVersion.length > 200
    || !Number.isFinite(value.sampleDurationMs) || value.sampleDurationMs < 3000 || value.sampleDurationMs > 30000
    || !Array.isArray(value.embedding)) throw new Error('The speaker profile is invalid or incompatible.');
  return {
    schemaVersion: 1, id: value.id, displayName: value.displayName.trim(), createdAt: value.createdAt,
    consentVersion: CONSENT_VERSION, consentedAt: value.consentedAt, modelVersion: value.modelVersion,
    sampleDurationMs: value.sampleDurationMs, embedding: normalizeEmbedding(value.embedding),
  };
}

export function profileSummary(profile: SpeakerProfile): ProfileSummary {
  const { embedding, ...summary } = validateProfile(profile);
  embedding.fill(0);
  return summary;
}
