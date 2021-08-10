import React, { useCallback, useState } from 'react';

import { isIOS } from 'react-device-detect';
import styled from 'styled-components';

import Popover, { PopoverProps, PopperWithoutArrowAndBorder } from '../Popover';

const TooltipContainer = styled.div<{ wide?: boolean; small?: boolean }>`
  @media (max-width: 650px) {
    ${props => props.small && ' width: 156px;  font-size: 12px; padding: 11px;'}
  }

  width: ${props => (props.wide ? '300px' : '244px')};
  padding: 10px 0.9375rem;
  line-height: 150%;
  font-weight: 400;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.white};
`;

interface TooltipProps extends Omit<PopoverProps, 'content'> {
  text: React.ReactNode;
  wide?: boolean;
  small?: boolean;
  containerStyle?: React.CSSProperties;
  noArrowAndBorder?: boolean;
}

export default function Tooltip({ text, wide, small, containerStyle, noArrowAndBorder, ...rest }: TooltipProps) {
  return (
    <>
      {noArrowAndBorder ? (
        <PopperWithoutArrowAndBorder
          content={<TooltipContainer style={{ width: '100%' }}>{text}</TooltipContainer>}
          {...rest}
        />
      ) : (
        <Popover
          content={
            <TooltipContainer style={containerStyle} wide={wide} small={small}>
              {text}
            </TooltipContainer>
          }
          {...rest}
        />
      )}
    </>
  );
}

export function MouseoverTooltip({ children, noArrowAndBorder, ...rest }: Omit<TooltipProps, 'show'>) {
  const [show, setShow] = useState(false);
  const open = useCallback(() => setShow(true), [setShow]);
  const close = useCallback(() => setShow(false), [setShow]);
  return (
    <Tooltip {...rest} show={show} noArrowAndBorder={noArrowAndBorder}>
      <div onClick={open} {...(!isIOS ? { onMouseEnter: open } : null)} onMouseLeave={close}>
        {children}
      </div>
    </Tooltip>
  );
}
