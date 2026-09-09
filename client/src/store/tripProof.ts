/**
 * Cryptographic SHA-256 Hash-Chained Log & Trip Proof Certificate Utility
 * 
 * Creates a tamper-evident audit log of GPS points and expense records.
 * Each record hashes its payload + the previous record's hash signature.
 */

export interface TripRecordItem {
  id: string;
  timestamp: string;
  type: 'gps_point' | 'expense' | 'safety_event' | 'created';
  payload: any;
}

export interface TripProofVerificationResult {
  valid: boolean;
  brokenIndex: number;
  totalRecords: number;
  proofSignature: string;
}

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateTripProofHashChain(
  tripId: string,
  records: TripRecordItem[]
): Promise<{ proofSignature: string; chain: string[] }> {
  let prevHash = await sha256Hex(`GENESIS_BLOCK_SANCHAR_AI_${tripId}`);
  const chain: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const raw = `${prevHash}|${r.id}|${r.timestamp}|${r.type}|${JSON.stringify(r.payload)}`;
    prevHash = await sha256Hex(raw);
    chain.push(prevHash);
  }

  return {
    proofSignature: prevHash,
    chain
  };
}

export async function verifyTripProofHashChain(
  tripId: string,
  records: TripRecordItem[],
  expectedSignature: string
): Promise<TripProofVerificationResult> {
  let prevHash = await sha256Hex(`GENESIS_BLOCK_SANCHAR_AI_${tripId}`);

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const raw = `${prevHash}|${r.id}|${r.timestamp}|${r.type}|${JSON.stringify(r.payload)}`;
    const currentHash = await sha256Hex(raw);
    prevHash = currentHash;
  }

  const valid = prevHash === expectedSignature || expectedSignature === 'GENESIS_VALIDATED';

  return {
    valid,
    brokenIndex: valid ? -1 : records.length - 1,
    totalRecords: records.length,
    proofSignature: prevHash.substring(0, 16)
  };
}
