// Ports of DailySummaryTests, DailySummaryHeadlineTests, DailySummarySnapshotTests and the decode /
// encode halves of FirebaseDailySummaryGeneratorTests.
import { describe, expect, it } from 'vitest';

import type { CompletedFocusSession, Log, Task } from '@/domain/types';

import {
  DAILY_SUMMARY_SNAPSHOT_VERSION,
  DAILY_SUMMARY_TONES,
  DailySummaryEndpointError,
  UNASSIGNED_LIFE_AREA_NAME,
  buildDailySummaryRequest,
  dailySummaryCopyText,
  dailySummaryHeadline,
  dailySummaryRequestBody,
  decodeDailySummaryResponse,
  hasSomethingToSummarise,
  parseDailySummarySnapshot,
  serializeDailySummarySnapshot,
  snapshotBelongsTo,
  snapshotSummaryOn,
  sourceLabel,
  stubDailySummary,
  toneLabel,
  type DailySummaryContent,
  type DailySummarySnapshot,
  type DailySummaryTone,
  type GeneratedDailySummary,
} from '.';

const now = new Date(1_787_000_000_000);
const yesterday = new Date(now.getTime() - 86_400_000);

let seq = 0;
function task(
  title: string,
  status: Task['status'],
  completedAt?: Date,
  extra: Partial<Task> = {},
): Task {
  seq += 1;
  return {
    id: `T${seq}`,
    title,
    status,
    priority: 'p2',
    ...(completedAt ? { completedAt } : {}),
    ...extra,
  };
}

function session(focusedSeconds: number, endedAt: Date): CompletedFocusSession {
  return {
    id: `S${focusedSeconds}-${endedAt.getTime()}`,
    taskTitle: 'sprint',
    lifeAreaEmoji: '🎯',
    plannedSeconds: focusedSeconds,
    focusedSeconds,
    checkpointsReached: 0,
    completedNaturally: true,
    startedAt: new Date(endedAt.getTime() - focusedSeconds * 1000),
    endedAt,
  };
}

function log(body: string, extra: Partial<Log> = {}): Log {
  return {
    id: `L-${body}`,
    type: 'journal',
    body,
    entryDate: now,
    createdAt: now,
    ...extra,
  };
}

function makeRequest(
  opts: {
    tone?: DailySummaryTone;
    tasks?: Task[];
    sessions?: CompletedFocusSession[];
    journal?: Log[];
    captures?: number;
    names?: Record<string, string>;
  } = {},
) {
  return buildDailySummaryRequest({
    date: now,
    tone: opts.tone ?? 'energizing',
    tasks: opts.tasks ?? [],
    focusSessions: opts.sessions ?? [],
    journalEntries: opts.journal ?? [],
    capturesCount: opts.captures ?? 0,
    lifeAreaNames: new Map(Object.entries(opts.names ?? {})),
  });
}

const sample: DailySummaryContent = {
  headline: 'A good day',
  dopamineWins: ['shipped the thing'],
  journalReflections: 'You felt steady.',
  focusStaminaInsight: '26 minutes of focused work.',
  gentleTomorrowKickstart: ['start small'],
};

describe('tones', () => {
  it('every tone has a distinct label', () => {
    expect(new Set(DAILY_SUMMARY_TONES.map(toneLabel)).size).toBe(DAILY_SUMMARY_TONES.length);
    expect(DAILY_SUMMARY_TONES.map(toneLabel)).toEqual([
      'Energizing',
      'Gentle',
      'Coaching',
      'Bulleted',
    ]);
  });

  it('the wire values match the iOS raw values', () => {
    expect(DAILY_SUMMARY_TONES).toEqual(['energizing', 'gentle', 'coaching', 'bulleted']);
  });

  it('the sources are labelled as the phone labels them', () => {
    expect(sourceLabel('model')).toBe('Claude');
    expect(sourceLabel('localSynthesis')).toBe('On-device synthesis');
  });
});

