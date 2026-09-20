/** Public receiving configuration controlled by the operator.
 * Before production opening, verify token versions and receive/send tests. Never store keys. */
export type SupportNetwork = {
  networkId: string;
  displayName: string;
  networkType: 'evm' | 'tron' | 'solana';
  currency: 'USDT';
  address: string;
  enabled: boolean;
  tokenNote: string;
};
// Addresses supplied and networks explicitly enabled by the operator for local review.
// Token versions and receive/send checks remain unverified; no deployment is implied.
const evmReceivingAddress = '0xD961BFF29F9b922d239a49b208fB32ccE18B180e';
export const supportNetworks: readonly SupportNetwork[] = [
  { networkId: 'ethereum', displayName: 'Ethereum（ERC20）', networkType: 'evm', currency: 'USDT', address: evmReceivingAddress, enabled: true, tokenNote: 'USDT 代幣合約版本及小額收轉款尚未驗證；實際轉帳前請先確認。' },
  { networkId: 'base', displayName: 'Base', networkType: 'evm', currency: 'USDT', address: evmReceivingAddress, enabled: true, tokenNote: 'USDT 代幣合約版本及小額收轉款尚未驗證；實際轉帳前請先確認。' },
  { networkId: 'bsc', displayName: 'BNB Smart Chain（BSC／BEP20）', networkType: 'evm', currency: 'USDT', address: evmReceivingAddress, enabled: true, tokenNote: 'USDT 代幣合約版本及小額收轉款尚未驗證；實際轉帳前請先確認。' },
  { networkId: 'arbitrum', displayName: 'Arbitrum One', networkType: 'evm', currency: 'USDT', address: evmReceivingAddress, enabled: true, tokenNote: 'USDT 代幣合約版本及小額收轉款尚未驗證；實際轉帳前請先確認。' },
  { networkId: 'optimism', displayName: 'OP Mainnet（Optimism）', networkType: 'evm', currency: 'USDT', address: evmReceivingAddress, enabled: true, tokenNote: 'USDT 代幣合約版本及小額收轉款尚未驗證；實際轉帳前請先確認。' },
  { networkId: 'polygon', displayName: 'Polygon PoS', networkType: 'evm', currency: 'USDT', address: evmReceivingAddress, enabled: true, tokenNote: 'USDT 代幣合約版本及小額收轉款尚未驗證；實際轉帳前請先確認。' },
  { networkId: 'solana', displayName: 'Solana（SPL）', networkType: 'solana', currency: 'USDT', address: '6oewELZKsNbhmPkkdJXrp1q2x85CUiU3jLkWj3MNJsb1', enabled: true, tokenNote: 'USDT 代幣合約版本及小額收轉款尚未驗證；實際轉帳前請先確認。' },
  { networkId: 'tron', displayName: 'TRON（TRC20）', networkType: 'tron', currency: 'USDT', address: 'TC7RBKrSynGmrzid9hpthHhegNjkh7yA44', enabled: true, tokenNote: 'USDT 代幣合約版本及小額收轉款尚未驗證；實際轉帳前請先確認。' },
];
const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
/** Format only: Solana account keys are 32 bytes, transaction signatures 64.
 * Preserve case; neither validity on curve nor on-chain existence is required. */
export function supportBase58Size(value: string): number | null {
  if (!/^[1-9A-HJ-NP-Za-km-z]{1,88}$/.test(value)) return null;
  let number = 0n;
  for (const character of value) number = number * 58n + BigInt(base58Alphabet.indexOf(character));
  let size = 0;
  while (number > 0n) { size++; number /= 256n; }
  return size + (value.match(/^1*/)?.[0].length ?? 0);
}
export function validSupportAddress(type: SupportNetwork['networkType'], value: string): boolean {
  if (type === 'evm') return /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value);
  if (type === 'tron') return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value);
  return type === 'solana' && supportBase58Size(value) === 32;
}
export function availableSupportNetworks(networks: readonly SupportNetwork[] = supportNetworks): SupportNetwork[] {
  return networks.filter(n => n.enabled && n.currency === 'USDT' && n.networkId.trim() && n.tokenNote.trim() && validSupportAddress(n.networkType, n.address));
}
export type SupportInput = { requestId: string; networkId: string; receivingAddress: string; reference: string; nickname?: string; message?: string };
export type SupportValidationError = 'network' | 'reference' | 'recipient' | 'nickname' | 'message' | 'request';
export function validateSupportInput(input: Record<string, unknown>, networks: readonly SupportNetwork[] = supportNetworks): SupportValidationError | null {
  if (Object.keys(input).some(k => !['requestId', 'networkId', 'receivingAddress', 'reference', 'nickname', 'message'].includes(k))
    || typeof input.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) return 'request';
  const network = availableSupportNetworks(networks).find(n => n.networkId === input.networkId);
  if (!network || input.receivingAddress !== network.address) return 'network';
  if (typeof input.reference !== 'string') return 'reference';
  const reference = input.reference.trim();
  if (!reference || reference.length > 256) return 'reference';
  if (networks.some(n => n.networkType === network.networkType && validSupportAddress(n.networkType, n.address)
    && (n.networkType === 'evm' ? reference.toLowerCase() === n.address.toLowerCase() : reference === n.address))) return 'recipient';
  const tx = network.networkType === 'evm' ? /^0x[0-9a-fA-F]{64}$/.test(reference)
    : network.networkType === 'solana' ? supportBase58Size(reference) === 64
      : /^[0-9a-fA-F]{64}$/.test(reference);
  if (!tx && !validSupportAddress(network.networkType, reference)) return 'reference';
  for (const [field, max] of [['nickname', 50], ['message', 2000]] as const) {
    if (input[field] !== undefined && (typeof input[field] !== 'string' || [...(input[field] as string).trim()].length > max)) return field;
  }
  return null;
}
