import React, { useEffect, useState } from 'react';

import { Trans, t } from '@lingui/macro';
import { Box, Flex } from 'rebass/styled-components';
import styled from 'styled-components';

import { Typography } from 'app/theme';
import Modal from 'app/components/Modal';
import { ModalContentWrapper } from 'app/components/ModalContent';
import { StyledButton as XCallButton } from 'app/components/trade/XCallSwapModal';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, TextButton } from 'app/components/Button';
import Spinner from 'app/components/Spinner';

import { getNetworkDisplayName } from 'app/_xcall/utils';
import { useXCallFee, useXCallGasChecker } from 'app/_xcall/hooks';
import { useShouldLedgerSign } from 'store/application/hooks';

import {
  useBridgeTransferConfirmModalStore,
  bridgeTransferConfirmModalActions,
} from '../_zustand/useBridgeTransferConfirmModalStore';

import BridgeTransferStatus from './BridgeTransferStatus';
import LiquidFinanceIntegration from '../../bridge/_components/LiquidFinanceIntegration';
import { useBridgeInfo } from 'store/bridge/hooks';
import {
  bridgeTransferActions,
  useBridgeTransferStore,
  useFetchBridgeTransferEvents,
} from '../_zustand/useBridgeTransferStore';
import { ApprovalState, useApproveCallback } from 'app/_xcall/archway/AllowanceHandler';
import { xChainMap } from 'app/_xcall/archway/config1';

const StyledXCallButton = styled(XCallButton)`
  transition: all 0.2s ease;

  &.disabled {
    background: rgba(255, 255, 255, 0.15);
    pointer-events: none;
    cursor: not-allowed;
  }
`;

export function BridgeTransferConfirmModal() {
  useFetchBridgeTransferEvents();

  const { modalOpen } = useBridgeTransferConfirmModalStore();
  const { isTransferring } = useBridgeTransferStore();

  const {
    currency: currencyToBridge,
    recipient,
    typedValue,
    isLiquidFinanceEnabled,
    currencyAmountToBridge,
    account,
    isDenom,
    bridgeDirection,
  } = useBridgeInfo();

  const { xCallFee } = useXCallFee(bridgeDirection.from, bridgeDirection.to);

  const xChain = xChainMap[bridgeDirection.from];
  const { approvalState, approveCallback } = useApproveCallback(currencyAmountToBridge, xChain.contracts.assetManager);

  const shouldLedgerSign = useShouldLedgerSign();

  const { data: gasChecker } = useXCallGasChecker(bridgeDirection.from, bridgeDirection.to);

  const handleDismiss = () => {
    bridgeTransferConfirmModalActions.closeModal();
  };

  const handleTransfer = async () => {
    if (currencyAmountToBridge && recipient && account && xCallFee) {
      const bridgeInfo = {
        bridgeDirection,
        currencyAmountToBridge,
        recipient,
        account,
        xCallFee,
        isDenom,
        isLiquidFinanceEnabled,
      };
      await bridgeTransferActions.executeTransfer(bridgeInfo);
    }

    // await xCallEventActions.startScanner(bridgeDirection.to, 4393620);
  };

  const handleApprove = () => {
    approveCallback();
  };

  // TODO: isApproveNeeded && !isApproving && !isApproved

  return (
    <>
      <Modal isOpen={modalOpen} onDismiss={handleDismiss}>
        <ModalContentWrapper>
          <Typography textAlign="center" mb="5px">
            {t`Transfer asset cross-chain?`}
          </Typography>

          <Typography variant="p" fontWeight="bold" textAlign="center" fontSize={20}>
            {`${currencyAmountToBridge?.toFixed(2)} ${currencyAmountToBridge?.currency.symbol}`}
          </Typography>

          <Flex my={5}>
            <Box width={1 / 2} className="border-right">
              <Typography textAlign="center">
                <Trans>From</Trans>
              </Typography>
              <Typography variant="p" textAlign="center">
                {getNetworkDisplayName(bridgeDirection.from)}
              </Typography>
            </Box>

            <Box width={1 / 2}>
              <Typography textAlign="center">
                <Trans>To</Trans>
              </Typography>
              <Typography variant="p" textAlign="center">
                {getNetworkDisplayName(bridgeDirection.to)}
              </Typography>
            </Box>
          </Flex>

          <Typography textAlign="center" mb="2px">
            {`${getNetworkDisplayName(bridgeDirection.to)} `}
            <Trans>address</Trans>
          </Typography>

          <Typography variant="p" textAlign="center" margin={'auto'} maxWidth={225} fontSize={16}>
            {recipient}
          </Typography>

          <LiquidFinanceIntegration />

          {isTransferring && <BridgeTransferStatus />}

          {gasChecker && gasChecker.hasEnoughGas && (
            <AnimatePresence>
              {/* {!isTransferring && isAllowanceIncreaseNeeded && !allowanceIncreased && (
                <motion.div key="allowance-handler" {...presenceVariants} style={{ overflow: 'hidden' }}>
                  <Box pt={3}>
                    <Flex
                      pt={3}
                      alignItems="center"
                      justifyContent="center"
                      flexDirection="column"
                      className="border-top"
                    >
                      <Typography
                        pb={4}
                      >{t`Approve ${currencyAmountToBridge?.currency.symbol} for cross-chain transfer.`}</Typography>
                      {!isTxPending && isAllowanceIncreaseNeeded && !allowanceIncreased && (
                        <Button onClick={increaseAllowance}>Approve</Button>
                      )}
                      {isTxPending && <Button disabled>Approving...</Button>}
                    </Flex>
                  </Box>
                </motion.div>
              )} */}
            </AnimatePresence>
          )}

          {gasChecker && !gasChecker.hasEnoughGas && (
            <Typography mt={4} mb={-1} textAlign="center" color="alert">
              {gasChecker.errorMessage || t`Not enough gas to complete the swap.`}
            </Typography>
          )}

          <Flex justifyContent="center" mt={4} pt={4} className="border-top">
            {shouldLedgerSign && <Spinner></Spinner>}
            {!shouldLedgerSign && (
              <>
                <TextButton onClick={handleDismiss}>
                  <Trans>Cancel</Trans>
                </TextButton>
                {approvalState !== ApprovalState.APPROVED && !isTransferring && (
                  <>
                    <Button onClick={handleApprove} disabled={approvalState === ApprovalState.PENDING}>
                      {approvalState === ApprovalState.PENDING ? 'Approving' : 'Approve'}
                    </Button>
                  </>
                )}
                {approvalState === ApprovalState.APPROVED && (
                  <>
                    <StyledXCallButton onClick={handleTransfer} disabled={isTransferring}>
                      {!isTransferring ? <Trans>Transfer</Trans> : <Trans>xCall in progress</Trans>}
                    </StyledXCallButton>
                  </>
                )}
              </>
            )}
          </Flex>
        </ModalContentWrapper>
      </Modal>
    </>
  );
}
