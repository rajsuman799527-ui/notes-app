/* eslint-disable @typescript-eslint/no-explicit-any */
type DB = any;
type In = Record<string, any>;

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOKEN_ALPHA = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const NOW = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function rand(len: number, alphabet = ALPHA) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}
const normUid = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const cleanText = (s: string, max = 4000) =>
  (s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const pairKey = (a: string, b: string) => [a, b].sort().join(':');
const otherUid = (p: any, me: string) => (p.userA === me ? p.userB : p.userA);
const listHas = (l: string | null, uid: string) => (l || '').split(',').includes(uid);
const listToggle = (l: string | null, uid: string, on: boolean) => {
  const set = new Set((l || '').split(',').filter(Boolean));
  if (on) set.add(uid); else set.delete(uid);
  return [...set].join(',');
};
const ph = (n: number) => Array(n).fill('?').join(',');

const first = (db: DB, sql: string, ...p: any[]) => db.prepare(sql).bind(...p).first();
const rows = async (db: DB, sql: string, ...p: any[]): Promise<any[]> => (await db.prepare(sql).bind(...p).all()).results || [];
const exec = (db: DB, sql: string, ...p: any[]) => db.prepare(sql).bind(...p).run();
const batch = async (db: DB, stmts: any[]) => { for (let k = 0; k < stmts.length; k += 50) await db.batch(stmts.slice(k, k + 50)); };

async function requireUser(db: DB, token: string) {
  if (!token || token.length < 20) throw new Error('Not available');
  const u = await first(db, 'SELECT * FROM chatUsers WHERE tokenHash=?', await sha256(token));
  if (!u) throw new Error('Not available');
  return u;
}
async function requireChat(db: DB, id: string, uid: string) {
  const p = await first(db, 'SELECT * FROM partnerships WHERE id=?', id || '');
  if (!p || (p.userA !== uid && p.userB !== uid)) throw new Error('Not available');
  return p;
}
const myPartnerships = (db: DB, uid: string) => rows(db, 'SELECT * FROM partnerships WHERE userA=? OR userB=?', uid, uid);

function isOnline(u: any) {
  if (!u || u.hideStatus) return false;
  if (u.presence !== 'active' || !u.lastActive) return false;
  return Date.now() - new Date(u.lastActive).getTime() < 30000;
}
function statusOf(u: any, chatId?: string) {
  if (!u) return 'none';
  if (u.presence === 'away' && u.lastPanicAt) return 'busy';
  if (u.hideStatus) return 'none';
  if (chatId && u.typingChat === chatId && u.typingUntil && new Date(u.typingUntil).getTime() > Date.now()) return 'typing';
  return isOnline(u) ? 'online' : 'none';
}

const handlers: Record<string, (db: DB, i: In) => Promise<any>> = {
  async register(db, i) {
    if (!/^\d{2}$/.test(i.code || '')) throw new Error('Invalid number');
    let uid = '';
    for (let k = 0; k < 5; k++) {
      const r = rand(8);
      uid = `${r.slice(0, 4)}-${r.slice(4)}`;
      if (!(await first(db, 'SELECT id FROM chatUsers WHERE uid=?', uid))) break;
    }
    const token = rand(40, TOKEN_ALPHA);
    const salt = rand(16);
    await exec(db,
      `INSERT INTO chatUsers (id,uid,displayName,tokenHash,codeHash,salt,presence,lastActive,hideStatus,failedAttempts) VALUES (?,?,?,?,?,?,?,?,0,0)`,
      uuid(), uid, cleanText(i.displayName || 'Me', 40) || 'Me', await sha256(token), await sha256(`${salt}:${i.code}`), salt, 'away', NOW());
    return { uid, token };
  },

  async unlock(db, i) {
    const u = await requireUser(db, i.token);
    const now = Date.now();
    if (u.lockedUntil && new Date(u.lockedUntil).getTime() > now)
      return { ok: false, lockedSeconds: Math.ceil((new Date(u.lockedUntil).getTime() - now) / 1000) };
    const ok = (await sha256(`${u.salt}:${i.code}`)) === u.codeHash;
    if (!ok) {
      const fails = (u.failedAttempts || 0) + 1;
      const lock = fails >= 4;
      await exec(db, 'UPDATE chatUsers SET failedAttempts=?, lockedUntil=? WHERE id=?',
        lock ? 0 : fails, lock ? new Date(now + 60000).toISOString() : null, u.id);
      return { ok: false, lockedSeconds: lock ? 60 : 0 };
    }
    const wasBusy = u.presence === 'away' && !!u.lastPanicAt;
    await exec(db,
      `UPDATE chatUsers SET failedAttempts=0, lockedUntil=NULL, presence='active', lastActive=?, lastPanicAt=NULL, backAt=? WHERE id=?`,
      NOW(), wasBusy ? NOW() : (u.backAt ?? null), u.id);
    await exec(db, 'UPDATE panicEvents SET clearedAt=? WHERE uid=? AND clearedAt IS NULL', NOW(), u.uid);
    return { ok: true, lockedSeconds: 0 };
  },

  async panic(db, i) {
    const u = await requireUser(db, i.token);
    if (u.presence === 'away' && u.lastPanicAt) return { ok: true };
    await db.batch([
      db.prepare(`UPDATE chatUsers SET presence='away', lastPanicAt=?, typingUntil=NULL, typingChat=NULL WHERE id=?`).bind(NOW(), u.id),
      db.prepare('INSERT INTO panicEvents (id,uid,createdAt) VALUES (?,?,?)').bind(uuid(), u.uid, NOW()),
    ]);
    return { ok: true };
  },

  async updateProfile(db, i) {
    const me = await requireUser(db, i.token);
    const sets: string[] = [];
    const vals: any[] = [];
    if (i.displayName !== undefined) { sets.push('displayName=?'); vals.push(cleanText(i.displayName, 40) || 'Me'); }
    if (i.hideStatus !== undefined) {
      sets.push('hideStatus=?'); vals.push(i.hideStatus ? 1 : 0);
      if (i.hideStatus) sets.push('typingChat=NULL', 'typingUntil=NULL');
    }
    if (i.newCode !== undefined) {
      if (!/^\d{2}$/.test(i.newCode)) return { ok: false, message: 'Use two digits' };
      if ((await sha256(`${me.salt}:${i.currentCode || ''}`)) !== me.codeHash) return { ok: false, message: 'Current number is incorrect' };
      sets.push('codeHash=?'); vals.push(await sha256(`${me.salt}:${i.newCode}`));
    }
    if (sets.length) await exec(db, `UPDATE chatUsers SET ${sets.join(',')} WHERE id=?`, ...vals, me.id);
    return { ok: true, message: 'Saved' };
  },

  async chatHome(db, i) {
    const me = await requireUser(db, i.token);
    const uid = me.uid;
    await exec(db, 'UPDATE chatUsers SET lastActive=? WHERE id=?', NOW(), me.id);
    const ps = await myPartnerships(db, uid);
    const others = [...new Set(ps.map((p) => otherUid(p, uid)))];
    const users = others.length ? await rows(db, `SELECT * FROM chatUsers WHERE uid IN (${ph(others.length)})`, ...others) : [];
    const byUid = new Map(users.map((u) => [u.uid, u]));
    const nameOf = (u: string) => byUid.get(u)?.displayName || 'Me';

    const accepted = ps.filter((p) => p.status === 'accepted');
    const ids = accepted.map((p) => p.id);
    const stats = new Map<string, any>();
    if (ids.length) {
      const [last, unread] = await Promise.all([
        rows(db,
          `SELECT * FROM (SELECT chatId,text,senderUid,status,deleted,createdAt, ROW_NUMBER() OVER (PARTITION BY chatId ORDER BY createdAt DESC) rn
            FROM messages WHERE chatId IN (${ph(ids.length)}) AND COALESCE(hiddenFor,'') NOT LIKE ?) WHERE rn=1`, ...ids, `%${uid}%`),
        rows(db,
          `SELECT chatId, COUNT(*) n FROM messages WHERE chatId IN (${ph(ids.length)}) AND senderUid <> ?
            AND COALESCE(status,'')<>'seen' AND COALESCE(deleted,0)=0 GROUP BY chatId`, ...ids, uid),
      ]);
      const unreadMap = new Map(unread.map((r) => [r.chatId, Number(r.n)]));
      for (const id of ids) stats.set(id, { lastText: null, lastAt: null, lastFromMe: false, lastStatus: null, unread: unreadMap.get(id) || 0 });
      for (const r of last) {
        const s = stats.get(r.chatId);
        s.lastText = r.deleted ? 'This message was deleted' : String(r.text ?? '');
        s.lastAt = r.createdAt || null;
        s.lastFromMe = r.senderUid === uid;
        s.lastStatus = r.status || null;
      }
      await exec(db, `UPDATE messages SET status='delivered' WHERE chatId IN (${ph(ids.length)}) AND status='sent' AND senderUid<>?`, ...ids, uid);
    }
    const pend = (status: string, mine: boolean) => ps
      .filter((p) => p.status === status && (status === 'pending' ? (p.requestedBy === uid) === mine : p.blockedBy === uid))
      .map((p) => ({ id: p.id, uid: otherUid(p, uid), name: nameOf(otherUid(p, uid)) }));
    return {
      me: { uid, name: me.displayName || 'Me', hideStatus: !!me.hideStatus },
      chats: accepted.map((p) => {
        const o = otherUid(p, uid);
        return { chatId: p.id, partner: { uid: o, name: nameOf(o) }, status: statusOf(byUid.get(o)), muted: listHas(p.mutedBy, uid), ...stats.get(p.id) };
      }).sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '')),
      incoming: pend('pending', false),
      outgoing: pend('pending', true),
      blocked: pend('blocked', true),
    };
  },

  async getMessages(db, i) {
    const me = await requireUser(db, i.token);
    const uid = me.uid;
    const chat = await requireChat(db, i.chatId, uid);
    if (chat.status !== 'accepted') throw new Error('Not available');
    const pUid = otherUid(chat, uid);
    if (i.typing !== undefined && !me.hideStatus)
      await exec(db, 'UPDATE chatUsers SET lastActive=?, typingChat=?, typingUntil=? WHERE id=?',
        NOW(), i.typing ? chat.id : null, i.typing ? new Date(Date.now() + 3000).toISOString() : null, me.id);
    else await exec(db, 'UPDATE chatUsers SET lastActive=? WHERE id=?', NOW(), me.id);

    const [partner, page] = await Promise.all([
      first(db, 'SELECT * FROM chatUsers WHERE uid=?', pUid),
      i.before
        ? rows(db, 'SELECT * FROM messages WHERE chatId=? AND createdAt < ? ORDER BY createdAt DESC LIMIT 41', chat.id, i.before)
        : rows(db, 'SELECT * FROM messages WHERE chatId=? ORDER BY createdAt DESC LIMIT 41', chat.id),
    ]);
    const hasMore = page.length > 40;
    const list = page.slice(0, 40).filter((m) => !listHas(m.hiddenFor, uid));
    const ids = list.map((m) => m.id);
    const replyIds = [...new Set(list.map((m) => m.replyToId).filter(Boolean))] as string[];
    const [reacts, replies] = await Promise.all([
      ids.length ? rows(db, `SELECT * FROM reactions WHERE messageId IN (${ph(ids.length)})`, ...ids) : Promise.resolve([]),
      replyIds.length ? rows(db, `SELECT id,text,senderUid,deleted FROM messages WHERE chatId=? AND id IN (${ph(replyIds.length)})`, chat.id, ...replyIds) : Promise.resolve([]),
    ]);
    const replyMap = new Map(replies.map((r) => [r.id, r]));
    const unseen = list.filter((m) => m.senderUid !== uid && m.status !== 'seen');
    if (unseen.length) {
      await exec(db, `UPDATE messages SET status='seen' WHERE id IN (${ph(unseen.length)})`, ...unseen.map((m) => m.id));
      unseen.forEach((m) => (m.status = 'seen'));
    }
    const messages = list.reverse().map((m) => {
      const grouped = new Map<string, { emoji: string; count: number; mine: boolean }>();
      reacts.filter((r) => r.messageId === m.id).forEach((r) => {
        const g = grouped.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
        g.count++;
        if (r.uid === uid) g.mine = true;
        grouped.set(r.emoji, g);
      });
      const rep = m.replyToId ? replyMap.get(m.replyToId) : undefined;
      return {
        id: m.id, clientId: m.clientId || null, text: m.deleted ? '' : m.text || '', fromMe: m.senderUid === uid,
        status: m.status || 'sent', deleted: !!m.deleted, createdAt: m.createdAt || NOW(),
        replyTo: rep ? { id: rep.id, text: rep.deleted ? 'This message was deleted' : rep.text || '', fromMe: rep.senderUid === uid } : null,
        reactions: [...grouped.values()],
      };
    });
    return {
      messages, hasMore,
      partner: {
        uid: pUid, name: partner?.displayName || 'Me', status: statusOf(partner, chat.id),
        busySince: partner?.presence === 'away' ? partner?.lastPanicAt || null : null, backAt: partner?.backAt || null,
      },
      muted: listHas(chat.mutedBy, uid),
    };
  },

  async sendMessage(db, i) {
    const me = await requireUser(db, i.token);
    const chat = await requireChat(db, i.chatId, me.uid);
    if (chat.status !== 'accepted') throw new Error('Not available');
    const text = cleanText(i.text);
    if (!text || !i.clientId) throw new Error('Empty');
    const dupe = await first(db, 'SELECT * FROM messages WHERE chatId=? AND clientId=?', chat.id, i.clientId);
    if (dupe) return { id: dupe.id, createdAt: dupe.createdAt, status: dupe.status || 'sent' };
    const id = uuid(), at = NOW();
    await exec(db,
      `INSERT INTO messages (id,text,chatId,senderUid,replyToId,status,deleted,clientId,createdAt) VALUES (?,?,?,?,?,'sent',0,?,?)`,
      id, text, chat.id, me.uid, i.replyToId || null, i.clientId, at);
    await exec(db, 'UPDATE chatUsers SET typingChat=NULL, typingUntil=NULL, lastActive=? WHERE id=?', at, me.id);
    return { id, createdAt: at, status: 'sent' };
  },

  async messageAction(db, i) {
    const me = await requireUser(db, i.token);
    const uid = me.uid;
    if (i.action === 'clearChat') {
      const chat = await requireChat(db, i.chatId || '', uid);
      const msgs = await rows(db, 'SELECT id, hiddenFor FROM messages WHERE chatId=?', chat.id);
      await batch(db, msgs.filter((m) => !listHas(m.hiddenFor, uid))
        .map((m) => db.prepare('UPDATE messages SET hiddenFor=? WHERE id=?').bind(listToggle(m.hiddenFor, uid, true), m.id)));
      return { ok: true };
    }
    const m = await first(db, 'SELECT * FROM messages WHERE id=?', i.messageId || '');
    if (!m) throw new Error('Not available');
    const chat = await requireChat(db, m.chatId || '', uid);
    if (chat.status !== 'accepted') throw new Error('Not available');
    if (i.action === 'react') {
      const emoji = (i.emoji || '').slice(0, 16);
      if (!emoji || m.deleted) return { ok: false };
      const mine = await rows(db, 'SELECT emoji FROM reactions WHERE messageId=? AND uid=?', m.id, uid);
      const same = mine.some((r) => r.emoji === emoji);
      await exec(db, 'DELETE FROM reactions WHERE messageId=? AND uid=?', m.id, uid);
      if (!same) await exec(db, 'INSERT INTO reactions (id,emoji,messageId,chatId,uid) VALUES (?,?,?,?,?)', uuid(), emoji, m.id, chat.id, uid);
      return { ok: true };
    }
    if (i.action === 'deleteMe') {
      await exec(db, 'UPDATE messages SET hiddenFor=? WHERE id=?', listToggle(m.hiddenFor, uid, true), m.id);
      return { ok: true };
    }
    if (m.senderUid !== uid) throw new Error('Not available');
    await exec(db, `UPDATE messages SET text='', deleted=1 WHERE id=?`, m.id);
    await exec(db, 'DELETE FROM reactions WHERE messageId=?', m.id);
    return { ok: true };
  },

  async partnerAction(db, i) {
    const me = await requireUser(db, i.token);
    const uid = me.uid;
    if (i.action === 'request') {
      const target = normUid(i.uid || '');
      const formatted = `${target.slice(0, 4)}-${target.slice(4, 8)}`;
      if (target.length !== 8) return { ok: false, message: 'User not found' };
      if (formatted === uid) return { ok: false, message: 'This is your own ID' };
      const other = await first(db, 'SELECT id FROM chatUsers WHERE uid=?', formatted);
      if (!other) return { ok: false, message: 'User not found' };
      const key = pairKey(uid, formatted);
      const ex = await first(db, 'SELECT * FROM partnerships WHERE pairKey=?', key);
      if (ex) {
        if (ex.status === 'blocked') return { ok: false, message: 'User not found' };
        if (ex.status === 'accepted') return { ok: true, message: 'Already partners' };
        if (ex.requestedBy !== uid) {
          await exec(db, `UPDATE partnerships SET status='accepted' WHERE id=?`, ex.id);
          return { ok: true, message: 'Partner added' };
        }
        return { ok: true, message: 'Request sent' };
      }
      await exec(db, `INSERT INTO partnerships (id,pairKey,userA,userB,requestedBy,status,createdAt) VALUES (?,?,?,?,?,'pending',?)`,
        uuid(), key, uid, formatted, uid, NOW());
      return { ok: true, message: 'Request sent' };
    }
    if (!i.partnershipId) throw new Error('Not available');
    const p = (await myPartnerships(db, uid)).find((x) => x.id === i.partnershipId);
    if (!p) throw new Error('Not available');
    const wipe = async () => {
      await exec(db, 'DELETE FROM reactions WHERE chatId=?', p.id);
      await exec(db, 'DELETE FROM messages WHERE chatId=?', p.id);
    };
    switch (i.action) {
      case 'accept':
        if (p.status !== 'pending' || p.requestedBy === uid) throw new Error('Not available');
        await exec(db, `UPDATE partnerships SET status='accepted' WHERE id=?`, p.id);
        return { ok: true, message: 'Partner added' };
      case 'decline':
      case 'cancel':
        if (p.status !== 'pending') throw new Error('Not available');
        await exec(db, 'DELETE FROM partnerships WHERE id=?', p.id);
        return { ok: true, message: i.action === 'decline' ? 'Request declined' : 'Request cancelled' };
      case 'remove':
        if (p.status === 'blocked') throw new Error('Not available');
        await wipe();
        await exec(db, 'DELETE FROM partnerships WHERE id=?', p.id);
        return { ok: true, message: 'Partner removed' };
      case 'block':
        await wipe();
        await exec(db, `UPDATE partnerships SET status='blocked', blockedBy=? WHERE id=?`, uid, p.id);
        return { ok: true, message: `Blocked ${otherUid(p, uid)}` };
      case 'unblock':
        if (p.status !== 'blocked' || p.blockedBy !== uid) throw new Error('Not available');
        await exec(db, 'DELETE FROM partnerships WHERE id=?', p.id);
        return { ok: true, message: 'Unblocked' };
      case 'mute':
      case 'unmute':
        await exec(db, 'UPDATE partnerships SET mutedBy=? WHERE id=?', listToggle(p.mutedBy, uid, i.action === 'mute'), p.id);
        return { ok: true, message: i.action === 'mute' ? 'Muted' : 'Unmuted' };
    }
    return { ok: false, message: 'Not available' };
  },

  async getHeadMoves(db, i) {
    const me = await requireUser(db, i.token);
    const [s, m] = await Promise.all([
      first(db, 'SELECT * FROM headMoveSettings WHERE uid=?', me.uid),
      rows(db, 'SELECT * FROM headMoves WHERE uid=?', me.uid),
    ]);
    return {
      settings: s ? {
        enabled: !!s.enabled, sensitivity: s.sensitivity ?? 2, sendInstantly: !!s.sendInstantly, partnerConsent: !!s.partnerConsent, setupDone: !!s.setupDone,
        neutral: s.neutralYaw != null ? { yaw: s.neutralYaw, pitch: s.neutralPitch ?? 0, roll: s.neutralRoll ?? 0 } : null,
        tune: s.tuneYaw ? { yaw: s.tuneYaw, pitch: s.tunePitch || 9, roll: s.tuneRoll || 10 } : null,
      } : null,
      moves: m.map((r) => ({ positionId: r.positionId || '', message: r.message || '', enabled: !!r.enabled, sensitivity: r.sensitivity ?? null })),
    };
  },

  async saveHeadMoves(db, i) {
    const me = await requireUser(db, i.token);
    const uid = me.uid;
    if (i.settings) {
      const { neutral, tune, ...rest } = i.settings;
      const d: Record<string, any> = {};
      for (const k of ['enabled', 'sensitivity', 'sendInstantly', 'partnerConsent', 'setupDone']) {
        if (rest[k] !== undefined) d[k] = typeof rest[k] === 'boolean' ? (rest[k] ? 1 : 0) : rest[k];
      }
      if (neutral) { d.neutralYaw = neutral.yaw; d.neutralPitch = neutral.pitch; d.neutralRoll = neutral.roll; }
      if (tune) { d.tuneYaw = tune.yaw; d.tunePitch = tune.pitch; d.tuneRoll = tune.roll; }
      const cols = Object.keys(d);
      await exec(db,
        `INSERT INTO headMoveSettings (id,uid${cols.map((c) => ',' + c).join('')}) VALUES (?,?${cols.map(() => ',?').join('')})
                  ON CONFLICT(uid) DO UPDATE SET uid=excluded.uid${cols.map((c) => `,${c}=excluded.${c}`).join('')}`,
        uuid(), uid, ...cols.map((c) => d[c]));
    }
    if (Array.isArray(i.moves)) {
      const stmts = [db.prepare('DELETE FROM headMoves WHERE uid=?').bind(uid)];
      for (const m of i.moves) {
        stmts.push(
          db.prepare('INSERT INTO headMoves (id,uid,positionId,message,enabled,sensitivity) VALUES (?,?,?,?,?,?)')
            .bind(uuid(), uid, cleanText(m.positionId, 40), cleanText(m.message, 200), m.enabled ? 1 : 0, m.sensitivity ?? null)
        );
      }
      await batch(db, stmts);
    }
    return { ok: true };
  },
};

export const onRequestPost = async ({ request, env, params }: any) => {
  const name = String(params.name || '');
  const fn = Object.prototype.hasOwnProperty.call(handlers, name) ? handlers[name] : null;
  if (!fn) return Response.json({ error: 'Not found' }, { status: 404 });
  try {
    const input = await request.json().catch(() => ({}));
    return Response.json(await fn(env.DB, input || {}));
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Error' }, { status: 400 });
  }
};
