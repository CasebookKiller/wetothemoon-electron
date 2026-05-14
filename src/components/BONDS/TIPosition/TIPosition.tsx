import React, { FC } from 'react';

import { IAccount, IPortfolioPosition, IInstrument } from '@root/api/types'

import { Avatar } from 'primereact/avatar';

interface TIPositionProps {
  account: IAccount;
  position: IPortfolioPosition;
  instrument: IInstrument;
}

export const TIPosition:FC<TIPositionProps> = (props) => {
  return (
    <React.Fragment>
      <div className='flex app align-items-center gap-2'>
        <div className='flex-grow-1 gap-1 text-sm'>
          <div
            className='app flex align-items-center gap-2 mt-2'
          >
            <Avatar shape='circle' image={props.instrument?.brand.logoName} /> <div className='flex-1 flex flex-column gap-1'><div>{props.instrument?.name}</div><div className='app theme-hint-color font-weight-content flex nowrap'>{props.position.ticker}</div></div>
          </div>
          <div className='flex align-items-center gap-2'>
            <div
              className='app font-size theme-hint-color font-weight-content flex nowrap'
            >
              {
                //
              }
            </div>
            <div className='flex flex-wrap'>
              {
                //
              }
            </div>
          </div>
        </div>
        <div className='flex-shrink-0 align-items-center justify-content-center'></div>
        <div className='flex-shrink-0 gap-1 justify-content-center text-sm'>
          <div className='flex align-items-center justify-content-center gap-2'>
            <div
              className='app font-size theme-hint-color font-weight-content flex nowrap'
            >
              <span className='ml-2'>{(Number(props.position.quantity.units+'.'+props.position.quantity.nano) * Number(props.position.currentPrice.units+'.'+props.position.currentPrice.nano)).toFixed(2)} </span>
            </div>
            <div className='flex flex-wrap'>
              {
                //
              }
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}