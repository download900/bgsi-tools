import React from 'react';
import { useScrollTrigger, Zoom, Fab } from '@mui/material';

interface ScrollTopProps {
  window?: () => Window;
  children: React.ReactElement;
}

export function ScrollTop({ window, children }: ScrollTopProps) {
  // Trigger once page has scrolled 100px
  const trigger = useScrollTrigger({
    target: window ? window() : undefined,
    disableHysteresis: true,
    threshold: 100,
  });

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLDivElement).ownerDocument.querySelector('#back-to-top-anchor');
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <Zoom in={trigger} style={{transitionDuration: '0s' }}>
      <div
        onClick={handleClick}
        role="presentation"
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          zIndex: 1000,
        }}
      >
        {children}
      </div>
    </Zoom>
  );
}
