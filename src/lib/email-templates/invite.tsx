import * as React from 'react'

import { Button, Text } from '@react-email/components'
import { EmailShell, button, h1, muted, text } from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <EmailShell preview="You've been invited to Fatui Market">
    <Text style={h1}>You've been invited</Text>
    <Text style={text}>
      You've been invited to join Fatui Market — instant top-ups for Genshin
      Impact, Mobile Legends, Honor of Kings and more. Accept the invitation to
      create your account.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Accept invitation
    </Button>
    <Text style={{ ...muted, margin: '18px 0 0' }}>
      If you weren't expecting this invitation, you can safely ignore this email.
    </Text>
  </EmailShell>
)

export default InviteEmail
