import * as React from 'react'

import { Text } from '@react-email/components'
import {
  EmailShell,
  codeBox,
  codeText,
  h1,
  muted,
  text,
} from './brand'

interface MagicLinkEmailProps {
  siteName: string
  token: string
}

export const MagicLinkEmail = ({ token }: MagicLinkEmailProps) => (
  <EmailShell preview={`Your Fatui Market login code is ${token}`}>
    <Text style={h1}>Your login code</Text>
    <Text style={text}>
      Enter this 6-digit code on the Fatui Market sign-in screen to continue.
    </Text>
    <div style={codeBox}>
      <Text style={codeText}>{token}</Text>
    </div>
    <Text style={text}>This code expires in 10 minutes and can be used once.</Text>
    <Text style={muted}>
      Didn't request this code? You can safely ignore this email — nobody can
      access your account without it. Never share this code with anyone.
    </Text>
  </EmailShell>
)

export default MagicLinkEmail
