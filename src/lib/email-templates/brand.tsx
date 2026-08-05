import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export const BRAND = {
  name: 'Fatui Market',
  url: 'https://fatuimarket.shop',
  support: 'https://fatuimarket.shop/contact',
  purple: '#b13bff',
  magenta: '#e455ff',
  ink: '#160f22',
}

export const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: '0',
  padding: '0',
}

export const container = {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '0 0 32px',
}

export const header = {
  background: 'linear-gradient(135deg, #e455ff 0%, #6b5cff 100%)',
  backgroundColor: BRAND.purple,
  padding: '26px 28px',
  borderRadius: '14px 14px 0 0',
}

export const brandMark = {
  color: '#ffffff',
  fontSize: '19px',
  fontWeight: 700 as const,
  letterSpacing: '0.6px',
  margin: '0',
}

export const brandTag = {
  color: '#f3e6ff',
  fontSize: '11px',
  letterSpacing: '1.6px',
  textTransform: 'uppercase' as const,
  margin: '4px 0 0',
}

export const card = {
  border: '1px solid #ece7f5',
  borderTop: 'none',
  borderRadius: '0 0 14px 14px',
  padding: '28px',
}

export const h1 = {
  fontSize: '21px',
  fontWeight: 700 as const,
  color: BRAND.ink,
  margin: '0 0 14px',
}

export const text = {
  fontSize: '14px',
  color: '#4b4560',
  lineHeight: '1.6',
  margin: '0 0 18px',
}

export const codeBox = {
  backgroundColor: '#faf6ff',
  border: '1px solid #e9d9ff',
  borderRadius: '12px',
  padding: '20px 12px',
  textAlign: 'center' as const,
  margin: '0 0 18px',
}

export const codeText = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: '34px',
  fontWeight: 700 as const,
  letterSpacing: '10px',
  color: BRAND.ink,
  margin: '0',
}

export const button = {
  background: 'linear-gradient(135deg, #e455ff 0%, #6b5cff 100%)',
  backgroundColor: BRAND.purple,
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600 as const,
  borderRadius: '10px',
  padding: '13px 26px',
  textDecoration: 'none',
  display: 'inline-block',
}

export const muted = {
  fontSize: '12px',
  color: '#8b849c',
  lineHeight: '1.6',
  margin: '0',
}

export const link = { color: BRAND.purple, textDecoration: 'underline' }

export type FooterLink = { key: string; label: string; url: string; emoji: string }

const socialPill = {
  display: 'inline-block',
  border: '1px solid #ece7f5',
  borderRadius: '999px',
  padding: '7px 12px',
  margin: '0 6px 6px 0',
  fontSize: '12px',
  fontWeight: 600 as const,
  color: BRAND.ink,
  textDecoration: 'none',
}

/**
 * Permanent branded footer for customer announcements: contact details,
 * official channels and the preferences/unsubscribe notice.
 */
export const BrandFooter = ({
  links = [],
  preferencesUrl = `${BRAND.url}/dashboard`,
}: {
  links?: FooterLink[]
  preferencesUrl?: string
}) => (
  <>
    <Hr style={{ borderColor: '#ece7f5', margin: '26px 0 14px' }} />
    <Text style={{ ...muted, margin: '0 0 4px' }}>
      You&apos;re receiving this email because you&apos;re a Fatui Market customer.
    </Text>
    <Text style={{ ...muted, margin: '0 0 14px' }}>
      <Link href={preferencesUrl} style={link}>
        Manage notification preferences
      </Link>
      {' or unsubscribe anytime.'}
    </Text>
    <Text style={{ ...muted, margin: '0 0 12px' }}>
      🌐{' '}
      <Link href={BRAND.url} style={link}>
        fatuimarket.shop
      </Link>
      {'   '}📧{' '}
      <Link href="mailto:fatuimarket@gmail.com" style={link}>
        fatuimarket@gmail.com
      </Link>
    </Text>
    {links.length > 0 ? (
      <Text style={{ margin: '0 0 12px' }}>
        {links.map((l) => (
          <Link key={l.key} href={l.url} style={socialPill}>
            {l.emoji} {l.label}
          </Link>
        ))}
      </Text>
    ) : null}
    <Text style={{ ...muted, margin: '0' }}>
      © {new Date().getFullYear()} Fatui Market. All rights reserved.
    </Text>
  </>
)

export const EmailShell = ({
  preview,
  children,
  footer,
  trackingPixelUrl,
}: {
  preview: string
  children: React.ReactNode
  footer?: React.ReactNode
  trackingPixelUrl?: string | null
}) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brandMark}>FATUI MARKET</Text>
          <Text style={brandTag}>Instant game top-ups</Text>
        </Section>
        <Section style={card}>
          {children}
          {footer ?? (
            <>
              <Hr style={{ borderColor: '#ece7f5', margin: '24px 0 14px' }} />
              <Text style={muted}>
                <Link href={BRAND.url} style={link}>
                  fatuimarket.shop
                </Link>
                {' · '}
                <Link href={BRAND.support} style={link}>
                  Support
                </Link>
              </Text>
              <Text style={{ ...muted, margin: '6px 0 0' }}>
                © {new Date().getFullYear()} Fatui Market. All rights reserved.
              </Text>
            </>
          )}
          {trackingPixelUrl ? (
            <Img src={trackingPixelUrl} alt="" width="1" height="1" style={{ display: 'block' }} />
          ) : null}
        </Section>
      </Container>
    </Body>
  </Html>
)

