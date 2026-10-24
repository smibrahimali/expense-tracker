import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

const PREDEFINED_CATEGORIES = [
  "Housing", "Food", "Transportation", "Utilities", "Health", "Shopping", 
  "Entertainment", "Education", "Personal", "Other"
];

type EditState = {
  step: 'WAIT_DATE' | 'WAIT_SELECTION' | 'WAIT_CHANGES';
  map: Record<string, string>;
  details?: Record<string, string>;
  selected?: string | null;
};

export async function POST(req: Request) {
  try {
    const { message, sessionId, userId } = await req.json();
    const cleanMsg = message.trim();
    const lowerMsg = cleanMsg.toLowerCase();
    const normalizedMsg = lowerMsg.replace(/[.!?]/g, '').trim();
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch existing draft session
    let existingDraft: { item: string | null; amount: number | null; date: string | null } = { 
      item: null, 
      amount: null, 
      date: null 
    };
    
    if (sessionId) {
      const { data } = await supabase.from('expense_drafts').select('*').eq('session_id', sessionId).single();
      if (data) existingDraft = data;
    }

    // 2. Parse internal EDIT_STATE if active
    let editState: EditState | null = null;
    let promptDraftItem = existingDraft.item;

    if (existingDraft.item && existingDraft.item.startsWith('EDIT_STATE:')) {
      try {
        editState = JSON.parse(existingDraft.item.replace('EDIT_STATE:', ''));
      } catch (e) {
        editState = null;
      }
      promptDraftItem = null;
    }

    // --- FAST-PATH 1: CANCEL / UNSELECT / ABORT ---
    const isCancel = /^(cancel|stop|nevermind|never mind|reset|exit|quit|unselect|unselect it|back)$/i.test(normalizedMsg) ||
      normalizedMsg.includes("don't want to edit") ||
      normalizedMsg.includes("dont want to edit") ||
      normalizedMsg.includes("do not want to delete");

    if (isCancel) {
      if (sessionId) {
        await supabase.from('expense_drafts').delete().eq('session_id', sessionId);
      }
      return NextResponse.json({ 
        status: 'incomplete', 
        sessionId: null, 
        message: "No problem! I've cancelled that and cleared your selection. What would you like to do next?" 
      });
    }

    // --- FAST-PATH 2: EXPLICIT START OF EDIT OR DELETE FLOW ---
    let isPureEditOrViewStart = /^(edit|edit expense|delete|delete expense|i want to edit|i want to delete|i want to edit an expense|i want to delete an expense|lets edit|show expenses|view expenses|tell me what were the expenses|what were the expenses)$/i.test(normalizedMsg);

    // FIXED: If the user says "delete" but already has an option (like A) selected, DO NOT restart the flow!
    if (isPureEditOrViewStart && normalizedMsg === 'delete' && editState?.selected) {
      isPureEditOrViewStart = false; 
    }

    if (isPureEditOrViewStart) {
      const freshState = 'EDIT_STATE:' + JSON.stringify({ step: 'WAIT_DATE', map: {}, details: {}, selected: null });
      let newSessionId = sessionId;
      if (!sessionId) {
        const { data } = await supabase.from('expense_drafts').insert([{ user_id: userId, item: freshState, date: null, amount: null }]).select('session_id').single();
        newSessionId = data?.session_id;
      } else {
        await supabase.from('expense_drafts').update({ item: freshState, date: null, amount: null }).eq('session_id', sessionId);
      }
      return NextResponse.json({ 
        status: 'incomplete', 
        sessionId: newSessionId, 
        message: "Sure! Which date's expenses would you like to view, edit, or delete? (e.g., '20 October' or 'today')" 
      });
    }

    // 3. Call Groq LLM
    const modeContext = editState 
      ? `EDIT_MODE (Step:${editState.step}, Selected:${editState.selected || 'none'}, Date:${existingDraft.date || 'none'})` 
      : `CREATE_MODE`;

    const { text } = await generateText({
      model: groq('qwen/qwen3.8-27b'), 
      maxRetries: 0, 
      maxOutputTokens: 200,
      prompt: `Today:${today}. Context:${modeContext}. UserMsg:"${cleanMsg}".
Classify intent into ONE of: "chat", "create", "edit", "delete".
Rules:
1. "delete": User wants to delete an expense. Extract edit_selection ("A"-"H").
2. "edit": User wants to view/edit expenses, OR Context is EDIT_MODE and user provides a date, option letter, or new values.
3. If user provides ONLY a date (e.g. "20 October", "yesterday"), intent="edit", extract date.
4. "chat": Greetings, feelings, or off-topic.
5. "create": User is logging a new expense. Extract item, amount, date(YYYY-MM-DD), category.
CRITICAL: Output ONLY valid JSON. All strings MUST be enclosed in double quotes. 
Example format: {"intent":"delete","item":null,"amount":null,"date":null,"category":null,"edit_selection":null,"reply":null}`
    });

    let extractedData;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found");
      
      let rawJson = jsonMatch[0];
      rawJson = rawJson.replace(/:\s*([A-Za-z]+)(,|\s*\})/g, ':"$1"$2'); 
      
      extractedData = JSON.parse(rawJson);

      for (const key in extractedData) {
        if (extractedData[key] === "null" || extractedData[key] === "NaN" || extractedData[key] === "") {
          extractedData[key] = null;
        }
      }
    } catch (parseError) {
      throw new Error(`LLM returned invalid JSON. Raw output: ${text}`);
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

    const deleteMatch = normalizedMsg.match(/\b(?:delete|remove|erase)\b(?:\s+option)?(?:\s+([A-H]))?/i);
    if (deleteMatch && editState) {
      extractedData.intent = 'delete';
      if (deleteMatch[1]) extractedData.edit_selection = deleteMatch[1].toUpperCase();
    }

    if (editState && extractedData.intent === 'create') {
      extractedData.intent = 'edit';
    }

    // --- BRANCH 1: HANDLE CHAT INTENT ---
    if (extractedData.intent === 'chat') {
      let chatReply = extractedData.reply || "Hi! Tell me what you spent to log an expense, or say 'edit expense' to modify past entries.";
      if (editState?.selected) {
        chatReply += `\n\n(Note: Option ${editState.selected} is still selected for editing. Tell me the new amount/item when ready, or say 'cancel' to stop.)`;
      }
      return NextResponse.json({ status: 'incomplete', sessionId: sessionId, message: chatReply });
    }

    // --- BRANCH 2: HANDLE DELETE INTENT ---
    if (extractedData.intent === 'delete') {
      const targetLetter = (extractedData.edit_selection || editState?.selected || '').toUpperCase();
      
      if (editState && targetLetter && editState.map[targetLetter]) {
        const targetId = editState.map[targetLetter];
        const itemDesc = editState.details?.[targetLetter] || `Option ${targetLetter}`;

        const { error: delError } = await supabase.from('expenses').delete().eq('id', targetId).eq('user_id', userId);
        if (delError) throw new Error(delError.message);

        if (sessionId) await supabase.from('expense_drafts').delete().eq('session_id', sessionId);

        return NextResponse.json({
          status: 'complete',
          sessionId: null,
          message: `🗑️ Successfully deleted ${targetLetter}: ${itemDesc}!`
        });
      }

      extractedData.intent = 'edit';
    }

    // --- BRANCH 3: HANDLE EDIT / VIEW INTENT ---
    if (extractedData.intent === 'edit') {
      const newlySelectedLetter = extractedData.edit_selection ? extractedData.edit_selection.toUpperCase() : null;
      const activeLetter = newlySelectedLetter || (editState?.selected ? editState.selected.toUpperCase() : null);

      if (editState && activeLetter && editState.map[activeLetter]) {
        const targetId = editState.map[activeLetter];
        const isDateChange = editState.step === 'WAIT_CHANGES' && extractedData.date !== null;
        const hasNewValues = extractedData.item !== null || extractedData.amount !== null || isDateChange || extractedData.category !== null;

        if (!hasNewValues) {
          editState.selected = activeLetter;
          editState.step = 'WAIT_CHANGES';
          await supabase.from('expense_drafts').update({ 
            item: 'EDIT_STATE:' + JSON.stringify(editState) 
          }).eq('session_id', sessionId);

          const desc = editState.details?.[activeLetter] || `Option ${activeLetter}`;
          return NextResponse.json({ 
            status: 'incomplete', 
            sessionId: sessionId, 
            message: `✅ Selected ${activeLetter}: ${desc}\nType your new amount or item, or simply say 'delete' or 'cancel'.` 
          });
        }

        const { data: exp } = await supabase.from('expenses').select('*').eq('id', targetId).single();
        if (!exp) throw new Error("Original expense not found.");

        const updatedItem = extractedData.item || exp.note;
        const updatedAmount = extractedData.amount !== null ? Math.round(Number(extractedData.amount) * 100) : exp.amount_minor;
        const updatedDate = isDateChange ? extractedData.date : exp.spent_on;
        const updatedCat = (extractedData.category && PREDEFINED_CATEGORIES.includes(extractedData.category)) 
          ? extractedData.category 
          : exp.category_id;

        const { error: updateError } = await supabase.from('expenses').update({
          note: updatedItem,
          amount_minor: updatedAmount,
          spent_on: updatedDate,
          category_id: updatedCat
        }).eq('id', targetId);

        if (updateError) throw new Error(updateError.message);
        if (sessionId) await supabase.from('expense_drafts').delete().eq('session_id', sessionId);

        return NextResponse.json({ 
          status: 'complete', 
          sessionId: null, 
          message: `✅ Updated option ${activeLetter}!\nIt is now: PKR ${(updatedAmount / 100).toLocaleString()} for ${updatedItem} (${updatedCat}) on ${updatedDate}.` 
        });
      }

      const targetDate = extractedData.date || existingDraft.date;
      if (!targetDate) {
        const waitDateState = 'EDIT_STATE:' + JSON.stringify({ step: 'WAIT_DATE', map: {}, details: {}, selected: null });
        let newSessionId = sessionId;
        if (!sessionId) {
          const { data } = await supabase.from('expense_drafts').insert([{ user_id: userId, item: waitDateState, date: null }]).select('session_id').single();
          newSessionId = data?.session_id;
        } else {
          await supabase.from('expense_drafts').update({ item: waitDateState, date: null }).eq('session_id', sessionId);
        }
        return NextResponse.json({ 
          status: 'incomplete', 
          sessionId: newSessionId, 
          message: "Sure! What date is the expense you want to find? (e.g., '20 October' or 'today')" 
        });
      }

      const { data: expensesList } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .eq('spent_on', targetDate)
        .order('created_at', { ascending: true });
      
      if (!expensesList || expensesList.length === 0) {
        return NextResponse.json({ 
          status: 'incomplete', 
          sessionId: sessionId, 
          message: `I couldn't find any expenses logged on ${targetDate}. Try another date, or say 'cancel' to exit.` 
        });
      }

      const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const newMap: Record<string, string> = {};
      const newDetails: Record<string, string> = {};
      
      const options = expensesList.slice(0, 8).map((exp, idx) => {
        const label = labels[idx];
        newMap[label] = exp.id;
        const formattedAmt = (exp.amount_minor / 100).toLocaleString();
        const labelTitle = `${exp.note || exp.category_id} — PKR ${formattedAmt}`;
        newDetails[label] = labelTitle;
        return `${label}) ${labelTitle}`;
      });

      const responseMsg = `📅 Expenses on ${targetDate}:\n${options.join('\n')}\nClick an option above to select it, or reply like 'Delete A'.`;

      const newStateStr = 'EDIT_STATE:' + JSON.stringify({ step: 'WAIT_SELECTION', map: newMap, details: newDetails, selected: null });
      let newSessionId = sessionId;
      if (!sessionId) {
        const { data } = await supabase.from('expense_drafts').insert([{ 
          user_id: userId, 
          item: newStateStr, 
          date: targetDate 
        }]).select('session_id').single();
        newSessionId = data?.session_id;
      } else {
        await supabase.from('expense_drafts').update({ 
          item: newStateStr, 
          date: targetDate 
        }).eq('session_id', sessionId);
      }

      return NextResponse.json({ status: 'incomplete', sessionId: newSessionId, message: responseMsg });
    }

    // --- BRANCH 4: HANDLE CREATE INTENT ---
    let mergedItem = extractedData.item || promptDraftItem;
    if (mergedItem && mergedItem.startsWith('EDIT_STATE:')) {
      mergedItem = extractedData.item;
    }

    const mergedData = {
      item: mergedItem,
      amount: extractedData.amount !== null ? extractedData.amount : existingDraft.amount,
      date: extractedData.date || existingDraft.date,
    };

    const missing = [];
    if (!mergedData.item) missing.push("what you bought");
    if (!mergedData.amount) missing.push("how much it cost");
    if (!mergedData.date) missing.push("when you bought it");

    if (missing.length > 0) {
      let newSessionId = sessionId;
      if (!sessionId) {
        const { data, error } = await supabase.from('expense_drafts').insert([{ user_id: userId, ...mergedData }]).select('session_id').single();
        if (error) throw new Error(error.message);
        newSessionId = data?.session_id;
      } else {
        await supabase.from('expense_drafts').update(mergedData).eq('session_id', sessionId);
      }
      return NextResponse.json({ status: 'incomplete', sessionId: newSessionId, message: `Got it. Just need to know ${missing.join(" and ")}?` });
    }

    const amountMinor = Math.round(Number(mergedData.amount) * 100); 
    const finalCategory = PREDEFINED_CATEGORIES.includes(extractedData.category) ? extractedData.category : 'Other';
    
    const { error: insertError } = await supabase.from('expenses').insert([{
      user_id: userId,
      note: mergedData.item,
      category_id: finalCategory,
      amount_minor: amountMinor,
      spent_on: mergedData.date,
      payment_method: 'cash'
    }]);

    if (insertError) throw new Error(insertError.message);
    if (sessionId) await supabase.from('expense_drafts').delete().eq('session_id', sessionId);

    return NextResponse.json({ 
      status: 'complete', 
      sessionId: null, 
      message: `✅ Logged successfully: PKR ${Number(mergedData.amount).toLocaleString()} for ${mergedData.item} (${finalCategory}) on ${mergedData.date}.` 
    });

  } catch (error: any) {
    console.error("API Error Detailed:", error);
    return NextResponse.json({ error: error.message || "Unknown backend error" }, { status: 500 });
  }
}