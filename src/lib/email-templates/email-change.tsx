import * as React from 'react'

import { Button, Link, Text } from '@react-email/components'
import { EmailShell, button, h1, link, muted, text } from './brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailShell preview="Confirm your new Fatui Market email address">
    <Text style={h1}>Confirm your email change</Text>
    <Text style={text}>
      You asked to change the email on your Fatui Market account from{' '}
      <Link href={`mailto:${oldEmail}`} style={link}>
        {oldEmail}
      </Link>{' '}
      to{' '}
      <Link href={`mailto:${newEmail}`} style={link}>
        {newEmail}
      </Link>
      .
    </Text>
    <Button style={button} href={confirmationUrl}>
      Confirm email change
    </Button>
    <Text style={{ ...muted, margin: '18px 0 0' }}>
      If you didn't request this change, please secure your account immediately.
    </Text>
  </EmailShell>
)

export default EmailChangeEmail
