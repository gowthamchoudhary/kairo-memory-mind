import { supabase } from "@/integrations/supabase/client";

const USER_ID = "gowtham";

export async function sendChat(message: string): Promise<{ text: string; audio?: string }> {
  const { data, error } = await supabase.functions.invoke("kiro-chat", {
    body: { userId: USER_ID, message },
  });
  if (error) throw error;
  return data;
}

export async function getGreeting(): Promise<{ text: string; audio?: string }> {
  const { data, error } = await supabase.functions.invoke("kiro-greeting", {
    body: { userId: USER_ID },
  });
  if (error) throw error;
  return data;
}

export async function logMemory(type: string, value: string): Promise<void> {
  const { error } = await supabase.functions.invoke("kiro-log", {
    body: { userId: USER_ID, type, value, timestamp: new Date().toISOString() },
  });
  if (error) throw error;
}
