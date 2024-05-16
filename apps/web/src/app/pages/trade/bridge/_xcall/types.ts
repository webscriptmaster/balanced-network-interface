import { IXCallFee, XChainId, XToken } from 'app/pages/trade/bridge/types';
import { XSwapInfo, Transaction, TransactionStatus, XCallEvent, XCallEventMap } from '../_zustand/types';

export interface XCallService {
  // getBlock(blockHeight);
  // filterEventLogs(eventLogs)
  // filterCallMessageEventLogs(eventLogs)
  // filterCallExecutedEventLogs(eventLogs)
  // filterCallMessageSentEventLog(eventLogs)
  // parseCallMessageEventLog(eventLog)
  // parseCallExecutedEventLog(eventLog)
  // parseCallMessageSentEventLog(eventLog)

  // updateServiceConfig(serviceConfig: any): void;

  getXCallFee(to: XChainId, rollback: boolean): Promise<IXCallFee>;
  getBlockHeight(): Promise<bigint>;
  getBlockEventLogs(blockHeight: bigint): Promise<any[]>;
  getTxReceipt(txHash): Promise<any>;
  getTxEventLogs(rawTx): any[];
  deriveTxStatus(rawTx): TransactionStatus;

  getSourceEvents(transaction: Transaction): Promise<XCallEventMap>;
  getDestinationEventsByBlock(blockHeight: bigint): Promise<XCallEvent[]>;

  // getAllowance(token: XToken, owner: string | null, spender: string): Promise<string>;
  approve(token, owner, spender, currencyAmountToApprove);

  executeTransfer(xSwapInfo: XSwapInfo): Promise<string | undefined>;
  executeSwap(xSwapInfo: XSwapInfo): Promise<string | undefined>;
}
