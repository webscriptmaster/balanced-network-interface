import { Event } from '@cosmjs/cosmwasm-stargate';

import { DestinationXCallData, OriginXCallData, XCallEvent } from 'app/_xcall/types';
import { NETWORK_ID } from 'constants/config';

import { ARCHWAY_EVENT_XCALL_MSG_SENT } from './types';

export function getXCallOriginEventDataFromArchway(
  events: readonly Event[],
  descriptionAction: string,
  descriptionAmount: string,
): OriginXCallData | undefined {
  const xCallSentEvent = events.find(e => e.type === ARCHWAY_EVENT_XCALL_MSG_SENT);
  // const xCallDataEvent = events.find(e => e.type === 'wasm-send_packet');
  // const data = xCallDataEvent && xCallDataEvent.attributes.find(a => a.key === 'packet_data_hex')?.value;
  const sn = xCallSentEvent && xCallSentEvent.attributes.find(a => a.key === 'sn')?.value;

  if (sn) {
    return {
      sn: parseInt(sn),
      eventName: XCallEvent.CallMessageSent,
      chain: 'archway',
      destination: 'icon',
      timestamp: new Date().getTime(),
      descriptionAction,
      descriptionAmount,
    };
  }
}

export function getXCallDestinationEventDataFromArchwayEvent(
  events: readonly Event[],
): DestinationXCallData | undefined {
  const dataRaw = events['wasm-CallMessage.data'];
  const snRaw = events['wasm-CallMessage.sn'];
  const reqIdRaw = events['wasm-CallMessage.reqId'];
  const data = dataRaw && (dataRaw[0] as string);
  const sn = snRaw && parseInt(snRaw[0]);
  const reqId = reqIdRaw && parseInt(reqIdRaw[0]);
  console.log('xCall debug - Archway destination event data {data, sn, reqId}: ', data, sn, reqId);
  if (data && sn && reqId) {
    return {
      data,
      sn,
      reqId,
      eventName: XCallEvent.CallMessage,
      chain: 'archway',
      origin: 'icon',
    };
  }
}

export function getRollbackEventDataFromArchwayEvent(events: readonly Event[]): { sn: string } | undefined {
  const snRaw = events['wasm-RollbackMessage.sn'];
  const sn: string = snRaw && snRaw[0];
  console.log('xCall debug - Archway rollback event data {sn}: ', sn);
  if (sn) {
    return {
      sn,
    };
  }
}

export function getFeeParam(fee: number): { amount: { amount: string; denom: string }[]; gas: string } | 'auto' {
  return NETWORK_ID === 1
    ? 'auto'
    : {
        amount: [{ amount: '1', denom: 'aconst' }],
        gas: `${fee}`,
      };
}
