import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { request } from '../src/shared/api/client';
import {
  createStoreCheckout,
  StoreUnavailableError,
} from '../src/features/payments/application/store-checkout';
import {
  validPurchaseResult,
  validStoreOrder,
} from '../src/features/payments/data/http-store-repository';
import type {
  StoreBilling,
  StorePurchase,
  StoreRepository,
} from '../src/features/payments/domain/store';
import { TeamRightsScreen } from '../src/features/payments/ui/TeamRightsScreen';
import type { StoreCheckout } from '../src/features/payments';
import { copy } from '../src/shared/lib/copy';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('../src/shared/ui/Floodlight', () => ({ Floodlight: () => null }));
jest.mock(
  'lucide-react-native',
  () =>
    new Proxy(
      {},
      { get: (_target, name) => (name === '__esModule' ? false : () => null) },
    ),
);

beforeEach(() => jest.clearAllMocks());

const orderId = 'a'.repeat(32);
const order = {
  orderId,
  store: 'app_store' as const,
  productId: 'com.futcareer.rights.2',
  accountToken: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
};
const purchase: StorePurchase = {
  store: 'app_store',
  productId: 'com.futcareer.rights.2',
  token: 'signed-transaction',
  native: {},
};

function setup(over: Partial<StoreBilling> = {}, finish = true) {
  const repository: jest.Mocked<StoreRepository> = {
    createOrder: jest.fn().mockResolvedValue(order),
    confirm: jest
      .fn()
      .mockResolvedValue({
        orderId,
        status: finish ? 'paid' : 'pending',
        finish,
      }),
  };
  const billing: StoreBilling = {
    store: 'app_store',
    prices: jest.fn().mockResolvedValue({}),
    purchase: jest.fn().mockResolvedValue(purchase),
    finish: jest.fn().mockResolvedValue(undefined),
    unfinished: jest.fn().mockResolvedValue([]),
    ...over,
  };
  return {
    repository,
    billing,
    checkout: createStoreCheckout(repository, billing),
  };
}

describe('store checkout', () => {
  it('orders, buys, verifies and only then finishes the transaction', async () => {
    const { repository, billing, checkout } = setup();
    await expect(
      checkout.buy('session', 'team_rights', 'b'.repeat(32)),
    ).resolves.toBe('paid');
    expect(repository.createOrder).toHaveBeenCalledWith('session', {
      store: 'app_store',
      product: 'team_rights',
      itemId: 'b'.repeat(32),
    });
    expect(billing.purchase).toHaveBeenCalledWith(order);
    expect(repository.confirm).toHaveBeenCalledWith('session', purchase);
    expect(billing.finish).toHaveBeenCalledWith(purchase);
  });

  it('keeps the transaction when the server is not ready to finish it', async () => {
    const { billing, checkout } = setup({}, false);
    await expect(checkout.buy('session', 'pro', 'b'.repeat(32))).resolves.toBe(
      'pending',
    );
    expect(billing.finish).not.toHaveBeenCalled();
  });

  it('reports cancelled and deferred store sheets without verifying', async () => {
    let { repository, checkout } = setup({
      purchase: jest.fn().mockResolvedValue(null),
    });
    await expect(checkout.buy('s', 'pro', 'b'.repeat(32))).resolves.toBe(
      'cancelled',
    );
    expect(repository.confirm).not.toHaveBeenCalled();
    ({ repository, checkout } = setup({
      purchase: jest.fn().mockResolvedValue('pending'),
    }));
    await expect(checkout.buy('s', 'pro', 'b'.repeat(32))).resolves.toBe(
      'pending',
    );
    expect(repository.confirm).not.toHaveBeenCalled();
  });

  it('cannot buy where there is no store', async () => {
    const { repository, checkout } = setup({ store: null });
    await expect(
      checkout.buy('s', 'pro', 'b'.repeat(32)),
    ).rejects.toBeInstanceOf(StoreUnavailableError);
    expect(repository.createOrder).not.toHaveBeenCalled();
  });

  it('recovers unfinished purchases one by one and survives failures', async () => {
    const second = { ...purchase, token: 'second' };
    const { repository, billing, checkout } = setup({
      unfinished: jest.fn().mockResolvedValue([purchase, second]),
    });
    repository.confirm
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ orderId, status: 'paid', finish: true });
    await checkout.recover('session');
    expect(repository.confirm).toHaveBeenCalledTimes(2);
    expect(billing.finish).toHaveBeenCalledTimes(1);
    expect(billing.finish).toHaveBeenCalledWith(second);
  });
});

test('store responses are validated', () => {
  expect(validStoreOrder(order)).toBe(true);
  expect(validStoreOrder({ ...order, accountToken: 'b'.repeat(32) })).toBe(
    false,
  );
  expect(validStoreOrder({ ...order, store: 'web' })).toBe(false);
  expect(validPurchaseResult({ orderId, status: 'paid', finish: true })).toBe(
    true,
  );
  expect(validPurchaseResult({ orderId, status: 'ok', finish: true })).toBe(
    false,
  );
});

describe('TeamRightsScreen', () => {
  const catalog = (stores = { appStore: true, googlePlay: false }) => ({
    items: [
      {
        id: '0'.repeat(31) + '2',
        credits: 2,
        amountMinor: 10000,
        currency: 'TRY',
        active: true,
        sortOrder: 1,
        appleProductId: 'com.futcareer.rights.2',
        googleProductId: 'com.futcareer.rights.2',
      },
    ],
    checkoutEnabled: false,
    stores,
  });
  function storeCheckout(): StoreCheckout {
    return {
      store: 'app_store',
      prices: jest
        .fn()
        .mockResolvedValue({ 'com.futcareer.rights.2': '₺99,99' }),
      buy: jest.fn().mockResolvedValue('paid'),
      recover: jest.fn(),
    };
  }
  async function render(checkout: StoreCheckout) {
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(
        <TeamRightsScreen
          token="session"
          checkout={checkout}
          onBack={jest.fn()}
        />,
      );
    });
    return root;
  }
  const texts = (root: ReactTestRenderer) =>
    root.root.findAllByType(Text).map(node => node.props.children);

  it('shows the store price and buys through the store', async () => {
    jest.mocked(request).mockResolvedValue(catalog());
    const checkout = storeCheckout();
    const root = await render(checkout);
    expect(texts(root)).toContain('₺99,99');
    const button = root.root.find(
      node =>
        node.props.accessibilityLabel ===
          copy.payments.rights(2) + ', ₺99,99' && node.props.onPress,
    );
    await act(async () => button.props.onPress());
    expect(checkout.buy).toHaveBeenCalledWith(
      'session',
      'team_rights',
      '0'.repeat(31) + '2',
    );
    expect(texts(root)).toContain(copy.payments.purchased);
  });

  it('disables buying when the server has no verifier for this store', async () => {
    jest
      .mocked(request)
      .mockResolvedValue(catalog({ appStore: false, googlePlay: true }));
    const checkout = storeCheckout();
    const root = await render(checkout);
    expect(checkout.prices).not.toHaveBeenCalled();
    expect(texts(root)).toContain(copy.payments.unavailable);
  });
});
