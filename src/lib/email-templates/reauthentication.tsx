import * as React from 'react'

import { Text } from '@react-email/components'
import { EmailShell, codeBox, codeText, h1, muted, text } from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <EmailShell preview={`Your Fatui Market confirmation code is ${token}`}>
    <Text style={h1}>Confirm it's you</Text>
    <Text style={text}>Enter this 6-digit code to confirm your identity.</Text>
    <div style={codeBox}>
      <Text style={codeText}>{token}</Text>
    </div>
    <Text style={muted}>
      This code expires shortly. If you didn't request it, you can safely ignore
      this email. Never share this code with anyone.
    </Text>
  </EmailShell>
)

export default ReauthenticationEmail
