// ── Secret Detector ───────────────────────────────────────────────────────────
//
// Scans memory entry content for credential-like patterns before storage.
// Any match causes the entry to be blocked from persistence.

export interface SecretMatch {
  patternName: string;
  /** Approximate location of match (start index). */
  index: number;
}

interface SecretPattern {
  name: string;
  pattern: RegExp;
}

const PATTERNS: SecretPattern[] = [
  // BIP-39 mnemonic (12 or 24 words)
  { name: "bip39_mnemonic", pattern: /\b(?:[a-z]+\s+){11,23}[a-z]+\b/ },
  // Substrate / Polkadot private key patterns
  { name: "substrate_suri", pattern: /\/\/(Alice|Bob|Charlie|Dave|Eve|Ferdie)\b/ },
  { name: "hex_private_key_64", pattern: /\b0x[0-9a-fA-F]{64}\b/ },
  // Generic high-entropy hex (potential private key, 32+ bytes)
  { name: "hex_secret_32plus", pattern: /\b[0-9a-fA-F]{64,}\b/ },
  // Bearer token
  { name: "bearer_token", pattern: /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/i },
  // GitHub PAT
  { name: "github_pat", pattern: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: "github_oauth", pattern: /\bgho_[A-Za-z0-9]{36}\b/ },
  // OpenAI key
  { name: "openai_key", pattern: /\bsk-[A-Za-z0-9]{32,}\b/ },
  // Anthropic key
  { name: "anthropic_key", pattern: /\bsk-ant-[A-Za-z0-9\-_]{32,}\b/ },
  // AWS key
  { name: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  // SSH private key header
  { name: "ssh_private_key", pattern: /-----BEGIN (RSA|EC|OPENSSH|DSA|ECDSA) PRIVATE KEY-----/ },
  // VIBLY_HOME session.key path reference (path leak, not content leak)
  { name: "session_key_path", pattern: /session\.key\b/ },
  // JWT
  { name: "jwt_token", pattern: /ey[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/ },
];

/**
 * Scan text for secret-like patterns.
 *
 * @returns Array of matches (empty = clean).
 */
export function detectSecrets(text: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  for (const { name, pattern } of PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = globalPattern.exec(text)) !== null) {
      matches.push({ patternName: name, index: m.index });
    }
  }
  return matches;
}

/**
 * Return true if the text contains any detected secrets.
 */
export function hasSecrets(text: string): boolean {
  return detectSecrets(text).length > 0;
}
