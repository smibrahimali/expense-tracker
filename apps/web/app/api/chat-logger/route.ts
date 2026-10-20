import { groq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize a server-side Supabase client
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

    // 1. Fetch any existing draft for this session
    let existingDraft = { item: null, amount: null, date: null };
    if (sessionId) {
      const { data } = await supabase.from('expense_drafts').select('*').eq('session_id', sessionId).single();
      if (data) existingDraft = data;
    }

    // 2. Call Groq using Qwen with zero retries and optimized token footprint
    const { text } = await generateText({
      model: groq('qwen/qwen3.8-27b'), 
      maxRetries: 0, // Prevents retry loops from accumulating token limits
      // @ts-ignore
      maxTokens: 120, 
      prompt: `Today:${today}. Draft(item:${existingDraft.item || 'null'},amount:${existingDraft.amount || 'null'},date:${existingDraft.date || 'null'}). Msg:"${message}". Extract item, amount, date(YYYY-MM-DD), category(${PREDEFINED_CATEGORIES.join(',')}). Output ONLY JSON: {"item":string|null,"amount":number|null,"date":string|null,"category":string|null}`
    });

    // 3. Catch JSON Parsing Errors
    let extractedData;
    try {
      const cleanJson = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      extractedData = JSON.parse(cleanJson);
    } catch (parseError) {
      throw new Error(`LLM returned invalid JSON. Raw output: ${text}`);
    }

    // 4. Merge the newly extracted data with the existing draft
    const mergedData = {
      item: extractedData.item || existingDraft.item,
      amount: extractedData.amount || existingDraft.amount,
      date: extractedData.date || existingDraft.date,
    };

    // 5. Check for missing fields
    const missing = [];
    if (!mergedData.item) missing.push("what you bought");
    if (!mergedData.amount) missing.push("how much it cost");
    if (!mergedData.date) missing.push("when you bought it");

    // 6. Logic Branch: Ask for more info OR save to database
    if (missing.length > 0) {
      let newSessionId = sessionId;
      if (!sessionId) {
        const { data, error: draftError } = await supabase.from('expense_drafts').insert([{
          user_id: userId,
          ...mergedData
        }]).select('session_id').single();
        
        if (draftError) throw new Error(`Supabase Draft Insert Failed: ${draftError.message}`);
        newSessionId = data?.session_id;
      } else {
        const { error: draftUpdateError } = await supabase.from('expense_drafts').update(mergedData).eq('session_id', sessionId);
        if (draftUpdateError) throw new Error(`Supabase Draft Update Failed: ${draftUpdateError.message}`);
      }

      const followUpMsg = `Got it. Just need to know ${missing.join(" and ")}?`;
      return NextResponse.json({ status: 'incomplete', sessionId: newSessionId, message: followUpMsg });
    }

    // 7. All fields present! Finalize and explicitly apply the smart category
    const amountMinor = Math.round(mergedData.amount! * 100); 
    const finalCategory = PREDEFINED_CATEGORIES.includes(extractedData.category) 
      ? extractedData.category 
      : 'Other';
    
    const { error: insertError } = await supabase.from('expenses').insert([{
      user_id: userId,
      note: mergedData.item,
      category_id: finalCategory, 
      amount_minor: amountMinor,
      spent_on: mergedData.date,
      payment_method: 'cash'
    }]);

    if (insertError) throw new Error(`Supabase Final Insert Failed: ${insertError.message}`);

    // Clean up the draft session
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