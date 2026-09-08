'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Megaphone, Tv, Newspaper, Star, Building2, Smartphone,
  Play, Pause, XCircle, Plus, TrendingUp, TrendingDown,
  DollarSign, Eye, Target, BarChart3, Activity, Zap,
  Clock, ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
  Facebook
} from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

// ---- Types ----
type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
type MarketingChannel = 'SOCIAL_MEDIA' | 'FACEBOOK_ADS' | 'LOCAL_ADS' | 'INFLUENCER' | 'BILLBOARD' | 'TV_MEDIA';
type CampaignTargetSegment = 'BUDGET' | 'REGULAR' | 'PREMIUM' | 'TOURIST' | null;

interface Campaign {
  id: string;
  name: string;
  channel: MarketingChannel;
  channelName?: string;
  channelIcon?: string;
  targetSegment: CampaignTargetSegment;
  dailyBudget: number;
  totalBudget: number;
  duration: number;
  startDay: number;
  endDay: number;
  status: CampaignStatus;
  daysRun: number;
  totalSpend: number;
  totalReach: number;
  totalConversions: number;
  revenueInfluenced: number;
  effectiveness: number;
  roi?: number;
  costPerConversion?: number;
  createdAt: string;
}

interface AnalyticsData {
  brandAwareness: number;
  brandAwarenessBonus: number;
  activeCampaignsCount: number;
  totalDailySpend: number;
  combinedDemandModifier: number;
  campaignPerformance: {
    campaignId: string;
    campaignName: string;
    channel: string;
    status: CampaignStatus;
    totalSpend: number;
    totalReach: number;
    totalConversions: number;
    revenueInfluenced: number;
    roi: number;
    effectiveness: number;
    costPerConversion: number;
  }[];
  channelEffectiveness: {
    channel: string;
    channelName: string;
    totalSpend: number;
    totalReach: number;
    totalConversions: number;
    avgEffectiveness: number;
    campaignCount: number;
  }[];
  recentDailyMetrics: {
    gameDay: number;
    dailySpend: number;
    dailyReach: number;
    dailyConversions: number;
    revenueInfluenced: number;
  }[];
}

// ---- Channel Config ----
const CHANNEL_CONFIG: Record<MarketingChannel, {
  name: string;
  icon: string;
  LucideIcon: React.ComponentType<{ className?: string }>;
  description: string;
  baseDailyCost: number;
  minLevel: number;
}> = {
  SOCIAL_MEDIA: { name: 'Social Media', icon: '📱', LucideIcon: Smartphone, description: 'Low cost, moderate reach. Great for budget segment.', baseDailyCost: 500, minLevel: 1 },
  FACEBOOK_ADS: { name: 'Facebook Ads', icon: '📘', LucideIcon: Facebook, description: 'Targeted ads. Good reach with precise targeting.', baseDailyCost: 1500, minLevel: 1 },
  LOCAL_ADS: { name: 'Local Advertising', icon: '📰', LucideIcon: Newspaper, description: 'Newspaper & community ads. Reaches local customers.', baseDailyCost: 2000, minLevel: 1 },
  INFLUENCER: { name: 'Influencer', icon: '⭐', LucideIcon: Star, description: 'Hire influencers. Expensive but high impact on premium.', baseDailyCost: 5000, minLevel: 2 },
  BILLBOARD: { name: 'Billboard', icon: '🏪', LucideIcon: Building2, description: 'Physical billboards. High visibility, broad reach.', baseDailyCost: 8000, minLevel: 3 },
  TV_MEDIA: { name: 'TV/Media', icon: '📺', LucideIcon: Tv, description: 'TV & radio ads. Maximum reach, highest cost.', baseDailyCost: 20000, minLevel: 4 },
};

const TARGET_SEGMENTS: { value: CampaignTargetSegment; label: string; description: string }[] = [
  { value: null, label: 'All Segments', description: 'Target all customer segments equally' },
  { value: 'BUDGET', label: 'Budget', description: 'Price-sensitive customers' },
  { value: 'REGULAR', label: 'Regular', description: 'Mainstream customers' },
  { value: 'PREMIUM', label: 'Premium', description: 'High-spending customers' },
  { value: 'TOURIST', label: 'Tourist', description: 'Visitors and travelers' },
];

const BUDGET_TIERS = [500, 1000, 2000, 5000, 10000, 20000, 50000];
const DURATION_OPTIONS = [3, 5, 7, 10, 14, 21, 30];
const MAX_ACTIVE_CAMPAIGNS = 3;

