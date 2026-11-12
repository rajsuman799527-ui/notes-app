/* eslint-disable @typescript-eslint/no-explicit-any */
const call = (name: string) => async (input: any): Promise<any> => {
  const r = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'Request failed');
  return d;
};

export const chatHome = call('chatHome');
export const getHeadMoves = call('getHeadMoves');
export const getMessages = call('getMessages');
export const messageAction = call('messageAction');
export const panic = call('panic');
export const partnerAction = call('partnerAction');
export const register = call('register');
export const saveHeadMoves = call('saveHeadMoves');
export const sendMessage = call('sendMessage');
export const unlock = call('unlock');
export const updateProfile = call('updateProfile');

export type ChatHomeOutputType = any;
export type GetMessagesOutputType = any;
export type PartnerActionInputType = any;
