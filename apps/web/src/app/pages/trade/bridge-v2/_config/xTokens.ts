import { SupportedChainId } from '@balancednetwork/balanced-js';

import { NETWORK_ID } from 'constants/config';

import { XChainId, XToken } from '../types';

export const SUPPORTED_XCALL_CHAINS_BY_ICON_NETWORK: { [key in SupportedChainId]: XChainId[] } = {
  [SupportedChainId.MAINNET]: ['archway-1', '0x1.icon'],
  [SupportedChainId.BERLIN]: ['archway-1', '0x1.icon'],
  [SupportedChainId.LISBON]: ['archway-1', '0x1.icon'],
  [SupportedChainId.SEJONG]: [],
  [SupportedChainId.YEOUIDO]: [],
};

const CROSS_TRANSFER_TOKENS_BY_ICON_NETWORK: { [key in SupportedChainId]: string[] } = {
  [SupportedChainId.MAINNET]: ['bnUSD'],
  [SupportedChainId.BERLIN]: ['bnUSD'],
  [SupportedChainId.LISBON]: ['bnUSD'],
  [SupportedChainId.SEJONG]: [],
  [SupportedChainId.YEOUIDO]: [],
};

const ASSET_MANAGER_TOKENS_BY_ICON_NETWORK: { [key in SupportedChainId]: string[] } = {
  [SupportedChainId.MAINNET]: ['sARCH', 'USDC', 'AVAX'],
  [SupportedChainId.BERLIN]: ['sARCH'],
  [SupportedChainId.LISBON]: ['sARCH'],
  [SupportedChainId.SEJONG]: [],
  [SupportedChainId.YEOUIDO]: [],
};

export const DEFAULT_TOKEN_CHAIN: { [key in string]: XChainId } = {
  bnUSD: '0x1.icon',
  sARCH: 'archway-1',
};

export const SUPPORTED_XCALL_CHAINS = SUPPORTED_XCALL_CHAINS_BY_ICON_NETWORK[NETWORK_ID];
export const CROSS_TRANSFER_TOKENS = CROSS_TRANSFER_TOKENS_BY_ICON_NETWORK[NETWORK_ID];
export const ASSET_MANAGER_TOKENS = ASSET_MANAGER_TOKENS_BY_ICON_NETWORK[NETWORK_ID];

import { bnUSD } from 'constants/tokens';

import { SupportedChainId as ChainId } from '@balancednetwork/balanced-js';
import { sARCH } from './tokens';
import { NATIVE_ADDRESS } from 'constants/index';

export const xTokenMap: { [key1 in XChainId]?: { [key2 in XChainId]?: XToken[] } } = {
  '0x1.icon': {
    'archway-1': [
      XToken.getXToken('0x1.icon', bnUSD[ChainId.MAINNET]),
      XToken.getXToken('0x1.icon', sARCH[ChainId.MAINNET]),
    ],
    '0xa86a.avax': [
      new XToken('0x1.icon', ChainId.MAINNET, 'cx66a031cc3bd305c76371fb586e93801b948254f0', 18, 'AVAX', 'AVAX'),
      new XToken(
        '0x1.icon',
        ChainId.MAINNET,
        'cxf0a30d09ade391d7b570908b9b46cfa5b3cbc8f8',
        18,
        'hyTB',
        'HiYield Treasury Bill',
      ),
      new XToken(
        '0x1.icon',
        ChainId.MAINNET,
        'cx22319ac7f412f53eabe3c9827acf5e27e9c6a95f',
        6,
        'IUSDC',
        'ICON USD Coin',
      ),
    ],
  },
  'archway-1': {
    '0x1.icon': [
      new XToken(
        'archway-1',
        'archway-1',
        'archway1l3m84nf7xagkdrcced2y0g367xphnea5uqc3mww3f83eh6h38nqqxnsxz7',
        18,
        'bnUSD',
        'Balanced Dollar',
      ),
      new XToken(
        'archway-1',
        'archway-1',
        'archway1t2llqsvwwunf98v692nqd5juudcmmlu3zk55utx7xtfvznel030saclvq6',
        18,
        'sARCH',
        'Staked Arch',
      ),
    ],
  },
  '0xa86a.avax': {
    '0x1.icon': [
      new XToken('0xa86a.avax', 43114, NATIVE_ADDRESS, 18, 'AVAX', 'AVAX'),
      new XToken(
        '0xa86a.avax',
        43114,
        '0x8475509d391e6ee5A8b7133221CE17019D307B3E',
        18,
        'hyTB',
        'HiYield Treasury Bill',
      ),
      new XToken('0xa86a.avax', 43114, '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', 6, 'USDC', 'USD Coin'),
    ],
  },
};
