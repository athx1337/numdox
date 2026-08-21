'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { cn, formatPhoneNumber } from '@/lib/utils'
import {
  PhoneValidation,
  CarrierInfo,
  LocationInfo,
  SocialMediaAccount,
  BreachInfo,
  SpamScore,
  ReputationInfo,
} from '@/types/phone'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  MapPin,
  Antenna,
  Users,
  AlertTriangle as BreachIcon,
  ShieldAlert,
  Activity,
  Globe,
  Building2,
  Clock,
  Hash,
  ExternalLink,
  Copy,
} from 'lucide-react'

interface ResultCardProps {
  validation?: PhoneValidation | null
  carrier?: CarrierInfo | null
  location?: LocationInfo | null
  social?: SocialMediaAccount[]
  breaches?: BreachInfo[]
  spam?: SpamScore | null
  reputation?: ReputationInfo | null
  phone: string
}

export function ResultCard({
  validation,
  carrier,
  location,
  social,
  breaches,
  spam,
  reputation,
  phone,
}: ResultCardProps) {
  return (
    <div className="space-y-4">
      {/* Validation Card */}
      {validation && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Validation
              <Badge variant={validation.valid ? 'success' : 'destructive'}>
                {validation.valid ? 'Valid' : 'Invalid'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ValidationDetails validation={validation} />
          </CardContent>
        </Card>
      )}

      {/* Carrier Card */}
      {carrier && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Antenna className="h-5 w-5 text-blue-500" />
              Carrier
              {carrier.name && <Badge variant="outline">{carrier.name}</Badge>}
              {carrier.type && <Badge variant="secondary">{carrier.type}</Badge>}
              <Badge variant="outline">{carrier.confidence}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CarrierDetails carrier={carrier} />
          </CardContent>
        </Card>
      )}

      {/* Location Card */}
      {location && (
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-500" />
              Location
              {location.countryName && <Badge variant="outline">{location.countryName}</Badge>}
              {location.city && <Badge variant="secondary">{location.city}</Badge>}
              <Badge variant="outline">{location.accuracy}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <LocationDetails location={location} />
          </CardContent>
        </Card>
      )}

      {/* Social Media Card */}
      {social && social.length > 0 && (
        <Card className="border-l-4 border-l-pink-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-pink-500" />
              Social Media ({social.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <SocialDetails accounts={social} />
          </CardContent>
        </Card>
      )}

      {/* Breaches Card */}
      {breaches && (
        <Card className={cn('border-l-4', breaches.length > 0 ? 'border-l-red-500' : 'border-l-green-500')}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              {breaches.length > 0 ? (
                <>
                  <BreachIcon className="h-5 w-5 text-red-500" />
                  Data Breaches ({breaches.length})
                  <Badge variant="destructive">{breaches.length} found</Badge>
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5 text-green-500" />
                  Data Breaches (0)
                  <Badge variant="success">Clean (0 found)</Badge>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {breaches.length > 0 ? (
              <BreachDetails breaches={breaches} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No known data breach exposures associated with this phone number were found in public threat intelligence databases.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Spam Score Card */}
      {spam && (
        <Card className={cn('border-l-4', getSpamBorderColor(spam.level))}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              Spam Score
              <Badge variant={getSpamBadgeVariant(spam.level)}>
                {spam.level.charAt(0).toUpperCase() + spam.level.slice(1)} ({spam.score}/100)
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <SpamDetails spam={spam} />
          </CardContent>
        </Card>
      )}

      {/* Reputation Card */}
      {reputation && (
        <Card className={cn('border-l-4', getReputationBorderColor(reputation.level))}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-500" />
              Reputation
              <Badge variant={getReputationBadgeVariant(reputation.level)}>
                {reputation.level.charAt(0).toUpperCase() + reputation.level.slice(1)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ReputationDetails reputation={reputation} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ValidationDetails({ validation }: { validation: PhoneValidation }) {
  const fields = [
    { label: 'E.164 Format', value: validation.e164Format, icon: Hash },
    { label: 'International', value: validation.internationalFormat, icon: Globe },
    { label: 'National', value: validation.nationalFormat, icon: MapPin },
    { label: 'Type', value: validation.type, icon: Building2 },
    { label: 'Country', value: validation.countryName, icon: Globe },
    { label: 'Region Code', value: validation.regionCode, icon: MapPin },
    { label: 'Possible', value: validation.possible ? 'Yes' : 'No', icon: validation.possible ? CheckCircle : XCircle },
  ].filter((f) => f.value)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((field) => (
        <div key={field.label} className="flex items-center gap-2 text-sm">
          <field.icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">{field.label}:</span>
          <span className="font-mono text-foreground">{field.value}</span>
        </div>
      ))}
    </div>
  )
}

function CarrierDetails({ carrier }: { carrier: CarrierInfo }) {
  const fields = [
    { label: 'Carrier', value: carrier.name },
    { label: 'Type', value: carrier.type },
    { label: 'MCC', value: carrier.mcc },
    { label: 'MNC', value: carrier.mnc },
    { label: 'MCC/MNC', value: carrier.mccmnc },
    { label: 'Original Network', value: carrier.originalNetwork },
    { label: 'Ported', value: carrier.ported ? 'Yes' : 'No' },
    { label: 'Confidence', value: carrier.confidence },
    { label: 'Source', value: carrier.source },
  ].filter((f) => f.value)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((field) => (
        <div key={field.label} className="flex items-center gap-2 text-sm">
          <span className="font-medium text-muted-foreground">{field.label}:</span>
          <span className="font-mono text-foreground">{field.value}</span>
        </div>
      ))}
    </div>
  )
}

function LocationDetails({ location }: { location: LocationInfo }) {
  const fields = [
    { label: 'Country', value: location.countryName, icon: Globe },
    { label: 'Country Code', value: location.countryCode, icon: Hash },
    { label: 'Region', value: location.region, icon: MapPin },
    { label: 'Region Code', value: location.regionCode, icon: Hash },
    { label: 'City', value: location.city, icon: Building2 },
    { label: 'Coordinates', value: location.latitude && location.longitude ? `${location.latitude}, ${location.longitude}` : null, icon: MapPin },
    { label: 'Timezone', value: location.timezone, icon: Clock },
    { label: 'ISP', value: location.isp, icon: Building2 },
    { label: 'Organization', value: location.org, icon: Building2 },
    { label: 'ASN', value: location.asn, icon: Hash },
    { label: 'Accuracy', value: location.accuracy, icon: AlertTriangle },
    { label: 'Source', value: location.source, icon: ExternalLink },
  ].filter((f) => f.value)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((field) => (
        <div key={field.label} className="flex items-center gap-2 text-sm">
          {field.icon && <field.icon className="h-4 w-4 text-muted-foreground" />}
          <span className="font-medium text-muted-foreground">{field.label}:</span>
          <span className="font-mono text-foreground">{field.value}</span>
        </div>
      ))}
    </div>
  )
}

function SocialDetails({ accounts }: { accounts: SocialMediaAccount[] }) {
  return (
    <div className="space-y-2">
      {accounts.map((account) => (
        <div key={account.platform} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getPlatformIcon(account.platform)}</span>
            <div>
              <p className="font-medium">{account.platform}</p>
              <p className="text-xs text-muted-foreground">
                Confidence: <span className="capitalize">{account.confidence}</span>
              </p>
            </div>
          </div>
          {account.url && (
            <a href={account.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
              <ExternalLink className="h-4 w-4" />
              View
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

function BreachDetails({ breaches }: { breaches: BreachInfo[] }) {
  return (
    <div className="space-y-3">
      {breaches.map((breach) => (
        <Collapsible key={breach.name} open={false}>
          <CollapsibleTrigger className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
            <div className="flex items-center gap-3">
              <BreachIcon className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium">{breach.name || breach.title}</p>
                <p className="text-xs text-muted-foreground">
                  {breach.breachDate ? `Breached: ${breach.breachDate}` : ''}
                  {breach.pwnCount ? ` • ${breach.pwnCount.toLocaleString()} accounts` : ''}
                </p>
              </div>
            </div>
            <Badge variant={breach.isVerified ? 'success' : 'outline'}>
              {breach.isVerified ? 'Verified' : 'Unverified'}
            </Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-3 border-t border-red-100">
            <div className="space-y-2 text-sm">
              {breach.description && (
                <p className="text-muted-foreground">{breach.description}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {breach.dataClasses.map((dc) => (
                  <Badge key={dc} variant="outline" className="text-xs">{dc}</Badge>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {breach.domain && <span>Domain: {breach.domain}</span>}
                {breach.addedDate && <span>Added: {breach.addedDate}</span>}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}

function SpamDetails({ spam }: { spam: SpamScore }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <p className="text-3xl font-bold text-orange-500">{spam.score}</p>
          <p className="text-xs text-muted-foreground">Score (0-100)</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <p className="text-3xl font-bold">{spam.reports}</p>
          <p className="text-xs text-muted-foreground">Reports</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <p className="text-3xl font-bold">{spam.sources.length}</p>
          <p className="text-xs text-muted-foreground">Sources</p>
        </div>
      </div>

      {spam.categories.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Categories</p>
          <div className="flex flex-wrap gap-1">
            {spam.categories.map((cat) => (
              <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
            ))}
          </div>
        </div>
      )}

      {spam.lastReported && (
        <p className="text-xs text-muted-foreground">
          Last reported: {new Date(spam.lastReported).toLocaleDateString()}
        </p>
      )}

      {spam.sources.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sources: {spam.sources.join(', ')}
        </p>
      )}
    </div>
  )
}

function ReputationDetails({ reputation }: { reputation: ReputationInfo }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <p className="text-3xl font-bold text-cyan-500">{reputation.score}</p>
          <p className="text-xs text-muted-foreground">Score (0-100)</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <p className="text-3xl font-bold">{reputation.sources.length}</p>
          <p className="text-xs text-muted-foreground">Sources</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <p className="text-3xl font-bold">
            {[
              reputation.isVpn && 'VPN',
              reputation.isProxy && 'Proxy',
              reputation.isTor && 'Tor',
              reputation.isHosting && 'Hosting',
            ].filter(Boolean).length}
          </p>
          <p className="text-xs text-muted-foreground">Flags</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {reputation.asn && (
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">ASN:</span>
            <span className="font-mono">{reputation.asn}</span>
          </div>
        )}
        {reputation.isp && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">ISP:</span>
            <span>{reputation.isp}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">VPN:</span>
          <Badge variant={reputation.isVpn ? 'destructive' : 'success'} className="text-xs">
            {reputation.isVpn ? 'Yes' : 'No'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">Proxy:</span>
          <Badge variant={reputation.isProxy ? 'destructive' : 'success'} className="text-xs">
            {reputation.isProxy ? 'Yes' : 'No'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">Tor:</span>
          <Badge variant={reputation.isTor ? 'destructive' : 'success'} className="text-xs">
            {reputation.isTor ? 'Yes' : 'No'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">Hosting:</span>
          <Badge variant={reputation.isHosting ? 'warning' : 'success'} className="text-xs">
            {reputation.isHosting ? 'Yes' : 'No'}
          </Badge>
        </div>
      </div>

      {reputation.categories.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Categories</p>
          <div className="flex flex-wrap gap-1">
            {reputation.categories.map((cat) => (
              <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
            ))}
          </div>
        </div>
      )}

      {reputation.sources.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Sources</p>
          <div className="space-y-1">
            {reputation.sources.map((source) => (
              <div key={source.name} className="flex items-center gap-2 text-xs">
                <span className="font-medium">{source.name}</span>
                {source.score !== undefined && (
                  <Badge variant="outline" className="text-xs">{source.score}/100</Badge>
                )}
                {source.categories && source.categories.length > 0 && (
                  <span className="text-muted-foreground">{source.categories.join(', ')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getSpamBorderColor(level: SpamScore['level']): string {
  switch (level) {
    case 'critical': return 'border-l-red-500'
    case 'high': return 'border-l-orange-500'
    case 'medium': return 'border-l-yellow-500'
    case 'low': return 'border-l-blue-500'
    default: return 'border-l-green-500'
  }
}

function getSpamBadgeVariant(level: SpamScore['level']): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'phonetrace' {
  switch (level) {
    case 'critical': return 'destructive'
    case 'high': return 'destructive'
    case 'medium': return 'warning'
    case 'low': return 'info'
    default: return 'success'
  }
}

function getReputationBorderColor(level: ReputationInfo['level']): string {
  switch (level) {
    case 'malicious': return 'border-l-red-500'
    case 'suspicious': return 'border-l-yellow-500'
    default: return 'border-l-green-500'
  }
}

function getReputationBadgeVariant(level: ReputationInfo['level']): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'phonetrace' {
  switch (level) {
    case 'malicious': return 'destructive'
    case 'suspicious': return 'warning'
    default: return 'success'
  }
}

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    'Truecaller (Caller ID)': '🔍',
    'WhatsApp Direct Chat': '💬',
    WhatsApp: '💬',
    'UPI / PhonePe (@ybl)': '🟣',
    'UPI / Paytm (@paytm)': '🔵',
    'UPI / Google Pay (@okaxis)': '🟢',
    'DoT Sanchar Saathi (Fraud Check)': '🛡️',
    'National Cybercrime Portal': '🚨',
    Telegram: '✈️',
    Signal: '🔒',
    Viber: '📞',
    Facebook: '📘',
    Instagram: '📷',
    LinkedIn: '💼',
    'Twitter/X': '🐦',
  }
  return icons[platform] || '🔗'
}