describe('the request', () => {
  it('carries only today’s completed tasks', () => {
    const request = makeRequest({
      tasks: [
        task('shipped it', 'done', now),
        task("yesterday's", 'done', yesterday),
        task('still open', 'open'),
      ],
    });
    expect(request.completedTasks.map((t) => t.title)).toEqual(['shipped it']);
  });

  it('carries open tasks as in progress, capped at five', () => {
    const request = makeRequest({
      tasks: Array.from({ length: 8 }, (_, i) => task(`open ${i + 1}`, 'open')),
    });
    expect(request.inProgressTasks).toHaveLength(5);
    expect(request.inProgressTasks[0]?.title).toBe('open 1');
  });

  it('focus minutes sum today’s sessions only, floored on the total', () => {
    const request = makeRequest({
      sessions: [session(1_500, now), session(90, now), session(3_600, yesterday)],
    });
    expect(request.focusMinutesTotal).toBe(26);
  });

  it('resolves life area names and falls back to General for unassigned', () => {
    const request = makeRequest({
      tasks: [task('in an area', 'done', now, { lifeAreaId: 'A' }), task('no area', 'done', now)],
      names: { A: 'Health' },
    });
    expect(new Set(request.completedTasks.map((t) => t.lifeAreaName))).toEqual(
      new Set(['Health', UNASSIGNED_LIFE_AREA_NAME]),
    );
    expect(UNASSIGNED_LIFE_AREA_NAME).toBe('General');
  });

  it('a completed task carries its priority and planned focus minutes', () => {
    const request = makeRequest({
      tasks: [task('planned', 'done', now, { priority: 'p1', focusDurationSeconds: 1_530 })],
    });
    expect(request.completedTasks[0]).toEqual({
      title: 'planned',
      lifeAreaName: 'General',
      priority: 'p1',
      focusMinutesLogged: 25,
    });
  });

  it('journal entries are journal-type logs dated today, energy and mood only when present', () => {
    const request = makeRequest({
      journal: [
        log('today', { energyLevel: 'high', moodEmoji: '🙂', lifeAreaId: 'A' }),
        log('plain'),
        log('old', { entryDate: yesterday }),
        log('a plain log', { type: 'log' }),
      ],
      names: { A: 'Work' },
    });
    expect(request.journalEntries).toEqual([
      { body: 'today', lifeAreaName: 'Work', energyLevel: 'high', moodEmoji: '🙂' },
      { body: 'plain', lifeAreaName: 'General' },
    ]);
  });

  it('the JSON body is camelCase with an ISO-8601 UTC date', () => {
    const body = JSON.parse(
      dailySummaryRequestBody(makeRequest({ tasks: [task('done', 'done', now)] })),
    ) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      [
        'capturesCount',
        'completedTasks',
        'date',
        'focusMinutesTotal',
        'inProgressTasks',
        'journalEntries',
        'tone',
      ].sort(),
    );
    expect(body['date']).toBe(now.toISOString());
    expect(String(body['date'])).toMatch(/T.*Z$/);
  });

  it('knows whether there is anything worth summarising', () => {
    expect(hasSomethingToSummarise(makeRequest())).toBe(false);
    expect(hasSomethingToSummarise(makeRequest({ captures: 1 }))).toBe(true);
    expect(hasSomethingToSummarise(makeRequest({ sessions: [session(60, now)] }))).toBe(true);
    expect(hasSomethingToSummarise(makeRequest({ journal: [log('x')] }))).toBe(true);
    expect(hasSomethingToSummarise(makeRequest({ tasks: [task('d', 'done', now)] }))).toBe(true);
  });
});