// ---- Helpers ----
function formatTk(n: number): string {
  return `৳${n.toLocaleString()}`;
}

function statusColor(status: CampaignStatus): string {
  switch (status) {
    case 'ACTIVE': return 'bg-green-100 text-green-800 border-green-300';
    case 'PAUSED': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'COMPLETED': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'CANCELLED': return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

function roiColor(roi: number): string {
  if (roi > 0) return 'text-green-600';
  if (roi < 0) return 'text-red-600';
  return 'text-gray-500';
}

// ---- Component ----
interface MarketingViewProps {
  businessId: string;
  businessLevel?: number;
}

export default function MarketingView({ businessId, businessLevel = 1 }: MarketingViewProps) {
  // Data state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Create campaign dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    channel: 'SOCIAL_MEDIA' as MarketingChannel,
    targetSegment: null as CampaignTargetSegment,
    dailyBudget: 1000,
    duration: 7,
  });
  const [createErrors, setCreateErrors] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Action state
  const [actioningId, setActioningId] = useState<string | null>(null);

  // History expansion
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // ---- Fetch campaigns ----
  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/campaigns`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(Array.isArray(data) ? data : data.campaigns || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  // ---- Fetch analytics ----
  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${businessId}/campaigns/analytics`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.data || data);
      }
    } catch {
      // silent
    } finally {
      setAnalyticsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    setLoading(true);
    setAnalyticsLoading(true);
    fetchCampaigns();
    fetchAnalytics();
  }, [fetchCampaigns, fetchAnalytics]);

  // ---- Campaign actions ----
  const handleCampaignAction = async (campaignId: string, action: 'pause' | 'resume' | 'cancel') => {
    setActioningId(campaignId);
    try {
      const res = await fetch(`/api/businesses/${businessId}/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(`Campaign ${action}d successfully`);
        fetchCampaigns();
        fetchAnalytics();
      } else {
        const err = await res.json();
        toast.error(err.error || `Failed to ${action} campaign`);
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActioningId(null);
    }
  };

  // ---- Create campaign ----
  const handleCreateCampaign = async () => {
    setCreateErrors([]);
    const errors: string[] = [];

    if (!createForm.name.trim()) errors.push('Campaign name is required');
    if (createForm.name.trim().length > 50) errors.push('Campaign name too long (max 50 chars)');

    const channelConf = CHANNEL_CONFIG[createForm.channel];
    if (businessLevel < channelConf.minLevel) {
      errors.push(`Business level ${businessLevel} too low for ${channelConf.name} (requires level ${channelConf.minLevel})`);
    }

    const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length;
    if (activeCount >= MAX_ACTIVE_CAMPAIGNS) {
      errors.push(`Maximum ${MAX_ACTIVE_CAMPAIGNS} active campaigns allowed`);
    }

    if (errors.length > 0) {
      setCreateErrors(errors);
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          channel: createForm.channel,
          targetSegment: createForm.targetSegment,
          dailyBudget: createForm.dailyBudget,
          duration: createForm.duration,
        }),
      });
      if (res.ok) {
        toast.success('Campaign created!');
        setShowCreateDialog(false);
        setCreateForm({ name: '', channel: 'SOCIAL_MEDIA', targetSegment: null, dailyBudget: 1000, duration: 7 });
        setCreateErrors([]);
        fetchCampaigns();
        fetchAnalytics();
      } else {
        const err = await res.json();
        const msg = err.error || err.errors?.join(', ') || 'Failed to create campaign';
        toast.error(msg);
        if (err.errors) setCreateErrors(err.errors);
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCreating(false);
    }
  };

  // ---- Derived data ----
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE');
  const pausedCampaigns = campaigns.filter(c => c.status === 'PAUSED');
  const historyCampaigns = campaigns.filter(c => c.status === 'COMPLETED' || c.status === 'CANCELLED');
  const brandAwareness = analytics?.brandAwareness ?? 0;
  const brandAwarenessBonus = analytics?.brandAwarenessBonus ?? 1;
  const combinedModifier = analytics?.combinedDemandModifier ?? 1;
  const totalDailySpend = analytics?.totalDailySpend ?? activeCampaigns.reduce((s, c) => s + c.dailyBudget, 0);

  // ---- Render ----
  return (
    <div className="space-y-4">
      {/* ===== A. MARKETING OVERVIEW ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Brand Awareness */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-muted-foreground">Brand Awareness</span>
            </div>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-20 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{brandAwareness.toFixed(0)}<span className="text-sm text-muted-foreground">/100</span></div>
            )}
            <Progress value={brandAwareness} className="h-2 mt-1" />
            <p className="text-xs text-muted-foreground mt-1">Demand bonus: ×{brandAwarenessBonus.toFixed(2)}</p>
          </CardContent>
        </Card>

        {/* Active Campaigns */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-muted-foreground">Active Campaigns</span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-10" />
            ) : (
              <div className="text-2xl font-bold">{activeCampaigns.length}<span className="text-sm text-muted-foreground">/{MAX_ACTIVE_CAMPAIGNS}</span></div>
            )}
            {pausedCampaigns.length > 0 && (
              <p className="text-xs text-yellow-600 mt-1">{pausedCampaigns.length} paused</p>
            )}
          </CardContent>
        </Card>

        {/* Daily Spend */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-muted-foreground">Daily Spend</span>
            </div>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatTk(totalDailySpend)}</div>
            )}
          </CardContent>
        </Card>

        {/* Demand Boost */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-muted-foreground">Demand Boost</span>
            </div>
            {analyticsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">×{combinedModifier.toFixed(2)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {combinedModifier > 1.1 ? '↑ Significant boost' : combinedModifier > 1.0 ? '↑ Moderate boost' : 'No active boost'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ===== B. ACTIVE CAMPAIGNS ===== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" /> Active Campaigns
          </h3>
          <Button
            size="sm"
            className="gap-1 text-white text-xs"
            style={{ background: '#006a4e' }}
            onClick={() => setShowCreateDialog(true)}
            disabled={activeCampaigns.length >= MAX_ACTIVE_CAMPAIGNS}
          >
            <Plus className="h-3.5 w-3.5" /> New Campaign
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map(i => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : activeCampaigns.length === 0 && pausedCampaigns.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Megaphone className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No active campaigns</p>
              <p className="text-xs text-muted-foreground mb-3">Launch a campaign to boost customer demand</p>
              <Button size="sm" className="gap-1 text-white" style={{ background: '#006a4e' }} onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-3.5 w-3.5" /> Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...activeCampaigns, ...pausedCampaigns].map(campaign => {
              const ch = CHANNEL_CONFIG[campaign.channel];
              const IconComp = ch?.LucideIcon || Megaphone;
              const progress = campaign.duration > 0 ? Math.min(100, (campaign.daysRun / campaign.duration) * 100) : 0;
              const roi = campaign.roi ?? (campaign.totalSpend > 0 ? (campaign.revenueInfluenced - campaign.totalSpend) / campaign.totalSpend : 0);
              const eff = campaign.effectiveness ?? 0;

              return (
                <motion.div key={campaign.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50">
                            <IconComp className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{campaign.name}</p>
                            <p className="text-xs text-muted-foreground">{ch?.name || campaign.channel}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={statusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </div>

                      {/* Progress */}
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Day {campaign.daysRun} / {campaign.duration}</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Reach</p>
                          <p className="text-sm font-semibold">{campaign.totalReach.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Conversions</p>
                          <p className="text-sm font-semibold">{campaign.totalConversions.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Effectiveness</p>
                          <p className="text-sm font-semibold">{(eff * 100).toFixed(0)}%</p>
                        </div>
                      </div>

                      {/* Budget & ROI */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Daily: {formatTk(campaign.dailyBudget)}</span>
                        <span className={`font-semibold flex items-center gap-1 ${roiColor(roi)}`}>
                          ROI: {(roi * 100).toFixed(0)}%
                          {roi > 0 ? <TrendingUp className="h-3 w-3" /> : roi < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {campaign.status === 'ACTIVE' && (
                          <>
                            <Button
                              size="sm" variant="outline" className="flex-1 text-xs gap-1"
                              onClick={() => handleCampaignAction(campaign.id, 'pause')}
                              disabled={actioningId === campaign.id}
                            >
                              <Pause className="h-3 w-3" /> Pause
                            </Button>
                            <Button
                              size="sm" variant="outline" className="text-xs gap-1 text-red-600 hover:text-red-700"
                              onClick={() => handleCampaignAction(campaign.id, 'cancel')}
                              disabled={actioningId === campaign.id}
                            >
                              <XCircle className="h-3 w-3" /> Cancel
                            </Button>
                          </>
                        )}
                        {campaign.status === 'PAUSED' && (
                          <>
                            <Button
                              size="sm" variant="outline" className="flex-1 text-xs gap-1 text-green-600 hover:text-green-700"
                              onClick={() => handleCampaignAction(campaign.id, 'resume')}
                              disabled={actioningId === campaign.id}
                            >
                              <Play className="h-3 w-3" /> Resume
                            </Button>
                            <Button
                              size="sm" variant="outline" className="text-xs gap-1 text-red-600 hover:text-red-700"
                              onClick={() => handleCampaignAction(campaign.id, 'cancel')}
                              disabled={actioningId === campaign.id}
                            >
                              <XCircle className="h-3 w-3" /> Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== D. CAMPAIGN HISTORY ===== */}
      {historyCampaigns.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Campaign History
          </h3>
          <div className="space-y-2">
            {historyCampaigns.map(campaign => {
              const ch = CHANNEL_CONFIG[campaign.channel];
              const IconComp = ch?.LucideIcon || Megaphone;
              const roi = campaign.roi ?? (campaign.totalSpend > 0 ? (campaign.revenueInfluenced - campaign.totalSpend) / campaign.totalSpend : 0);
              const isExpanded = expandedHistoryId === campaign.id;

              return (
                <Card key={campaign.id}>
                  <CardContent className="p-3">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedHistoryId(isExpanded ? null : campaign.id)}
                    >
                      <div className="flex items-center gap-2">
                        <IconComp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{campaign.name}</span>
                        <Badge variant="outline" className={statusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{ch?.name}</span>
                        <span className={`text-xs font-semibold ${roiColor(roi)}`}>
                          ROI: {(roi * 100).toFixed(0)}%
                        </span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 pt-3 border-t">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">Total Spend</p>
                            <p className="text-sm font-semibold">{formatTk(campaign.totalSpend)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Reach</p>
                            <p className="text-sm font-semibold">{campaign.totalReach.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Conversions</p>
                            <p className="text-sm font-semibold">{campaign.totalConversions.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Revenue</p>
                            <p className="text-sm font-semibold">{formatTk(campaign.revenueInfluenced)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Effectiveness</p>
                            <p className="text-sm font-semibold">{((campaign.effectiveness ?? 0) * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> Ran for {campaign.daysRun} / {campaign.duration} days
                          {campaign.targetSegment && (
                            <><Separator orientation="vertical" className="h-3" /><Target className="h-3 w-3" /> {campaign.targetSegment}</>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== E. CAMPAIGN ANALYTICS ===== */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Performance Analytics
        </h3>

        {analyticsLoading ? (
          <Card><CardContent className="p-4"><Skeleton className="h-48 w-full" /></CardContent></Card>
        ) : !analytics ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No analytics data available yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Channel Effectiveness */}
            {analytics.channelEffectiveness && analytics.channelEffectiveness.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Channel Effectiveness</CardTitle>
                  <CardDescription className="text-xs">Performance by marketing channel</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2">
                    {analytics.channelEffectiveness.map(ch => {
                      const chConfig = CHANNEL_CONFIG[ch.channel as MarketingChannel];
                      const IconComp = chConfig?.LucideIcon || Megaphone;
                      return (
                        <div key={ch.channel} className="flex items-center gap-3">
                          <IconComp className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs w-28 shrink-0 truncate">{chConfig?.name || ch.channel}</span>
                          <Progress value={ch.avgEffectiveness * 100} className="h-3 flex-1" />
                          <span className="text-xs font-medium w-10 text-right">{(ch.avgEffectiveness * 100).toFixed(0)}%</span>
                          <span className="text-xs text-muted-foreground w-16 text-right">{ch.campaignCount} camp.</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Daily Metrics Trend Chart */}
            {analytics.recentDailyMetrics && analytics.recentDailyMetrics.length > 2 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Daily Performance Trend</CardTitle>
                  <CardDescription className="text-xs">Spend vs conversions over recent days</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.recentDailyMetrics}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="gameDay" tick={{ fontSize: 10 }} label={{ value: 'Day', position: 'insideBottomRight', fontSize: 10 }} />
                        <YAxis yAxisId="spend" tick={{ fontSize: 10 }} label={{ value: 'Spend (৳)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                        <YAxis yAxisId="conversions" orientation="right" tick={{ fontSize: 10 }} label={{ value: 'Conversions', angle: 90, position: 'insideRight', fontSize: 10 }} />
                        <RechartsTooltip />
                        <Line yAxisId="spend" type="monotone" dataKey="dailySpend" stroke="#f59e0b" strokeWidth={2} dot={false} name="Daily Spend" />
                        <Line yAxisId="conversions" type="monotone" dataKey="dailyConversions" stroke="#10b981" strokeWidth={2} dot={false} name="Conversions" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Campaign Performance Ranking */}
            {analytics.campaignPerformance && analytics.campaignPerformance.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Campaign Performance</CardTitle>
                  <CardDescription className="text-xs">Ranked by ROI (best first)</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {analytics.campaignPerformance.map((cp, idx) => {
                      const chConfig = CHANNEL_CONFIG[cp.channel as MarketingChannel];
                      return (
                        <div key={cp.campaignId} className="flex items-center gap-3 text-xs py-1">
                          <span className="font-mono w-5 text-muted-foreground">#{idx + 1}</span>
                          <span className="flex-1 truncate font-medium">{cp.campaignName}</span>
                          <span className="text-muted-foreground">{chConfig?.name || cp.channel}</span>
                          <span className={roiColor(cp.roi)}>{(cp.roi * 100).toFixed(0)}%</span>
                          <span className="text-muted-foreground">{(cp.effectiveness * 100).toFixed(0)}% eff</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ===== C. CREATE CAMPAIGN DIALOG ===== */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-emerald-600" /> Create Marketing Campaign
            </DialogTitle>
            <DialogDescription>
              Launch a new campaign to boost customer demand for your business.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Campaign Name */}
            <div>
              <Label className="text-xs">Campaign Name</Label>
              <Input
                className="mt-1"
                placeholder="e.g. Summer Sale Push"
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                maxLength={50}
              />
            </div>

            {/* Channel Selector */}
            <div>
              <Label className="text-xs mb-2 block">Marketing Channel</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(CHANNEL_CONFIG) as [MarketingChannel, typeof CHANNEL_CONFIG[MarketingChannel]][]).map(([key, ch]) => {
                  const IconComp = ch.LucideIcon;
                  const locked = businessLevel < ch.minLevel;
                  const selected = createForm.channel === key;

                  return (
                    <TooltipProvider key={key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => !locked && setCreateForm(f => ({ ...f, channel: key }))}
                            disabled={locked}
                            className={`p-2.5 rounded-lg border text-left transition-all ${
                              selected
                                ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                                : locked
                                  ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                  : 'border-gray-200 hover:border-emerald-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <IconComp className={`h-4 w-4 ${locked ? 'text-gray-400' : 'text-emerald-600'}`} />
                              <span className="text-xs font-semibold">{ch.name}</span>
                              {locked && <AlertCircle className="h-3 w-3 text-gray-400 ml-auto" />}
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{ch.description}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {locked ? `Requires Lv${ch.minLevel}` : `From ${formatTk(ch.baseDailyCost)}/day`}
                            </p>
                          </button>
                        </TooltipTrigger>
                        {locked && (
                          <TooltipContent>
                            <p>Requires business level {ch.minLevel}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>

            {/* Target Segment */}
            <div>
              <Label className="text-xs mb-2 block">Target Segment</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {TARGET_SEGMENTS.map(seg => (
                  <button
                    key={seg.value || 'ALL'}
                    onClick={() => setCreateForm(f => ({ ...f, targetSegment: seg.value }))}
                    className={`p-2 rounded-lg border text-center text-xs transition-all ${
                      createForm.targetSegment === seg.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                        : 'border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Budget */}
            <div>
              <Label className="text-xs mb-2 block">Daily Budget</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {BUDGET_TIERS.map(tier => (
                  <button
                    key={tier}
                    onClick={() => setCreateForm(f => ({ ...f, dailyBudget: tier }))}
                    className={`p-2 rounded-lg border text-center text-xs transition-all ${
                      createForm.dailyBudget === tier
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                        : 'border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    {formatTk(tier)}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <Label className="text-xs mb-2 block">Duration (days)</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {DURATION_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setCreateForm(f => ({ ...f, duration: d }))}
                    className={`p-2 rounded-lg border text-center text-xs transition-all ${
                      createForm.duration === d
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                        : 'border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    {d} days
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated Total */}
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Total Cost</span>
                  <span className="font-bold text-emerald-700">
                    {formatTk(createForm.dailyBudget * createForm.duration)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTk(createForm.dailyBudget)} × {createForm.duration} days
                </p>
              </CardContent>
            </Card>

            {/* Validation Errors */}
            {createErrors.length > 0 && (
              <div className="space-y-1">
                {createErrors.map((err, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              className="text-white gap-1"
              style={{ background: '#006a4e' }}
              onClick={handleCreateCampaign}
              disabled={creating || !createForm.name.trim()}
            >
              {creating ? (
                <span className="flex items-center gap-1"><Activity className="h-3.5 w-3.5 animate-spin" /> Creating...</span>
              ) : (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Create Campaign</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
