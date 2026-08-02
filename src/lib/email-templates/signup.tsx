import * as React from 'react'

import { Text } from '@react-email/components'
import { EmailShell, codeBox, codeText, h1, muted, text } from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  token: string
}

export const SignupEmail = ({ token }: SignupEmailProps) => (
  <EmailShell preview={`Your Fatui Market verification code is ${token}`}>
    <Text style={h1}>Confirm your email</Text>
    <Text style={text}>
      Welcome to Fatui Market. Enter this 6-digit code on the sign-in screen to
      verify your email and finish creating your account.
    </Text>
    <div style={codeBox}>
      <Text style={codeText}>{token}</Text>
    </div>
    <Text style={text}>This code expires in 10 minutes and can be used once.</Text>
    <Text style={muted}>
      If you didn't create an account, you can safely ignore this email. Never
      share this code with anyone.
    </Text>
  </EmailShell>
)

export default SignupEmail
