import React from 'react';
import { createRoot } from 'react-dom/client';
import { CryptoSupportPanel } from '../../../src/components/CryptoSupportPanel';
import { LanguageProvider } from '../../../src/i18n';
import '../../../src/index.css';

const bsc = {
  networkId: 'bsc', displayName: 'BNB Smart Chain（BSC／BEP20）', networkType: 'evm', currency: 'USDT',
  address: '0x1234567890abcdef1234567890ABCDEF12345678', enabled: true, tokenNote: 'BEP20 test fixture',
};
const tron = {
  networkId: 'tron', displayName: 'TRON（TRC20）', networkType: 'tron', currency: 'USDT',
  address: 'TQ9e5fR5D5V3HhQGQxA8t2L9WZQJdo5y1A', enabled: true, tokenNote: 'TRC20 test fixture',
};
const count = new URLSearchParams(location.search).get('networks');
const networks = count === '0' ? [] : count === '1' ? [bsc] : [bsc, tron];

createRoot(document.getElementById('root')).render(<LanguageProvider><CryptoSupportPanel networks={networks} /></LanguageProvider>);