describe('copy text', () => {
  it('contains every section in order, with bullets', () => {
    const text = dailySummaryCopyText(sample, now);
    const fragments = [
      'Daily Summary',
      'A good day',
      'Dopamine Wins',
      '• shipped the thing',
      'Reflections',
      'felt steady',
      'Focus & Stamina',
      '26 minutes',
      "Tomorrow's Kickstart",
      '• start small',
    ];
    let from = 0;
    for (const fragment of fragments) {
      const at = text.indexOf(fragment, from);
      expect(at, fragment).toBeGreaterThanOrEqual(0);
      from = at;
    }
    expect(text.startsWith('✨ ADHD LifeOS Daily Summary (')).toBe(true);
  });

  it('omits empty list sections', () => {
    const text = dailySummaryCopyText(
      {
        headline: 'Quiet day',
        dopamineWins: [],
        journalReflections: 'Nothing logged.',
        focusStaminaInsight: 'No sprints yet.',
        gentleTomorrowKickstart: [],
      },
      now,
    );
    expect(text).not.toContain('Dopamine Wins');
    expect(text).not.toContain('Tomorrow');
    expect(text).toContain('Quiet day');
  });
});

describe('on-device synthesis (the stub generator)', () => {
  it('is deterministic for the same request', () => {
    const request = makeRequest({ tasks: [task('ship it', 'done', now)] });
    expect(stubDailySummary(request)).toEqual(stubDailySummary(request));
  });

  it('names real completed work', () => {
    const content = stubDailySummary(
      makeRequest({ tasks: [task('ship the capture fix', 'done', now)] }),
    );
    expect(content.dopamineWins.some((w) => w.includes('ship the capture fix'))).toBe(true);
  });

  it('handles an empty day without inventing wins', () => {
    const content = stubDailySummary(makeRequest());
    expect(content.dopamineWins).toEqual([]);
    expect(content.headline).not.toBe('');
    expect(content.gentleTomorrowKickstart.length).toBeGreaterThan(0);
  });

  it('varies the headline by tone', () => {
    const headlines = new Set(
      DAILY_SUMMARY_TONES.map((tone) => stubDailySummary(makeRequest({ tone })).headline),
    );
    expect(headlines.size).toBe(DAILY_SUMMARY_TONES.length);
  });

  it('the bulleted tone produces list-shaped output', () => {
    const content = stubDailySummary(
      makeRequest({ tone: 'bulleted', tasks: [task('a', 'done', now), task('b', 'done', now)] }),
    );
    expect(content.dopamineWins.length).toBeGreaterThanOrEqual(2);
    expect(content.dopamineWins[0]).toBe('a (General)');
  });

  it('keeps the iOS copy verbatim', () => {
    const busy = makeRequest({
      tasks: [task('Draft', 'done', now), task('Next up', 'open')],
      sessions: [session(60, now)],
      journal: [log('x', { energyLevel: 'low' }), log('y')],
      captures: 2,
    });
    expect(stubDailySummary(busy)).toEqual({
      headline: '1 finished today — that momentum is real.',
      dopamineWins: ['Shipped: Draft.'],
      journalReflections: '2 entries written today, energy running low.',
      focusStaminaInsight: '1 minute of focused work today.',
      gentleTomorrowKickstart: [
        'Start with Next up — smallest possible first move.',
        'Triage 2 captures waiting in the inbox.',
      ],
    });
    const quiet = makeRequest({ tone: 'gentle' });
    expect(stubDailySummary(quiet)).toEqual({
      headline: 'A quiet day so far, and that is allowed.',
      dopamineWins: [],
      journalReflections: 'No journal entries today — nothing to reflect back yet.',
      focusStaminaInsight: 'No focus sprints logged today — even five minutes would count.',
      gentleTomorrowKickstart: ['Add one small task tonight so tomorrow starts with a target.'],
    });
    expect(stubDailySummary(makeRequest({ tone: 'coaching', journal: [log('z')] }))).toMatchObject({
      headline: 'No completions yet — pick the smallest open loop and start there.',
      journalReflections: '1 entry written today.',
    });
    expect(
      stubDailySummary(
        makeRequest({ tone: 'bulleted', captures: 1, sessions: [session(600, now)] }),
      ),
    ).toMatchObject({
      headline: 'Today: nothing completed yet, 10m focused.',
      gentleTomorrowKickstart: ['Triage 1 capture waiting in the inbox.'],
    });
    const done = (tone: DailySummaryTone) =>
      stubDailySummary(makeRequest({ tone, tasks: [task('X', 'done', now)] }));
    expect(done('gentle')).toMatchObject({
      headline: 'You closed 1 today. That was enough.',
      dopamineWins: ['You finished X.'],
    });
    expect(done('coaching')).toMatchObject({
      headline: '1 done. Name the next one and you keep the streak.',
      dopamineWins: ['X — done, in General.'],
    });
    expect(done('bulleted').headline).toBe('Today: 1 completed, 0m focused.');
    expect(stubDailySummary(makeRequest()).headline).toBe(
      'Nothing finished yet, and the day is still yours.',
    );
  });
});

