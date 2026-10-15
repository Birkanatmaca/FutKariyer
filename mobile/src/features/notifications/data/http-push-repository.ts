import { request } from '../../../shared/api/client';
import type { PushRepository } from '../domain/push';

export const pushRepository: PushRepository = {
  async register(token, device) {
    await request<void>('/v1/me/push-devices', {
      method: 'PUT',
      token,
      body: device,
    });
  },
};
