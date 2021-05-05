import React, { useCallback, useState } from 'react';

import styled from 'styled-components';

import Popover, { PopoverProps } from '../Popover';

const TooltipContainer = styled.div<{ wide?: boolean }>`
  width: ${props => (props.wide ? '300px' : '240px')};
  padding: 12px 1rem;
  line-height: 150%;
  font-weight: 400;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.white};
`;

interface TooltipProps extends Omit<PopoverProps, 'content'> {
  text: React.ReactNode;
  wide?: boolean;
}

export default function Tooltip({ text, wide, ...rest }: TooltipProps) {
  return <Popover content={<TooltipContainer wide={wide}>{text}</TooltipContainer>} {...rest} />;
}

export function MouseoverTooltip({ children, ...rest }: Omit<TooltipProps, 'show'>) {
  const [show, setShow] = useState(false);
  const open = useCallback(() => setShow(true), [setShow]);
  const close = useCallback(() => setShow(false), [setShow]);
  return (
    <Tooltip {...rest} show={show}>
      <div onMouseEnter={open} onMouseLeave={close}>
        {children}
      </div>
    </Tooltip>
  );
}