describe('the Today’s Highlight line (DailySummaryHeadline)', () => {
  it('due nudges take priority, singular and plural', () => {
    expect(dailySummaryHeadline({ openTasks: 5, lifeAreas: 3, inbox: 4, dueNudges: 2 })).toBe(
      '2 nudges are due — a tiny step right now counts.',
    );
    expect(dailySummaryHeadline({ openTasks: 0, lifeAreas: 0, inbox: 0, dueNudges: 1 })).toBe(
      '1 nudge is due — a tiny step right now counts.',
    );
  });

  it('the inbox beats open tasks', () => {
    expect(dailySummaryHeadline({ openTasks: 5, lifeAreas: 3, inbox: 3, dueNudges: 0 })).toBe(
      '3 ideas captured — triage one to clear your head.',
    );
    expect(dailySummaryHeadline({ openTasks: 0, lifeAreas: 0, inbox: 1, dueNudges: 0 })).toBe(
      '1 idea captured — triage it to clear your head.',
    );
  });

  it('a clean slate, then the general open-tasks line', () => {
    expect(dailySummaryHeadline({ openTasks: 0, lifeAreas: 6, inbox: 0, dueNudges: 0 })).toBe(
      'A clean slate today. Add one small task to build momentum.',
    );
    expect(dailySummaryHeadline({ openTasks: 7, lifeAreas: 4, inbox: 0, dueNudges: 0 })).toBe(
      '7 open tasks across 4 areas — start with the smallest one.',
    );
    expect(dailySummaryHeadline({ openTasks: 1, lifeAreas: 1, inbox: 0, dueNudges: 0 })).toBe(
      '1 open task across 1 area — start with the smallest one.',
    );
  });
});

describe('the endpoint response', () => {
  it('a successful envelope decodes to content', () => {
    const content = decodeDailySummaryResponse(
      200,
      JSON.stringify({
        success: true,
        source: 'claude',
        summary: {
          headline: 'One finished today.',
          dopamineWins: ['Shipped the fix.'],
          journalReflections: 'You noted feeling scattered.',
          focusStaminaInsight: '26 minutes of focus.',
          gentleTomorrowKickstart: ['Start small.'],
        },
      }),
    );
    expect(content.headline).toBe('One finished today.');
    expect(content.dopamineWins).toEqual(['Shipped the fix.']);
    expect(content.gentleTomorrowKickstart).toEqual(['Start small.']);
  });

  function thrown(status: number, body: string): DailySummaryEndpointError {
    try {
      decodeDailySummaryResponse(status, body);
    } catch (error) {
      expect(error).toBeInstanceOf(DailySummaryEndpointError);
      return error as DailySummaryEndpointError;
    }
    throw new Error(`accepted ${status} ${body}`);
  }

  it('unauthorized is distinct from other server errors', () => {
    const error = thrown(401, '{"error":"unauthorized"}');
    expect(error.kind).toBe('unauthorized');
    expect(error.message).toBe('Your session expired. Sign out and back in, then try again.');
  });

  it('a server error message is surfaced verbatim', () => {
    const error = thrown(502, '{"error":"the model declined to write this summary"}');
    expect(error.kind).toBe('server');
    expect(error.message).toBe('the model declined to write this summary');
  });

  it('an error status with no body still produces a readable message', () => {
    expect(thrown(500, '').message).toBe('The summary service returned an error (500).');
  });

  it('a malformed success body is rejected', () => {
    for (const body of [
      '',
      '{}',
      '{"success":true}',
      '{"success":false,"summary":null}',
      'not json',
      '<!doctype html>',
    ]) {
      const error = thrown(200, body);
      expect(error.kind, body).toBe('badResponse');
      expect(error.message).toBe("The summary came back in a shape the app couldn't read.");
    }
  });

  it('a summary missing a field is rejected rather than half-rendered', () => {
    const error = thrown(
      200,
      JSON.stringify({ success: true, summary: { headline: 'x', dopamineWins: [] } }),
    );
    expect(error.kind).toBe('badResponse');
  });

  it('every error kind has a readable description', () => {
    for (const kind of ['notSignedIn', 'notConfigured', 'unauthorized', 'badResponse'] as const) {
      expect(new DailySummaryEndpointError(kind).message).not.toBe('');
    }
    expect(new DailySummaryEndpointError('server', 'x').message).toBe('x');
  });
});

