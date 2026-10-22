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

export async function POST(req: Request) {
  try {
    const { message, sessionId, userId } = await req.json();
    const today = new Date().toISOString().split('T')[0];

    let existingDraft = { item: null, amount: null, date: null };
    if (sessionId) {
      const { data } = await supabase.from('expense_drafts').select('*').eq('session_id', sessionId).single();
      if (data) existingDraft = data;
    }

    // FIXED: Added an explicit rule to handle emotional/personal queries with empathy
    const { text } = await generateText({
      model: groq('qwen/qwen3.8-27b'), 
      maxRetries: 0, 
      maxOutputTokens: 200,
      prompt: `Today:${today}.Draft(item:${existingDraft.item},amount:${existingDraft.amount},date:${existingDraft.date}).Msg:"${message}". If msg expresses sadness, stress, or personal feelings, return {"is_expense":false,"reply":"I'm really sorry to hear you're feeling that way. Take your time, and I'll be right here whenever you need to log an expense."}. If msg is a greeting, return {"is_expense":false,"reply":"Hello! Ready to log an expense?"}. If msg is an agreement (yes, ok, sure), return {"is_expense":false,"reply":"Great! What did you buy and how much was it?"}. If msg is purely off-topic, return {"is_expense":false,"reply":"🤖 I am strictly an expense logging bot and can only help with finances."}. If msg shows intent to log, has financial info, OR is a time expression, return {"is_expense":true,"item":string|null,"amount":number|null,"date":string|null,"category":string|null}. CRITICAL: Leave date as null UNLESS explicitly mentioned. Categories: ${PREDEFINED_CATEGORIES.join(',')}. Output ONLY valid JSON.`
    });

    let extractedData;
    try {
      const cleanJson = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      extractedData = JSON.parse(cleanJson);
    } catch (parseError) {
      throw new Error(`LLM returned invalid JSON. Raw output: ${text}`);
    }

    if (extractedData.is_expense === false) {
      return NextResponse.json({ 
        status: 'incomplete', 
        sessionId: sessionId, 
        message: extractedData.reply || "🤖 I am strictly an expense logging bot. I am not designed to answer other queries or chat." 
      });
    }

    const mergedData = {
      item: extractedData.item || existingDraft.item,
      amount: extractedData.amount || existingDraft.amount,
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

    const amountMinor = Math.round(mergedData.amount! * 100); 
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

    if (sessionId) {
      await supabase.from('expense_drafts').delete().eq('session_id', sessionId);
    }

    return NextResponse.json({ 
      status: 'complete', 
      sessionId: null, 
      message: `✅ Logged successfully: PKR ${mergedData.amount} for ${mergedData.item} (${finalCategory}) on ${mergedData.date}.` 
    });

  } catch (error: any) {
    console.error("API Error Detailed:", error);
    return NextResponse.json({ error: error.message || "Unknown backend error" }, { status: 500 });
  }
}