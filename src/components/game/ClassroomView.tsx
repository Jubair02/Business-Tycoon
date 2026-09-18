'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, Users, Download, Copy, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { Scenario } from '@/lib/education/scenarios';

interface Cohort {
  id: string;
  name: string;
  joinCode?: string;
  scenario: string;
  status: string;
  seats?: { limit: number; used: number; remaining: number; utilisation: number };
  objectives: { id: string; metric: string; label: string; target: number; weight: number }[];
}

interface CohortsData {
  scenarios: Scenario[];
  teaching: Cohort[];
  enrolled: Cohort[];
}

interface GradebookRow {
  userId: string;
  name: string;
  email: string;
  hasSave: boolean;
  score: number;
  objectivesMet: number;
  objectivesTotal: number;
  results: { metric: string; label: string; target: number; value: number; met: boolean }[];
}

/**
 * The education edition's one screen.
 *
 * Two audiences in one place because they are the same person often enough: an
 * instructor sets up a class here, and a student joins one. The gradebook is
 * only ever shown to whoever created the cohort.
 */
export default function ClassroomView() {
  const [data, setData] = useState<CohortsData | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newScenario, setNewScenario] = useState('STANDARD');
  const [newSeats, setNewSeats] = useState(30);
  const [busy, setBusy] = useState(false);
  const [gradebook, setGradebook] = useState<{ cohortId: string; students: GradebookRow[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/education/cohorts');
      if (res.ok) setData(await res.json());
    } catch {
      // Leave the skeleton up.
    }
  }, []);

  useEffect(() => {
    // Started off a resolved promise so nothing `load` does can write state
    // during the effect body itself — the cascading-render pattern React 19
    // flags, and the same shape used elsewhere in this codebase.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) return load();
    });
    return () => { cancelled = true; };
  }, [load]);

  const join = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/education/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? 'Could not join that class.');
        return;
      }
      toast.success(body.alreadyIn ? `You are already in ${body.cohort.name}.` : `Joined ${body.cohort.name}.`);
      setJoinCode('');
      await load();
    } catch {
      toast.error('Network error.');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/education/cohorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, scenario: newScenario, seatLimit: newSeats }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? 'Could not create that class.');
        return;
      }
      toast.success(`Class created. Code: ${body.cohort.joinCode}`);
      setNewName('');
      await load();
    } catch {
      toast.error('Network error.');
    } finally {
      setBusy(false);
    }
  };

  const openGradebook = async (cohortId: string) => {
    try {
      const res = await fetch(`/api/education/cohorts/${cohortId}/gradebook`);
      if (!res.ok) {
        toast.error('Could not load the gradebook.');
        return;
      }
      const body = await res.json();
      setGradebook({ cohortId, students: body.students });
    } catch {
      toast.error('Network error.');
    }
  };

  if (!data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 md:p-4">
      {/* ---- Join ---- */}
      <Card className="game-shine">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            Join a class
          </CardTitle>
          <CardDescription className="text-xs">
            Enter the code your instructor gave you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 px-4 pb-4">
          <Input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="ABCDEF"
            maxLength={12}
            className="uppercase"
            aria-label="Class code"
          />
          <Button onClick={join} disabled={busy || joinCode.trim().length === 0} className="shrink-0">
            Join
          </Button>
        </CardContent>
      </Card>

      {/* ---- Classes the student is in ---- */}
      {data.enrolled.length > 0 && (
        <Card className="game-shine">
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="text-sm font-semibold">Your classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            {data.enrolled.map(cohort => (
              <div key={cohort.id} className="rounded-lg border border-[var(--bt-hairline)] p-2.5">
                <p className="text-sm font-medium">{cohort.name}</p>
                <div className="mt-1.5 space-y-1">
                  {cohort.objectives.map(objective => (
                    <p key={objective.id} className="text-[11px] text-muted-foreground">
                      • {objective.label}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ---- Create ---- */}
      <Card className="game-shine">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-sm font-semibold">Run a class</CardTitle>
          <CardDescription className="text-xs">
            A scenario everyone starts from, so what one student did is comparable with the next.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="cohort-name" className="text-xs">Class name</Label>
            <Input
              id="cohort-name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="BBA 2nd year — Entrepreneurship"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Scenario</Label>
            <div className="space-y-1.5">
              {data.scenarios.map(scenario => (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => setNewScenario(scenario.id)}
                  className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                    newScenario === scenario.id
                      ? 'border-[var(--bt-emerald)] bg-green-50/70 dark:bg-green-950/30'
                      : 'border-[var(--bt-hairline)]'
                  }`}
                >
                  <p className="text-sm font-medium">{scenario.name}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{scenario.brief}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cohort-seats" className="text-xs">Seats</Label>
            <Input
              id="cohort-seats"
              type="number"
              min={1}
              max={500}
              value={newSeats}
              onChange={e => setNewSeats(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <Button
            onClick={create}
            disabled={busy || newName.trim().length < 2}
            className="w-full text-white"
            style={{ background: '#006a4e' }}
          >
            Create class
          </Button>
        </CardContent>
      </Card>

      {/* ---- Classes the instructor runs ---- */}
      {data.teaching.map(cohort => (
        <Card key={cohort.id} className="game-shine">
          <CardHeader className="px-4 pb-2 pt-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm font-semibold">{cohort.name}</CardTitle>
                <CardDescription className="text-xs">
                  Code <span className="bt-numeric font-bold tracking-widest">{cohort.joinCode}</span>
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 px-2"
                aria-label="Copy class code"
                onClick={() => {
                  navigator.clipboard?.writeText(cohort.joinCode ?? '').then(
                    () => toast.success('Code copied.'),
                    () => toast.error('Could not copy.'),
                  );
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 px-4 pb-4">
            {cohort.seats && (
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    Seats
                  </span>
                  <span className="bt-numeric font-semibold">
                    {cohort.seats.used} / {cohort.seats.limit}
                  </span>
                </div>
                <Progress value={cohort.seats.utilisation * 100} className="mt-1.5 h-1" />
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => openGradebook(cohort.id)}>
                <ClipboardCheck className="h-3.5 w-3.5" />
                Gradebook
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" asChild>
                <a href={`/api/education/cohorts/${cohort.id}/gradebook?format=csv`}>
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </a>
              </Button>
            </div>

            {gradebook?.cohortId === cohort.id && (
              <div className="space-y-1.5">
                {gradebook.students.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nobody has joined yet.</p>
                )}
                {gradebook.students.map(student => (
                  <div
                    key={student.userId}
                    className="flex items-center gap-2.5 rounded-lg border border-[var(--bt-hairline)] p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{student.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {student.hasSave
                          ? `${student.objectivesMet}/${student.objectivesTotal} objectives met`
                          : 'Has not started'}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`bt-numeric shrink-0 rounded-full px-2 text-xs font-bold ${
                        student.score >= 60 ? 'bt-tone bt-tone-emerald' : ''
                      }`}
                    >
                      {student.score}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