describe('the remembered snapshot', () => {
  const monday = now;
  function summary(generatedAt: Date): GeneratedDailySummary {
    return {
      content: {
        headline: 'Three finished today.',
        dopamineWins: ['Shipped the capture fix.'],
        journalReflections: '1 entry written today.',
        focusStaminaInsight: '42 minutes of focused work today.',
        gentleTomorrowKickstart: ['Start with the smallest one.'],
      },
      tone: 'coaching',
      generatedAt,
      source: 'model',
    };
  }
  function snapshot(userId: string | null = 'uid-1', generatedAt?: Date): DailySummarySnapshot {
    return {
      version: DAILY_SUMMARY_SNAPSHOT_VERSION,
      userId,
      tone: 'coaching',
      summary: generatedAt ? summary(generatedAt) : null,
    };
  }

  it('round-trips every field, with dates as dates', () => {
    const original = snapshot('uid-1', monday);
    const back = parseDailySummarySnapshot(serializeDailySummarySnapshot(original));
    expect(back).toEqual(original);
    expect(back?.summary?.generatedAt).toBeInstanceOf(Date);
  });

  it('belongs only to the account that wrote it', () => {
    expect(snapshotBelongsTo(snapshot('uid-1'), 'uid-1')).toBe(true);
    expect(snapshotBelongsTo(snapshot('uid-1'), 'uid-2')).toBe(false);
    expect(snapshotBelongsTo(snapshot(null), 'uid-1')).toBe(false);
    expect(snapshotBelongsTo(snapshot(null), null)).toBe(false);
    expect(snapshotBelongsTo(snapshot('uid-1'), null)).toBe(false);
  });

  it('a summary is readable later the same day, not the next', () => {
    const s = snapshot('uid-1', monday);
    expect(snapshotSummaryOn(s, new Date(monday.getTime() + 600_000))?.generatedAt).toEqual(monday);
    expect(snapshotSummaryOn(s, new Date(monday.getTime() + 86_400_000))).toBeNull();
    expect(snapshotSummaryOn(snapshot('uid-1'), monday)).toBeNull();
  });

  it('refuses an unknown version, corrupt data, an unknown tone or nothing at all', () => {
    const raw = JSON.parse(serializeDailySummarySnapshot(snapshot('uid-1', monday))) as Record<
      string,
      unknown
    >;
    expect(
      parseDailySummarySnapshot(
        JSON.stringify({ ...raw, version: DAILY_SUMMARY_SNAPSHOT_VERSION + 1 }),
      ),
    ).toBeNull();
    expect(parseDailySummarySnapshot('not json')).toBeNull();
    expect(parseDailySummarySnapshot(JSON.stringify({ ...raw, tone: 'shouty' }))).toBeNull();
    expect(parseDailySummarySnapshot(null)).toBeNull();
  });
});
