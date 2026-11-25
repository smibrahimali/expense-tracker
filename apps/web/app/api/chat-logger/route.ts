import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createServerSupabase } from '../../../utils/supabase/server';
import { PREDEFINED_CATEGORIES } from '../../../utils/categories';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type EditStep = 'WAIT_DATE' | 'WAIT_SELECTION' | 'WAIT_CHANGES' | 'WAIT_DELETE_CONFIRM';

type EditState = {
  step: EditStep;
  map: Record<string, string>;
  details?: Record<string, string>;
  selected?: string | null;
  pendingDelete?: string | null;
};

const LlmSchema = z.object({
  intent: z.enum(['chat', 'create', 'edit', 'delete']).catch('chat'),
  item: z.union([z.string(), z.null()]).optional().nullable(),
  amount: z.union([z.number(), z.string(), z.null()]).optional().nullable(),
  date: z.union([z.string(), z.null()]).optional().nullable(),
  category: z.union([z.string(), z.null()]).optional().nullable(),
  edit_selection: z.union([z.string(), z.null()]).optional().nullable(),
  reply: z.union([z.string(), z.null()]).optional().nullable(),
});

type Extracted = {
  intent: 'chat' | 'create' | 'edit' | 'delete';
  item: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  edit_selection: string | null;
  reply: string | null;
};

function clientError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isValidCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parseAmountMajor(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return Math.round(raw * 100) / 100;
  }
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) return null;
  return n;
}

function toMinor(amountMajor: number): number {
  const [whole, frac = ''] = amountMajor.toFixed(2).split('.');
  return parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0').slice(0, 2), 10);
}

function normalizeSelection(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().toUpperCase().match(/^([A-H])(?:\)|$)/);
  return m ? m[1] : null;
}

function normalizeCategory(raw: string | null, userCats: string[]): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  const fromUser = userCats.find((c) => c.toLowerCase() === lower);
  if (fromUser) return fromUser;
  const fromPre = (PREDEFINED_CATEGORIES as readonly string[]).find(
    (c) => c.toLowerCase() === lower
  );
  return fromPre ?? null;
}

function looksDateOnly(msg: string): boolean {
  return /^(today|yesterday|tomorrow|\d{1,2}([\/\-]\d{1,2})?([\/\-]\d{2,4})?|\d{4}-\d{2}-\d{2}|(\d{1,2}\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*(\s+\d{2,4})?)$/i.test(
    msg
  );
}

function explicitDateChange(msg: string): boolean {
  return /\b(change|set|update|move)\s+(the\s+)?date\b|\bdate\s+to\b/i.test(msg);
}

function parseLlmJson(text: string): Extracted {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('PARSE');
  let raw = jsonMatch[0];
  // Only quote bare intent-like tokens outside strings is too risky; try parse first.
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    raw = raw.replace(/:\s*(chat|create|edit|delete)(,|\s*\})/gi, ':"$1"$2');
    parsed = JSON.parse(raw);
  }
  const data = LlmSchema.parse(parsed);
  const amount = parseAmountMajor(data.amount ?? null);
  const dateRaw = typeof data.date === 'string' ? data.date.trim() : null;
  const date = dateRaw && isValidCalendarDate(dateRaw) ? dateRaw : null;
  const item =
    typeof data.item === 'string' && data.item.trim() && !data.item.startsWith('EDIT_STATE:')
      ? data.item.trim().slice(0, 140)
      : null;

  return {
    intent: data.intent,
    item,
    amount,
    date,
    category: typeof data.category === 'string' ? data.category.trim() : null,
    edit_selection: normalizeSelection(data.edit_selection ?? null),
    reply: typeof data.reply === 'string' ? data.reply : null,
  };
}

async function loadUserCategories(userId: string): Promise<string[]> {
  const { data } = await supabase.from('categories').select('name').eq('user_id', userId);
  return (data || []).map((r) => r.name).filter(Boolean);
}

