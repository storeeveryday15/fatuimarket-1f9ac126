import * as React from 'react'

import { Button, Img, Text } from '@react-email/components'
import { BrandFooter, EmailShell, button, h1, text } from './brand'
import type { FooterLink } from './brand'
import type { TemplateEntry } from './registry'

interface AnnouncementEmailProps {
  title?: string
  body?: string
  imageUrl?: string | null
  buttonText?: string | null
  buttonLink?: string | null
  footerLinks?: FooterLink[]
  preferencesUrl?: string
  trackingPixelUrl?: string | null
}

export const AnnouncementEmail = ({
  title = 'Update from Fatui Market',
  body = '',
  imageUrl,
  buttonText,
  buttonLink,
  footerLinks = [],
  preferencesUrl,
  trackingPixelUrl,
}: AnnouncementEmailProps) => (
  <EmailShell
    preview={title}
    trackingPixelUrl={trackingPixelUrl}
    footer={<BrandFooter links={footerLinks} preferencesUrl={preferencesUrl} />}
  >
    <Text style={h1}>{title}</Text>
    {imageUrl ? (
      <Img
        src={imageUrl}
        alt=""
        width="464"
        style={{ width: '100%', borderRadius: '12px', margin: '0 0 16px' }}
      />
    ) : null}
    {body
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line, i) => (
        <Text key={i} style={text}>
          {line}
        </Text>
      ))}
    {buttonLink ? (
      <Button style={button} href={buttonLink}>
        {buttonText || 'Open Fatui Market'}
      </Button>
    ) : null}
  </EmailShell>
)

export const template = {
  component: AnnouncementEmail,
  subject: (data: Record<string, any>) =>
    (data?.['title'] as string) || 'Update from Fatui Market',
  displayName: 'Store announcement',
  previewData: {
    title: 'Flash sale: 10% off Genshin top-ups',
    body: 'For the next 24 hours every Genesis Crystal pack is discounted.\nOrders are delivered instantly as always.',
    buttonText: 'Shop now',
    buttonLink: 'https://fatuimarket.shop',
    footerLinks: [
      { key: 'whatsapp', label: 'WhatsApp', url: 'https://wa.me/917679393645', emoji: '💬' },
      { key: 'instagram', label: 'Instagram', url: 'https://instagram.com/fatuimarket', emoji: '📸' },
      { key: 'telegram', label: 'Telegram', url: 'https://t.me/fatuimarket', emoji: '✈️' },
      { key: 'facebook', label: 'Facebook', url: 'https://facebook.com', emoji: '📘' },
      { key: 'youtube', label: 'YouTube', url: 'https://youtube.com/@fatuimarket', emoji: '▶️' },
    ],
  },
} satisfies TemplateEntry

export default AnnouncementEmail
