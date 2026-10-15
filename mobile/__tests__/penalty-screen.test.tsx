import React from 'react';
import { Animated } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PenaltyShootout } from '../src/features/games/ui/PenaltyShootout';
import type { GamesService } from '../src/features/games/application/games-service';
import type {
  GameState,
  PenaltyMatch,
} from '../src/features/games/domain/models';
import { copy } from '../src/shared/lib/copy';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  ArrowUpRight: () => null,
  Check: () => null,
  Clock3: () => null,
  Heart: () => null,
  Shield: () => null,
  Trophy: () => null,
}));

const text = copy.games.penalty;
const id = 'a'.repeat(32);
const base: GameState = {
  hearts: 2,
  maxHearts: 3,
  nextHeartAt: '2026-10-12T13:00:00Z',
  serverTime: '2026-10-12T10:00:00Z',
  rewardEligible: true,
  stats: { played: 0, wins: 0, bestScore: 0, earnedCredits: 0 },
  run: null,
  penalty: null,
};
const active: PenaltyMatch = {
  id,
  status: 'active',
  kicks: [],
  goals: { user: 0, cpu: 0 },
  winner: null,
  rewardGranted: false,
  nextRole: 'shooter',
};

function fakeService(responses: { state: GameState; kick?: GameState }) {
  const calls: (string | number)[][] = [];
  const service = {
    state: async () => responses.state,
    penaltyStart: async () => {
      calls.push(['start']);
      return { ...base, hearts: 1, penalty: active };
    },
    penaltyKick: async (...args: unknown[]) => {
      calls.push(['kick', ...(args as (string | number)[])]);
      return responses.kick!;
    },
  } as unknown as GamesService;
  return { service, calls };
}

function press(root: ReactTestRenderer, label: string) {
  const node = root.root.findAll(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel === label,
  )[0];
  return act(async () => {
    await node.props.onPress();
  });
}

function texts(root: ReactTestRenderer) {
  return root.root
    .findAll(n => typeof n.props.children === 'string')
    .map(n => n.props.children as string);
}

async function mount(service: GamesService) {
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(
      <PenaltyShootout service={service} token="t" onBack={() => {}} />,
    );
  });
  return root;
}

describe('PenaltyShootout screen', () => {
  beforeEach(() => {
    // Keep the motion out of the test; the assertions cover the server flow.
    jest.spyOn(Animated, 'timing').mockReturnValue({
      start: jest.fn(),
    } as unknown as Animated.CompositeAnimation);
  });

  it('starts a match, sends the kick and reveals the server result', async () => {
    const kicked = {
      ...base,
      penalty: {
        ...active,
        kicks: [
          {
            role: 'shooter' as const,
            userSide: 'left' as const,
            cpuSide: 'right' as const,
            scored: true,
          },
        ],
        goals: { user: 1, cpu: 0 },
        nextRole: 'keeper' as const,
      },
    };
    const { service, calls } = fakeService({ state: base, kick: kicked });
    const root = await mount(service);
    expect(texts(root)).toContain(text.play);

    await press(root, text.play);
    expect(texts(root)).toContain(text.shooterPrompt);

    await press(root, text.sides.left);
    expect(calls[calls.length - 1]).toEqual(['kick', 't', id, 0, 'left']);
    expect(texts(root)).toContain(text.goal);
    expect(texts(root)).toContain(text.next);
  });
});
