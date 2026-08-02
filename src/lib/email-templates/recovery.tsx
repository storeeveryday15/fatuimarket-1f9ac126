import * as React from 'react'

import { Button, Text } from '@react-email/components'
import { EmailShell, button, h1, muted, text } from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <EmailShell preview="Reset your Fatui Market password">
    <Text style={h1}>Reset your password</Text>
    <Text style={text}>
      We received a request to reset the password for your Fatui Market account.
      Choose a new password using the button below.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Reset password
    </Button>
    <Text style={{ ...text, margin: '18px 0 0' }}>
      This link expires shortly for your security.
    </Text>
    <Text style={muted}>
      If you didn't request a password reset, you can safely ignore this email —
      your password will not change.
    </Text>
  </EmailShell>
)

export default RecoveryEmail
