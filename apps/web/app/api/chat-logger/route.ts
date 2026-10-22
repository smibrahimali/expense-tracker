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

    // --- FAST-PATH 1: DETERMINISTIC CANCEL / UNSELECT / ABORT ---
    const isCancel = /^(cancel|stop|nevermind|never mind|reset|exit|quit|unselect|unselect it|back)$/i.test(lowerMsg) ||
      lowerMsg.includes("don't want to edit") ||
      lowerMsg.includes("dont want to edit") ||
      lowerMsg.includes("do not want to edit") ||
      lowerMsg.includes("don't want to log") ||
      lowerMsg.includes("dont want to log");

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

    // --- FAST-PATH 2: EXPLICIT START/RESTART OF EDIT OR VIEW FLOW ---
    const isPureEditOrViewStart = /^(edit|edit expense|edit an expense|i want to edit|i want to edit an expense|i want to edit expense|lets edit|lets edit expense|let's edit expense|change expense|modify expense|show expenses|view expenses|tell me what were the expenses|what were the expenses|what did i spend)$/i.test(lowerMsg);

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
        message: "Sure! Which date's expenses would you like to view or edit? (e.g., '20 October', 'yesterday', or 'today')" 
      });
    }

    // 3. Call Groq LLM for Natural Language & Date/Entity Extraction
    const modeContext = editState 
      ? `EDIT_MODE (Step:${editState.step}, Selected:${editState.selected || 'none'}, Date:${existingDraft.date || 'none'})` 
      : `CREATE_MODE (Draft item:${promptDraftItem}, amount:${existingDraft.amount}, date:${existingDraft.date})`;

    const { text } = await generateText({
      model: groq('qwen/qwen3.8-27b'), 
      maxRetries: 0, 
      maxOutputTokens: 200,
      prompt: `Today:${today}. Context:${modeContext}. UserMsg:"${cleanMsg}".
Classify intent into ONE of: "chat", "create", "edit", "delete".
Rules:
1. "delete": User wants to delete/remove an expense (e.g., "delete option A", "delete A", "remove it"). Extract edit_selection ("A"-"H") if mentioned.
2. "edit": User wants to edit/view/list past expenses, OR Context starts with EDIT_MODE and user provides a date, option letter (A-H), or new item/amount/date. Extract edit_selection ("A"-"H"), item, amount, date(YYYY-MM-DD), category.
3. "chat": Greetings ("hi","hello"), feelings ("feeling low"), or off-topic questions ("weather"). Write a warm, natural 'reply':
   - If greeting: "Hi there! 👋 Tell me what you spent to log an expense, or say 'edit expense' to modify past entries."
   - If feeling low/sad/stressed: "I'm really sorry you're feeling down today. Take a breather—your well-being comes first. I'll be right here whenever you're ready."
   - If off-topic: "I can only help with tracking, viewing, or editing your expenses! Tell me what you bought or ask to edit a date."
4. "create": User is logging a new expense. Extract item (noun only), amount (number), date (YYYY-MM-DD, null unless explicitly stated), category (${PREDEFINED_CATEGORIES.join(',')}).
Output ONLY valid JSON: {"intent":"chat"|"create"|"edit"|"delete","item":string|null,"amount":number|null,"date":string|null,"category":string|null,"edit_selection":string|null,"reply":string|null}`
    });

    let extractedData;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found");
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      throw new Error(`LLM returned invalid JSON. Raw output: ${text}`);
    }

    // --- DETERMINISTIC OVERRIDES (Prevents LLM State Confusion) ---
    // Override A: Check if user explicitly typed a single letter A-H while a list is active
    if (editState && Object.keys(editState.map).length > 0 && /^[A-H]$/i.test(cleanMsg)) {
      extractedData.intent = 'edit';
      extractedData.edit_selection = cleanMsg.toUpperCase();
    }

    // Override B: Check if user asked to delete via keywords
    const deleteMatch = cleanMsg.match(/\b(?:delete|remove|erase)\b(?:\s+option)?(?:\s+([A-H]))?/i);
    if (deleteMatch && editState) {
      extractedData.intent = 'delete';
      if (deleteMatch[1]) extractedData.edit_selection = deleteMatch[1].toUpperCase();
    }

    // Override C: If we are in EDIT_MODE and user provided a date (e.g., "20 oct") or new value ("800"), NEVER let it fall into 'create'
    if (editState && extractedData.intent === 'create') {
      extractedData.intent = 'edit';
    }

    // Override D: If user asks "what were the expenses" or "show expenses" with a date
    if (/\b(what were|show|list|view)\b.*\b(expense|expenses)\b/i.test(lowerMsg)) {
      extractedData.intent = 'edit';
    }

    // --- BRANCH 1: HANDLE CHAT INTENT ---
    if (extractedData.intent === 'chat') {
      let chatReply = extractedData.reply || "Hi! Tell me what you spent to log an expense, or say 'edit expense' to modify past entries.";
      // If they were in the middle of editing an option, gently remind them without being robotic
      if (editState?.selected) {
        chatReply += `\n\n(Note: Option ${editState.selected} is still selected for editing. Tell me the new amount/item when ready, or say 'cancel' to stop.)`;
      }
      return NextResponse.json({ 
        status: 'incomplete', 
        sessionId: sessionId, 
        message: chatReply 
      });
    }

    // --- BRANCH 2: HANDLE DELETE INTENT ---
    if (extractedData.intent === 'delete') {
      const targetLetter = (extractedData.edit_selection || editState?.selected || '').toUpperCase();
      if (!editState || !targetLetter || !editState.map[targetLetter]) {
        return NextResponse.json({
          status: 'incomplete',
          sessionId: sessionId,
          message: "Which expense would you like to delete? Please tell me the date first (e.g., 'edit 20 October') and then pick an option A–H to delete."
        });
      }

      const targetId = editState.map[targetLetter];
      const itemDesc = editState.details?.[targetLetter] || `Option ${targetLetter}`;

      const { error: delError } = await supabase.from('expenses').delete().eq('id', targetId).eq('user_id', userId);
      if (delError) throw new Error(delError.message);

      if (sessionId) await supabase.from('expense_drafts').delete().eq('session_id', sessionId);

      return NextResponse.json({
        status: 'complete',
        sessionId: null,
        message: `🗑️ Successfully deleted ${targetLetter}) ${itemDesc}!`
      });
    }

    // --- BRANCH 3: HANDLE EDIT / VIEW INTENT ---
    if (extractedData.intent === 'edit') {
      const newlySelectedLetter = extractedData.edit_selection ? extractedData.edit_selection.toUpperCase() : null;
      const activeLetter = newlySelectedLetter || (editState?.selected ? editState.selected.toUpperCase() : null);

      // Case A: User has a valid option letter (A-H) from the active map
      if (editState && activeLetter && editState.map[activeLetter]) {
        const targetId = editState.map[activeLetter];
        // Only count date as a "new value" if we were ALREADY in WAIT_CHANGES (so the lookup date isn't mistaken for a change)
        const isDateChange = editState.step === 'WAIT_CHANGES' && extractedData.date !== null;
        const hasNewValues = extractedData.item !== null || extractedData.amount !== null || isDateChange || extractedData.category !== null;

        // If they just clicked/typed "A" (or haven't provided new values yet)
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
            message: `Got it, **${activeLetter}) ${desc}** selected!\nWhat would you like to change its item, amount, or date to?\n(e.g., '800', 'burger for 600', 'delete', or 'cancel')` 
          });
        }

        // They provided new values! Update the expense in Supabase
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

      // Case B: Need a date to fetch the expenses list
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
          message: "Sure! What date is the expense you want to view or edit? (e.g., '20 October' or 'yesterday')" 
        });
      }

      // Case C: We have a date! Fetch expenses for that date and build the A-H clickable list
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
          message: `I couldn't find any expenses logged on ${targetDate}. Try another date (e.g., '20 October'), or say 'cancel' to exit.` 
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

      const responseMsg = `📅 Expenses on ${targetDate}:\n${options.join('\n')}\nClick an option above to select it, or reply like 'Change A to 600' or 'Delete A'.`;

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