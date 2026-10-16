import React, { useEffect, useRef, useState } from 'react'
import { CSSTransition } from 'react-transition-group'
import styles from './Callout.css'

interface CalloutProps {
  // the callout shows each time showKey changes (if text is set)
  showKey: string | number
  text: string
  duration: number // ms
  className?: string
}

const Callout = ({ showKey, text, duration, className }: CalloutProps) => {
  const [show, setShow] = useState(false)
  const nodeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!text) return

    const frame = requestAnimationFrame(() => setShow(true))
    const timer = setTimeout(() => setShow(false), duration)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      setShow(false)
    }
  }, [showKey, text, duration])

  return (
    <CSSTransition
      nodeRef={nodeRef}
      in={show}
      timeout={300}
      unmountOnExit
      classNames={{
        enter: styles.enter,
        enterActive: styles.enterActive,
        exitActive: styles.exitActive,
      }}
    >
      <div ref={nodeRef} className={`${styles.container} ${className ?? ''}`} translate='no'>
        {text}
      </div>
    </CSSTransition>
  )
}

export default Callout
