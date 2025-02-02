import React from 'react';

import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { Flex } from 'rebass/styled-components';
import styled from 'styled-components';

import { Typography } from 'app/theme';
import { ProposalInterface } from 'types';
import { normalizeContent } from 'utils';

import {
  ApprovalLabel,
  RejectionLabel,
  VoteDateEndLabel,
  VoterNumberLabel,
  VoterPercentLabel,
  VoteStatusLabel,
} from './components';
import Skeleton from '../Skeleton';
import { notificationCSS } from '../Wallet/ICONWallets/utils';

dayjs.extend(duration);

const ProposalWrapper = styled.div<{ showNotification?: boolean }>`
  border-radius: 10px;
  flex: 1;
  width: 100%;
  background: #144a68;
  border: 2px solid #144a68;
  padding: 20px 25px;
  transition: border 0.3s ease;
  outline: none;
  overflow: visible;
  margin: 0 0 25px;
  cursor: pointer;

  &:hover,
  &:focus {
    border: 2px solid #2ca9b7;
  }

  ${({ showNotification }) => showNotification && `${notificationCSS}`}

  &:before, &:after {
    left: 10px;
    top: 10px;
    background-color: ${({ theme }) => theme.colors.primaryBright};
  }
`;
const Divider = styled.div`
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  margin-bottom: 15px;
`;
const ContentText = styled(Typography)`
  color: ${({ theme }) => theme.colors.text2};
  margin-bottom: 15px;
  font-size: 16px;
`;

export default function ProposalInfo({
  proposal,
  showNotification,
}: {
  proposal?: ProposalInterface;
  showNotification?: boolean;
}) {
  const { name: title, description } = proposal || {};

  return (
    <ProposalWrapper showNotification={showNotification}>
      <Typography variant="h3" mb="10px">
        {title ? title : <Skeleton height={30} />}
      </Typography>
      <ContentText>
        {description ? description && normalizeContent(description, 600) : <Skeleton height={20} />}
      </ContentText>
      <Divider />
      <Flex alignItems="center" flexWrap="wrap" sx={{ columnGap: '15px' }}>
        <VoteStatusLabel proposal={proposal} />
        <VoteDateEndLabel proposal={proposal} />
        <VoterPercentLabel value={proposal?.sum} />
        <VoterNumberLabel value={proposal?.voters} />
        <ApprovalLabel value={proposal?.for} />
        <RejectionLabel value={proposal?.against} />
      </Flex>
    </ProposalWrapper>
  );
}