async function verifyExpenseOwned(userId: string, expenseId: string): Promise<boolean> {
  if (!UUID_RE.test(expenseId)) return false;
  const { data } = await supabase
    .from('expenses')
    .select('id')
    .eq('id', expenseId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

async function sanitizeEditState(
  userId: string,
  state: EditState | null
): Promise<EditState | null> {
  if (!state) return null;
  const map: Record<string, string> = {};
  const details: Record<string, string> = { ...(state.details || {}) };
  for (const [letter, id] of Object.entries(state.map || {})) {
    if (await verifyExpenseOwned(userId, id)) map[letter] = id;
    else delete details[letter];
  }
  const selected =
    state.selected && map[state.selected.toUpperCase()] ? state.selected.toUpperCase() : null;
  const pendingDelete =
    state.pendingDelete && map[state.pendingDelete.toUpperCase()]
      ? state.pendingDelete.toUpperCase()
      : null;
  return {
    ...state,
    map,
    details,
    selected,
    pendingDelete,
  };
}

export async function POST(req: Request) {
  try {
    const authClient = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    let body: { message?: unknown; sessionId?: unknown; localDate?: unknown };
    try {
      body = await req.json();
    } catch {
      return clientError('Invalid JSON body');
    }

    if (!body.message || typeof body.message !== 'string') {
      return clientError('Message is required');
    }

    const cleanMsg = body.message.trim().slice(0, 500);
    if (!cleanMsg) return clientError('Message is required');

    const lowerMsg = cleanMsg.toLowerCase();
    const normalizedMsg = lowerMsg.replace(/[’']/g, "'").replace(/[.!?]/g, '').trim();

    const localDate =
      typeof body.localDate === 'string' && isValidCalendarDate(body.localDate)
        ? body.localDate
        : null;
    const today =
      localDate ||
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

    let sessionId =
      typeof body.sessionId === 'string' && UUID_RE.test(body.sessionId) ? body.sessionId : null;

    // 1. Load draft (scoped)
    let existingDraft: {
      item: string | null;
      amount: number | null;
      date: string | null;
    } = { item: null, amount: null, date: null };

    if (sessionId) {
      const { data, error } = await supabase
        .from('expense_drafts')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error('draft load', error);
        return NextResponse.json({ error: 'Could not load session' }, { status: 503 });
      }
      if (!data) {
        return NextResponse.json({
          status: 'incomplete',
          sessionId: null,
          message:
            "That chat session expired. Start again — tell me what you spent, or say 'edit expense'.",
        });
      }
      existingDraft = {
        item: data.item,
        amount: data.amount,
        date: data.date,
      };
    }

    let editState: EditState | null = null;
    let promptDraftItem = existingDraft.item;
    const isCreateDraft =
      !!existingDraft.item && !String(existingDraft.item).startsWith('EDIT_STATE:');

    if (existingDraft.item && String(existingDraft.item).startsWith('EDIT_STATE:')) {
      try {
        editState = JSON.parse(String(existingDraft.item).replace('EDIT_STATE:', ''));
      } catch {
        editState = null;
      }
      promptDraftItem = null;
      editState = await sanitizeEditState(userId, editState);
    }

    const userCats = await loadUserCategories(userId);

    // --- FAST-PATH: CANCEL ---
    const isCancel =
      /^(cancel|stop|nevermind|never mind|reset|exit|quit|unselect|unselect it|back|no)$/i.test(
        normalizedMsg
      ) ||
      normalizedMsg.includes("don't want to edit") ||
      normalizedMsg.includes('dont want to edit') ||
      normalizedMsg.includes('do not want to delete');

    if (isCancel) {
      if (sessionId) {
        await supabase
          .from('expense_drafts')
          .delete()
          .eq('session_id', sessionId)
          .eq('user_id', userId);
      }
      return NextResponse.json({
        status: 'incomplete',
        sessionId: null,
        message:
          "No problem! I've cancelled that and cleared your selection. What would you like to do next?",
      });
    }

    // --- FAST-PATH: delete confirm yes/no ---
    if (editState?.step === 'WAIT_DELETE_CONFIRM' && editState.pendingDelete) {
      const letter = editState.pendingDelete;
      const isYes = /^(yes|y|confirm|ok|okay|sure|do it|delete)$/i.test(normalizedMsg);
      const isNo = /^(no|n|cancel|stop|nevermind|never mind)$/i.test(normalizedMsg);
      if (isNo) {
        editState.step = 'WAIT_CHANGES';
        editState.pendingDelete = null;
        editState.selected = letter;
        if (sessionId) {
          await supabase
            .from('expense_drafts')
            .update({ item: 'EDIT_STATE:' + JSON.stringify(editState), amount: null })
            .eq('session_id', sessionId)
            .eq('user_id', userId);
        }
        return NextResponse.json({
          status: 'incomplete',
          sessionId,
          message: `Okay, kept ${letter}. Change amount/item, or say 'delete' / 'cancel'.`,
        });
      }
      if (isYes) {
        const targetId = editState.map[letter];
        const itemDesc = editState.details?.[letter] || `Option ${letter}`;
        if (!targetId || !(await verifyExpenseOwned(userId, targetId))) {
          return NextResponse.json({
            status: 'incomplete',
            sessionId: null,
            message: 'That expense is no longer available. Say cancel and try again.',
          });
        }
        const { data: deleted, error: delError } = await supabase
          .from('expenses')
          .delete()
          .eq('id', targetId)
          .eq('user_id', userId)
          .select('id');
        if (delError) {
          console.error(delError);
          return NextResponse.json({ error: 'Could not delete expense' }, { status: 500 });
        }
        if (!deleted?.length) {
          return NextResponse.json({
            status: 'incomplete',
            sessionId: null,
            message: 'Nothing was deleted (already gone).',
          });
        }
        if (sessionId) {
          await supabase
            .from('expense_drafts')
            .delete()
            .eq('session_id', sessionId)
            .eq('user_id', userId);
        }
        return NextResponse.json({
          status: 'complete',
          sessionId: null,
          message: `🗑️ Successfully deleted ${letter}: ${itemDesc}!`,
        });
      }
    }

    // --- FAST-PATH: start edit/view ---
    let isPureEditOrViewStart =
      /^(edit|edit expense|delete|delete expense|i want to edit|i want to delete|i want to edit an expense|i want to delete an expense|lets edit|show expenses|view expenses|tell me what were the expenses|what were the expenses)$/i.test(
        normalizedMsg
      );

    if (
      isPureEditOrViewStart &&
      /^(delete|delete expense)$/i.test(normalizedMsg) &&
      editState?.selected
    ) {
      isPureEditOrViewStart = false;
    }

    if (isPureEditOrViewStart) {
      const freshState =
        'EDIT_STATE:' +
        JSON.stringify({
          step: 'WAIT_DATE',
          map: {},
          details: {},
          selected: null,
          pendingDelete: null,
        });
      let newSessionId = sessionId;
      if (!sessionId) {
        const { data, error } = await supabase
          .from('expense_drafts')
          .insert([{ user_id: userId, item: freshState, date: null, amount: null }])
          .select('session_id')
          .single();
        if (error) {
          console.error(error);
          return NextResponse.json({ error: 'Could not start session' }, { status: 500 });
        }
        newSessionId = data?.session_id;
      } else {
        await supabase
          .from('expense_drafts')
          .update({ item: freshState, date: null, amount: null })
          .eq('session_id', sessionId)
          .eq('user_id', userId);
      }
      return NextResponse.json({
        status: 'incomplete',
        sessionId: newSessionId,
        message:
          "Sure! Which date's expenses would you like to view, edit, or delete? (e.g., '20 October' or 'today')",
      });
    }

    // Create draft: date-only merge before LLM when only date missing
    if (
      isCreateDraft &&
      existingDraft.item &&
      existingDraft.amount &&
      !existingDraft.date &&
      looksDateOnly(normalizedMsg)
    ) {
      // Fall through to LLM for date resolution, but force create intent after parse
    }

    const createDraftHint = isCreateDraft
      ? ` PendingCreate:{item:${JSON.stringify(promptDraftItem)},amount:${existingDraft.amount},date:${existingDraft.date}}`
      : '';

    const modeContext = editState
      ? `EDIT_MODE (Step:${editState.step}, Selected:${editState.selected || 'none'}, Date:${existingDraft.date || 'none'})`
      : `CREATE_MODE${createDraftHint}`;

    let text: string;
    try {
      const result = await generateText({
        model: groq('qwen/qwen3.8-27b'),
        maxRetries: 2,
        maxOutputTokens: 400,
        abortSignal: AbortSignal.timeout(25000),
        prompt: `Today:${today}. Context:${modeContext}. UserMsg:${JSON.stringify(cleanMsg)}.
Classify intent into ONE of: "chat", "create", "edit", "delete".
Rules:
1. "delete": User clearly wants to delete. Extract edit_selection ("A"-"H") if given.
2. "edit": View/edit expenses, OR EDIT_MODE with a date/option/new values. Date change ONLY if user says "change date to…" / "set date…".
3. If CREATE_MODE has PendingCreate missing only date, and user gives a date, intent="create" with that date (YYYY-MM-DD).
4. If user provides ONLY a date with no PendingCreate and not clearly creating, intent="edit".
5. "chat": greetings/off-topic.
6. "create": logging a new expense. Extract item, amount (number), date(YYYY-MM-DD), category.
CRITICAL: Output ONLY valid JSON with double-quoted strings.
Example: {"intent":"create","item":"Lunch","amount":500,"date":"${today}","category":"Food","edit_selection":null,"reply":null}`,
      });
      text = result.text;
    } catch (err) {
      console.error('LLM error', err);
      return NextResponse.json(
        { error: 'AI service temporarily unavailable. Try again.' },
        { status: 503 }
      );
    }

    let extractedData: Extracted;
    try {
      extractedData = parseLlmJson(text);
    } catch {
      return NextResponse.json(
        { error: 'Could not understand that. Try a shorter message.' },
        { status: 502 }
      );
    }

    // --- DETERMINISTIC OVERRIDES ---
    if (editState && Object.keys(editState.map).length > 0 && /^[A-H]$/i.test(normalizedMsg)) {
      extractedData.intent = 'edit';
      extractedData.edit_selection = normalizedMsg.toUpperCase();
      extractedData.item = null;
      extractedData.amount = null;
      extractedData.date = null;
      extractedData.category = null;
    }

    // Exact delete commands only (C1)
    const deleteMatch = normalizedMsg.match(
      /^(?:delete|remove|erase)(?:\s+(?:option\s+)?([A-H]))?$/i
    );
    const hasEditFields =
      extractedData.item !== null ||
      extractedData.amount !== null ||
      (extractedData.date !== null && explicitDateChange(normalizedMsg)) ||
      extractedData.category !== null;

    if (deleteMatch && editState && !hasEditFields) {
      extractedData.intent = 'delete';
      if (deleteMatch[1]) extractedData.edit_selection = deleteMatch[1].toUpperCase();
    }

    // H2: do not coerce create→edit; disambiguate
    if (editState && extractedData.intent === 'create') {
      return NextResponse.json({
        status: 'incomplete',
        sessionId,
        message: editState.selected
          ? `You're editing option ${editState.selected}. Say "cancel" to log a new expense instead, or tell me the new amount/item for this one.`
          : `You're in edit mode. Say "cancel" to leave edit mode and log a new expense, or pick a date/option to continue editing.`,
      });
    }

    // H3 assist: create draft missing only date + date-only message
    if (
      isCreateDraft &&
      existingDraft.item &&
      existingDraft.amount &&
      !existingDraft.date &&
      (extractedData.date || looksDateOnly(normalizedMsg))
    ) {
      extractedData.intent = 'create';
      if (!extractedData.date && looksDateOnly(normalizedMsg)) {
        // leave date for LLM; if still null and msg is today/yesterday, map simply
        if (/^today$/i.test(normalizedMsg)) extractedData.date = today;
        if (/^yesterday$/i.test(normalizedMsg)) {
          const d = new Date(today + 'T12:00:00');
          d.setDate(d.getDate() - 1);
          extractedData.date = d.toISOString().slice(0, 10);
        }
      }
    }

    // --- CHAT ---
    if (extractedData.intent === 'chat') {
      let chatReply =
        extractedData.reply ||
        "Hi! Tell me what you spent to log an expense, or say 'edit expense' to modify past entries.";
      if (editState?.selected) {
        chatReply += `\n\n(Note: Option ${editState.selected} is still selected. Tell me the new amount/item, or say 'cancel'.)`;
      }
      return NextResponse.json({
        status: 'incomplete',
        sessionId,
        message: chatReply,
      });
    }

    // --- DELETE (confirm first) ---
    if (extractedData.intent === 'delete') {
      const targetLetter = (
        extractedData.edit_selection ||
        editState?.selected ||
        ''
      ).toUpperCase();

      if (editState && targetLetter && editState.map[targetLetter]) {
        editState.step = 'WAIT_DELETE_CONFIRM';
        editState.pendingDelete = targetLetter;
        editState.selected = targetLetter;
        const itemDesc = editState.details?.[targetLetter] || `Option ${targetLetter}`;
        if (sessionId) {
          await supabase
            .from('expense_drafts')
            .update({
              item: 'EDIT_STATE:' + JSON.stringify(editState),
              amount: null,
            })
            .eq('session_id', sessionId)
            .eq('user_id', userId);
        }
        return NextResponse.json({
          status: 'incomplete',
          sessionId,
          message: `Delete ${targetLetter}: ${itemDesc}?\nReply "yes" to confirm or "no" to keep it.`,
        });
      }
      extractedData.intent = 'edit';
    }

    // --- EDIT / VIEW ---
    if (extractedData.intent === 'edit') {
      const newlySelectedLetter = extractedData.edit_selection;
      const activeLetter =
        newlySelectedLetter ||
        (editState?.selected ? editState.selected.toUpperCase() : null);

      if (editState && activeLetter && editState.map[activeLetter]) {
        const targetId = editState.map[activeLetter];
        if (!(await verifyExpenseOwned(userId, targetId))) {
          return NextResponse.json({
            status: 'incomplete',
            sessionId: null,
            message: 'That expense is no longer available. Say cancel and try again.',
          });
        }

        const wantsDateChange =
          editState.step === 'WAIT_CHANGES' &&
          extractedData.date !== null &&
          explicitDateChange(normalizedMsg);

        const hasNewValues =
          extractedData.item !== null ||
          extractedData.amount !== null ||
          wantsDateChange ||
          extractedData.category !== null;

        // Date-only without explicit change → treat as view that date
        if (
          editState.step === 'WAIT_CHANGES' &&
          extractedData.date &&
          !wantsDateChange &&
          !hasNewValues
        ) {
          // fall through to list-by-date below by clearing selection path
        } else if (!hasNewValues) {
          editState.selected = activeLetter;
          editState.step = 'WAIT_CHANGES';
          editState.pendingDelete = null;
          await supabase
            .from('expense_drafts')
            .update({
              item: 'EDIT_STATE:' + JSON.stringify(editState),
              amount: null,
            })
            .eq('session_id', sessionId!)
            .eq('user_id', userId);

          const desc = editState.details?.[activeLetter] || `Option ${activeLetter}`;
          return NextResponse.json({
            status: 'incomplete',
            sessionId,
            message: `✅ Selected ${activeLetter}: ${desc}\nType your new amount or item, say 'delete', or 'cancel'.`,
          });
        } else if (hasNewValues) {
          const { data: exp, error: expErr } = await supabase
            .from('expenses')
            .select('*')
            .eq('id', targetId)
            .eq('user_id', userId)
            .maybeSingle();
          if (expErr || !exp) {
            return NextResponse.json({
              status: 'incomplete',
              sessionId: null,
              message: 'Original expense not found.',
            });
          }

          const cat = normalizeCategory(extractedData.category, userCats);
          const updatedItem = extractedData.item || exp.note;
          const updatedAmount =
            extractedData.amount !== null ? toMinor(extractedData.amount) : exp.amount_minor;
          const updatedDate = wantsDateChange ? extractedData.date : exp.spent_on;
          const updatedCat = cat || exp.category_id;

          if (updatedItem && String(updatedItem).length > 140) {
            return NextResponse.json({
              status: 'incomplete',
              sessionId,
              message: 'Note is too long (max 140 characters).',
            });
          }

          const { error: updateError } = await supabase
            .from('expenses')
            .update({
              note: updatedItem,
              amount_minor: updatedAmount,
              spent_on: updatedDate,
              category_id: updatedCat,
            })
            .eq('id', targetId)
            .eq('user_id', userId);

          if (updateError) {
            console.error(updateError);
            return NextResponse.json({ error: 'Could not update expense' }, { status: 500 });
          }
          if (sessionId) {
            await supabase
              .from('expense_drafts')
              .delete()
              .eq('session_id', sessionId)
              .eq('user_id', userId);
          }

          return NextResponse.json({
            status: 'complete',
            sessionId: null,
            message: `✅ Updated option ${activeLetter}!\nIt is now: PKR ${(updatedAmount / 100).toLocaleString('en-PK')} for ${updatedItem} (${updatedCat}) on ${updatedDate}.`,
          });
        }
      }

      const targetDate = extractedData.date || existingDraft.date;
      if (!targetDate || !isValidCalendarDate(String(targetDate))) {
        const waitDateState =
          'EDIT_STATE:' +
          JSON.stringify({
            step: 'WAIT_DATE',
            map: {},
            details: {},
            selected: null,
            pendingDelete: null,
          });
        let newSessionId = sessionId;
        if (!sessionId) {
          const { data, error } = await supabase
            .from('expense_drafts')
            .insert([{ user_id: userId, item: waitDateState, date: null, amount: null }])
            .select('session_id')
            .single();
          if (error) {
            console.error(error);
            return NextResponse.json({ error: 'Could not start session' }, { status: 500 });
          }
          newSessionId = data?.session_id;
        } else {
          await supabase
            .from('expense_drafts')
            .update({ item: waitDateState, date: null, amount: null })
            .eq('session_id', sessionId)
            .eq('user_id', userId);
        }
        return NextResponse.json({
          status: 'incomplete',
          sessionId: newSessionId,
          message:
            "Sure! What date is the expense you want to find? (e.g., '20 October' or 'today')",
        });
      }

      const { data: expensesList, error: listErr } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .eq('spent_on', targetDate)
        .order('created_at', { ascending: true });

      if (listErr) {
        console.error(listErr);
        return NextResponse.json({ error: 'Could not load expenses' }, { status: 500 });
      }

      if (!expensesList || expensesList.length === 0) {
        return NextResponse.json({
          status: 'incomplete',
          sessionId,
          message: `I couldn't find any expenses logged on ${targetDate}. Try another date, or say 'cancel' to exit.`,
        });
      }

      const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const newMap: Record<string, string> = {};
      const newDetails: Record<string, string> = {};
      const total = expensesList.length;
      const options = expensesList.slice(0, 8).map((exp, idx) => {
        const label = labels[idx];
        newMap[label] = exp.id;
        const formattedAmt = (exp.amount_minor / 100).toLocaleString('en-PK');
        const labelTitle = `${exp.note || exp.category_id} — PKR ${formattedAmt}`;
        newDetails[label] = labelTitle;
        return `${label}) ${labelTitle}`;
      });

      const more =
        total > 8 ? `\n(Showing 8 of ${total}. Narrow by a more specific day if needed.)` : '';
      const responseMsg = `📅 Expenses on ${targetDate}:\n${options.join('\n')}${more}\nClick an option, or reply like 'Delete A'.`;

      const newStateStr =
        'EDIT_STATE:' +
        JSON.stringify({
          step: 'WAIT_SELECTION',
          map: newMap,
          details: newDetails,
          selected: null,
          pendingDelete: null,
        });
      let newSessionId = sessionId;
      if (!sessionId) {
        const { data, error } = await supabase
          .from('expense_drafts')
          .insert([
            {
              user_id: userId,
              item: newStateStr,
              date: targetDate,
              amount: null,
            },
          ])
          .select('session_id')
          .single();
        if (error) {
          console.error(error);
          return NextResponse.json({ error: 'Could not save session' }, { status: 500 });
        }
        newSessionId = data?.session_id;
      } else {
        await supabase
          .from('expense_drafts')
          .update({ item: newStateStr, date: targetDate, amount: null })
          .eq('session_id', sessionId)
          .eq('user_id', userId);
      }

      return NextResponse.json({
        status: 'incomplete',
        sessionId: newSessionId,
        message: responseMsg,
        optionsVersion: newSessionId,
      });
    }

    // --- CREATE ---
    let mergedItem = extractedData.item || promptDraftItem;
    if (mergedItem && String(mergedItem).startsWith('EDIT_STATE:')) {
      mergedItem = extractedData.item;
    }

    const mergedData = {
      item: mergedItem,
      amount: extractedData.amount !== null ? extractedData.amount : existingDraft.amount,
      date: extractedData.date || existingDraft.date,
    };

    const missing: string[] = [];
    if (!mergedData.item) missing.push('what you bought');
    if (!mergedData.amount || Number(mergedData.amount) <= 0) missing.push('how much it cost');
    if (!mergedData.date || !isValidCalendarDate(String(mergedData.date)))
      missing.push('when you bought it');

    if (missing.length > 0) {
      let newSessionId = sessionId;
      const draftPayload = {
        item: mergedData.item,
        amount: mergedData.amount,
        date: mergedData.date && isValidCalendarDate(String(mergedData.date)) ? mergedData.date : null,
      };
      if (!sessionId) {
        const { data, error } = await supabase
          .from('expense_drafts')
          .insert([{ user_id: userId, ...draftPayload }])
          .select('session_id')
          .single();
        if (error) {
          console.error(error);
          return NextResponse.json({ error: 'Could not save draft' }, { status: 500 });
        }
        newSessionId = data?.session_id;
      } else {
        const { error } = await supabase
          .from('expense_drafts')
          .update(draftPayload)
          .eq('session_id', sessionId)
          .eq('user_id', userId);
        if (error) {
          console.error(error);
          return NextResponse.json({ error: 'Could not update draft' }, { status: 500 });
        }
      }
      return NextResponse.json({
        status: 'incomplete',
        sessionId: newSessionId,
        message: `Got it. Just need to know ${missing.join(' and ')}?`,
      });
    }

    const amountMajor = Number(mergedData.amount);
    const amountMinor = toMinor(amountMajor);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      return NextResponse.json({
        status: 'incomplete',
        sessionId,
        message: 'That amount looks invalid. Enter a positive amount (e.g. 500 or 12.50).',
      });
    }

    const finalCategory =
      normalizeCategory(extractedData.category, userCats) ||
      normalizeCategory(null, userCats) ||
      'Other';

    // Idempotency: consume draft first when present
    if (sessionId) {
      const { data: consumed, error: consumeErr } = await supabase
        .from('expense_drafts')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .select('session_id');
      if (consumeErr) {
        console.error(consumeErr);
        return NextResponse.json({ error: 'Could not finalize draft' }, { status: 500 });
      }
      if (!consumed?.length) {
        return NextResponse.json({
          status: 'incomplete',
          sessionId: null,
          message: 'That draft was already used or expired. Please send the expense again.',
        });
      }
    }

    const note = String(mergedData.item).slice(0, 140);
    const { error: insertError } = await supabase.from('expenses').insert([
      {
        user_id: userId,
        note,
        category_id: finalCategory,
        amount_minor: amountMinor,
        spent_on: mergedData.date,
        payment_method: 'cash',
      },
    ]);

    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ error: 'Could not log expense' }, { status: 500 });
    }

    return NextResponse.json({
      status: 'complete',
      sessionId: null,
      message: `✅ Logged successfully: PKR ${(amountMinor / 100).toLocaleString('en-PK')} for ${note} (${finalCategory}) on ${mergedData.date}.`,
    });
  } catch (error: unknown) {
    console.error('API Error Detailed:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
