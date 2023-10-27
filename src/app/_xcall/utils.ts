import rlp from 'rlp';

import { XCallState } from 'store/xCall/reducer';

import { ARCHWAY_SUPPORTED_TOKENS_LIST } from './archway/tokens';
import { OriginXCallData, SupportedXCallChains, XCallEvent, XCallEventType } from './types';

export function getRlpEncodedMsg(msg: string | any[]) {
  return Array.from(rlp.encode(msg));
}

export function getBytesFromString(str: string) {
  return Array.from(Buffer.from(str, 'utf8'));
}

export function getStringFromBytes(bytes: number[]) {
  const buffer = Buffer.from(bytes);
  return buffer.toString('utf8');
}

//TODO: improve this nonsense
export const getFollowingEvent = (event: XCallEventType): XCallEventType => {
  switch (event) {
    case XCallEvent.CallMessageSent:
      return XCallEvent.CallMessage;
    default:
      return XCallEvent.CallMessage;
  }
};

//TODO: improve this nonsense
export const getOppositeChain = (chain: SupportedXCallChains): SupportedXCallChains => {
  if (chain === 'icon') {
    return 'archway';
  } else {
    return 'icon';
  }
};

export const getNetworkDisplayName = (chain: SupportedXCallChains) => {
  if (chain === 'icon') {
    return 'ICON';
  }
  if (chain === 'archway') {
    return 'Archway';
  }
  return '';
};

export const getArchwayCounterToken = (symbol?: string) => {
  if (symbol) {
    return ARCHWAY_SUPPORTED_TOKENS_LIST.find(token => token.symbol === symbol);
  }
};

export const getOriginEvent = (sn: number, xCallState: XCallState): OriginXCallData | undefined => {
  return Object.keys(xCallState.events)
    .map(chain => xCallState.events[chain].origin.find(e => e.sn === sn))
    .find(event => event);
};
