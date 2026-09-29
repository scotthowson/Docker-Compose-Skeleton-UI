// =============================================================================
// Hint — a tooltip for an icon-only button (or any control whose name needs one
// more sentence). A thin wrapper around Mantine's Tooltip, which the dashboard
// themes once (lib/mantine.tsx): a dark bubble with an arrow, 12 px text that
// wraps at 320 px. Unlike a `title`, it shows on keyboard focus as well as on
// hover, comes up after 150 ms and is styled in every theme.
//
//   <Hint label="Refresh"><button aria-label="Refresh" className={BTN_ICON_QUIET}>…</button></Hint>
//
// The hint is for eyes: the control still carries its own aria-label. With an
// empty label the child is returned as it is (a hint that only sometimes
// exists needs no branch at the call site). A disabled button gets no pointer
// events and so no hover hint: wrap it in a <span> and hint the span.
// =============================================================================

import type { ReactElement, ReactNode } from 'react'
import { Tooltip, type TooltipProps } from '@mantine/core'

export default function Hint({ label, children, position }: { label?: ReactNode; children: ReactElement; position?: TooltipProps['position'] }) {
  if (label === undefined || label === null || label === false || label === '') return children
  return (
    <Tooltip label={label} withArrow position={position} events={{ hover: true, focus: true, touch: false }}>
      {children}
    </Tooltip>
  )
}
