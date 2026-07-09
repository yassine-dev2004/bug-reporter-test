import React, { useEffect } from 'react'

interface AgeGateProps {
  onAccept: () => void
}

export default function AgeGate({ onAccept }: AgeGateProps) {
  useEffect(() => {
    onAccept()
  }, [onAccept])

  return null
}
